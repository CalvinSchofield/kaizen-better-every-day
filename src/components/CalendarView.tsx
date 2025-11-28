import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek, isSameDay, getDay, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { SaveEntrySheet } from "@/components/SaveEntrySheet";
import { useDailyEntry } from "@/hooks/useDailyEntry";

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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { entry: selectedEntry, finalizeEntry, deleteEntry, isFinalizing, updateCounter } = useDailyEntry(
    selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined
  );

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);

  const days = viewMode === "month" 
    ? eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    : eachDayOfInterval({ start: weekStart, end: weekEnd });

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

  const nextPeriod = () => {
    if (viewMode === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const prevPeriod = () => {
    if (viewMode === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    // Don't allow editing Sundays
    if (getDay(date) === 0) return;
    
    setSelectedDate(date);
    setSheetOpen(true);
  };

  const handleSaveEntry = (data: {
    doors_knocked: number;
    decision_makers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp_plus: number;
    prmr: number;
    saveDate: string;
  }) => {
    finalizeEntry(data);
  };

  const handleDeleteEntry = () => {
    if (selectedEntry && 'id' in selectedEntry && selectedEntry.id) {
      deleteEntry(selectedEntry.id);
      setSheetOpen(false);
    }
  };

  // Check if current view is on today's month/week
  const today = new Date();
  const isViewingToday = viewMode === "month" 
    ? isSameMonth(currentDate, today)
    : isSameDay(currentDate, today) || (currentDate >= weekStart && currentDate <= weekEnd);

  // Calculate totals for the current view
  const viewTotals = entries.reduce((totals, entry) => {
    const entryDate = new Date(entry.entry_date);
    const isInView = viewMode === "month"
      ? isSameMonth(entryDate, currentDate)
      : entryDate >= weekStart && entryDate <= weekEnd;

    if (isInView && entry.is_finalized) {
      totals.fpPlus += entry.fp_plus || 0;
      totals.prmr += entry.prmr || 0;
    }
    return totals;
  }, { fpPlus: 0, prmr: 0 });

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

      {/* Period Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={prevPeriod}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">
          {viewMode === "month" 
            ? format(currentDate, 'MMMM yyyy')
            : `Week of ${format(weekStart, 'MMM d')}`
          }
        </h2>
        <Button variant="ghost" size="icon" onClick={nextPeriod}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <Button 
        variant={isViewingToday ? "ghost" : "default"} 
        size="sm" 
        onClick={goToToday} 
        className={`w-full mb-4 ${isViewingToday ? 'text-xs' : ''}`}
      >
        Today
      </Button>

      {/* Calendar Grid */}
      {viewMode === "month" ? (
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
            const isSunday = getDay(day) === 0;

            return (
              <div
                key={idx}
                onClick={() => handleDayClick(day)}
                className={`
                  aspect-square p-2 rounded-lg border transition-all
                  ${isSunday ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
                  ${isTodayDate ? 'border-primary border-2' : 'border-border'}
                  ${!isCurrentMonth ? 'opacity-40' : ''}
                  ${isKnocking && !isSunday ? 'bg-primary/10' : 'bg-card'}
                `}
              >
                <div className={`text-sm font-semibold ${isKnocking && !isSunday ? 'text-primary' : isSunday ? 'text-muted-foreground' : 'text-foreground'}`}>
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
      ) : (
        /* Week View - Grid layout matching month view */
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-sm font-semibold text-muted-foreground pb-2">
              {day}
            </div>
          ))}

          {/* Week days */}
          {days.map((day, idx) => {
            const entry = getEntryForDate(day);
            const isKnocking = isKnockingDay(day);
            const isTodayDate = isToday(day);
            const isSunday = getDay(day) === 0;

            return (
              <div
                key={idx}
                onClick={() => handleDayClick(day)}
                className={`
                  p-3 rounded-lg border cursor-pointer transition-all hover:scale-105 min-h-[100px] flex flex-col
                  ${isSunday ? 'opacity-40 cursor-not-allowed' : ''}
                  ${isTodayDate ? 'border-primary border-2' : 'border-border'}
                  ${isKnocking && !isSunday ? 'bg-primary/10' : 'bg-card'}
                `}
              >
                <div className={`text-lg font-semibold ${isKnocking && !isSunday ? 'text-primary' : isSunday ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {format(day, 'd')}
                </div>
                {entry && entry.is_finalized && (
                  <div className="text-xs text-primary font-semibold mt-2">
                    {entry.fp_plus}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary/10 border-2 border-primary" />
          <span className="text-muted-foreground">Knocking day</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-card border border-border flex items-center justify-center">
            <span className="text-xs text-primary font-semibold">2</span>
          </div>
          <span className="text-muted-foreground">Entry with FP+</span>
        </div>
      </div>

      {/* Totals */}
      <div className="mt-4 p-4 rounded-lg bg-card border border-border">
        <div className="text-sm font-semibold text-foreground mb-2">
          {viewMode === "month" ? format(currentDate, 'MMMM yyyy') : `Week of ${format(weekStart, 'MMM d')}`} Totals
        </div>
        <div className="flex gap-4">
          <div>
            <span className="text-2xl font-bold text-primary">{viewTotals.fpPlus.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground ml-1">FP+</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-primary">${viewTotals.prmr.toFixed(0)}</span>
            <span className="text-sm text-muted-foreground ml-1">PRMR</span>
          </div>
        </div>
      </div>

      {/* Save Entry Sheet */}
      <SaveEntrySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        entry={selectedEntry}
        date={selectedDate || new Date()}
        onSave={handleSaveEntry}
        onDelete={selectedEntry?.is_finalized ? handleDeleteEntry : undefined}
        isSaving={isFinalizing}
      />
    </div>
  );
};