import { useMemo } from "react";
import { useCalendarEvents } from "./useCalendarEvents";
import { startOfDay, isSameDay } from "date-fns";

const CALENDAR_URL = "webcal://p143-caldav.icloud.com/published/2/ODM4MTQxNjQ5ODgzODE0MRrnO9QwHvwHspg2nEVoCsv5FLdG2RTizQGaaVJnHbZfV6TPTtdNYJ2MVW7qvW7RYu4PfYLf5BI9YcU9DIKXHes";

/**
 * Hook to check if there's a Monday Night Lights event scheduled for today.
 * Returns loading state and whether MNL is on the calendar today.
 */
export const useMondayNightLightsEvent = () => {
  const { events, loading, error } = useCalendarEvents(CALENDAR_URL);

  const hasMnlEventToday = useMemo(() => {
    if (loading || error || !events.length) return false;

    const today = startOfDay(new Date());
    
    // Check if any event with "Monday Night Lights" in the title is today
    return events.some(event => {
      const eventTitle = event.title.toLowerCase();
      const isMnl = eventTitle.includes("monday night lights") || eventTitle.includes("mnl");
      const isToday = isSameDay(event.startDate, today);
      return isMnl && isToday;
    });
  }, [events, loading, error]);

  return {
    hasMnlEventToday,
    loading,
    error,
  };
};
