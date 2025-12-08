import { differenceInDays, nextSunday, startOfDay } from "date-fns";

// Default summer start if user hasn't set personal dates
const DEFAULT_SUMMER_START = '2026-04-12';

export type PaceStatus = 'ahead' | 'on-track' | 'behind' | 'no-goal';

interface PaceResult {
  status: PaceStatus;
  expectedProgress: number;
  actualProgress: number;
  daysRemaining: number;
  neededPerDay: number;
}

/**
 * Calculate pace status for a commitment based on personal summer start date
 * Used for: books, role plays, MNL, recruits with sale, FP+
 */
export const calculatePreseasonPace = (
  current: number,
  goal: number,
  personalSummerStart: string | null | undefined,
  referenceDate?: Date
): PaceResult => {
  if (goal === 0) {
    return {
      status: 'no-goal',
      expectedProgress: 0,
      actualProgress: 0,
      daysRemaining: 0,
      neededPerDay: 0,
    };
  }

  const now = referenceDate ? startOfDay(referenceDate) : startOfDay(new Date());
  const summerStart = startOfDay(new Date(personalSummerStart || DEFAULT_SUMMER_START));
  
  // Preseason start date (when tracking began)
  const preseasonStart = startOfDay(new Date('2025-09-28'));
  
  const totalDays = differenceInDays(summerStart, preseasonStart);
  const elapsedDays = Math.max(0, differenceInDays(now, preseasonStart));
  const daysRemaining = Math.max(0, differenceInDays(summerStart, now));
  
  const actualProgress = current / goal;
  const expectedProgress = totalDays > 0 ? elapsedDays / totalDays : 0;
  
  // Calculate needed per day to hit goal
  const remaining = Math.max(0, goal - current);
  const neededPerDay = daysRemaining > 0 ? remaining / daysRemaining : remaining;
  
  let status: PaceStatus;
  if (actualProgress >= 1) {
    status = 'ahead';
  } else if (actualProgress >= expectedProgress * 0.9) {
    status = 'on-track';
  } else {
    status = 'behind';
  }
  
  return {
    status,
    expectedProgress,
    actualProgress,
    daysRemaining,
    neededPerDay,
  };
};

/**
 * Calculate pace status for weekly training hours (resets Sunday)
 */
export const calculateWeeklyTrainingPace = (
  currentMinutes: number,
  goalMinutes: number,
  referenceDate?: Date
): PaceResult => {
  if (goalMinutes === 0) {
    return {
      status: 'no-goal',
      expectedProgress: 0,
      actualProgress: 0,
      daysRemaining: 0,
      neededPerDay: 0,
    };
  }

  const now = referenceDate ? startOfDay(referenceDate) : startOfDay(new Date());
  const sunday = nextSunday(now);
  
  // Days in week (Mon-Sat = 6 working days typically, but calculate from today to Sunday)
  const daysRemaining = differenceInDays(sunday, now);
  
  // Calculate what day of the week we're on (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = now.getDay();
  // Days elapsed this week (Sunday = 0, Monday = 1, etc.)
  const daysElapsed = dayOfWeek === 0 ? 0 : dayOfWeek;
  const totalDaysInWeek = 7;
  
  const actualProgress = currentMinutes / goalMinutes;
  const expectedProgress = totalDaysInWeek > 0 ? daysElapsed / totalDaysInWeek : 0;
  
  // Calculate needed per day to hit goal
  const remainingMinutes = Math.max(0, goalMinutes - currentMinutes);
  const neededPerDay = daysRemaining > 0 ? remainingMinutes / daysRemaining : remainingMinutes;
  
  let status: PaceStatus;
  if (actualProgress >= 1) {
    status = 'ahead';
  } else if (actualProgress >= expectedProgress * 0.9) {
    status = 'on-track';
  } else {
    status = 'behind';
  }
  
  return {
    status,
    expectedProgress,
    actualProgress,
    daysRemaining,
    neededPerDay,
  };
};

/**
 * Get pace status for a commitment (helper that picks the right calculator)
 */
export const getCommitmentPaceStatus = (
  commitmentKey: string,
  current: number,
  goal: number,
  personalSummerStart: string | null | undefined,
  referenceDate?: Date
): PaceStatus => {
  // Training hours use weekly pace (resets Sunday)
  if (commitmentKey === 'training' || commitmentKey === 'training_hours_goal') {
    // For training, current is in minutes, goal is in minutes (hours * 60)
    return calculateWeeklyTrainingPace(current, goal, referenceDate).status;
  }
  
  // Blitzes use different logic (committed vs attended) - handled separately
  if (commitmentKey === 'blitzes' || commitmentKey === 'blitzes_goal') {
    // Blitzes don't have traditional pace - it's just committed vs attended
    if (goal === 0) return 'no-goal';
    if (current >= goal) return 'ahead';
    return 'on-track'; // Can't be "behind" on blitzes in traditional sense
  }
  
  // All other commitments use preseason pace based on summer start
  return calculatePreseasonPace(current, goal, personalSummerStart, referenceDate).status;
};
