/**
 * Goal Pace Calculations
 * 
 * Determines if reps are on pace, at risk, or behind their goals
 * based on time elapsed and current progress
 */

import { differenceInDays, parseISO, startOfYear, endOfYear, isWithinInterval } from "date-fns";

export interface RepGoalData {
  user_id: string;
  name: string;
  preseason_fp_goal: number | null;
  must_do_fp_goal: number | null;
  will_do_fp_goal: number | null;
  could_do_fp_goal: number | null;
  focus_tier: string | null;
  setup_complete: boolean | null;
}

export interface RepProgress {
  userId: string;
  currentFP: number;
}

export type GoalPaceStatus = 'on_pace' | 'at_risk' | 'behind' | 'no_goals';

export interface GoalPaceResult {
  userId: string;
  name: string;
  status: GoalPaceStatus;
  activeGoal: number;
  currentProgress: number;
  expectedAtThisPoint: number;
  percentOfExpected: number;
}

/**
 * Determine if we're in preseason (before May 1st typically)
 */
export const isPreseason = (date: Date = new Date()): boolean => {
  const month = date.getMonth(); // 0-indexed
  return month < 4; // Before May (0=Jan, 1=Feb, 2=Mar, 3=Apr)
};

/**
 * Get the season date range
 */
export const getSeasonDateRange = (date: Date = new Date()): { start: Date; end: Date } => {
  const year = date.getFullYear();
  
  if (isPreseason(date)) {
    // Preseason: Jan 1 - Apr 30
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 3, 30),
    };
  } else {
    // Summer season: May 1 - Aug 31
    return {
      start: new Date(year, 4, 1),
      end: new Date(year, 7, 31),
    };
  }
};

/**
 * Calculate expected progress at this point in the season
 */
export const calculateExpectedProgress = (
  goal: number,
  seasonStart: Date,
  seasonEnd: Date,
  currentDate: Date = new Date()
): number => {
  const totalDays = differenceInDays(seasonEnd, seasonStart);
  const elapsedDays = differenceInDays(currentDate, seasonStart);
  
  if (totalDays <= 0 || elapsedDays <= 0) return 0;
  
  const percentElapsed = Math.min(1, elapsedDays / totalDays);
  return goal * percentElapsed;
};

/**
 * Determine goal pace status for a rep
 */
export const calculateGoalPaceStatus = (
  goalData: RepGoalData,
  currentFP: number,
  currentDate: Date = new Date()
): GoalPaceResult => {
  // Check if rep has goals set up
  if (!goalData.setup_complete) {
    return {
      userId: goalData.user_id,
      name: goalData.name,
      status: 'no_goals',
      activeGoal: 0,
      currentProgress: currentFP,
      expectedAtThisPoint: 0,
      percentOfExpected: 0,
    };
  }

  // Determine active goal based on season and focus tier
  let activeGoal: number;
  
  if (isPreseason(currentDate)) {
    activeGoal = goalData.preseason_fp_goal || 0;
  } else {
    // Summer season - use focus tier
    const tier = goalData.focus_tier || 'willDo';
    switch (tier) {
      case 'mustDo':
        activeGoal = goalData.must_do_fp_goal || 0;
        break;
      case 'couldDo':
        activeGoal = goalData.could_do_fp_goal || 0;
        break;
      case 'willDo':
      default:
        activeGoal = goalData.will_do_fp_goal || 0;
    }
  }

  // No goal set
  if (activeGoal <= 0) {
    return {
      userId: goalData.user_id,
      name: goalData.name,
      status: 'no_goals',
      activeGoal: 0,
      currentProgress: currentFP,
      expectedAtThisPoint: 0,
      percentOfExpected: 0,
    };
  }

  // Calculate expected progress
  const { start, end } = getSeasonDateRange(currentDate);
  const expectedAtThisPoint = calculateExpectedProgress(activeGoal, start, end, currentDate);
  
  const percentOfExpected = expectedAtThisPoint > 0 
    ? (currentFP / expectedAtThisPoint) * 100 
    : 100;

  // Determine status based on percent of expected
  let status: GoalPaceStatus;
  if (percentOfExpected >= 90) {
    status = 'on_pace';
  } else if (percentOfExpected >= 70) {
    status = 'at_risk';
  } else {
    status = 'behind';
  }

  return {
    userId: goalData.user_id,
    name: goalData.name,
    status,
    activeGoal,
    currentProgress: currentFP,
    expectedAtThisPoint,
    percentOfExpected,
  };
};

/**
 * Calculate goal pace for all team members
 */
export const calculateTeamGoalPace = (
  goalsData: RepGoalData[],
  progressData: RepProgress[]
): GoalPaceResult[] => {
  const progressMap = new Map(progressData.map(p => [p.userId, p.currentFP]));
  
  return goalsData.map(goal => {
    const currentFP = progressMap.get(goal.user_id) || 0;
    return calculateGoalPaceStatus(goal, currentFP);
  });
};
