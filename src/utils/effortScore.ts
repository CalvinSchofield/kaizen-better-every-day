/**
 * Effort Score Calculation System
 * 
 * Effort is measured by:
 * 1. Doors knocked (primary) - volume of work
 * 2. Start time (secondary) - late starts penalized
 * 3. End time (secondary) - early quits penalized
 * 
 * NOT included: Days worked count
 */

export interface EffortThresholds {
  // Doors per hour benchmarks
  doorsPerHourRookie: number;
  doorsPerHourVet: number;
  // Time thresholds (in minutes from midnight, local time)
  lateStartMinutes: number; // e.g., 630 = 10:30 AM
  earlyEndMinutes: number;  // e.g., 1140 = 7:00 PM
  // Minimum hours to be considered a "work day"
  minHoursWorked: number;
}

export const DEFAULT_EFFORT_THRESHOLDS: EffortThresholds = {
  doorsPerHourRookie: 12,
  doorsPerHourVet: 15,
  lateStartMinutes: 630,  // 10:30 AM
  earlyEndMinutes: 1140,  // 7:00 PM (19:00)
  minHoursWorked: 2,
};

export interface EffortFlag {
  type: 'low_doors' | 'late_start' | 'early_end' | 'volume_dropping' | 'output_below_capability' | 'below_personal_baseline';
  label: string;
  severity: 'warning' | 'critical';
}

export interface RepEffortData {
  userId: string;
  name: string;
  year?: string;
  doors: number;
  hoursWorked: number;
  startTimeMinutes?: number; // Minutes from midnight in local time
  endTimeMinutes?: number;   // Minutes from midnight in local time
  avgDoorsLast14Days?: number; // For trend comparison
  // Personal FP rate comparison
  avgFpPerDoor14Days?: number; // Their historical efficiency
  todayFp?: number;            // Today's FP
  todayDoors?: number;         // Today's doors (for calculating today's rate)
  // Personal baseline comparison
  avgFPPerWorkDay?: number;    // Their 2-week rolling FP/work day average
  avgDoorsPerWorkDay?: number; // Their 2-week rolling doors/work day average
}

export interface EffortResult {
  score: number; // 0-100
  category: 'outstanding' | 'standard' | 'needs_improvement';
  flags: EffortFlag[];
  doorsPerHour: number;
  benchmark: number;
}

/**
 * Convert UTC timestamp to minutes from midnight in a given timezone
 */
export const getLocalTimeMinutes = (utcTimestamp: string, timezone: string = 'America/Denver'): number => {
  try {
    const date = new Date(utcTimestamp);
    const localTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).format(date);
    
    const [hour, minute] = localTime.split(':').map(Number);
    return hour * 60 + minute;
  } catch {
    return 0;
  }
};

/**
 * Format minutes from midnight to a readable time string
 */
export const formatMinutesToTime = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${min.toString().padStart(2, '0')} ${period}`;
};

/**
 * Calculate effort score for a single rep
 */
export const calculateEffortScore = (
  rep: RepEffortData,
  thresholds: EffortThresholds = DEFAULT_EFFORT_THRESHOLDS
): EffortResult => {
  let score = 100;
  const flags: EffortFlag[] = [];
  
  // Determine benchmark based on year
  const isRookie = rep.year === 'Rookie';
  const benchmark = isRookie ? thresholds.doorsPerHourRookie : thresholds.doorsPerHourVet;
  
  // Calculate doors per hour
  const doorsPerHour = rep.hoursWorked > 0 ? rep.doors / rep.hoursWorked : 0;
  
  // Primary: Doors per hour vs benchmark
  if (rep.hoursWorked >= thresholds.minHoursWorked) {
    if (doorsPerHour < benchmark * 0.6) {
      score -= 40;
      flags.push({
        type: 'low_doors',
        label: `${doorsPerHour.toFixed(1)} doors/hr (goal: ${benchmark})`,
        severity: 'critical',
      });
    } else if (doorsPerHour < benchmark * 0.8) {
      score -= 20;
      flags.push({
        type: 'low_doors',
        label: `${doorsPerHour.toFixed(1)} doors/hr (goal: ${benchmark})`,
        severity: 'warning',
      });
    }
  }
  
  // Secondary: Start time (after threshold = penalty)
  if (rep.startTimeMinutes !== undefined && rep.startTimeMinutes > thresholds.lateStartMinutes) {
    const minutesLate = rep.startTimeMinutes - thresholds.lateStartMinutes;
    if (minutesLate > 60) {
      score -= 20;
      flags.push({
        type: 'late_start',
        label: `Started ${formatMinutesToTime(rep.startTimeMinutes)}`,
        severity: 'critical',
      });
    } else {
      score -= 10;
      flags.push({
        type: 'late_start',
        label: `Started ${formatMinutesToTime(rep.startTimeMinutes)}`,
        severity: 'warning',
      });
    }
  }
  
  // Secondary: End time (before threshold = penalty)
  if (rep.endTimeMinutes !== undefined && rep.endTimeMinutes < thresholds.earlyEndMinutes) {
    const minutesEarly = thresholds.earlyEndMinutes - rep.endTimeMinutes;
    if (minutesEarly > 60) {
      score -= 20;
      flags.push({
        type: 'early_end',
        label: `Ended ${formatMinutesToTime(rep.endTimeMinutes)}`,
        severity: 'critical',
      });
    } else {
      score -= 10;
      flags.push({
        type: 'early_end',
        label: `Ended ${formatMinutesToTime(rep.endTimeMinutes)}`,
        severity: 'warning',
      });
    }
  }
  
  // Volume trend: compare to own 14-day average
  if (rep.avgDoorsLast14Days !== undefined && rep.avgDoorsLast14Days > 0 && rep.hoursWorked >= thresholds.minHoursWorked) {
    const currentDoorsPerHour = doorsPerHour;
    const avgDoorsPerHour = rep.avgDoorsLast14Days;
    const percentChange = ((currentDoorsPerHour - avgDoorsPerHour) / avgDoorsPerHour) * 100;
    
    if (percentChange < -30) {
      score -= 15;
      flags.push({
        type: 'volume_dropping',
        label: `${Math.abs(percentChange).toFixed(0)}% below your average`,
        severity: 'warning',
      });
    }
  }
  
  // Output below capability: compare FP/door rate to personal average
  if (
    rep.avgFpPerDoor14Days !== undefined && 
    rep.avgFpPerDoor14Days > 0 && 
    rep.todayDoors !== undefined && 
    rep.todayDoors >= 20 && // Only flag if enough doors to be meaningful
    rep.todayFp !== undefined
  ) {
    const todayFpPerDoor = rep.todayDoors > 0 ? rep.todayFp / rep.todayDoors : 0;
    const percentOfAvg = (todayFpPerDoor / rep.avgFpPerDoor14Days) * 100;
    
    if (percentOfAvg < 70) {
      score -= 10;
      flags.push({
        type: 'output_below_capability',
        label: `Output ${Math.round(100 - percentOfAvg)}% below your usual rate`,
        severity: 'warning',
      });
    }
  }
  
  // Below personal baseline: compare today's FP to their 2-week average FP/day
  if (
    rep.avgFPPerWorkDay !== undefined &&
    rep.avgFPPerWorkDay > 0 &&
    rep.todayFp !== undefined &&
    rep.hoursWorked >= 4 // Only flag if significant work day
  ) {
    const percentOfBaseline = (rep.todayFp / rep.avgFPPerWorkDay) * 100;
    
    if (percentOfBaseline < 60) {
      score -= 10;
      flags.push({
        type: 'below_personal_baseline',
        label: `FP ${Math.round(100 - percentOfBaseline)}% below your daily average`,
        severity: 'warning',
      });
    }
  }
  
  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));
  
  // Determine category
  let category: 'outstanding' | 'standard' | 'needs_improvement';
  if (score >= 80) {
    category = 'outstanding';
  } else if (score >= 50) {
    category = 'standard';
  } else {
    category = 'needs_improvement';
  }
  
  return {
    score,
    category,
    flags,
    doorsPerHour,
    benchmark,
  };
};

/**
 * Calculate aggregate effort stats for a team
 */
export interface TeamEffortSummary {
  avgScore: number;
  outstandingCount: number;
  standardCount: number;
  needsImprovementCount: number;
  avgDoorsPerHour: number;
  totalFlags: number;
}

export const calculateTeamEffortSummary = (
  results: Array<{ rep: RepEffortData; result: EffortResult }>
): TeamEffortSummary => {
  if (results.length === 0) {
    return {
      avgScore: 0,
      outstandingCount: 0,
      standardCount: 0,
      needsImprovementCount: 0,
      avgDoorsPerHour: 0,
      totalFlags: 0,
    };
  }
  
  const avgScore = results.reduce((sum, r) => sum + r.result.score, 0) / results.length;
  const outstandingCount = results.filter(r => r.result.category === 'outstanding').length;
  const standardCount = results.filter(r => r.result.category === 'standard').length;
  const needsImprovementCount = results.filter(r => r.result.category === 'needs_improvement').length;
  
  const totalDoors = results.reduce((sum, r) => sum + r.rep.doors, 0);
  const totalHours = results.reduce((sum, r) => sum + r.rep.hoursWorked, 0);
  const avgDoorsPerHour = totalHours > 0 ? totalDoors / totalHours : 0;
  
  const totalFlags = results.reduce((sum, r) => sum + r.result.flags.length, 0);
  
  return {
    avgScore,
    outstandingCount,
    standardCount,
    needsImprovementCount,
    avgDoorsPerHour,
    totalFlags,
  };
};
