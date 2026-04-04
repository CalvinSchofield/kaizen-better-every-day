/**
 * Baseline Calculations for Team and Individual Performance
 * 
 * Calculates 2-week rolling averages for realistic performance expectations
 * adjusted for who's actually working today.
 * 
 * IMPORTANT: All benchmarks are derived from the group's own historical data —
 * no hardcoded industry standards. This ensures leaders compare against their
 * team's actual performance, not arbitrary numbers.
 */

import { format, subDays, isWithinInterval, parseISO } from "date-fns";

export interface RepBaseline {
  userId: string;
  name: string;
  avgFPPerWorkDay: number;
  avgDoorsPerWorkDay: number;
  avgPRMRPerWorkDay: number;
  avgDMsPerWorkDay: number;
  avgPitchesPerWorkDay: number;
  avgTransitionsPerWorkDay: number;
  avgPresentationsPerWorkDay: number;
  avgClosesPerWorkDay: number;
  avgDoorsPerHour: number;
  avgStartMinutes: number | null;   // Minutes from midnight
  avgHoursWorked: number;
  workDaysIn14: number;
  isWorkingToday: boolean;
}

/** Conversion rate baselines derived from team's own history */
export interface BaselineConversions {
  doorsToDMs: number;           // DMs / Doors
  dmsToPitches: number;         // Pitches / DMs
  pitchesToTransitions: number; // Transitions / Pitches
  transitionsToPres: number;    // Presentations / Transitions
  presToCloses: number;         // Closes / Presentations
  doorsPerHour: number;         // Team avg doors/hr
  avgStartMinutes: number | null; // Team avg start time in minutes from midnight
  avgHoursWorked: number;       // Team avg hours per working day
  hasEnoughData: boolean;       // True if >= 3 work days of baseline data
}

export interface TeamBaseline {
  workingTodayCount: number;
  workingTodayNames: string[];
  teamExpectedFPToday: number;
  teamExpectedFPThisWeek: number;
  teamExpectedFPThisMonth: number;
  avgFPPerWorkingRep: number;
  /** Team's own historical conversion rates — the source of truth for all comparisons */
  conversions: BaselineConversions;
  /** Per-rep baselines for time-of-day pacing */
  repBaselines: RepBaseline[];
}

interface DailyEntry {
  entry_date: string;
  doors_knocked: number | null;
  decision_makers?: number | null;
  pitches?: number | null;
  transitions?: number | null;
  presentations?: number | null;
  closes?: number | null;
  fp_plus: number | null;
  prmr: number | null;
  work_start_time: string | null;
  work_end_time: string | null;
  break_periods?: any;
}

interface PlannedWorkDay {
  user_id: string;
  planned_date: string;
}

interface CommittedBlitz {
  blitz_id: string;
  date: string;
  end_date: string | null;
}

/**
 * Calculate 2-week rolling average for a single rep.
 * If dayTypeFilter is provided, only entries matching that day type are used.
 */
export const calculateRepBaseline = (
  userId: string,
  name: string,
  entries: DailyEntry[],
  isWorkingToday: boolean,
  dayTypeFilter?: 'weekday' | 'saturday',
): RepBaseline => {
  // Filter by day type if specified
  let filteredEntries = entries;
  if (dayTypeFilter) {
    filteredEntries = entries.filter(e => {
      const d = new Date(e.entry_date + 'T12:00:00'); // noon to avoid TZ shift
      const dow = d.getDay(); // 0=Sun, 6=Sat
      if (dayTypeFilter === 'saturday') return dow === 6;
      return dow >= 1 && dow <= 5;
    });
  }
  const workDays = filteredEntries.filter(e => 
    (e.doors_knocked || 0) > 0 && 
    e.work_start_time && 
    e.work_end_time
  );
  
  const workDaysIn14 = workDays.length;
  
  if (workDaysIn14 === 0) {
    return {
      userId, name,
      avgFPPerWorkDay: 0, avgDoorsPerWorkDay: 0, avgPRMRPerWorkDay: 0,
      avgDMsPerWorkDay: 0, avgPitchesPerWorkDay: 0, avgTransitionsPerWorkDay: 0,
      avgPresentationsPerWorkDay: 0, avgClosesPerWorkDay: 0,
      avgDoorsPerHour: 0, avgStartMinutes: null, avgHoursWorked: 0,
      workDaysIn14: 0, isWorkingToday,
    };
  }
  
  const totalFP = workDays.reduce((sum, e) => sum + (e.fp_plus || 0), 0);
  const totalDoors = workDays.reduce((sum, e) => sum + (e.doors_knocked || 0), 0);
  const totalPRMR = workDays.reduce((sum, e) => sum + (e.prmr || 0), 0);
  const totalDMs = workDays.reduce((sum, e) => sum + (e.decision_makers || 0), 0);
  const totalPitches = workDays.reduce((sum, e) => sum + (e.pitches || 0), 0);
  const totalTransitions = workDays.reduce((sum, e) => sum + (e.transitions || 0), 0);
  const totalPresentations = workDays.reduce((sum, e) => sum + (e.presentations || 0), 0);
  const totalCloses = workDays.reduce((sum, e) => sum + (e.closes || 0), 0);

  // Calculate hours worked per day and start times
  let totalHours = 0;
  const startMinutesList: number[] = [];
  
  for (const e of workDays) {
    if (e.work_start_time && e.work_end_time) {
      const start = new Date(e.work_start_time);
      const end = new Date(e.work_end_time);
      const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      totalHours += hours;
      startMinutesList.push(start.getHours() * 60 + start.getMinutes());
    }
  }
  
  const avgHoursWorked = totalHours / workDaysIn14;
  const avgDoorsPerHour = totalHours > 0 ? totalDoors / totalHours : 0;
  const avgStartMinutes = startMinutesList.length > 0 
    ? startMinutesList.reduce((a, b) => a + b, 0) / startMinutesList.length 
    : null;
  
  return {
    userId, name,
    avgFPPerWorkDay: totalFP / workDaysIn14,
    avgDoorsPerWorkDay: totalDoors / workDaysIn14,
    avgPRMRPerWorkDay: totalPRMR / workDaysIn14,
    avgDMsPerWorkDay: totalDMs / workDaysIn14,
    avgPitchesPerWorkDay: totalPitches / workDaysIn14,
    avgTransitionsPerWorkDay: totalTransitions / workDaysIn14,
    avgPresentationsPerWorkDay: totalPresentations / workDaysIn14,
    avgClosesPerWorkDay: totalCloses / workDaysIn14,
    avgDoorsPerHour,
    avgStartMinutes,
    avgHoursWorked,
    workDaysIn14,
    isWorkingToday,
  };
};

/**
 * Calculate team baseline from individual rep baselines
 */
export const calculateTeamBaseline = (
  repBaselines: RepBaseline[],
  remainingWorkDaysThisWeek: number = 5,
  remainingWorkDaysThisMonth: number = 20
): TeamBaseline => {
  const workingToday = repBaselines.filter(r => r.isWorkingToday);
  
  const teamExpectedFPToday = workingToday.reduce(
    (sum, r) => sum + r.avgFPPerWorkDay, 0
  );
  
  const avgFPPerWorkingRep = workingToday.length > 0 
    ? teamExpectedFPToday / workingToday.length 
    : 0;

  // Calculate team-level conversion baselines from ALL reps with history
  const repsWithData = repBaselines.filter(r => r.workDaysIn14 >= 1);
  
  // Sum up raw totals from per-day averages * days worked for proper weighted averaging
  let teamDoors = 0, teamDMs = 0, teamPitches = 0, teamTransitions = 0;
  let teamPresentations = 0, teamCloses = 0, teamHours = 0;
  const startMinutes: number[] = [];
  
  for (const r of repsWithData) {
    const days = r.workDaysIn14;
    teamDoors += r.avgDoorsPerWorkDay * days;
    teamDMs += r.avgDMsPerWorkDay * days;
    teamPitches += r.avgPitchesPerWorkDay * days;
    teamTransitions += r.avgTransitionsPerWorkDay * days;
    teamPresentations += r.avgPresentationsPerWorkDay * days;
    teamCloses += r.avgClosesPerWorkDay * days;
    teamHours += r.avgHoursWorked * days;
    if (r.avgStartMinutes !== null) startMinutes.push(r.avgStartMinutes);
  }
  
  const totalDays = repsWithData.reduce((sum, r) => sum + r.workDaysIn14, 0);
  const hasEnoughData = totalDays >= 3;
  
  const conversions: BaselineConversions = {
    doorsToDMs: teamDoors > 0 ? teamDMs / teamDoors : 0,
    dmsToPitches: teamDMs > 0 ? teamPitches / teamDMs : 0,
    pitchesToTransitions: teamPitches > 0 ? teamTransitions / teamPitches : 0,
    transitionsToPres: teamTransitions > 0 ? teamPresentations / teamTransitions : 0,
    presToCloses: teamPresentations > 0 ? teamCloses / teamPresentations : 0,
    doorsPerHour: teamHours > 0 ? teamDoors / teamHours : 0,
    avgStartMinutes: startMinutes.length > 0 
      ? startMinutes.reduce((a, b) => a + b, 0) / startMinutes.length 
      : null,
    avgHoursWorked: totalDays > 0 ? teamHours / totalDays : 0,
    hasEnoughData,
  };
  
  return {
    workingTodayCount: workingToday.length,
    workingTodayNames: workingToday.map(r => r.name),
    teamExpectedFPToday,
    teamExpectedFPThisWeek: teamExpectedFPToday * remainingWorkDaysThisWeek,
    teamExpectedFPThisMonth: teamExpectedFPToday * remainingWorkDaysThisMonth,
    avgFPPerWorkingRep,
    conversions,
    repBaselines,
  };
};

/**
 * Check if a rep is working today based on planned work days and blitz commitments
 */
export const isRepWorkingToday = (
  userId: string,
  today: string,
  plannedWorkDays: PlannedWorkDay[],
  committedBlitzes: CommittedBlitz[],
  isPreseason: boolean
): boolean => {
  const hasPlannedWork = plannedWorkDays.some(
    p => p.user_id === userId && p.planned_date === today
  );
  if (hasPlannedWork) return true;
  
  if (isPreseason) {
    const todayDate = parseISO(today);
    const isOnBlitz = committedBlitzes.some(blitz => {
      const startDate = parseISO(blitz.date);
      const endDate = blitz.end_date ? parseISO(blitz.end_date) : startDate;
      return isWithinInterval(todayDate, { start: startDate, end: endDate });
    });
    if (isOnBlitz) return true;
  }
  
  return false;
};

/**
 * Get date range for 14-day lookback
 */
export const get14DayRange = (today: Date = new Date()): { start: string; end: string } => {
  return {
    start: format(subDays(today, 14), 'yyyy-MM-dd'),
    end: format(subDays(today, 1), 'yyyy-MM-dd'),
  };
};
