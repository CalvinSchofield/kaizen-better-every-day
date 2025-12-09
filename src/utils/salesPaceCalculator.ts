import { parseISO, format, isBefore, isAfter, startOfDay } from 'date-fns';

const PRESEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';
const SUMMER_END = '2026-09-27';

export interface SalesPaceResult {
  dailyGoal: number;
  expectedAtThisPoint: number;
  currentProgress: number;
  paceVariance: number;
  isOnTrack: boolean;
  remainingDailyNeeded: number;
  totalDays: number;
  knockingDays: number;
  futurePlannedDays: number;
  fundedGoal: number;
  isInPreseason: boolean;
}

export interface SalesPaceInput {
  goals: {
    preseason_fp_goal?: number | null;
    must_do_fp_goal?: number | null;
    will_do_fp_goal?: number | null;
    could_do_fp_goal?: number | null;
    cancel_rate?: number | null;
    setup_complete?: boolean | null;
  } | null | undefined;
  plannedDays: Array<{ planned_date: string }> | null | undefined;
  knockingDays: number;
  currentFpPlus: number;
  currentPrmr: number;
  efpModeEnabled: boolean;
  calculateEfp: (prmr: number) => number;
  activeTier?: 'preseason' | 'mustDo' | 'willDo' | 'couldDo';
  personalSummerStart?: string | null;
}

/**
 * Calculate sales pace status with consistent logic across the app.
 * 
 * Formula:
 * 1. Get the active goal (preseason or summer tier based on activeTier or current date)
 * 2. Apply cancel rate buffer: fundedGoal = goal / (1 - cancelRate)
 * 3. Convert goal to EFP if efpModeEnabled (goal remains same, just different units)
 * 4. totalDays = knockingDays (past worked) + futurePlannedDays
 * 5. dailyGoal = fundedGoal / totalDays
 * 6. expectedAtThisPoint = dailyGoal * knockingDays
 * 7. paceVariance = currentProgress - expectedAtThisPoint
 * 8. remainingDailyNeeded = remaining / (futurePlannedDays + 1 for today)
 */
export function calculateSalesPace(input: SalesPaceInput): SalesPaceResult | null {
  const {
    goals,
    plannedDays,
    knockingDays,
    currentFpPlus,
    currentPrmr,
    efpModeEnabled,
    calculateEfp,
    activeTier,
    personalSummerStart,
  } = input;

  if (!goals?.setup_complete) return null;

  const today = startOfDay(new Date());
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Determine if we're in preseason based on today's date
  const preseasonEndDate = parseISO(PRESEASON_END);
  const isDateInPreseason = !isAfter(today, preseasonEndDate);
  
  // If user has personal summer start, check if that has passed
  const personalStart = personalSummerStart ? parseISO(personalSummerStart) : null;
  const hasPersonalSummerStarted = personalStart ? !isBefore(today, personalStart) : false;
  
  // We're in preseason if the date is before preseason end AND user's personal summer hasn't started
  const isInPreseason = isDateInPreseason && !hasPersonalSummerStarted;
  
  // Determine which tier to use
  const effectiveTier = activeTier || (isInPreseason ? 'preseason' : 'willDo');
  
  // Get the goal based on tier
  let rawGoal = 0;
  if (effectiveTier === 'preseason') {
    rawGoal = goals.preseason_fp_goal || 0;
  } else if (effectiveTier === 'mustDo') {
    rawGoal = goals.must_do_fp_goal || 0;
  } else if (effectiveTier === 'willDo') {
    rawGoal = goals.will_do_fp_goal || goals.must_do_fp_goal || 0;
  } else if (effectiveTier === 'couldDo') {
    rawGoal = goals.could_do_fp_goal || 0;
  }
  
  if (rawGoal <= 0) return null;
  
  // Apply cancel rate buffer
  const cancelRate = goals.cancel_rate || 0;
  const fundedGoal = cancelRate > 0 && cancelRate < 1 
    ? rawGoal / (1 - cancelRate) 
    : rawGoal;
  
  // Determine season end date for calculating future planned days
  const seasonEndStr = isInPreseason ? PRESEASON_END : SUMMER_END;
  const seasonEndDate = parseISO(seasonEndStr);
  
  // Count future planned days (not including today, within season)
  const futurePlannedDays = plannedDays?.filter(d => {
    const date = parseISO(d.planned_date);
    return d.planned_date > todayStr && !isAfter(date, seasonEndDate);
  }).length || 0;
  
  // Total days = knocking days already done + future planned
  const totalDays = knockingDays + futurePlannedDays;
  
  if (totalDays <= 0) return null;
  
  // Daily goal = funded goal / total days
  const dailyGoal = fundedGoal / totalDays;
  
  // Calculate current progress based on mode
  // In EFP mode: progress is EFP (total PRMR / 85)
  // In FP+ mode: progress is FP+
  const currentProgress = efpModeEnabled ? calculateEfp(currentPrmr) : currentFpPlus;
  
  // Expected progress at this point = daily goal × knocking days completed
  const expectedAtThisPoint = dailyGoal * knockingDays;
  
  // Pace variance = actual - expected
  const paceVariance = currentProgress - expectedAtThisPoint;
  
  // Remaining needed = (funded goal - current progress) / remaining days
  const remaining = Math.max(0, fundedGoal - currentProgress);
  const remainingDays = futurePlannedDays + 1; // +1 for today
  const remainingDailyNeeded = remainingDays > 0 ? remaining / remainingDays : 0;
  
  return {
    dailyGoal,
    expectedAtThisPoint,
    currentProgress,
    paceVariance,
    isOnTrack: paceVariance >= 0,
    remainingDailyNeeded,
    totalDays,
    knockingDays,
    futurePlannedDays,
    fundedGoal,
    isInPreseason,
  };
}

/**
 * Get daily goal for display on calendar/other views
 * Returns the per-day target based on funded goal / total planned days
 */
export function getDailyGoal(input: Omit<SalesPaceInput, 'currentFpPlus' | 'currentPrmr'>): number | null {
  const result = calculateSalesPace({
    ...input,
    currentFpPlus: 0,
    currentPrmr: 0,
  });
  return result?.dailyGoal ?? null;
}
