import { parseISO, format, isToday, isTomorrow, isYesterday, isSameDay } from 'date-fns';

/**
 * Formats competition duration in a human-friendly way.
 * Single-day: "Today", "Tomorrow", "Yesterday", or "Jan 10"
 * Multi-day: "Today - Tomorrow", "Jan 10 - Jan 15", etc.
 */
export const formatCompetitionDuration = (startDate: string, endDate: string): string => {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const isSingleDay = isSameDay(start, end);

  if (isSingleDay) {
    if (isToday(start)) return 'Today';
    if (isTomorrow(start)) return 'Tomorrow';
    if (isYesterday(start)) return 'Yesterday';
    return format(start, 'MMM d');
  }

  // Multi-day range
  const formatDate = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  };

  return `${formatDate(start)} - ${formatDate(end)}`;
};

/**
 * Formats a single date in a human-friendly way.
 * Returns "Today", "Tomorrow", "Yesterday", or formatted date.
 */
export const formatFriendlyDate = (dateStr: string): string => {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
};
