import { useState, useEffect } from "react";
import ICAL from "ical.js";

interface CalendarEvent {
  title: string;
  date: string;
  time: string;
  startDate: Date;
}

export const useCalendarEvents = (calendarUrl: string) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCalendarEvents = async () => {
      try {
        setLoading(true);
        setError(null);

        // Convert webcal to https
        const httpsUrl = calendarUrl.replace("webcal://", "https://");
        
        // Fetch the iCal data
        const response = await fetch(httpsUrl);
        
        if (!response.ok) {
          throw new Error("Failed to fetch calendar");
        }

        const icalData = await response.text();
        
        // Parse iCal data
        const jcalData = ICAL.parse(icalData);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents("vevent");

        // Process events
        const parsedEvents: CalendarEvent[] = vevents
          .map((vevent) => {
            const event = new ICAL.Event(vevent);
            const startDate = event.startDate.toJSDate();
            
            return {
              title: event.summary,
              startDate: startDate,
              date: formatDate(startDate, event.endDate?.toJSDate()),
              time: formatTime(startDate, event.endDate?.toJSDate(), event.startDate.isDate),
            };
          })
          .filter((event) => event.startDate >= new Date()) // Only future events
          .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
          .slice(0, 10); // Get next 10 events

        setEvents(parsedEvents);
      } catch (err) {
        console.error("Error fetching calendar:", err);
        setError("Unable to load calendar events");
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarEvents();
  }, [calendarUrl]);

  return { events, loading, error };
};

const formatDate = (startDate: Date, endDate?: Date): string => {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: "long", 
    month: "short", 
    day: "numeric" 
  };
  
  if (endDate && endDate.getDate() !== startDate.getDate()) {
    // Multi-day event
    const endOptions: Intl.DateTimeFormatOptions = { 
      weekday: "long", 
      month: "short", 
      day: "numeric" 
    };
    return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", endOptions)}`;
  }
  
  return startDate.toLocaleDateString("en-US", options);
};

const formatTime = (startDate: Date, endDate?: Date, isAllDay?: boolean): string => {
  if (isAllDay) {
    return "All Day";
  }
  
  const timeOptions: Intl.DateTimeFormatOptions = { 
    hour: "numeric", 
    minute: "2-digit",
    hour12: true 
  };
  
  const startTime = startDate.toLocaleTimeString("en-US", timeOptions);
  
  if (endDate) {
    const endTime = endDate.toLocaleTimeString("en-US", timeOptions);
    return `${startTime} - ${endTime}`;
  }
  
  return startTime;
};
