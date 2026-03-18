import { differenceInCalendarDays, startOfWeek, getDay, parseISO, format, addDays } from 'date-fns';

// Season definitions - Monday of week 1 for each season
// Season definitions - Sunday of week 1 for each season (weeks run Sun-Sat)
const SEASON_DEFINITIONS: Record<number, { preseason: Date; summer: Date; extension: Date }> = {
  2025: {
    preseason: new Date(2024, 8, 29), // Sep 29, 2024 (Sunday week 1)
    summer: new Date(2025, 3, 13),    // Apr 13, 2025 (Sunday week 1)
    extension: new Date(2025, 7, 31), // Aug 31, 2025 (Sunday week 1)
  },
  2026: {
    preseason: new Date(2025, 8, 28), // Sep 28, 2025 (Sunday week 1)
    summer: new Date(2026, 3, 12),    // Apr 12, 2026 (Sunday week 1)
    extension: new Date(2026, 7, 30), // Aug 30, 2026 (Sunday week 1)
  },
};

export type SeasonType = 'preseason' | 'summer' | 'extension';

export interface SeasonInfo {
  year: number;
  type: SeasonType;
  week: number;
  dayOfWeek: number; // 1 (Monday) through 6 (Saturday), 0 for Sunday
}

/**
 * Get the season week start date for a given year and season type
 */
export function getSeasonStartDate(year: number, seasonType: SeasonType): Date | null {
  const yearDef = SEASON_DEFINITIONS[year];
  if (!yearDef) return null;
  return yearDef[seasonType];
}

/**
 * Determine which season a date falls into
 */
export function getSeasonInfo(date: Date): SeasonInfo | null {
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  // Sort years in descending order so we check newest seasons first
  // This ensures Oct 2025 matches 2026 preseason (Sep 29, 2025) before 2025 extension (Sep 1, 2025)
  const sortedYears = Object.keys(SEASON_DEFINITIONS)
    .map(y => parseInt(y))
    .sort((a, b) => b - a);
  
  for (const year of sortedYears) {
    const seasons = SEASON_DEFINITIONS[year];
    
    // Check extension first (latest in the season year)
    if (dateOnly >= seasons.extension) {
      // But make sure we're not past the next year's preseason
      const nextYear = SEASON_DEFINITIONS[year + 1];
      if (nextYear && dateOnly >= nextYear.preseason) {
        continue; // This date belongs to next year's preseason, not this year's extension
      }
      
      const daysSinceStart = differenceInCalendarDays(dateOnly, seasons.extension);
      const week = Math.floor(daysSinceStart / 7) + 1;
      const dayOfWeek = getDay(dateOnly); // 0 = Sunday, 1 = Monday, etc.
      const adjustedDayOfWeek = dayOfWeek === 0 ? 0 : dayOfWeek; // Keep Sunday as 0
      
      return { year, type: 'extension', week, dayOfWeek: adjustedDayOfWeek };
    }
    
    // Check summer
    if (dateOnly >= seasons.summer) {
      const daysSinceStart = differenceInCalendarDays(dateOnly, seasons.summer);
      const week = Math.floor(daysSinceStart / 7) + 1;
      const dayOfWeek = getDay(dateOnly);
      const adjustedDayOfWeek = dayOfWeek === 0 ? 0 : dayOfWeek;
      
      return { year, type: 'summer', week, dayOfWeek: adjustedDayOfWeek };
    }
    
    // Check preseason (may start in previous calendar year)
    if (dateOnly >= seasons.preseason) {
      const daysSinceStart = differenceInCalendarDays(dateOnly, seasons.preseason);
      const week = Math.floor(daysSinceStart / 7) + 1;
      const dayOfWeek = getDay(dateOnly);
      const adjustedDayOfWeek = dayOfWeek === 0 ? 0 : dayOfWeek;
      
      return { year, type: 'preseason', week, dayOfWeek: adjustedDayOfWeek };
    }
  }
  
  return null;
}

/**
 * Map a current date to its equivalent date in a comparison year
 * Returns the date in the comparison year that has the same season week and day
 */
export function mapToComparisonDate(currentDate: Date, comparisonYear: number): Date | null {
  const currentSeasonInfo = getSeasonInfo(currentDate);
  if (!currentSeasonInfo) return null;
  
  const comparisonSeasonStart = getSeasonStartDate(comparisonYear, currentSeasonInfo.type);
  if (!comparisonSeasonStart) return null;
  
  // Calculate days from season start (weeks run Sun-Sat, so dayOfWeek 0=Sun matches directly)
  const daysFromStart = (currentSeasonInfo.week - 1) * 7 + currentSeasonInfo.dayOfWeek;
  
  return addDays(comparisonSeasonStart, daysFromStart);
}

/**
 * Get the equivalent season week/day for a given date in another year
 */
export function getComparisonSeasonInfo(currentDate: Date, comparisonYear: number): SeasonInfo | null {
  const currentSeasonInfo = getSeasonInfo(currentDate);
  if (!currentSeasonInfo) return null;
  
  return {
    year: comparisonYear,
    type: currentSeasonInfo.type,
    week: currentSeasonInfo.week,
    dayOfWeek: currentSeasonInfo.dayOfWeek,
  };
}

/**
 * Get the date range for a specific season in a given year
 */
export function getSeasonDateRange(year: number, seasonType: SeasonType): { start: Date; end: Date } | null {
  const yearDef = SEASON_DEFINITIONS[year];
  if (!yearDef) return null;

  const start = yearDef[seasonType];
  
  // End date is the day before the next season starts
  if (seasonType === 'preseason') {
    return { start, end: addDays(yearDef.summer, -1) };
  }
  if (seasonType === 'summer') {
    return { start, end: addDays(yearDef.extension, -1) };
  }
  // Extension ends the day before next year's preseason
  const nextYear = SEASON_DEFINITIONS[year + 1];
  if (nextYear) {
    return { start, end: addDays(nextYear.preseason, -1) };
  }
  // Fallback: extension runs ~4 weeks
  return { start, end: addDays(start, 27) };
}

/**
 * Get all weeks (Sun-Sat) for a season, with labels and date ranges
 */
export function getSeasonWeeks(year: number, seasonType: SeasonType): { label: string; start: Date; end: Date; weekNum: number }[] {
  const range = getSeasonDateRange(year, seasonType);
  if (!range) return [];

  const prefix = seasonType === 'preseason' ? 'Pre' : seasonType === 'summer' ? 'Sum' : 'Ext';
  const weeks: { label: string; start: Date; end: Date; weekNum: number }[] = [];
  let weekStart = range.start;
  let weekNum = 1;
  const today = new Date();
  
  while (weekStart <= range.end) {
    const weekEnd = addDays(weekStart, 6);
    const clampedEnd = weekEnd > range.end ? range.end : weekEnd;
    weeks.push({
      label: `${prefix} W${weekNum}`,
      start: weekStart,
      end: clampedEnd > today ? today : clampedEnd,
      weekNum,
    });
    weekStart = addDays(weekStart, 7);
    weekNum++;
    if (weekStart > today) break; // Don't show future weeks
  }
  return weeks;
}

/**
 * Get months within the 2026 season year (Oct 2025 - Sep 2026)
 */
export function getSeasonMonths(year: number): { label: string; start: Date; end: Date }[] {
  const yearDef = SEASON_DEFINITIONS[year];
  if (!yearDef) return [];

  const seasonStart = yearDef.preseason;
  const today = new Date();
  const months: { label: string; start: Date; end: Date }[] = [];
  
  // Start from the preseason month, go through 12 months
  let current = new Date(seasonStart.getFullYear(), seasonStart.getMonth(), 1);
  
  for (let i = 0; i < 12; i++) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0); // last day of month
    
    if (monthStart > today) break; // Don't show future months
    
    const label = format(monthStart, "MMM ''yy");
    months.push({
      label,
      start: monthStart,
      end: monthEnd > today ? today : monthEnd,
    });
    
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  
  return months;
}

/**
 * Get the current season week info for highlighting "now" chips
 */
export function getCurrentSeasonWeekLabel(): string | null {
  const info = getSeasonInfo(new Date());
  if (!info) return null;
  const prefix = info.type === 'preseason' ? 'Pre' : info.type === 'summer' ? 'Sum' : 'Ext';
  return `${prefix} W${info.week}`;
}

/**
 * Format a date for display in season context
 */
export function formatSeasonDate(date: Date): string {
  const info = getSeasonInfo(date);
  if (!info) return format(date, 'MMM d, yyyy');
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[getDay(date)];
  
  return `${info.type.charAt(0).toUpperCase() + info.type.slice(1)} Week ${info.week}, ${dayName}`;
}

/**
 * Parse CSV date string to Date object
 */
export function parseCSVDate(dateStr: string): Date | null {
  try {
    // Try common formats
    if (dateStr.includes('/')) {
      // MM/DD/YYYY or M/D/YYYY
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0]) - 1;
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      }
    } else if (dateStr.includes('-')) {
      // YYYY-MM-DD
      return parseISO(dateStr);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Calculate hours worked from start/end times
 */
export function calculateHoursWorked(startTime: string | null, endTime: string | null, breakMinutes: number = 0): number {
  if (!startTime || !endTime) return 0;
  
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const breakHours = breakMinutes / 60;
    return Math.max(0, diffHours - breakHours);
  } catch {
    return 0;
  }
}
