import { useState } from "react";
import { format, isSameDay, startOfWeek, addDays, isAfter, subWeeks } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { ActivityRingMini, ActivityCalendarDrawer } from "@/components/activity-ring";
import { useRepActivityCalendar } from "@/hooks/useRepActivityCalendar";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/utils/haptics";

interface MyActivityCardProps {
  onSelectDate?: (date: Date) => void;
}

export const MyActivityCard = ({ onSelectDate }: MyActivityCardProps) => {
  const { userId } = useCurrentUserId();
  const { data: calendarData } = useRepActivityCalendar(userId ?? undefined, 90);
  
  const [weekOffset, setWeekOffset] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const today = new Date();
  const baseWeekStart = startOfWeek(subWeeks(today, weekOffset), { weekStartsOn: 0 });
  
  // Generate days for current week view
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(baseWeekStart, i));
  
  const handlePrevWeek = () => {
    hapticSelection();
    setWeekOffset(prev => prev + 1);
  };
  
  const handleNextWeek = () => {
    hapticSelection();
    if (weekOffset > 0) {
      setWeekOffset(prev => prev - 1);
    }
  };
  
  const handleSelectDay = (date: Date) => {
    if (isAfter(date, today)) return;
    hapticSelection();
    setSelectedDate(date);
    onSelectDate?.(date);
  };
  
  const getDaySummary = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return calendarData?.byDate[dateStr];
  };
  
  // Calculate week stats
  const weekStats = weekDays.reduce(
    (acc, day) => {
      const summary = getDaySummary(day);
      if (summary) {
        acc.totalDoors += summary.doors;
        acc.totalFP += summary.fp;
        acc.daysWorked += summary.hasWork ? 1 : 0;
        acc.salesDays += summary.hasSale ? 1 : 0;
      }
      return acc;
    },
    { totalDoors: 0, totalFP: 0, daysWorked: 0, salesDays: 0 }
  );
  
  const canGoNext = weekOffset > 0;

  if (!userId) return null;

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <span className="text-lg">🗓️</span>
              My Activity
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setShowCalendar(true)}
            >
              <Calendar className="h-3.5 w-3.5" />
              Full History
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handlePrevWeek}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <span className="text-sm font-medium text-muted-foreground">
              {format(weekDays[0], 'MMM d')} – {format(weekDays[6], 'MMM d')}
            </span>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleNextWeek}
              disabled={!canGoNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Week Days Grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {weekDays.map((day, i) => {
              const summary = getDaySummary(day);
              const isToday = isSameDay(day, today);
              const isFuture = isAfter(day, today);
              const isSelected = isSameDay(day, selectedDate);
              
              return (
                <button
                  key={i}
                  onClick={() => handleSelectDay(day)}
                  disabled={isFuture}
                  className={cn(
                    "flex flex-col items-center py-2 rounded-lg transition-colors",
                    "hover:bg-muted/50 active:scale-95",
                    isSelected && "bg-primary/10 ring-1 ring-primary",
                    isToday && !isSelected && "bg-accent",
                    isFuture && "opacity-30 cursor-not-allowed"
                  )}
                >
                  <span className="text-[10px] text-muted-foreground mb-1">
                    {format(day, 'EEE')}
                  </span>
                  <span className={cn(
                    "text-xs font-medium mb-1",
                    isToday && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </span>
                  <ActivityRingMini
                    doors={summary?.doors || 0}
                    hasSale={summary?.hasSale || false}
                    hasWork={summary?.hasWork || false}
                    size="sm"
                  />
                </button>
              );
            })}
          </div>
          
          {/* Week Summary */}
          <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border/50">
            <div className="text-center">
              <div className="text-lg font-semibold">{weekStats.daysWorked}</div>
              <div className="text-[10px] text-muted-foreground">Days</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{weekStats.totalDoors}</div>
              <div className="text-[10px] text-muted-foreground">Doors</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{weekStats.totalFP.toFixed(1)}</div>
              <div className="text-[10px] text-muted-foreground">FP+</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{weekStats.salesDays}</div>
              <div className="text-[10px] text-muted-foreground">Sale Days</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Full Calendar Drawer */}
      <ActivityCalendarDrawer
        open={showCalendar}
        onOpenChange={setShowCalendar}
        userId={userId}
        selectedDate={selectedDate}
        onSelectDate={(date) => {
          setSelectedDate(date);
          onSelectDate?.(date);
        }}
      />
    </>
  );
};
