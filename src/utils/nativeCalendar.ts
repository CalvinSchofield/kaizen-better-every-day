import { isNativeApp, isIOS } from './platform';
import { CalendarEventData, generateICSFile, generateGoogleCalendarUrl } from './calendarLinks';

/**
 * Add event to calendar using the best available method for the platform
 * 
 * iOS Native: Opens native calendar via data URI (most reliable in WebView)
 * iOS Web: Downloads .ics file
 * Android/Desktop: Opens Google Calendar URL
 */
export async function addToNativeCalendar(event: CalendarEventData): Promise<void> {
  if (isNativeApp() && isIOS()) {
    // For native iOS, open data URI which triggers system handler
    await openCalendarDataUri(event);
  } else if (isIOS()) {
    // iOS Safari - download ICS file
    downloadICSFile(event);
  } else {
    // Android/Desktop - Google Calendar
    openGoogleCalendar(event);
  }
}

/**
 * Open calendar event as data URI
 * This works better in iOS WebView than blob downloads
 */
async function openCalendarDataUri(event: CalendarEventData): Promise<void> {
  const icsContent = generateICSFile(event);
  
  // Create data URI - encode for URL safety
  const encodedContent = encodeURIComponent(icsContent);
  const dataUri = `data:text/calendar;charset=utf-8,${encodedContent}`;
  
  // Create a temporary link and click it
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  link.target = '_blank';
  
  // Try opening in system - iOS Safari handles .ics files
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Download ICS file (standard web approach)
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
