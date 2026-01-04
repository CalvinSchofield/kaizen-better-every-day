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

export interface TimingAward {
  userId: string;
  name: string;
  value: number; // minutes since midnight
  timeValue: string; // formatted time string
  actionType: string; // e.g. "First FP+", "Earliest Presentation"
}

export interface TimingSet {
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
}

export interface GritAwards {
  // Combined (all days) - for backward compatibility and single-day views
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
  
  // Separated by day type
  weekday: TimingSet;
  saturday: TimingSet;
  hasWeekdayData: boolean;
  hasSaturdayData: boolean;

  // NEW: Early Bird & Night Owl awards with fallback logic
  earlyBirdWeekday: TimingAward | null;
  earlyBirdSaturday: TimingAward | null;
  nightOwlWeekday: TimingAward | null;
  nightOwlSaturday: TimingAward | null;
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
      return { start: '2025-09-28', end: getLocalDateString(today) };
    }
    case 'ytd': {
      const firstOfYear = new Date(today.getFullYear(), 0, 1);
      return { start: getLocalDateString(firstOfYear), end: getLocalDateString(today) };
    }
  }
};

const createEmptyTimingSet = (): TimingSet => ({
  earliestDoor: null, latestDoor: null,
  earliestDM: null, latestDM: null,
  earliestPitch: null, latestPitch: null,
  earliestTransition: null, latestTransition: null,
  earliestPresentation: null, latestPresentation: null,
  earliestClose: null, latestClose: null,
});

interface UserTimingStats {
  mins: number;
  ts: string;
  date: string;
  isSaturday: boolean;
}

// Time thresholds in minutes since midnight
const WEEKDAY_EARLY_CUTOFF = 15 * 60; // 3:00 PM = 900 minutes
const SATURDAY_EARLY_CUTOFF = 10 * 60; // 10:00 AM = 600 minutes
const NIGHT_OWL_CUTOFF = 19 * 60; // 7:00 PM = 1140 minutes

export const useExpandedLeaderboard = (timeframe: TimeframeType, filterByYear?: string) => {
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

      const query = supabase
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

      // Helper to check if a date is Saturday
      const isSaturdayDate = (dateStr: string): boolean => {
        const dateObj = new Date(dateStr + 'T12:00:00');
        return dateObj.getDay() === 6;
      };

      // Aggregate by user - now tracking weekday and Saturday separately
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
        // Combined timing
        earliestDoor: UserTimingStats | null;
        latestDoor: UserTimingStats | null;
        earliestDM: UserTimingStats | null;
        latestDM: UserTimingStats | null;
        earliestPitch: UserTimingStats | null;
        latestPitch: UserTimingStats | null;
        earliestTransition: UserTimingStats | null;
        latestTransition: UserTimingStats | null;
        earliestPresentation: UserTimingStats | null;
        latestPresentation: UserTimingStats | null;
        earliestClose: UserTimingStats | null;
        latestClose: UserTimingStats | null;
        // Weekday timing
        weekdayEarliestDoor: UserTimingStats | null;
        weekdayLatestDoor: UserTimingStats | null;
        weekdayEarliestDM: UserTimingStats | null;
        weekdayLatestDM: UserTimingStats | null;
        weekdayEarliestPitch: UserTimingStats | null;
        weekdayLatestPitch: UserTimingStats | null;
        weekdayEarliestTransition: UserTimingStats | null;
        weekdayLatestTransition: UserTimingStats | null;
        weekdayEarliestPresentation: UserTimingStats | null;
        weekdayLatestPresentation: UserTimingStats | null;
        weekdayEarliestClose: UserTimingStats | null;
        weekdayLatestClose: UserTimingStats | null;
        // Saturday timing
        saturdayEarliestDoor: UserTimingStats | null;
        saturdayLatestDoor: UserTimingStats | null;
        saturdayEarliestDM: UserTimingStats | null;
        saturdayLatestDM: UserTimingStats | null;
        saturdayEarliestPitch: UserTimingStats | null;
        saturdayLatestPitch: UserTimingStats | null;
        saturdayEarliestTransition: UserTimingStats | null;
        saturdayLatestTransition: UserTimingStats | null;
        saturdayEarliestPresentation: UserTimingStats | null;
        saturdayLatestPresentation: UserTimingStats | null;
        saturdayEarliestClose: UserTimingStats | null;
        saturdayLatestClose: UserTimingStats | null;
        // FP+ timing (for Early Bird / Night Owl)
        weekdayEarliestFPPlus: UserTimingStats | null;
        weekdayLatestFPPlus: UserTimingStats | null;
        saturdayEarliestFPPlus: UserTimingStats | null;
        saturdayLatestFPPlus: UserTimingStats | null;
        timezone: string;
      }>();

      const createEmptyUserStats = (timezone: string) => ({
        doors: 0, dms: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0,
        fp: 0, prmr: 0, upgradeFp: 0, hoursWorked: 0,
        earliestDoor: null, latestDoor: null,
        earliestDM: null, latestDM: null,
        earliestPitch: null, latestPitch: null,
        earliestTransition: null, latestTransition: null,
        earliestPresentation: null, latestPresentation: null,
        earliestClose: null, latestClose: null,
        weekdayEarliestDoor: null, weekdayLatestDoor: null,
        weekdayEarliestDM: null, weekdayLatestDM: null,
        weekdayEarliestPitch: null, weekdayLatestPitch: null,
        weekdayEarliestTransition: null, weekdayLatestTransition: null,
        weekdayEarliestPresentation: null, weekdayLatestPresentation: null,
        weekdayEarliestClose: null, weekdayLatestClose: null,
        saturdayEarliestDoor: null, saturdayLatestDoor: null,
        saturdayEarliestDM: null, saturdayLatestDM: null,
        saturdayEarliestPitch: null, saturdayLatestPitch: null,
        saturdayEarliestTransition: null, saturdayLatestTransition: null,
        saturdayEarliestPresentation: null, saturdayLatestPresentation: null,
        saturdayEarliestClose: null, saturdayLatestClose: null,
        weekdayEarliestFPPlus: null, weekdayLatestFPPlus: null,
        saturdayEarliestFPPlus: null, saturdayLatestFPPlus: null,
        timezone
      });

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

      // Check if a sale qualifies as FP+ (type='fp' OR upgrade with prmr >= 85)
      const isFPPlus = (sale: any): boolean => {
        if (sale.type === 'fp') return true;
        if (sale.type === 'upgrade' && Number(sale.prmr) >= 85) return true;
        return false;
      };

      filteredEntries.forEach(entry => {
        const repInfo = repsMap.get(entry.user_id);
        if (!repInfo) return;

        const userTimezone = entry.timezone || repInfo.timezone;
        const existing = userStats.get(entry.user_id) || createEmptyUserStats(userTimezone);
        const isSaturday = isSaturdayDate(entry.entry_date);

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
            combinedEarliest: keyof typeof existing,
            combinedLatest: keyof typeof existing,
            weekdayEarliest: keyof typeof existing,
            weekdayLatest: keyof typeof existing,
            saturdayEarliest: keyof typeof existing,
            saturdayLatest: keyof typeof existing
          ) => {
            const tsArray = timestamps[key];
            if (!tsArray || !Array.isArray(tsArray) || tsArray.length === 0) return;

            tsArray.forEach((ts: string) => {
              const mins = getLocalMinutesOfDay(ts, userTimezone);
              const timingData: UserTimingStats = { mins, ts, date: entry.entry_date, isSaturday };
              
              // Update combined
              const currentCombinedEarliest = existing[combinedEarliest] as UserTimingStats | null;
              if (!currentCombinedEarliest || mins < currentCombinedEarliest.mins) {
                (existing[combinedEarliest] as any) = timingData;
              }
              const currentCombinedLatest = existing[combinedLatest] as UserTimingStats | null;
              if (!currentCombinedLatest || mins > currentCombinedLatest.mins) {
                (existing[combinedLatest] as any) = timingData;
              }
              
              // Update day-specific
              if (isSaturday) {
                const currentSatEarliest = existing[saturdayEarliest] as UserTimingStats | null;
                if (!currentSatEarliest || mins < currentSatEarliest.mins) {
                  (existing[saturdayEarliest] as any) = timingData;
                }
                const currentSatLatest = existing[saturdayLatest] as UserTimingStats | null;
                if (!currentSatLatest || mins > currentSatLatest.mins) {
                  (existing[saturdayLatest] as any) = timingData;
                }
              } else {
                const currentWkdEarliest = existing[weekdayEarliest] as UserTimingStats | null;
                if (!currentWkdEarliest || mins < currentWkdEarliest.mins) {
                  (existing[weekdayEarliest] as any) = timingData;
                }
                const currentWkdLatest = existing[weekdayLatest] as UserTimingStats | null;
                if (!currentWkdLatest || mins > currentWkdLatest.mins) {
                  (existing[weekdayLatest] as any) = timingData;
                }
              }
            });
          };

          processTimestamps('doors_knocked', 
            'earliestDoor', 'latestDoor',
            'weekdayEarliestDoor', 'weekdayLatestDoor',
            'saturdayEarliestDoor', 'saturdayLatestDoor'
          );
          processTimestamps('decision_makers',
            'earliestDM', 'latestDM',
            'weekdayEarliestDM', 'weekdayLatestDM',
            'saturdayEarliestDM', 'saturdayLatestDM'
          );
          processTimestamps('pitches',
            'earliestPitch', 'latestPitch',
            'weekdayEarliestPitch', 'weekdayLatestPitch',
            'saturdayEarliestPitch', 'saturdayLatestPitch'
          );
          processTimestamps('transitions',
            'earliestTransition', 'latestTransition',
            'weekdayEarliestTransition', 'weekdayLatestTransition',
            'saturdayEarliestTransition', 'saturdayLatestTransition'
          );
          processTimestamps('presentations',
            'earliestPresentation', 'latestPresentation',
            'weekdayEarliestPresentation', 'weekdayLatestPresentation',
            'saturdayEarliestPresentation', 'saturdayLatestPresentation'
          );
        }

        // Process sales_log for close timestamps AND FP+ timestamps
        const salesLog = entry.sales_log as any[] | null;
        if (salesLog && Array.isArray(salesLog)) {
          salesLog.forEach((sale: any) => {
            if (sale.timestamp) {
              const mins = getLocalMinutesOfDay(sale.timestamp, userTimezone);
              const timingData: UserTimingStats = { mins, ts: sale.timestamp, date: entry.entry_date, isSaturday };
              
              // Combined close timing
              if (!existing.earliestClose || mins < existing.earliestClose.mins) {
                existing.earliestClose = timingData;
              }
              if (!existing.latestClose || mins > existing.latestClose.mins) {
                existing.latestClose = timingData;
              }
              
              // Day-specific close timing
              if (isSaturday) {
                if (!existing.saturdayEarliestClose || mins < existing.saturdayEarliestClose.mins) {
                  existing.saturdayEarliestClose = timingData;
                }
                if (!existing.saturdayLatestClose || mins > existing.saturdayLatestClose.mins) {
                  existing.saturdayLatestClose = timingData;
                }
              } else {
                if (!existing.weekdayEarliestClose || mins < existing.weekdayEarliestClose.mins) {
                  existing.weekdayEarliestClose = timingData;
                }
                if (!existing.weekdayLatestClose || mins > existing.weekdayLatestClose.mins) {
                  existing.weekdayLatestClose = timingData;
                }
              }

              // FP+ timing (for Early Bird / Night Owl)
              if (isFPPlus(sale)) {
                if (isSaturday) {
                  if (!existing.saturdayEarliestFPPlus || mins < existing.saturdayEarliestFPPlus.mins) {
                    existing.saturdayEarliestFPPlus = timingData;
                  }
                  if (!existing.saturdayLatestFPPlus || mins > existing.saturdayLatestFPPlus.mins) {
                    existing.saturdayLatestFPPlus = timingData;
                  }
                } else {
                  if (!existing.weekdayEarliestFPPlus || mins < existing.weekdayEarliestFPPlus.mins) {
                    existing.weekdayEarliestFPPlus = timingData;
                  }
                  if (!existing.weekdayLatestFPPlus || mins > existing.weekdayLatestFPPlus.mins) {
                    existing.weekdayLatestFPPlus = timingData;
                  }
                }
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
          isSamePersonEarliestLatestDoor: false,
          weekday: createEmptyTimingSet(),
          saturday: createEmptyTimingSet(),
          hasWeekdayData: false,
          hasSaturdayData: false,
          earlyBirdWeekday: null,
          earlyBirdSaturday: null,
          nightOwlWeekday: null,
          nightOwlSaturday: null,
        },
        activityLeaders: {
          mostDoors: null, mostDMs: null, mostPitches: null,
          mostTransitions: null, mostPresentations: null, mostCloses: null
        },
        salesLeaders: {
          mostFP: null, mostPRMR: null, mostUpgradeFP: null
        }
      };

      const processGritAward = (
        statsField: UserTimingStats | null,
        targetSet: TimingSet | GritAwards,
        fieldName: keyof TimingSet,
        isEarliest: boolean,
        userId: string,
        name: string,
        timezone: string
      ) => {
        if (!statsField) return;
        
        const current = targetSet[fieldName] as TimingEntry | null;
        const isBetter = isEarliest 
          ? (!current || statsField.mins < current.value)
          : (!current || statsField.mins > current.value);
        
        if (isBetter) {
          (targetSet[fieldName] as TimingEntry) = {
            userId,
            name,
            value: statsField.mins,
            timeValue: formatTime(statsField.ts, timezone),
            isSaturday: statsField.isSaturday
          };
        }
      };

      // For Early Bird / Night Owl computation
      // Fallback order: FP+ → Presentation → Transition → Pitch → DM → Door
      interface EarlyBirdCandidate {
        userId: string;
        name: string;
        mins: number;
        ts: string;
        actionType: string;
        timezone: string;
      }

      const earlyBirdWeekdayCandidates: EarlyBirdCandidate[] = [];
      const earlyBirdSaturdayCandidates: EarlyBirdCandidate[] = [];
      const nightOwlWeekdayCandidates: EarlyBirdCandidate[] = [];
      const nightOwlSaturdayCandidates: EarlyBirdCandidate[] = [];

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

        // Combined grit awards
        processGritAward(stats.earliestDoor, result.gritAwards, 'earliestDoor', true, userId, name, stats.timezone);
        processGritAward(stats.latestDoor, result.gritAwards, 'latestDoor', false, userId, name, stats.timezone);
        processGritAward(stats.earliestDM, result.gritAwards, 'earliestDM', true, userId, name, stats.timezone);
        processGritAward(stats.latestDM, result.gritAwards, 'latestDM', false, userId, name, stats.timezone);
        processGritAward(stats.earliestPitch, result.gritAwards, 'earliestPitch', true, userId, name, stats.timezone);
        processGritAward(stats.latestPitch, result.gritAwards, 'latestPitch', false, userId, name, stats.timezone);
        processGritAward(stats.earliestTransition, result.gritAwards, 'earliestTransition', true, userId, name, stats.timezone);
        processGritAward(stats.latestTransition, result.gritAwards, 'latestTransition', false, userId, name, stats.timezone);
        processGritAward(stats.earliestPresentation, result.gritAwards, 'earliestPresentation', true, userId, name, stats.timezone);
        processGritAward(stats.latestPresentation, result.gritAwards, 'latestPresentation', false, userId, name, stats.timezone);
        processGritAward(stats.earliestClose, result.gritAwards, 'earliestClose', true, userId, name, stats.timezone);
        processGritAward(stats.latestClose, result.gritAwards, 'latestClose', false, userId, name, stats.timezone);

        // Weekday grit awards
        processGritAward(stats.weekdayEarliestDoor, result.gritAwards.weekday, 'earliestDoor', true, userId, name, stats.timezone);
        processGritAward(stats.weekdayLatestDoor, result.gritAwards.weekday, 'latestDoor', false, userId, name, stats.timezone);
        processGritAward(stats.weekdayEarliestDM, result.gritAwards.weekday, 'earliestDM', true, userId, name, stats.timezone);
        processGritAward(stats.weekdayLatestDM, result.gritAwards.weekday, 'latestDM', false, userId, name, stats.timezone);
        processGritAward(stats.weekdayEarliestPitch, result.gritAwards.weekday, 'earliestPitch', true, userId, name, stats.timezone);
        processGritAward(stats.weekdayLatestPitch, result.gritAwards.weekday, 'latestPitch', false, userId, name, stats.timezone);
        processGritAward(stats.weekdayEarliestTransition, result.gritAwards.weekday, 'earliestTransition', true, userId, name, stats.timezone);
        processGritAward(stats.weekdayLatestTransition, result.gritAwards.weekday, 'latestTransition', false, userId, name, stats.timezone);
        processGritAward(stats.weekdayEarliestPresentation, result.gritAwards.weekday, 'earliestPresentation', true, userId, name, stats.timezone);
        processGritAward(stats.weekdayLatestPresentation, result.gritAwards.weekday, 'latestPresentation', false, userId, name, stats.timezone);
        processGritAward(stats.weekdayEarliestClose, result.gritAwards.weekday, 'earliestClose', true, userId, name, stats.timezone);
        processGritAward(stats.weekdayLatestClose, result.gritAwards.weekday, 'latestClose', false, userId, name, stats.timezone);

        // Saturday grit awards
        processGritAward(stats.saturdayEarliestDoor, result.gritAwards.saturday, 'earliestDoor', true, userId, name, stats.timezone);
        processGritAward(stats.saturdayLatestDoor, result.gritAwards.saturday, 'latestDoor', false, userId, name, stats.timezone);
        processGritAward(stats.saturdayEarliestDM, result.gritAwards.saturday, 'earliestDM', true, userId, name, stats.timezone);
        processGritAward(stats.saturdayLatestDM, result.gritAwards.saturday, 'latestDM', false, userId, name, stats.timezone);
        processGritAward(stats.saturdayEarliestPitch, result.gritAwards.saturday, 'earliestPitch', true, userId, name, stats.timezone);
        processGritAward(stats.saturdayLatestPitch, result.gritAwards.saturday, 'latestPitch', false, userId, name, stats.timezone);
        processGritAward(stats.saturdayEarliestTransition, result.gritAwards.saturday, 'earliestTransition', true, userId, name, stats.timezone);
        processGritAward(stats.saturdayLatestTransition, result.gritAwards.saturday, 'latestTransition', false, userId, name, stats.timezone);
        processGritAward(stats.saturdayEarliestPresentation, result.gritAwards.saturday, 'earliestPresentation', true, userId, name, stats.timezone);
        processGritAward(stats.saturdayLatestPresentation, result.gritAwards.saturday, 'latestPresentation', false, userId, name, stats.timezone);
        processGritAward(stats.saturdayEarliestClose, result.gritAwards.saturday, 'earliestClose', true, userId, name, stats.timezone);
        processGritAward(stats.saturdayLatestClose, result.gritAwards.saturday, 'latestClose', false, userId, name, stats.timezone);

        // Early Bird / Night Owl candidates (with fallback priority)
        // Fallback order: FP+ → Presentation → Transition → Pitch → DM → Door
        const addEarlyBirdCandidate = (
          candidates: EarlyBirdCandidate[],
          timing: UserTimingStats | null,
          actionType: string,
          cutoff: number
        ) => {
          if (timing && timing.mins < cutoff) {
            candidates.push({
              userId,
              name,
              mins: timing.mins,
              ts: timing.ts,
              actionType,
              timezone: stats.timezone
            });
          }
        };

        const addNightOwlCandidate = (
          candidates: EarlyBirdCandidate[],
          timing: UserTimingStats | null,
          actionType: string
        ) => {
          if (timing && timing.mins >= NIGHT_OWL_CUTOFF) {
            candidates.push({
              userId,
              name,
              mins: timing.mins,
              ts: timing.ts,
              actionType,
              timezone: stats.timezone
            });
          }
        };

        // Weekday Early Bird (before 3 PM)
        addEarlyBirdCandidate(earlyBirdWeekdayCandidates, stats.weekdayEarliestFPPlus, 'First FP+', WEEKDAY_EARLY_CUTOFF);
        addEarlyBirdCandidate(earlyBirdWeekdayCandidates, stats.weekdayEarliestPresentation, 'First Presentation', WEEKDAY_EARLY_CUTOFF);
        addEarlyBirdCandidate(earlyBirdWeekdayCandidates, stats.weekdayEarliestTransition, 'First Transition', WEEKDAY_EARLY_CUTOFF);
        addEarlyBirdCandidate(earlyBirdWeekdayCandidates, stats.weekdayEarliestPitch, 'First Pitch', WEEKDAY_EARLY_CUTOFF);
        addEarlyBirdCandidate(earlyBirdWeekdayCandidates, stats.weekdayEarliestDM, 'First DM', WEEKDAY_EARLY_CUTOFF);
        addEarlyBirdCandidate(earlyBirdWeekdayCandidates, stats.weekdayEarliestDoor, 'First Door', WEEKDAY_EARLY_CUTOFF);

        // Saturday Early Bird (before 10 AM)
        addEarlyBirdCandidate(earlyBirdSaturdayCandidates, stats.saturdayEarliestFPPlus, 'First FP+', SATURDAY_EARLY_CUTOFF);
        addEarlyBirdCandidate(earlyBirdSaturdayCandidates, stats.saturdayEarliestPresentation, 'First Presentation', SATURDAY_EARLY_CUTOFF);
        addEarlyBirdCandidate(earlyBirdSaturdayCandidates, stats.saturdayEarliestTransition, 'First Transition', SATURDAY_EARLY_CUTOFF);
        addEarlyBirdCandidate(earlyBirdSaturdayCandidates, stats.saturdayEarliestPitch, 'First Pitch', SATURDAY_EARLY_CUTOFF);
        addEarlyBirdCandidate(earlyBirdSaturdayCandidates, stats.saturdayEarliestDM, 'First DM', SATURDAY_EARLY_CUTOFF);
        addEarlyBirdCandidate(earlyBirdSaturdayCandidates, stats.saturdayEarliestDoor, 'First Door', SATURDAY_EARLY_CUTOFF);

        // Weekday Night Owl (after 7 PM)
        addNightOwlCandidate(nightOwlWeekdayCandidates, stats.weekdayLatestFPPlus, 'Latest FP+');
        addNightOwlCandidate(nightOwlWeekdayCandidates, stats.weekdayLatestPresentation, 'Latest Presentation');
        addNightOwlCandidate(nightOwlWeekdayCandidates, stats.weekdayLatestTransition, 'Latest Transition');
        addNightOwlCandidate(nightOwlWeekdayCandidates, stats.weekdayLatestPitch, 'Latest Pitch');
        addNightOwlCandidate(nightOwlWeekdayCandidates, stats.weekdayLatestDM, 'Latest DM');
        addNightOwlCandidate(nightOwlWeekdayCandidates, stats.weekdayLatestDoor, 'Latest Door');

        // Saturday Night Owl (after 7 PM)
        addNightOwlCandidate(nightOwlSaturdayCandidates, stats.saturdayLatestFPPlus, 'Latest FP+');
        addNightOwlCandidate(nightOwlSaturdayCandidates, stats.saturdayLatestPresentation, 'Latest Presentation');
        addNightOwlCandidate(nightOwlSaturdayCandidates, stats.saturdayLatestTransition, 'Latest Transition');
        addNightOwlCandidate(nightOwlSaturdayCandidates, stats.saturdayLatestPitch, 'Latest Pitch');
        addNightOwlCandidate(nightOwlSaturdayCandidates, stats.saturdayLatestDM, 'Latest DM');
        addNightOwlCandidate(nightOwlSaturdayCandidates, stats.saturdayLatestDoor, 'Latest Door');
      });

      // Select Early Bird / Night Owl winners with fallback priority
      const actionPriority = ['First FP+', 'First Presentation', 'First Transition', 'First Pitch', 'First DM', 'First Door'];
      const nightOwlPriority = ['Latest FP+', 'Latest Presentation', 'Latest Transition', 'Latest Pitch', 'Latest DM', 'Latest Door'];

      const selectEarlyBirdWinner = (candidates: EarlyBirdCandidate[]): TimingAward | null => {
        // Group by action type, prioritize by fallback order
        for (const actionType of actionPriority) {
          const matching = candidates.filter(c => c.actionType === actionType);
          if (matching.length > 0) {
            // Find earliest among matching
            const earliest = matching.reduce((a, b) => a.mins < b.mins ? a : b);
            return {
              userId: earliest.userId,
              name: earliest.name,
              value: earliest.mins,
              timeValue: formatTime(earliest.ts, earliest.timezone),
              actionType: earliest.actionType
            };
          }
        }
        return null;
      };

      const selectNightOwlWinner = (candidates: EarlyBirdCandidate[]): TimingAward | null => {
        // Group by action type, prioritize by fallback order
        for (const actionType of nightOwlPriority) {
          const matching = candidates.filter(c => c.actionType === actionType);
          if (matching.length > 0) {
            // Find latest among matching
            const latest = matching.reduce((a, b) => a.mins > b.mins ? a : b);
            return {
              userId: latest.userId,
              name: latest.name,
              value: latest.mins,
              timeValue: formatTime(latest.ts, latest.timezone),
              actionType: latest.actionType
            };
          }
        }
        return null;
      };

      result.gritAwards.earlyBirdWeekday = selectEarlyBirdWinner(earlyBirdWeekdayCandidates);
      result.gritAwards.earlyBirdSaturday = selectEarlyBirdWinner(earlyBirdSaturdayCandidates);
      result.gritAwards.nightOwlWeekday = selectNightOwlWinner(nightOwlWeekdayCandidates);
      result.gritAwards.nightOwlSaturday = selectNightOwlWinner(nightOwlSaturdayCandidates);

      // Check for Ironman award
      result.gritAwards.isSamePersonEarliestLatestDoor = 
        result.gritAwards.earliestDoor !== null && 
        result.gritAwards.latestDoor !== null &&
        result.gritAwards.earliestDoor.userId === result.gritAwards.latestDoor.userId;

      // Check if we have data for weekday/Saturday
      result.gritAwards.hasWeekdayData = result.gritAwards.weekday.earliestDoor !== null;
      result.gritAwards.hasSaturdayData = result.gritAwards.saturday.earliestDoor !== null;

      return result;
    },
    staleTime: 30000,
  });
};
