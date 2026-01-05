/**
 * Baseline Calculations for Team and Individual Performance
 * 
 * Calculates 2-week rolling averages for realistic performance expectations
 * adjusted for who's actually working today
 */

import { format, subDays, isWithinInterval, parseISO } from "date-fns";

export interface RepBaseline {
  userId: string;
  name: string;
  avgFPPerWorkDay: number;      // Average FP+ on days they worked
  avgDoorsPerWorkDay: number;   // Average doors on days they worked
  avgPRMRPerWorkDay: number;    // Average PRMR on days they worked
  workDaysIn14: number;         // Number of days worked in last 14 days
  isWorkingToday: boolean;      // Whether they're marked as working today
}

export interface TeamBaseline {
  workingTodayCount: number;
  workingTodayNames: string[];
  teamExpectedFPToday: number;
  teamExpectedFPThisWeek: number;
  teamExpectedFPThisMonth: number;
  avgFPPerWorkingRep: number;
}

interface DailyEntry {
  entry_date: string;
  doors_knocked: number | null;
  fp_plus: number | null;
  prmr: number | null;
  work_start_time: string | null;
  work_end_time: string | null;
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
 * Calculate 2-week rolling average for a single rep
 */
export const calculateRepBaseline = (
  userId: string,
  name: string,
  entries: DailyEntry[],
  isWorkingToday: boolean
): RepBaseline => {
  // Filter to days with actual work (doors > 0 and start/end times)
  const workDays = entries.filter(e => 
    (e.doors_knocked || 0) > 0 && 
    e.work_start_time && 
    e.work_end_time
  );
  
  const workDaysIn14 = workDays.length;
  
  if (workDaysIn14 === 0) {
    return {
      userId,
      name,
      avgFPPerWorkDay: 0,
      avgDoorsPerWorkDay: 0,
      avgPRMRPerWorkDay: 0,
      workDaysIn14: 0,
      isWorkingToday,
    };
  }
  
  const totalFP = workDays.reduce((sum, e) => sum + (e.fp_plus || 0), 0);
  const totalDoors = workDays.reduce((sum, e) => sum + (e.doors_knocked || 0), 0);
  const totalPRMR = workDays.reduce((sum, e) => sum + (e.prmr || 0), 0);
  
  return {
    userId,
    name,
    avgFPPerWorkDay: totalFP / workDaysIn14,
    avgDoorsPerWorkDay: totalDoors / workDaysIn14,
    avgPRMRPerWorkDay: totalPRMR / workDaysIn14,
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
    (sum, r) => sum + r.avgFPPerWorkDay, 
    0
  );
  
  const avgFPPerWorkingRep = workingToday.length > 0 
    ? teamExpectedFPToday / workingToday.length 
    : 0;
  
  return {
    workingTodayCount: workingToday.length,
    workingTodayNames: workingToday.map(r => r.name),
    teamExpectedFPToday,
    teamExpectedFPThisWeek: teamExpectedFPToday * remainingWorkDaysThisWeek,
    teamExpectedFPThisMonth: teamExpectedFPToday * remainingWorkDaysThisMonth,
    avgFPPerWorkingRep,
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
  // Check planned work days
  const hasPlannedWork = plannedWorkDays.some(
    p => p.user_id === userId && p.planned_date === today
  );
  
  if (hasPlannedWork) return true;
  
  // During preseason, also check blitz commitments
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
    end: format(subDays(today, 1), 'yyyy-MM-dd'), // Yesterday (not including today)
  };
};
