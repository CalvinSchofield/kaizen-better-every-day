import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
  timeValue?: string;
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
  mostUpgradePRMR: LeaderboardEntry | null;
  mostHoursWorked: LeaderboardEntry | null;
  earliestDoor: LeaderboardEntry | null;
  latestDoor: LeaderboardEntry | null;
}

export const useYTDLeaderboard = (filterByYear?: string) => {
  return useQuery({
    queryKey: ['ytd-leaderboard', filterByYear],
    queryFn: async () => {
      // Get start of current year
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

      // Fetch all users
      const { data: reps, error: repsError } = await supabase
        .from('reps')
        .select('user_id, name, year');

      if (repsError) {
        console.error('Error fetching reps:', repsError);
        return null;
      }

      // Filter by year if specified
      const filteredReps = filterByYear 
        ? reps?.filter(rep => rep.year === filterByYear) 
        : reps;

      if (!filteredReps || filteredReps.length === 0) return null;

      const userIds = filteredReps.map(rep => rep.user_id);

      // Fetch all finalized entries for the year
      const { data: entries, error: entriesError } = await supabase
        .from('daily_entries')
        .select('*')
        .in('user_id', userIds)
        .eq('is_finalized', true)
        .gte('entry_date', yearStart);

      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
        return null;
      }

      // Aggregate by user
      const userStats = new Map<string, {
        doors: number;
        decisionMakers: number;
        pitches: number;
        transitions: number;
        presentations: number;
        fp: number;
        prmr: number;
        upgradeFp: number;
        upgradePrmr: number;
        hoursWorked: number;
        earliestDoorTime: string | null;
        latestDoorTime: string | null;
      }>();

      entries?.forEach(entry => {
        const stats = userStats.get(entry.user_id) || {
          doors: 0,
          decisionMakers: 0,
          pitches: 0,
          transitions: 0,
          presentations: 0,
          fp: 0,
          prmr: 0,
          upgradeFp: 0,
          upgradePrmr: 0,
          hoursWorked: 0,
          earliestDoorTime: null,
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
        stats.upgradeFp += (entry.fp_plus || 0) - Math.floor(entry.fp_plus || 0);

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

        // Track earliest/latest door times
        const timestamps = entry.counter_timestamps as any;
        if (timestamps?.doors_knocked) {
          const doorTimes = timestamps.doors_knocked.map((ts: string) => new Date(ts));
          if (doorTimes.length > 0) {
            const earliest = new Date(Math.min(...doorTimes.map((d: Date) => d.getTime())));
            const latest = new Date(Math.max(...doorTimes.map((d: Date) => d.getTime())));
            
            if (!stats.earliestDoorTime || earliest < new Date(stats.earliestDoorTime)) {
              stats.earliestDoorTime = earliest.toISOString();
            }
            if (!stats.latestDoorTime || latest > new Date(stats.latestDoorTime)) {
              stats.latestDoorTime = latest.toISOString();
            }
          }
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
        mostUpgradePRMR: null,
        mostHoursWorked: null,
        earliestDoor: null,
        latestDoor: null,
      };

      userStats.forEach((stats, userId) => {
        const rep = filteredReps.find(r => r.user_id === userId);
        if (!rep) return;

        if (stats.doors > (leaderboard.mostDoors?.value || 0)) {
          leaderboard.mostDoors = { userId, name: rep.name, value: stats.doors };
        }
        if (stats.decisionMakers > (leaderboard.mostDecisionMakers?.value || 0)) {
          leaderboard.mostDecisionMakers = { userId, name: rep.name, value: stats.decisionMakers };
        }
        if (stats.pitches > (leaderboard.mostPitches?.value || 0)) {
          leaderboard.mostPitches = { userId, name: rep.name, value: stats.pitches };
        }
        if (stats.transitions > (leaderboard.mostTransitions?.value || 0)) {
          leaderboard.mostTransitions = { userId, name: rep.name, value: stats.transitions };
        }
        if (stats.presentations > (leaderboard.mostPresentations?.value || 0)) {
          leaderboard.mostPresentations = { userId, name: rep.name, value: stats.presentations };
        }
        if (stats.fp > (leaderboard.mostFP?.value || 0)) {
          leaderboard.mostFP = { userId, name: rep.name, value: stats.fp };
        }
        if (stats.prmr > (leaderboard.mostPRMR?.value || 0)) {
          leaderboard.mostPRMR = { userId, name: rep.name, value: stats.prmr };
        }
        if (stats.upgradeFp > (leaderboard.mostUpgradeFP?.value || 0)) {
          leaderboard.mostUpgradeFP = { userId, name: rep.name, value: stats.upgradeFp };
        }
        if (stats.upgradePrmr > (leaderboard.mostUpgradePRMR?.value || 0)) {
          leaderboard.mostUpgradePRMR = { userId, name: rep.name, value: stats.upgradePrmr };
        }
        if (stats.hoursWorked > (leaderboard.mostHoursWorked?.value || 0)) {
          leaderboard.mostHoursWorked = { userId, name: rep.name, value: stats.hoursWorked };
        }

        // Earliest door
        if (stats.earliestDoorTime) {
          const currentEarliest = leaderboard.earliestDoor?.timeValue ? new Date(leaderboard.earliestDoor.timeValue) : null;
          const newEarliest = new Date(stats.earliestDoorTime);
          if (!currentEarliest || newEarliest < currentEarliest) {
            const timeStr = newEarliest.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            });
            leaderboard.earliestDoor = { 
              userId, 
              name: rep.name, 
              value: newEarliest.getTime(),
              timeValue: timeStr
            };
          }
        }

        // Latest door
        if (stats.latestDoorTime) {
          const currentLatest = leaderboard.latestDoor?.timeValue ? new Date(leaderboard.latestDoor.timeValue) : null;
          const newLatest = new Date(stats.latestDoorTime);
          if (!currentLatest || newLatest > currentLatest) {
            const timeStr = newLatest.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            });
            leaderboard.latestDoor = { 
              userId, 
              name: rep.name, 
              value: newLatest.getTime(),
              timeValue: timeStr
            };
          }
        }
      });

      return leaderboard;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
