import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, subMonths, addMonths, isAfter } from "date-fns";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { ActivityRingMini } from "./ActivityRingMini";
import { useRepActivityCalendar } from "@/hooks/useRepActivityCalendar";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/utils/haptics";

interface ActivityCalendarDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const ActivityCalendarDrawer = ({
  open,
  onOpenChange,
  userId,
  selectedDate,
  onSelectDate,
}: ActivityCalendarDrawerProps) => {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate));
  const { data: calendarData } = useRepActivityCalendar(userId, 180); // 6 months back
  
  const today = useMemo(() => new Date(), []);
  
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);
  
  // Get the first day of week offset (0 = Sunday)
  const firstDayOffset = useMemo(() => {
    return startOfMonth(viewMonth).getDay();
  }, [viewMonth]);
  
  const handlePrevMonth = () => {
    hapticSelection();
    setViewMonth(prev => subMonths(prev, 1));
  };
  
  const handleNextMonth = () => {
    hapticSelection();
    setViewMonth(prev => addMonths(prev, 1));
  };
  
  const handleSelectDay = (day: Date) => {
    if (isAfter(day, today)) return; // Can't select future dates
    hapticSelection();
    onSelectDate(day);
    onOpenChange(false);
  };
  
  const getDaySummary = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return calendarData?.byDate[dateStr];
  };
  
  const canGoNext = !isSameMonth(viewMonth, today);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] z-[70]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center justify-center gap-2">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            Activity History
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="px-4 pb-6">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <span className="text-lg font-semibold">
              {format(viewMonth, "MMMM yyyy")}
            </span>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              disabled={!canGoNext}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map(day => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-1"
              >
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for offset */}
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            
            {/* Day cells */}
            {daysInMonth.map(day => {
              const summary = getDaySummary(day);
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDate);
              const isFuture = isAfter(day, today);
              const hasData = !!summary;
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleSelectDay(day)}
                  disabled={isFuture}
                  className={cn(
                    "aspect-square flex flex-col items-center justify-center rounded-lg p-1 transition-colors",
                    "hover:bg-muted/50 active:scale-95",
                    isSelected && "bg-primary/10 ring-1 ring-primary",
                    isToday && !isSelected && "bg-accent",
                    isFuture && "opacity-30 cursor-not-allowed"
                  )}
                >
                  <span className={cn(
                    "text-xs mb-0.5",
                    isSelected ? "font-semibold text-primary" : "text-muted-foreground",
                    isToday && !isSelected && "font-semibold"
                  )}>
                    {format(day, "d")}
                  </span>
                  
                  {hasData ? (
                    <ActivityRingMini
                      doors={summary.doors}
                      hasSale={summary.hasSale}
                      hasWork={summary.hasWork}
                      size="sm"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-muted/20" />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-primary" />
              <span>High Activity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-warning flex items-center justify-center">
                <span className="text-[8px] text-warning-foreground">⭐</span>
              </div>
              <span>Sale Day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-muted/40" />
              <span>No Work</span>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
