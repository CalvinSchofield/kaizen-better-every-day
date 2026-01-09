import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getLocalDateString } from '@/lib/utils';

interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
  timeValue?: string;
  isSaturday?: boolean;
}

interface YTDLeaderboard {
  mostDoors: LeaderboardEntry | null;
  mostDecisionMakers: LeaderboardEntry | null;
  mostPitches: LeaderboardEntry | null;
  mostTransitions: LeaderboardEntry | null;
  mostPresentations: LeaderboardEntry | null;
  mostFP: LeaderboardEntry | null;
  mostPRMR: LeaderboardEntry | null;
  mostUpgradeFP: LeaderboardEntry | null;
  mostHoursWorked: LeaderboardEntry | null;
  earliestDoor: LeaderboardEntry | null;
  latestDoor: LeaderboardEntry | null;
}

export const useYTDLeaderboard = (filterByYear?: string) => {
  // Calculate date range for cache key
  const now = new Date();
  const yearStart = getLocalDateString(new Date(now.getFullYear(), 0, 1));
  const todayStr = getLocalDateString(now);

  return useQuery({
    queryKey: ['ytd-leaderboard', yearStart, todayStr, filterByYear],
    queryFn: async () => {

      // Fetch all users
      const { data: reps, error: repsError } = await supabase
        .from('reps')
        .select('user_id, name, year, timezone');

      if (repsError) {
        console.error('Error fetching reps:', repsError);
        return null;
      }

      // Create reps map for lookups
      const repsMap = new Map(reps?.map(r => [r.user_id, { name: r.name, year: r.year, timezone: r.timezone }]) || []);

      // Fetch ALL finalized entries for the year (no pre-filtering)
      const { data: entries, error: entriesError } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('is_finalized', true)
        .gte('entry_date', yearStart);

      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
        return null;
      }

      // Filter entries by year if specified
      const filteredEntries = filterByYear 
        ? entries?.filter(e => repsMap.get(e.user_id)?.year === filterByYear) || []
        : entries || [];

      // Aggregate by user
      const userStats = new Map<string, {
        doors: number;
        decisionMakers: number;
        pitches: number;
        transitions: number;
        presentations: number;
        fp: number;
        prmr: number;
        upgradePrmr: number;
        hoursWorked: number;
        earliestDoorTime: string | null;
        earliestDoorDate: string | null;
        latestDoorTime: string | null;
      }>();

      filteredEntries.forEach(entry => {
        const stats = userStats.get(entry.user_id) || {
          doors: 0,
          decisionMakers: 0,
          pitches: 0,
          transitions: 0,
          presentations: 0,
          fp: 0,
          prmr: 0,
          upgradePrmr: 0,
          hoursWorked: 0,
          earliestDoorTime: null,
          earliestDoorDate: null,
          latestDoorTime: null,
        };

        stats.doors += entry.doors_knocked || 0;
        stats.decisionMakers += entry.decision_makers || 0;
        stats.pitches += entry.pitches || 0;
        stats.transitions += entry.transitions || 0;
        stats.presentations += entry.presentations || 0;
        stats.fp += entry.fp_plus || 0;
        stats.prmr += entry.prmr || 0;
        stats.upgradePrmr += entry.upgrade_prmr || 0;

        // Calculate hours worked
        if (entry.work_start_time && entry.work_end_time) {
          const start = new Date(entry.work_start_time);
          const end = new Date(entry.work_end_time);
          let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          
          if (entry.break_periods && Array.isArray(entry.break_periods)) {
            entry.break_periods.forEach((period: any) => {
              if (period.start && period.end) {
                const breakStart = new Date(period.start);
                const breakEnd = new Date(period.end);
                hours -= (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
              }
            });
          }
          
          stats.hoursWorked += hours;
        }

        // Track earliest/latest door times (local time-of-day)
        const timestamps = entry.counter_timestamps as any;
        const repInfo = repsMap.get(entry.user_id);
        const userTimezone = entry.timezone || repInfo?.timezone || 'America/Los_Angeles';
        if (timestamps?.doors_knocked) {
          timestamps.doors_knocked.forEach((ts: string) => {
            try {
              const date = new Date(ts);
              // Extract local time-of-day in user's timezone
              const localTime = new Intl.DateTimeFormat('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: userTimezone,
              }).format(date);
              const [hours, minutes] = localTime.split(':').map(Number);
              const minutesOfDay = hours * 60 + minutes;
              
              // Track earliest door (smallest minutes of day) - store timezone and date too
              if (stats.earliestDoorTime === null) {
                stats.earliestDoorTime = `${minutesOfDay}|${ts}|${userTimezone}`;
                stats.earliestDoorDate = entry.entry_date;
              } else {
                const [existingMins] = stats.earliestDoorTime.split('|');
                if (minutesOfDay < parseInt(existingMins)) {
                  stats.earliestDoorTime = `${minutesOfDay}|${ts}|${userTimezone}`;
                  stats.earliestDoorDate = entry.entry_date;
                }
              }
              
              // Track latest door (largest minutes of day) - store timezone too
              if (stats.latestDoorTime === null) {
                stats.latestDoorTime = `${minutesOfDay}|${ts}|${userTimezone}`;
              } else {
                const [existingMins] = stats.latestDoorTime.split('|');
                if (minutesOfDay > parseInt(existingMins)) {
                  stats.latestDoorTime = `${minutesOfDay}|${ts}|${userTimezone}`;
                }
              }
            } catch (e) {
              // Invalid timestamp, skip
            }
          });
        }

        userStats.set(entry.user_id, stats);
      });

      // Find top performers
      const leaderboard: YTDLeaderboard = {
        mostDoors: null,
        mostDecisionMakers: null,
        mostPitches: null,
        mostTransitions: null,
        mostPresentations: null,
        mostFP: null,
        mostPRMR: null,
        mostUpgradeFP: null,
        mostHoursWorked: null,
        earliestDoor: null,
        latestDoor: null,
      };

      userStats.forEach((stats, userId) => {
        const repInfo = repsMap.get(userId);
        if (!repInfo) return;
        
        const cleanName = repInfo.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();

        if (stats.doors > (leaderboard.mostDoors?.value || 0)) {
          leaderboard.mostDoors = { userId, name: cleanName, value: stats.doors };
        }
        if (stats.decisionMakers > (leaderboard.mostDecisionMakers?.value || 0)) {
          leaderboard.mostDecisionMakers = { userId, name: cleanName, value: stats.decisionMakers };
        }
        if (stats.pitches > (leaderboard.mostPitches?.value || 0)) {
          leaderboard.mostPitches = { userId, name: cleanName, value: stats.pitches };
        }
        if (stats.transitions > (leaderboard.mostTransitions?.value || 0)) {
          leaderboard.mostTransitions = { userId, name: cleanName, value: stats.transitions };
        }
        if (stats.presentations > (leaderboard.mostPresentations?.value || 0)) {
          leaderboard.mostPresentations = { userId, name: cleanName, value: stats.presentations };
        }
        if (stats.fp > (leaderboard.mostFP?.value || 0)) {
          leaderboard.mostFP = { userId, name: cleanName, value: stats.fp };
        }
        // Total PRMR = prmr (FP sales) + upgradePrmr (upgrade sales)
        const totalPrmr = stats.prmr + stats.upgradePrmr;
        if (totalPrmr > (leaderboard.mostPRMR?.value || 0)) {
          leaderboard.mostPRMR = { userId, name: cleanName, value: totalPrmr };
        }
        const upgradeFp = stats.upgradePrmr / 85;
        if (upgradeFp > (leaderboard.mostUpgradeFP?.value || 0)) {
          leaderboard.mostUpgradeFP = { userId, name: cleanName, value: upgradeFp };
        }
        if (stats.hoursWorked > (leaderboard.mostHoursWorked?.value || 0)) {
          leaderboard.mostHoursWorked = { userId, name: cleanName, value: stats.hoursWorked };
        }

        // Earliest door (compare local time-of-day)
        if (stats.earliestDoorTime) {
          const [minutesOfDay, timestamp, tz] = stats.earliestDoorTime.split('|');
          const mins = parseInt(minutesOfDay);
          const currentEarliestMins = leaderboard.earliestDoor?.value || Infinity;
          
          if (mins < currentEarliestMins) {
            const date = new Date(timestamp);
            const timeStr = date.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true,
              timeZone: tz || 'America/Los_Angeles',
            });
            // Check if this earliest door was on a Saturday
            const isSaturday = stats.earliestDoorDate 
              ? new Date(stats.earliestDoorDate + 'T12:00:00').getDay() === 6 
              : false;
            leaderboard.earliestDoor = { 
              userId, 
              name: cleanName, 
              value: mins,
              timeValue: timeStr,
              isSaturday
            };
          }
        }

        // Latest door (compare local time-of-day)
        if (stats.latestDoorTime) {
          const [minutesOfDay, timestamp, tz] = stats.latestDoorTime.split('|');
          const mins = parseInt(minutesOfDay);
          const currentLatestMins = leaderboard.latestDoor?.value || -1;
          
          if (mins > currentLatestMins) {
            const date = new Date(timestamp);
            const timeStr = date.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true,
              timeZone: tz || 'America/Los_Angeles',
            });
            leaderboard.latestDoor = { 
              userId, 
              name: cleanName, 
              value: mins,
              timeValue: timeStr
            };
          }
        }
      });

      return leaderboard;
    },
    staleTime: 0, // Force fresh data on every mount
  });
};
