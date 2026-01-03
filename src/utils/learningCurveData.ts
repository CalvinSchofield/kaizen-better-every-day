// Learning curve example data based on typical rookie progression patterns
// Shows that early weeks have lower sales but accelerate over time

export interface LearningCurveWeek {
  week: number;
  sales: number;
  cumulative: number;
}

// 24-week summer example: Goal of 100, slow start, accelerating finish
export const LEARNING_CURVE_24_WEEKS: LearningCurveWeek[] = [
  { week: 1, sales: 0.5, cumulative: 0.5 },
  { week: 2, sales: 1, cumulative: 1.5 },
  { week: 3, sales: 1.5, cumulative: 3 },
  { week: 4, sales: 2, cumulative: 5 },
  { week: 5, sales: 2, cumulative: 7 },
  { week: 6, sales: 2.5, cumulative: 9.5 },
  { week: 7, sales: 3, cumulative: 12.5 },
  { week: 8, sales: 3, cumulative: 15.5 },
  { week: 9, sales: 3.5, cumulative: 19 },
  { week: 10, sales: 4, cumulative: 23 },
  { week: 11, sales: 4, cumulative: 27 },
  { week: 12, sales: 4.5, cumulative: 31.5 },
  { week: 13, sales: 5, cumulative: 36.5 },
  { week: 14, sales: 5, cumulative: 41.5 },
  { week: 15, sales: 5, cumulative: 46.5 },
  { week: 16, sales: 5.5, cumulative: 52 },
  { week: 17, sales: 5.5, cumulative: 57.5 },
  { week: 18, sales: 6, cumulative: 63.5 },
  { week: 19, sales: 6, cumulative: 69.5 },
  { week: 20, sales: 6.5, cumulative: 76 },
  { week: 21, sales: 6.5, cumulative: 82.5 },
  { week: 22, sales: 6, cumulative: 88.5 },
  { week: 23, sales: 6, cumulative: 94.5 },
  { week: 24, sales: 5.5, cumulative: 100 },
];

// 18-week summer example: Goal of 100, more compressed timeline
export const LEARNING_CURVE_18_WEEKS: LearningCurveWeek[] = [
  { week: 1, sales: 1, cumulative: 1 },
  { week: 2, sales: 2, cumulative: 3 },
  { week: 3, sales: 2.5, cumulative: 5.5 },
  { week: 4, sales: 3, cumulative: 8.5 },
  { week: 5, sales: 4, cumulative: 12.5 },
  { week: 6, sales: 4.5, cumulative: 17 },
  { week: 7, sales: 5, cumulative: 22 },
  { week: 8, sales: 5.5, cumulative: 27.5 },
  { week: 9, sales: 6, cumulative: 33.5 },
  { week: 10, sales: 6.5, cumulative: 40 },
  { week: 11, sales: 7, cumulative: 47 },
  { week: 12, sales: 7, cumulative: 54 },
  { week: 13, sales: 7.5, cumulative: 61.5 },
  { week: 14, sales: 7.5, cumulative: 69 },
  { week: 15, sales: 8, cumulative: 77 },
  { week: 16, sales: 8, cumulative: 85 },
  { week: 17, sales: 8, cumulative: 93 },
  { week: 18, sales: 7, cumulative: 100 },
];

// Get the closest learning curve example based on user's planned weeks
export function getClosestLearningCurve(plannedWeeks: number): LearningCurveWeek[] {
  // If closer to 18 weeks, use 18-week example, otherwise use 24-week
  const midpoint = (18 + 24) / 2; // 21
  return plannedWeeks < midpoint ? LEARNING_CURVE_18_WEEKS : LEARNING_CURVE_24_WEEKS;
}

// Scale the learning curve to match user's actual goal
export function scaleLearningCurve(
  curve: LearningCurveWeek[],
  targetGoal: number
): LearningCurveWeek[] {
  const originalMax = curve[curve.length - 1].cumulative;
  const scale = targetGoal / originalMax;
  
  return curve.map(week => ({
    week: week.week,
    sales: Math.round(week.sales * scale * 10) / 10,
    cumulative: Math.round(week.cumulative * scale * 10) / 10,
  }));
}

// Get a message about the learning curve based on current week
export function getLearningCurveMessage(
  currentWeek: number,
  totalWeeks: number,
  currentProgress: number,
  goal: number
): string {
  const percentComplete = (currentProgress / goal) * 100;
  const weekPercent = (currentWeek / totalWeeks) * 100;
  
  // First few weeks - always encouraging
  if (currentWeek <= 3) {
    return "The first weeks are about building skills, not hitting numbers. Every rep starts here.";
  }
  
  // Early season (weeks 4-6)
  if (currentWeek <= 6) {
    if (percentComplete >= weekPercent * 0.5) {
      return "You're building strong momentum early! Keep that energy going.";
    }
    return "You're right on the typical rookie path. The acceleration phase is coming.";
  }
  
  // Mid season (weeks 7-12) - the acceleration phase
  if (currentWeek <= 12) {
    if (percentComplete >= weekPercent) {
      return "You're ahead of pace! Your hard work is paying off.";
    }
    if (percentComplete >= weekPercent * 0.7) {
      return "This is when acceleration happens. Your best weeks are ahead.";
    }
    return "The learning curve gets easier from here. Stay consistent.";
  }
  
  // Late season - focus on finishing strong
  if (percentComplete >= weekPercent) {
    return "You're on track to crush your goal. Keep pushing!";
  }
  return "Time to dig deep. You have the skills - now finish strong.";
}
