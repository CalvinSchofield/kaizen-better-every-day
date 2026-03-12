import { isNativeApp, isIOS } from './platform';
import { CalendarEventData, generateICSFile, generateGoogleCalendarUrl, buildCalendarDescription } from './calendarLinks';

/**
 * Detect whether the action text suggests a quick reminder vs a calendar event
 */
export function detectCalendarType(notes: string): 'reminder' | 'event' {
  const lower = (notes || '').toLowerCase();
  const reminderKeywords = ['text', 'message', 'send', 'remind', 'check in', 'follow up'];
  const eventKeywords = ['call', 'meet', 'visit', 'in person', 'zoom', 'video', 'interview', 'appointment'];
  
  for (const kw of eventKeywords) {
    if (lower.includes(kw)) return 'event';
  }
  for (const kw of reminderKeywords) {
    if (lower.includes(kw)) return 'reminder';
  }
  return 'event'; // default
}

/**
 * Suggest a smart default time based on the action text
 * Morning actions (text/message) → 9:00 AM
 * Call/meeting → 10:00 AM  
 * Generic → 9:00 AM
 */
export function suggestTime(notes: string): string {
  const lower = (notes || '').toLowerCase();
  if (lower.includes('lunch') || lower.includes('noon')) return '12:00';
  if (lower.includes('evening') || lower.includes('tonight') || lower.includes('after work')) return '18:00';
  if (lower.includes('morning')) return '09:00';
  if (lower.includes('call') || lower.includes('meet') || lower.includes('visit')) return '10:00';
  return '09:00';
}

/**
 * Add event to native calendar using @ebarooni/capacitor-calendar plugin
 * Opens the native iOS event creation sheet pre-filled with details
 */
export async function addToNativeCalendarEvent(event: CalendarEventData): Promise<boolean> {
  if (!isNativeApp()) {
    // Web fallback
    addToCalendarWeb(event);
    return true;
  }

  try {
    const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
    
    const endDate = new Date(event.startDate.getTime() + (event.durationMinutes || 15) * 60000);
    
    await CapacitorCalendar.createEventWithPrompt({
      title: event.title,
      startDate: event.startDate.getTime(),
      endDate: endDate.getTime(),
      notes: event.description || '',
      isAllDay: false,
    });
    
    return true;
  } catch (error) {
    console.error('Native calendar event error:', error);
    // Fall back to web approach
    addToCalendarWeb(event);
    return true;
  }
}

/**
 * Add reminder using native Reminders app (iOS only)
 * Opens the native iOS reminder creation sheet
 */
export async function addToNativeReminder(event: CalendarEventData): Promise<boolean> {
  if (!isNativeApp() || !isIOS()) {
    // Web fallback - use calendar event instead
    addToCalendarWeb(event);
    return true;
  }

  try {
    const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
    
    await CapacitorCalendar.createReminderWithPrompt({
      title: event.title,
      dueDate: event.startDate.getTime(),
      notes: event.description || '',
    });
    
    return true;
  } catch (error) {
    console.error('Native reminder error:', error);
    // Fall back to calendar event
    addToCalendarWeb(event);
    return true;
  }
}

/**
 * Web fallback: ICS download for iOS Safari, Google Calendar for others
 */
function addToCalendarWeb(event: CalendarEventData): void {
  if (isIOS()) {
    downloadICSFile(event);
  } else {
    const url = generateGoogleCalendarUrl(event);
    window.open(url, '_blank');
  }
}

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

// Keep legacy export for any code still using it
export const addToNativeCalendar = addToNativeCalendarEvent;
