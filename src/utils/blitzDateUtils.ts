import { startOfDay, differenceInCalendarDays, parseISO, isValid } from "date-fns";

/**
 * Calculate the number of calendar days until a blitz starts.
 * This counts calendar days, not 24-hour periods.
 * 
 * Examples:
 * - If today is Saturday and blitz is Sunday: returns 1 ("tomorrow")
 * - If today is Saturday and blitz is Saturday: returns 0 ("today")
 * - If today is Saturday and blitz is Monday: returns 2
 * 
 * @param blitzDateStr The blitz start date as YYYY-MM-DD string
 * @param fromDate Optional date to calculate from (defaults to now)
 * @returns Number of days until blitz, or null if invalid
 */
export const getDaysUntilBlitz = (
  blitzDateStr: string | null | undefined,
  fromDate: Date = new Date()
): number | null => {
  if (!blitzDateStr) return null;
  
  try {
    // Parse the blitz date as a local date (no timezone offset)
    const blitzDate = parseISO(blitzDateStr);
    if (!isValid(blitzDate)) return null;
    
    // Use startOfDay to compare calendar days, not exact times
    const todayStart = startOfDay(fromDate);
    const blitzStart = startOfDay(blitzDate);
    
    // differenceInCalendarDays counts calendar days properly
    return differenceInCalendarDays(blitzStart, todayStart);
  } catch (e) {
    console.error('[getDaysUntilBlitz] Error calculating days:', e);
    return null;
  }
};

/**
 * Format the days until blitz as a human-readable string.
 * 
 * @param days Number of days until blitz
 * @returns Human-readable string like "today", "tomorrow", "2 days", etc.
 */
export const formatDaysUntilBlitz = (days: number | null): string => {
  if (days === null || days < 0) return '';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `${days} days`;
};

/**
 * Format days until blitz for display in badges/chips.
 * 
 * @param days Number of days until blitz
 * @returns Short format like "today", "1d", "2d", etc.
 */
export const formatDaysUntilBlitzShort = (days: number | null): string => {
  if (days === null || days < 0) return '';
  if (days === 0) return 'today';
  if (days === 1) return '1d';
  return `${days}d`;
};
