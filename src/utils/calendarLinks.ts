import { isIOS } from "./platform";

export interface CalendarEventData {
  title: string;
  description: string;
  startDate: Date;
  durationMinutes: number;
  location?: string;
}

/**
 * Format date for ICS file (UTC format: YYYYMMDDTHHMMSSZ)
 */
function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Format date for Google Calendar URL (ISO format)
 */
function formatGoogleDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Escape special characters for ICS format
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generate ICS file content for Apple Calendar / iOS
 */
export function generateICSFile(event: CalendarEventData): string {
  const endDate = new Date(event.startDate.getTime() + event.durationMinutes * 60 * 1000);
  const now = new Date();
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kaizen//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@kaizen`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(event.startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(event.description)}`,
    event.location ? `LOCATION:${escapeICS(event.location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
  
  return icsContent;
}

/**
 * Generate Google Calendar URL
 */
export function generateGoogleCalendarUrl(event: CalendarEventData): string {
  const endDate = new Date(event.startDate.getTime() + event.durationMinutes * 60 * 1000);
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: event.description,
    dates: `${formatGoogleDate(event.startDate)}/${formatGoogleDate(endDate)}`,
  });
  
  if (event.location) {
    params.set('location', event.location);
  }
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Download ICS file (triggers native calendar on iOS)
 */
function downloadICSFile(event: CalendarEventData): void {
  const icsContent = generateICSFile(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Open Google Calendar in new tab
 */
function openGoogleCalendar(event: CalendarEventData): void {
  const url = generateGoogleCalendarUrl(event);
  window.open(url, '_blank');
}

/**
 * Add event to calendar - platform aware
 * iOS: Downloads .ics file (opens Apple Calendar)
 * Android/Desktop: Opens Google Calendar URL
 */
export function addToCalendar(event: CalendarEventData): void {
  if (isIOS()) {
    downloadICSFile(event);
  } else {
    openGoogleCalendar(event);
  }
}

/**
 * Generate smart calendar title based on recruit name and notes
 */
export function getCalendarTitle(recruitName: string, notes?: string): string {
  const cleanName = recruitName.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
  
  if (!notes) {
    return `Follow up with ${cleanName}`;
  }
  
  const lowerNotes = notes.toLowerCase();
  
  if (lowerNotes.includes('call')) {
    return `Call ${cleanName}`;
  }
  if (lowerNotes.includes('meet') || lowerNotes.includes('meeting')) {
    return `Meet with ${cleanName}`;
  }
  if (lowerNotes.includes('text') || lowerNotes.includes('message')) {
    return `Text ${cleanName}`;
  }
  if (lowerNotes.includes('check in') || lowerNotes.includes('check-in')) {
    return `Check in with ${cleanName}`;
  }
  
  return `Follow up with ${cleanName}`;
}

/**
 * Format phone number for calendar description
 */
export function formatPhoneForCalendar(phone: string | null): string {
  if (!phone) return '';
  return `📱 ${phone}`;
}

/**
 * Build calendar event description from notes and phone
 */
export function buildCalendarDescription(notes: string, phone: string | null): string {
  const parts: string[] = [];
  
  if (notes) {
    // Clean @mentions from notes for calendar display
    const cleanNotes = notes.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
    parts.push(cleanNotes);
  }
  
  if (phone) {
    parts.push('');
    parts.push(formatPhoneForCalendar(phone));
  }
  
  return parts.join('\n');
}
