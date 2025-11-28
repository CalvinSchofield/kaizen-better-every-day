import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek } from "date-fns";

interface CalendarViewProps {
  entries?: any[];
  blitzes?: any[];
  personalSummerStart?: Date;
  personalSummerEnd?: Date;
}

export const CalendarView = ({
  entries = [],
  blitzes = [],
  personalSummerStart,
  personalSummerEnd,
}: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const isKnockingDay = (date: Date) => {
    // Check if date is within any blitz
    const inBlitz = blitzes.some((blitz) => {
      const start = new Date(blitz.date);
      const end = new Date(blitz.endDate || blitz.date);
      return date >= start && date <= end;
    });

    // Check if date is within personal summer season
    const inSeason =
      personalSummerStart &&
      personalSummerEnd &&
      date >= personalSummerStart &&
      date <= personalSummerEnd;

    return inBlitz || inSeason;
  };

  const getEntryForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return entries.find((e) => e.entry_date === dateStr);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("month")}
          >
            Month
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("week")}
          >
            Week
          </Button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <Button variant="outline" size="sm" onClick={goToToday} className="w-full mb-4">
        Today
      </Button>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-muted-foreground pb-2">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((day, idx) => {
          const entry = getEntryForDate(day);
          const isKnocking = isKnockingDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);

          return (
            <div
              key={idx}
              className={`
                aspect-square p-2 rounded-lg border
                ${isTodayDate ? 'border-primary border-2' : 'border-border'}
                ${!isCurrentMonth ? 'opacity-40' : ''}
                ${isKnocking ? 'bg-primary/10' : 'bg-card'}
              `}
            >
              <div className={`text-sm font-semibold ${isKnocking ? 'text-primary' : 'text-foreground'}`}>
                {format(day, 'd')}
              </div>
              {entry && entry.is_finalized && (
                <div className="text-xs text-primary font-semibold mt-1">
                  {entry.fp_plus}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary/10 border-2 border-primary" />
          <span className="text-muted-foreground">Knocking day</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-card border border-border">
            <span className="text-xs text-primary font-semibold">2.4</span>
          </div>
          <span className="text-muted-foreground">Entry with FP+</span>
        </div>
      </div>
    </div>
  );
};