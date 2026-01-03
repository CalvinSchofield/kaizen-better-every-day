import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, differenceInWeeks, format, isAfter, isBefore, getDay } from "date-fns";

const PRESEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';
const GLOBAL_SUMMER_END = '2026-09-27';

export interface PersonalBenchmarks {
  bestDay: number;
  currentAverage: number;  // 18-day rolling average (only when hasEnoughData)
  knockingDaysCompleted: number;
  weekInSummer: number;
  hasEnoughData: boolean;  // True when 18+ knocking days
  projectedFinal: number;  // Where they'll land at current pace
  canAddMoreDays: boolean; // Whether more days can be added
  availableDaysToAdd: number; // How many Mon-Sat days available
}

interface UsePersonalBenchmarksInput {
  userId: string | null | undefined;
  personalSummerStart: string | null | undefined;
  personalSummerEnd: string | null | undefined;
  efpModeEnabled: boolean;
  calculateEfp: (prmr: number) => number;
  currentProgress: number;
  futurePlannedDays: number;
  fundedGoal: number;
}

export const usePersonalBenchmarks = ({
  userId,
  personalSummerStart,
  personalSummerEnd,
  efpModeEnabled,
  calculateEfp,
  currentProgress,
  futurePlannedDays,
  fundedGoal,
}: UsePersonalBenchmarksInput) => {
  return useQuery({
    queryKey: ['personal-benchmarks', userId, personalSummerStart, efpModeEnabled],
    queryFn: async (): Promise<PersonalBenchmarks> => {
      if (!userId) {
        return getDefaultBenchmarks();
      }

      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');

      // Fetch all finalized daily entries
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date, fp_plus, prmr, upgrade_prmr, doors_knocked, work_start_time, work_end_time')
        .eq('user_id', userId)
        .eq('is_finalized', true)
        .order('entry_date', { ascending: false });

      if (error || !entries) {
        return getDefaultBenchmarks();
      }

      // Filter to knocking days only (doors >= 5, has work times)
      const knockingDays = entries.filter(e => 
        (e.doors_knocked || 0) >= 5 && e.work_start_time && e.work_end_time
      );

      const knockingDaysCompleted = knockingDays.length;

      // Calculate daily values in correct mode
      const dailyValues = knockingDays.map(e => {
        const totalPrmr = (e.prmr || 0) + (e.upgrade_prmr || 0);
        return efpModeEnabled ? calculateEfp(totalPrmr) : (e.fp_plus || 0) + ((e.upgrade_prmr || 0) / 85);
      });

      // Best day
      const bestDay = dailyValues.length > 0 ? Math.max(...dailyValues) : 0;

      // 18-day rolling average (only meaningful if 18+ days)
      const hasEnoughData = knockingDaysCompleted >= 18;
      const recentDays = dailyValues.slice(0, 18);
      const currentAverage = recentDays.length > 0 
        ? recentDays.reduce((a, b) => a + b, 0) / recentDays.length 
        : 0;

      // Calculate week in summer
      let weekInSummer = 0;
      if (personalSummerStart) {
        const summerStart = parseISO(personalSummerStart);
        if (!isBefore(today, summerStart)) {
          weekInSummer = Math.max(1, differenceInWeeks(today, summerStart) + 1);
        }
      }

      // Calculate projected final based on current average and remaining days
      const remainingDays = futurePlannedDays + 1; // +1 for today
      const projectedFinal = currentAverage > 0 
        ? currentProgress + (currentAverage * remainingDays)
        : 0;

      // Calculate available days to add (Mon-Sat within valid ranges)
      const { canAddMoreDays, availableDaysToAdd } = calculateAvailableDays(
        todayStr,
        personalSummerStart,
        personalSummerEnd,
        userId
      );

      return {
        bestDay: Math.round(bestDay * 10) / 10,
        currentAverage: hasEnoughData ? Math.round(currentAverage * 100) / 100 : 0,
        knockingDaysCompleted,
        weekInSummer,
        hasEnoughData,
        projectedFinal: Math.round(projectedFinal * 10) / 10,
        canAddMoreDays,
        availableDaysToAdd,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

function getDefaultBenchmarks(): PersonalBenchmarks {
  return {
    bestDay: 0,
    currentAverage: 0,
    knockingDaysCompleted: 0,
    weekInSummer: 0,
    hasEnoughData: false,
    projectedFinal: 0,
    canAddMoreDays: false,
    availableDaysToAdd: 0,
  };
}

/**
 * Calculate available Mon-Sat days that could be added as work days.
 * Only counts days within preseason (before personal_summer_start) or 
 * personal summer dates (personal_summer_start to personal_summer_end).
 * Never counts days after global summer end.
 */
function calculateAvailableDays(
  todayStr: string,
  personalSummerStart: string | null | undefined,
  personalSummerEnd: string | null | undefined,
  _userId: string
): { canAddMoreDays: boolean; availableDaysToAdd: number } {
  const today = parseISO(todayStr);
  const globalEnd = parseISO(GLOBAL_SUMMER_END);
  
  // If we're past the global summer end, no days can be added
  if (isAfter(today, globalEnd)) {
    return { canAddMoreDays: false, availableDaysToAdd: 0 };
  }

  let availableCount = 0;

  // Helper to count Mon-Sat days between two dates
  const countMonSatDays = (start: Date, end: Date): number => {
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = getDay(current);
      if (dayOfWeek !== 0) { // Not Sunday
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  // Check preseason availability
  const preseasonEnd = parseISO(PRESEASON_END);
  if (isBefore(today, preseasonEnd) || today.toISOString().split('T')[0] === PRESEASON_END) {
    const startDate = today;
    const endDate = personalSummerStart 
      ? parseISO(personalSummerStart) < preseasonEnd 
        ? parseISO(personalSummerStart) 
        : preseasonEnd
      : preseasonEnd;
    
    if (isBefore(startDate, endDate)) {
      availableCount += countMonSatDays(startDate, endDate);
    }
  }

  // Check summer availability
  if (personalSummerStart && personalSummerEnd) {
    const summerStart = parseISO(personalSummerStart);
    const summerEnd = parseISO(personalSummerEnd);
    const effectiveEnd = isBefore(summerEnd, globalEnd) ? summerEnd : globalEnd;
    
    if (!isAfter(today, effectiveEnd)) {
      const effectiveStart = isBefore(today, summerStart) ? summerStart : today;
      if (isBefore(effectiveStart, effectiveEnd)) {
        availableCount += countMonSatDays(effectiveStart, effectiveEnd);
      }
    }
  }

  return {
    canAddMoreDays: availableCount > 0,
    availableDaysToAdd: availableCount,
  };
}
