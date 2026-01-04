import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";

export interface TimingEntry {
  userId: string;
  name: string;
  value: number; // minutes since midnight
  timeValue: string; // formatted time string
  isSaturday?: boolean;
}

export interface GritAwards {
  earliestDoor: TimingEntry | null;
  latestDoor: TimingEntry | null;
  earliestDM: TimingEntry | null;
  latestDM: TimingEntry | null;
  earliestPitch: TimingEntry | null;
  latestPitch: TimingEntry | null;
  earliestTransition: TimingEntry | null;
  latestTransition: TimingEntry | null;
  earliestPresentation: TimingEntry | null;
  latestPresentation: TimingEntry | null;
  earliestClose: TimingEntry | null;
  latestClose: TimingEntry | null;
  mostHoursWorked: { userId: string; name: string; value: number } | null;
  isSamePersonEarliestLatestDoor: boolean;
}

export interface ActivityLeaders {
  mostDoors: { userId: string; name: string; value: number } | null;
  mostDMs: { userId: string; name: string; value: number } | null;
  mostPitches: { userId: string; name: string; value: number } | null;
  mostTransitions: { userId: string; name: string; value: number } | null;
  mostPresentations: { userId: string; name: string; value: number } | null;
  mostCloses: { userId: string; name: string; value: number } | null;
}

export interface SalesLeaders {
  mostFP: { userId: string; name: string; value: number } | null;
  mostPRMR: { userId: string; name: string; value: number } | null;
  mostUpgradeFP: { userId: string; name: string; value: number } | null;
}

export interface ExpandedLeaderboard {
  gritAwards: GritAwards;
  activityLeaders: ActivityLeaders;
  salesLeaders: SalesLeaders;
}

const getLocalMinutesOfDay = (timestamp: string, timezone: string): number => {
  try {
    const date = new Date(timestamp);
    const localTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(date);
    const [hours, minutes] = localTime.split(':').map(Number);
    return hours * 60 + minutes;
  } catch {
    return 0;
  }
};

const formatTime = (timestamp: string, timezone: string): string => {
  try {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone
    });
  } catch {
    return '';
  }
};

export type TimeframeType = 'live' | 'yesterday' | 'week' | 'month' | 'season' | 'ytd';

const getDateRange = (timeframe: TimeframeType): { start: string; end: string } => {
  const today = new Date();
  
  switch (timeframe) {
    case 'live': {
      const str = getLocalDateString(today);
      return { start: str, end: str };
    }
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const str = getLocalDateString(yesterday);
      return { start: str, end: str };
    }
    case 'week': {
      const sunday = new Date(today);
      sunday.setDate(sunday.getDate() - sunday.getDay());
      return { start: getLocalDateString(sunday), end: getLocalDateString(today) };
    }
    case 'month': {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: getLocalDateString(firstOfMonth), end: getLocalDateString(today) };
    }
    case 'season': {
      // Preseason: Sept 28, 2025 - April 12, 2026
      return { start: '2025-09-28', end: getLocalDateString(today) };
    }
    case 'ytd': {
      const firstOfYear = new Date(today.getFullYear(), 0, 1);
      return { start: getLocalDateString(firstOfYear), end: getLocalDateString(today) };
    }
  }
};

export const useExpandedLeaderboard = (timeframe: TimeframeType, filterByYear?: string) => {
  const isLive = timeframe === 'live';
  
  return useQuery({
    queryKey: ["expanded-leaderboard", timeframe, filterByYear],
    queryFn: async () => {
      const { start, end } = getDateRange(timeframe);

      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, year, timezone");

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [r.user_id, { 
        name: r.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim(), 
        year: r.year,
        timezone: r.timezone || 'America/Los_Angeles'
      }]) || []);

      // For live view, include unfinalized entries. For historical views, prefer finalized.
      let query = supabase
        .from("daily_entries")
        .select("user_id, entry_date, doors_knocked, decision_makers, pitches, transitions, presentations, closes, fp_plus, prmr, upgrade_prmr, work_start_time, work_end_time, break_periods, counter_timestamps, timezone, is_finalized, sales_log")
        .gte("entry_date", start)
        .lte("entry_date", end);

      const { data: entries, error } = await query;

      if (error) throw error;

      let filteredEntries = entries || [];
      if (filterByYear) {
        filteredEntries = filteredEntries.filter(e => repsMap.get(e.user_id)?.year === filterByYear);
      }

      // Aggregate by user
      const userStats = new Map<string, {
        doors: number;
        dms: number;
        pitches: number;
        transitions: number;
        presentations: number;
        closes: number;
        fp: number;
        prmr: number;
        upgradeFp: number;
        hoursWorked: number;
        earliestDoor: { mins: number; ts: string; date: string } | null;
        latestDoor: { mins: number; ts: string } | null;
        earliestDM: { mins: number; ts: string } | null;
        latestDM: { mins: number; ts: string } | null;
        earliestPitch: { mins: number; ts: string } | null;
        latestPitch: { mins: number; ts: string } | null;
        earliestTransition: { mins: number; ts: string } | null;
        latestTransition: { mins: number; ts: string } | null;
        earliestPresentation: { mins: number; ts: string } | null;
        latestPresentation: { mins: number; ts: string } | null;
        earliestClose: { mins: number; ts: string } | null;
        latestClose: { mins: number; ts: string } | null;
        timezone: string;
      }>();

      const calculateFromSalesLog = (salesLog: any[]): { fp: number; prmr: number; upgradeFp: number } => {
        if (!salesLog || !Array.isArray(salesLog)) return { fp: 0, prmr: 0, upgradeFp: 0 };
        
        let fp = 0;
        let prmr = 0;
        let upgradeFp = 0;
        
        for (const sale of salesLog) {
          const salePrmr = Number(sale.prmr) || 0;
          prmr += salePrmr;
          
          if (sale.type === 'fp') {
            fp += 1;
          } else if (sale.type === 'upgrade') {
            fp += salePrmr / 85;
            upgradeFp += salePrmr / 85;
          }
        }
        
        return { fp, prmr, upgradeFp };
      };

      filteredEntries.forEach(entry => {
        const repInfo = repsMap.get(entry.user_id);
        if (!repInfo) return;

        const userTimezone = entry.timezone || repInfo.timezone;
        const existing = userStats.get(entry.user_id) || {
          doors: 0, dms: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0,
          fp: 0, prmr: 0, upgradeFp: 0, hoursWorked: 0,
          earliestDoor: null, latestDoor: null,
          earliestDM: null, latestDM: null,
          earliestPitch: null, latestPitch: null,
          earliestTransition: null, latestTransition: null,
          earliestPresentation: null, latestPresentation: null,
          earliestClose: null, latestClose: null,
          timezone: userTimezone
        };

        // Activity counts
        existing.doors += entry.doors_knocked || 0;
        existing.dms += entry.decision_makers || 0;
        existing.pitches += entry.pitches || 0;
        existing.transitions += entry.transitions || 0;
        existing.presentations += entry.presentations || 0;
        existing.closes += entry.closes || 0;

        // Sales metrics
        if (entry.is_finalized) {
          existing.fp += entry.fp_plus || 0;
          existing.prmr += entry.prmr || 0;
          const upgradePrmr = entry.upgrade_prmr || 0;
          existing.upgradeFp += upgradePrmr / 85;
        } else {
          const salesLog = entry.sales_log as any[];
          if (salesLog && salesLog.length > 0) {
            const fromLog = calculateFromSalesLog(salesLog);
            existing.fp += fromLog.fp;
            existing.prmr += fromLog.prmr;
            existing.upgradeFp += fromLog.upgradeFp;
          } else {
            existing.fp += entry.fp_plus || 0;
            existing.prmr += entry.prmr || 0;
            const upgradePrmr = entry.upgrade_prmr || 0;
            existing.upgradeFp += upgradePrmr / 85;
          }
        }

        // Hours worked
        if (entry.work_start_time && entry.work_end_time) {
          const startTime = new Date(entry.work_start_time);
          const endTime = new Date(entry.work_end_time);
          let totalMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

          if (entry.break_periods && Array.isArray(entry.break_periods)) {
            entry.break_periods.forEach((period: any) => {
              if (period.start && period.end) {
                const breakStart = new Date(period.start);
                const breakEnd = new Date(period.end);
                totalMinutes -= (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
              }
            });
          }

          existing.hoursWorked += Math.max(0, totalMinutes / 60);
        }

        // Process timestamps for all action types
        const timestamps = entry.counter_timestamps as Record<string, string[]> | null;
        if (timestamps) {
          const processTimestamps = (
            key: string,
            earliestField: keyof typeof existing,
            latestField: keyof typeof existing
          ) => {
            const tsArray = timestamps[key];
            if (!tsArray || !Array.isArray(tsArray) || tsArray.length === 0) return;

            tsArray.forEach((ts: string) => {
              const mins = getLocalMinutesOfDay(ts, userTimezone);
              
              const currentEarliest = existing[earliestField] as { mins: number; ts: string; date?: string } | null;
              if (!currentEarliest || mins < currentEarliest.mins) {
                (existing[earliestField] as any) = { mins, ts, date: entry.entry_date };
              }
              
              const currentLatest = existing[latestField] as { mins: number; ts: string } | null;
              if (!currentLatest || mins > currentLatest.mins) {
                (existing[latestField] as any) = { mins, ts };
              }
            });
          };

          processTimestamps('doors_knocked', 'earliestDoor', 'latestDoor');
          processTimestamps('decision_makers', 'earliestDM', 'latestDM');
          processTimestamps('pitches', 'earliestPitch', 'latestPitch');
          processTimestamps('transitions', 'earliestTransition', 'latestTransition');
          processTimestamps('presentations', 'earliestPresentation', 'latestPresentation');
        }

        // Process sales_log for close timestamps
        const salesLog = entry.sales_log as any[] | null;
        if (salesLog && Array.isArray(salesLog)) {
          salesLog.forEach((sale: any) => {
            if (sale.timestamp) {
              const mins = getLocalMinutesOfDay(sale.timestamp, userTimezone);
              
              if (!existing.earliestClose || mins < existing.earliestClose.mins) {
                existing.earliestClose = { mins, ts: sale.timestamp };
              }
              if (!existing.latestClose || mins > existing.latestClose.mins) {
                existing.latestClose = { mins, ts: sale.timestamp };
              }
            }
          });
        }

        userStats.set(entry.user_id, existing);
      });

      // Build the leaderboard results
      const result: ExpandedLeaderboard = {
        gritAwards: {
          earliestDoor: null, latestDoor: null,
          earliestDM: null, latestDM: null,
          earliestPitch: null, latestPitch: null,
          earliestTransition: null, latestTransition: null,
          earliestPresentation: null, latestPresentation: null,
          earliestClose: null, latestClose: null,
          mostHoursWorked: null,
          isSamePersonEarliestLatestDoor: false
        },
        activityLeaders: {
          mostDoors: null, mostDMs: null, mostPitches: null,
          mostTransitions: null, mostPresentations: null, mostCloses: null
        },
        salesLeaders: {
          mostFP: null, mostPRMR: null, mostUpgradeFP: null
        }
      };

      userStats.forEach((stats, userId) => {
        const repInfo = repsMap.get(userId);
        if (!repInfo) return;

        const name = repInfo.name;

        // Activity leaders
        if (stats.doors > 0 && (!result.activityLeaders.mostDoors || stats.doors > result.activityLeaders.mostDoors.value)) {
          result.activityLeaders.mostDoors = { userId, name, value: stats.doors };
        }
        if (stats.dms > 0 && (!result.activityLeaders.mostDMs || stats.dms > result.activityLeaders.mostDMs.value)) {
          result.activityLeaders.mostDMs = { userId, name, value: stats.dms };
        }
        if (stats.pitches > 0 && (!result.activityLeaders.mostPitches || stats.pitches > result.activityLeaders.mostPitches.value)) {
          result.activityLeaders.mostPitches = { userId, name, value: stats.pitches };
        }
        if (stats.transitions > 0 && (!result.activityLeaders.mostTransitions || stats.transitions > result.activityLeaders.mostTransitions.value)) {
          result.activityLeaders.mostTransitions = { userId, name, value: stats.transitions };
        }
        if (stats.presentations > 0 && (!result.activityLeaders.mostPresentations || stats.presentations > result.activityLeaders.mostPresentations.value)) {
          result.activityLeaders.mostPresentations = { userId, name, value: stats.presentations };
        }
        if (stats.closes > 0 && (!result.activityLeaders.mostCloses || stats.closes > result.activityLeaders.mostCloses.value)) {
          result.activityLeaders.mostCloses = { userId, name, value: stats.closes };
        }

        // Sales leaders
        if (stats.fp > 0 && (!result.salesLeaders.mostFP || stats.fp > result.salesLeaders.mostFP.value)) {
          result.salesLeaders.mostFP = { userId, name, value: stats.fp };
        }
        if (stats.prmr > 0 && (!result.salesLeaders.mostPRMR || stats.prmr > result.salesLeaders.mostPRMR.value)) {
          result.salesLeaders.mostPRMR = { userId, name, value: stats.prmr };
        }
        if (stats.upgradeFp > 0 && (!result.salesLeaders.mostUpgradeFP || stats.upgradeFp > result.salesLeaders.mostUpgradeFP.value)) {
          result.salesLeaders.mostUpgradeFP = { userId, name, value: stats.upgradeFp };
        }

        // Hours worked
        if (stats.hoursWorked > 0 && (!result.gritAwards.mostHoursWorked || stats.hoursWorked > result.gritAwards.mostHoursWorked.value)) {
          result.gritAwards.mostHoursWorked = { userId, name, value: stats.hoursWorked };
        }

        // Grit awards (timing)
        const processGritAward = (
          statsField: { mins: number; ts: string; date?: string } | null,
          resultField: keyof GritAwards,
          isEarliest: boolean
        ) => {
          if (!statsField) return;
          
          const current = result.gritAwards[resultField] as TimingEntry | null;
          const isBetter = isEarliest 
            ? (!current || statsField.mins < current.value)
            : (!current || statsField.mins > current.value);
          
          if (isBetter) {
            let isSaturday = false;
            if (statsField.date) {
              const dateObj = new Date(statsField.date + 'T12:00:00');
              isSaturday = dateObj.getDay() === 6;
            }
            
            (result.gritAwards[resultField] as TimingEntry) = {
              userId,
              name,
              value: statsField.mins,
              timeValue: formatTime(statsField.ts, stats.timezone),
              isSaturday
            };
          }
        };

        processGritAward(stats.earliestDoor, 'earliestDoor', true);
        processGritAward(stats.latestDoor, 'latestDoor', false);
        processGritAward(stats.earliestDM, 'earliestDM', true);
        processGritAward(stats.latestDM, 'latestDM', false);
        processGritAward(stats.earliestPitch, 'earliestPitch', true);
        processGritAward(stats.latestPitch, 'latestPitch', false);
        processGritAward(stats.earliestTransition, 'earliestTransition', true);
        processGritAward(stats.latestTransition, 'latestTransition', false);
        processGritAward(stats.earliestPresentation, 'earliestPresentation', true);
        processGritAward(stats.latestPresentation, 'latestPresentation', false);
        processGritAward(stats.earliestClose, 'earliestClose', true);
        processGritAward(stats.latestClose, 'latestClose', false);
      });

      // Check for Ironman award
      result.gritAwards.isSamePersonEarliestLatestDoor = 
        result.gritAwards.earliestDoor !== null && 
        result.gritAwards.latestDoor !== null &&
        result.gritAwards.earliestDoor.userId === result.gritAwards.latestDoor.userId;

      return result;
    },
    staleTime: 30000,
  });
};
