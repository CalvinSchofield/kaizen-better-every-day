/**
 * Calculate the number of calendar days until a blitz starts.
 * Uses the user's local timezone for accurate day counting.
 * 
 * Examples (in user's local timezone):
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
    // Get user's local timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Get today's date string in user's local timezone
    const todayFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = todayFormatter.format(fromDate); // Returns YYYY-MM-DD in en-CA locale
    
    // Parse both dates as YYYY-MM-DD (treating them as local dates)
    const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
    const [blitzYear, blitzMonth, blitzDay] = blitzDateStr.split('-').map(Number);
    
    // Create dates at noon (to avoid DST edge cases) for comparison
    const todayDate = new Date(todayYear, todayMonth - 1, todayDay, 12, 0, 0);
    const blitzDate = new Date(blitzYear, blitzMonth - 1, blitzDay, 12, 0, 0);
    
    // Calculate difference in days
    const diffTime = blitzDate.getTime() - todayDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
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

/**
 * Get the current date as YYYY-MM-DD string in user's local timezone.
 * Use this for consistent date comparisons throughout the app.
 */
export const getTodayDateString = (): string => {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: userTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
};

/**
 * Calculate days since a date string in user's local timezone.
 * @param dateStr The date as YYYY-MM-DD string
 * @returns Number of days since the date, or null if invalid
 */
export const getDaysSinceDate = (dateStr: string | null | undefined): number | null => {
  if (!dateStr) return null;
  
  try {
    const daysUntil = getDaysUntilBlitz(dateStr);
    if (daysUntil === null) return null;
    return -daysUntil; // Negate to get "days since" instead of "days until"
  } catch (e) {
    return null;
  }
};
