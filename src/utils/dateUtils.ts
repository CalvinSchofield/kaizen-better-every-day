/**
 * Parse a date-only string (YYYY-MM-DD) as a local-timezone Date at midnight.
 * 
 * IMPORTANT: `new Date('2026-04-12')` and `parseISO('2026-04-12')` both create
 * a UTC midnight Date, which in US timezones (UTC-6/7/8) becomes April 11 at
 * 6/7/8 PM local time. This causes off-by-one errors in date comparisons.
 * 
 * This utility ensures the Date represents local midnight, so April 12 stays
 * April 12 regardless of the user's timezone.
 */
export const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};
