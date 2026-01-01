import { useMemo } from "react";
import { format, startOfWeek, differenceInDays } from "date-fns";

export interface SummerRepData {
  userId: string;
  notionPageId: string;
  name: string;
  year: string;
  personalSummerStart: string | null;
  personalSummerEnd: string | null;
  mustDoGoal: number;
  willDoGoal: number;
  couldDoGoal: number;
  currentFpPlus: number;
  knockingDaysCount: number;
}

export interface SummerRecommendation {
  rep: SummerRepData;
  priority: number;
  reason: string;
  reasonBadge: 'bagel' | 'record' | 'off-pace' | 'plateau' | 'work-ethic' | 'praise' | 'check-in' | 'needs-review';
  details?: {
    daysSinceSale?: number;
    knockingDays?: number;
    pacePercentage?: number;
    recordType?: 'personal' | 'class';
    recordPeriod?: 'day' | 'week' | 'month';
    avgStartTime?: string;
    avgEndTime?: string;
    avgDaysPerWeek?: number;
  };
}

interface DailyEntryData {
  user_id: string;
  entry_date: string;
  fp_plus: number;
  work_start_time: string | null;
  work_end_time: string | null;
  doors_knocked: number;
  is_finalized: boolean;
}

interface RecordBreaker {
  userId: string;
  name: string;
  year: string;
  recordType: 'personal' | 'class';
  period: 'day' | 'week' | 'month';
  newValue: number;
  previousValue: number;
}

interface UseSummerRecommendationsParams {
  reps: SummerRepData[];
  entries: DailyEntryData[];
  recordBreakers?: RecordBreaker[];
  repsNeedingMonthlyReview?: string[]; // User IDs of reps needing monthly 1-on-1
}

// Minimum doors to count as a "knocking day"
const MIN_DOORS_FOR_KNOCKING_DAY = 4;

export const useSummerRecommendations = ({
  reps,
  entries,
  recordBreakers = [],
  repsNeedingMonthlyReview = [],
}: UseSummerRecommendationsParams) => {
  return useMemo(() => {
    if (!reps.length) return [];

    const recommendations: SummerRecommendation[] = [];
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // Set of user IDs needing monthly review for quick lookup
    const needsReviewSet = new Set(repsNeedingMonthlyReview);

    // Group entries by user
    const entriesByUser = new Map<string, DailyEntryData[]>();
    entries.forEach(entry => {
      if (!entriesByUser.has(entry.user_id)) {
        entriesByUser.set(entry.user_id, []);
      }
      entriesByUser.get(entry.user_id)!.push(entry);
    });

    // Process each rep
    reps.forEach(rep => {
      // Skip if rep hasn't started summer yet
      if (rep.personalSummerStart && todayStr < rep.personalSummerStart) {
        return;
      }

      const userEntries = entriesByUser.get(rep.userId) || [];
      const finalizedEntries = userEntries.filter(e => e.is_finalized);
      
      // Calculate knocking days (4+ doors with start/end times)
      const knockingDays = finalizedEntries.filter(e => 
        e.doors_knocked >= MIN_DOORS_FOR_KNOCKING_DAY && 
        e.work_start_time && 
        e.work_end_time
      );

      const knockingDaysCount = knockingDays.length;
      const totalFpPlus = finalizedEntries.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
      
      // Days since last sale (FP+ > 0)
      const salesDays = finalizedEntries.filter(e => Number(e.fp_plus) > 0).sort((a, b) => 
        b.entry_date.localeCompare(a.entry_date)
      );
      const lastSaleDate = salesDays[0]?.entry_date;
      const daysSinceSale = lastSaleDate ? differenceInDays(today, new Date(lastSaleDate + 'T12:00:00')) : null;

      const firstName = rep.name?.split(' ')[0] || 'Rep';

      // P0: BAGEL ALERT - 0 FP+ after 2+ knocking days
      if (knockingDaysCount >= 2 && totalFpPlus === 0) {
        recommendations.push({
          rep,
          priority: 300,
          reason: `🚨 ${firstName} has BAGELED after ${knockingDaysCount} days—needs immediate support`,
          reasonBadge: 'bagel',
          details: { knockingDays: knockingDaysCount },
        });
        return; // Don't add other recommendations for this rep
      }

      // P1: RECORD BREAKER - praise them!
      const repRecords = recordBreakers.filter(r => r.userId === rep.userId);
      if (repRecords.length > 0) {
        const bestRecord = repRecords.sort((a, b) => {
          // Prioritize class records over personal, and longer periods
          const typeScore = (r: typeof repRecords[0]) => r.recordType === 'class' ? 10 : 0;
          const periodScore = (r: typeof repRecords[0]) => r.period === 'month' ? 3 : r.period === 'week' ? 2 : 1;
          return (typeScore(b) + periodScore(b)) - (typeScore(a) + periodScore(a));
        })[0];

        const recordLabel = bestRecord.recordType === 'class' 
          ? `${rep.year.toUpperCase()} ${bestRecord.period} record` 
          : `personal ${bestRecord.period} record`;

        recommendations.push({
          rep,
          priority: 250,
          reason: `🏆 ${firstName} just broke the ${recordLabel}! Praise them!`,
          reasonBadge: 'record',
          details: {
            recordType: bestRecord.recordType,
            recordPeriod: bestRecord.period,
          },
        });
        return; // Prioritize celebration
      }

      // P2: OFF PACE - not tracking toward Will Do goal
      if (rep.willDoGoal > 0 && rep.personalSummerStart && rep.personalSummerEnd) {
        const summerStart = new Date(rep.personalSummerStart + 'T12:00:00');
        const summerEnd = new Date(rep.personalSummerEnd + 'T12:00:00');
        const totalSummerDays = differenceInDays(summerEnd, summerStart) + 1;
        const daysElapsed = Math.max(1, differenceInDays(today, summerStart) + 1);
        
        const expectedProgress = (rep.willDoGoal / totalSummerDays) * daysElapsed;
        const pacePercentage = (rep.currentFpPlus / expectedProgress) * 100;

        if (pacePercentage < 80 && knockingDaysCount >= 3) {
          recommendations.push({
            rep,
            priority: 180 - pacePercentage,
            reason: `${firstName} is at ${Math.round(pacePercentage)}% of expected pace for Will Do goal`,
            reasonBadge: 'off-pace',
            details: { pacePercentage: Math.round(pacePercentage), knockingDays: knockingDaysCount },
          });
        }
      }

      // P3: PLATEAU - flat FP+ for 2+ weeks
      if (knockingDaysCount >= 10) {
        const sortedByDate = [...finalizedEntries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
        const twoWeeksAgo = format(new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
        const fourWeeksAgo = format(new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
        
        const recentWeekFp = sortedByDate
          .filter(e => e.entry_date >= twoWeeksAgo)
          .reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
        
        const previousWeekFp = sortedByDate
          .filter(e => e.entry_date >= fourWeeksAgo && e.entry_date < twoWeeksAgo)
          .reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);

        // Plateau if within ±0.5 FP+ AND behind pace
        if (Math.abs(recentWeekFp - previousWeekFp) <= 0.5 && rep.willDoGoal > 0) {
          const expectedWeekly = rep.willDoGoal / 18; // Assume ~18 weeks of summer
          if (recentWeekFp < expectedWeekly * 0.9) {
            recommendations.push({
              rep,
              priority: 120,
              reason: `${firstName} is plateauing—same output for 2 weeks and below pace`,
              reasonBadge: 'plateau',
            });
          }
        }
      }

      // P4: NEEDS MONTHLY REVIEW - hasn't had monthly 1-on-1 this month
      if (needsReviewSet.has(rep.userId)) {
        recommendations.push({
          rep,
          priority: 100,
          reason: `Monthly 1-on-1 due for ${firstName}`,
          reasonBadge: 'needs-review',
        });
      }

      // P5: WORK ETHIC FLAGS - late starts, early finishes, few days worked
      if (knockingDaysCount >= 5) {
        const workTimes = knockingDays.filter(e => e.work_start_time && e.work_end_time);
        
        if (workTimes.length >= 3) {
          // Calculate average start/end times
          const avgStartMinutes = workTimes.reduce((sum, e) => {
            const start = new Date(e.work_start_time!);
            return sum + start.getHours() * 60 + start.getMinutes();
          }, 0) / workTimes.length;

          const avgEndMinutes = workTimes.reduce((sum, e) => {
            const end = new Date(e.work_end_time!);
            return sum + end.getHours() * 60 + end.getMinutes();
          }, 0) / workTimes.length;

          const avgStartTime = `${Math.floor(avgStartMinutes / 60)}:${String(Math.round(avgStartMinutes % 60)).padStart(2, '0')}`;
          const avgEndTime = `${Math.floor(avgEndMinutes / 60)}:${String(Math.round(avgEndMinutes % 60)).padStart(2, '0')}`;

          // Flag if avg start > 1pm (780 minutes) or avg end < 6pm (1080 minutes)
          if (avgStartMinutes > 780) {
            recommendations.push({
              rep,
              priority: 80,
              reason: `${firstName} averages starting at ${avgStartTime}—needs earlier start`,
              reasonBadge: 'work-ethic',
              details: { avgStartTime },
            });
          } else if (avgEndMinutes < 1080) {
            recommendations.push({
              rep,
              priority: 70,
              reason: `${firstName} averages finishing at ${avgEndTime}—could push later`,
              reasonBadge: 'work-ethic',
              details: { avgEndTime },
            });
          }
        }

        // Check days per week
        const weekCounts = new Map<string, number>();
        knockingDays.forEach(e => {
          const weekStart = format(startOfWeek(new Date(e.entry_date + 'T12:00:00'), { weekStartsOn: 0 }), 'yyyy-MM-dd');
          weekCounts.set(weekStart, (weekCounts.get(weekStart) || 0) + 1);
        });

        const avgDaysPerWeek = Array.from(weekCounts.values()).reduce((a, b) => a + b, 0) / weekCounts.size;
        if (avgDaysPerWeek < 4 && weekCounts.size >= 2) {
          recommendations.push({
            rep,
            priority: 60,
            reason: `${firstName} averages ${avgDaysPerWeek.toFixed(1)} days/week—could work more`,
            reasonBadge: 'work-ethic',
            details: { avgDaysPerWeek },
          });
        }
      }
    });

    // Sort by priority (highest first)
    return recommendations.sort((a, b) => b.priority - a.priority);
  }, [reps, entries, recordBreakers, repsNeedingMonthlyReview]);
};
