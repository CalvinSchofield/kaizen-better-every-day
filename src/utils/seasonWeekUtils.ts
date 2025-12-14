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
