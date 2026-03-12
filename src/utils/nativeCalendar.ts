import { isNativeApp, isIOS } from './platform';
import { CalendarEventData, generateICSFile, generateGoogleCalendarUrl } from './calendarLinks';

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
  return 'event';
}

/**
 * Suggest a smart default time based on the action text
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
 * Add event to native calendar using @ebarooni/capacitor-calendar plugin.
 * Opens the native iOS event creation sheet pre-filled with details.
 */
export async function addToNativeCalendarEvent(event: CalendarEventData): Promise<boolean> {
  if (!isNativeApp()) {
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
      description: event.description || '',
      isAllDay: false,
    });
    
    return true;
  } catch (error) {
    console.error('Native calendar event error:', error);
    addToCalendarWeb(event);
    return true;
  }
}

/**
 * Add reminder using native Reminders (iOS only).
 * Requests permission then creates reminder directly — no prompt API exists,
 * but this adds it to Reminders with the due date set.
 */
export async function addToNativeReminder(event: CalendarEventData): Promise<boolean> {
  if (!isNativeApp() || !isIOS()) {
    addToCalendarWeb(event);
    return true;
  }

  try {
    const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
    
    // Request reminders access first
    const { result } = await CapacitorCalendar.requestFullRemindersAccess();
    if (result !== 'granted') {
      // Fall back to calendar event prompt if denied
      return addToNativeCalendarEvent(event);
    }
    
    await CapacitorCalendar.createReminder({
      title: event.title,
      dueDate: event.startDate.getTime(),
      notes: event.description || '',
      alerts: [-0], // Alert at due time
    });
    
    return true;
  } catch (error) {
    console.error('Native reminder error:', error);
    // Fall back to calendar event
    return addToNativeCalendarEvent(event);
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

// Legacy export
export const addToNativeCalendar = addToNativeCalendarEvent;
