/**
 * Intraday Pace Calculations
 * 
 * Calculates "expected by now" KPI milestones based on the team's
 * historical performance, split by day type (Weekday vs Saturday).
 * 
 * Uses uniform distribution assumption: if a rep averages X doors
 * over Y hours, they're expected to have (X/Y * hoursElapsed) doors
 * at the current time.
 */

import { RepBaseline } from "./baselineCalculations";

export type DayType = 'weekday' | 'saturday';

export interface IntradayKpis {
  doors: number;
  dms: number;
  pitches: number;
  transitions: number;
  presentations: number;
  fp: number;
}

export interface IntradayPaceResult {
  /** What the team would typically have produced by this time */
  expectedNow: IntradayKpis;
  /** What the team has actually produced so far */
  actualNow: IntradayKpis;
  /** Per-KPI delta percentages (positive = ahead) */
  deltas: Record<keyof IntradayKpis, number | null>;
  /** 'weekday' or 'saturday' */
  dayType: DayType;
  /** 0-1 fraction of typical work day elapsed (capped by 9 PM end) */
  pctDayElapsed: number;
  /** Whether there's enough historical data (>= 3 matching day-type entries) */
  hasEnoughData: boolean;
  /** Formatted current time label e.g. "3:12 PM" */
  timeLabel: string;
  /** Day name e.g. "Wednesday" */
  dayName: string;
}

/**
 * Get the current day type based on JS day index (0=Sun, 6=Sat)
 */
export const getDayType = (dayIndex: number): DayType | null => {
  if (dayIndex === 0) return null; // Sunday — no pacing
  if (dayIndex === 6) return 'saturday';
  return 'weekday';
};

/**
 * Filter RepBaselines to only include entries matching a day type.
 * This requires the per-rep baselines to have been calculated with
 * day-type-specific entries (weekdayBaseline or saturdayBaseline).
 */

/**
 * Calculate the fraction of the work day elapsed.
 * Uses 9 PM local as the fixed end-of-day anchor (per plan).
 * avgStartMinutes comes from the team baseline.
 */
export const calculateDayFractionElapsed = (
  nowMinutes: number,
  avgStartMinutes: number,
): number => {
  const END_OF_DAY_MINUTES = 21 * 60; // 9 PM = 1260 minutes
  const totalDayMinutes = END_OF_DAY_MINUTES - avgStartMinutes;
  if (totalDayMinutes <= 0) return 0;

  const elapsed = nowMinutes - avgStartMinutes;
  if (elapsed <= 0) return 0;
  return Math.min(1, elapsed / totalDayMinutes);
};

/**
 * Core intraday pace calculation.
 * 
 * For each rep working today, estimates what they'd typically have produced
 * by the current time, based on their historical average and the fraction
 * of the work day that has elapsed.
 * 
 * @param repBaselines - Day-type-specific baselines (already filtered for weekday or saturday)
 * @param actualKpis - Current live totals for the team
 * @param nowMinutes - Current local time in minutes from midnight
 * @param dayType - 'weekday' or 'saturday'
 */
export const calculateIntradayPace = (
  repBaselines: RepBaseline[],
  actualKpis: IntradayKpis,
  nowMinutes: number,
  dayType: DayType,
): IntradayPaceResult => {
  const END_OF_DAY_MINUTES = 21 * 60; // 9 PM

  // Only reps flagged as working today contribute to expected
  const workingReps = repBaselines.filter(r => r.isWorkingToday && r.workDaysIn14 >= 1);
  
  // Need at least 3 total work-day data points across working reps
  const totalDataDays = workingReps.reduce((sum, r) => sum + r.workDaysIn14, 0);
  const hasEnoughData = totalDataDays >= 3;

  if (!hasEnoughData || workingReps.length === 0) {
    return {
      expectedNow: { doors: 0, dms: 0, pitches: 0, transitions: 0, presentations: 0, fp: 0 },
      actualNow: actualKpis,
      deltas: { doors: null, dms: null, pitches: null, transitions: null, presentations: null, fp: null },
      dayType,
      pctDayElapsed: 0,
      hasEnoughData: false,
      timeLabel: formatMinutesToTime(nowMinutes),
      dayName: '',
    };
  }

  // Calculate team-level avg start from working reps
  const startMinutes = workingReps
    .filter(r => r.avgStartMinutes !== null)
    .map(r => r.avgStartMinutes!);
  const teamAvgStart = startMinutes.length > 0
    ? startMinutes.reduce((a, b) => a + b, 0) / startMinutes.length
    : 9 * 60; // default 9 AM

  const pctDayElapsed = calculateDayFractionElapsed(nowMinutes, teamAvgStart);

  // Sum expected-by-now across all working reps
  const expectedNow: IntradayKpis = { doors: 0, dms: 0, pitches: 0, transitions: 0, presentations: 0, fp: 0 };

  for (const rep of workingReps) {
    // Each rep's fraction is based on their own avg start, but capped at 9 PM
    const repStart = rep.avgStartMinutes ?? teamAvgStart;
    const repTotalDay = END_OF_DAY_MINUTES - repStart;
    if (repTotalDay <= 0) continue;

    const repElapsed = Math.max(0, nowMinutes - repStart);
    const repFraction = Math.min(1, repElapsed / repTotalDay);

    expectedNow.doors += rep.avgDoorsPerWorkDay * repFraction;
    expectedNow.dms += rep.avgDMsPerWorkDay * repFraction;
    expectedNow.pitches += rep.avgPitchesPerWorkDay * repFraction;
    expectedNow.transitions += rep.avgTransitionsPerWorkDay * repFraction;
    expectedNow.presentations += rep.avgPresentationsPerWorkDay * repFraction;
    expectedNow.fp += rep.avgFPPerWorkDay * repFraction;
  }

  // Calculate deltas
  const deltas: Record<keyof IntradayKpis, number | null> = {
    doors: calcDeltaPct(actualKpis.doors, expectedNow.doors),
    dms: calcDeltaPct(actualKpis.dms, expectedNow.dms),
    pitches: calcDeltaPct(actualKpis.pitches, expectedNow.pitches),
    transitions: calcDeltaPct(actualKpis.transitions, expectedNow.transitions),
    presentations: calcDeltaPct(actualKpis.presentations, expectedNow.presentations),
    fp: calcDeltaPct(actualKpis.fp, expectedNow.fp),
  };

  return {
    expectedNow,
    actualNow: actualKpis,
    deltas,
    dayType,
    pctDayElapsed,
    hasEnoughData,
    timeLabel: formatMinutesToTime(nowMinutes),
    dayName: '',
  };
};

function calcDeltaPct(actual: number, expected: number): number | null {
  if (expected <= 0 && actual <= 0) return null;
  if (expected <= 0) return actual > 0 ? 100 : null;
  return ((actual - expected) / expected) * 100;
}

function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

/**
 * Generate a pace-aware pulse sentence for live view.
 */
export const generatePacePulseSentence = (
  pace: IntradayPaceResult,
  dayName: string,
): string | null => {
  if (!pace.hasEnoughData) return null;
  
  const fpDelta = pace.deltas.fp;
  if (fpDelta === null) return null;

  const dayLabel = pace.dayType === 'saturday' ? 'Saturday' : dayName;

  if (fpDelta >= 15) {
    return `Team is ${Math.round(fpDelta)}% ahead of typical ${dayLabel} pace 🔥`;
  }
  if (fpDelta >= -10) {
    return `Tracking on pace for a typical ${dayLabel} — ${pace.actualNow.fp.toFixed(1)} FP+ by ${pace.timeLabel}`;
  }
  if (fpDelta >= -30) {
    return `Team is ${Math.abs(Math.round(fpDelta))}% behind typical ${dayLabel} pace`;
  }
  return `Significantly behind ${dayLabel} pace — ${Math.abs(Math.round(fpDelta))}% below expected`;
};
