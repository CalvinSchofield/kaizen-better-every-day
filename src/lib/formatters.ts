/**
 * Formats a number to at most 2 decimal places, removing trailing zeros.
 * Examples: 1.00 → "1", 1.10 → "1.1", 1.25 → "1.25"
 */
export const formatFP = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return "0";
  
  // Round to 2 decimal places, then remove trailing zeros
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

/**
 * Formats a percentage value (0-100) to whole number.
 */
export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return "0";
  return Math.round(value).toString();
};

/**
 * Formats PRMR values (typically whole dollars, but can have cents).
 */
export const formatPRMR = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return "0";
  
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

/**
 * Formats decimal hours to hours and minutes.
 * Examples: 7.6 → "7 hr 36 min", 2.0 → "2 hr", 0.5 → "30 min"
 */
export const formatHoursMinutes = (hours: number | null | undefined): string => {
  if (hours === null || hours === undefined || isNaN(hours) || hours <= 0) return "0 min";
  
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
};
