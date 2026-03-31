/**
 * Timezone-aware utilities for week calculations
 * Used for prep leaderboard and Rookie of the Week features
 */

/**
 * Get the start of the current week (Sunday at midnight) in the given timezone
 */
export const getWeekStartInTimezone = (timezone: string = 'America/Los_Angeles'): Date => {
  const now = new Date();
  
  // Get current day in the rep's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const year = parts.find(p => p.type === 'year')?.value;
  
  // Calculate days since Sunday
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  const daysSinceSunday = dayMap[weekday || 'Sun'] || 0;
  
  // Create date for Sunday
  const currentDate = new Date(`${year}-${month}-${day}T00:00:00`);
  currentDate.setDate(currentDate.getDate() - daysSinceSunday);
  
  return currentDate;
};

/**
 * Get the week start date as YYYY-MM-DD string in the given timezone
 */
export const getWeekStartDateString = (timezone: string = 'America/Los_Angeles'): string => {
  const weekStart = getWeekStartInTimezone(timezone);
  return weekStart.toISOString().split('T')[0];
};

/**
 * Get the percentage of the week elapsed in the given timezone
 * Sunday 12am = 0%, Saturday 11:59pm = ~100%
 * Returns decimal 0-1
 */
export const getWeekProgressInTimezone = (timezone: string = 'America/Los_Angeles'): number => {
  const now = new Date();
  
  // Get current time components in the rep's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  const dayIndex = dayMap[weekday || 'Sun'] || 0;
  
  // Total minutes in a week = 7 days * 24 hours * 60 minutes = 10080
  const totalWeekMinutes = 7 * 24 * 60;
  const elapsedMinutes = (dayIndex * 24 * 60) + (hour * 60) + minute;
  
  return elapsedMinutes / totalWeekMinutes;
};

/**
 * Get expected training progress percentage based on day of week in rep's timezone
 * Sunday-Saturday scale (6 working days: Mon-Sat)
 */
export const getExpectedWeeklyProgress = (timezone: string = 'America/Los_Angeles'): number => {
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  
  const weekday = formatter.format(now);
  
  // Working days are Mon-Sat (6 days)
  const progressMap: Record<string, number> = {
    'Sun': 0,      // Week hasn't started
    'Mon': 0.167,  // 1/6
    'Tue': 0.333,  // 2/6
    'Wed': 0.5,    // 3/6
    'Thu': 0.667,  // 4/6
    'Fri': 0.833,  // 5/6
    'Sat': 1.0,    // 6/6 (end of week)
  };
  
  return progressMap[weekday] || 0;
};

/**
 * Determine training pace status based on actual vs expected progress
 */
export const getTrainingPaceStatus = (
  actualProgress: number,
  goalMinutes: number,
  timezone: string = 'America/Los_Angeles'
): 'ahead' | 'on-track' | 'behind' | 'no-goal' => {
  if (goalMinutes <= 0) return 'no-goal';
  
  const expectedProgress = getExpectedWeeklyProgress(timezone);
  const actualPercent = actualProgress / goalMinutes;
  
  // Allow 10% variance for "on track"
  if (actualPercent >= expectedProgress + 0.1) return 'ahead';
  if (actualPercent >= expectedProgress - 0.1) return 'on-track';
  return 'behind';
};

// ============================================
// Time display utilities for timezone-correct rendering
// ============================================

/**
 * Get hours and minutes from an ISO timestamp in a specific timezone.
 * This ensures times are displayed in the rep's local time, not the viewer's.
 */
export const getTimeInTimezone = (
  isoString: string,
  timezone?: string | null
): { hours: number; minutes: number } | null => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;

    if (timezone) {
      const hourFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      });
      const minuteFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        minute: 'numeric',
      });
      const hours = parseInt(hourFormatter.format(date), 10);
      const minutes = parseInt(minuteFormatter.format(date), 10);
      return { hours, minutes };
    }

    return { hours: date.getHours(), minutes: date.getMinutes() };
  } catch {
    return null;
  }
};

/**
 * Convert an ISO timestamp to "minutes from midnight" in a specific timezone.
 * Used for timeline visualizations where we need a numeric position.
 */
export const isoToMinutesInTimezone = (
  isoString: string,
  timezone?: string | null
): number | null => {
  const time = getTimeInTimezone(isoString, timezone);
  if (!time) return null;
  return time.hours * 60 + time.minutes;
};

/**
 * Format an ISO timestamp as a localized time string in a specific timezone.
 * e.g. "2:39 PM"
 */
export const formatTimeInTz = (
  isoString: string | null | undefined,
  timezone?: string | null
): string | null => {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      ...(timezone ? { timeZone: timezone } : {}),
    });
  } catch {
    return null;
  }
};
