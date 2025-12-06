import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, DollarSign } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, getDay, isBefore, startOfDay } from "date-fns";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { calculateTakeHome, formatCurrency } from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";

interface CalendarPlanningCardProps {
  fpGoal: number;
  avgPrmrPerFp: number;
  rentType: string;
  weeksWorking: number;
  upgradeFpGoal?: number;
}

export const CalendarPlanningCard = ({
  fpGoal,
  avgPrmrPerFp,
  rentType,
  weeksWorking,
  upgradeFpGoal = 0,
}: CalendarPlanningCardProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { plannedDays, togglePlannedDay, isDatePlanned, getPlannedDaysCount, isToggling } = usePlannedDays();

  const today = startOfDay(new Date());
  
  // Calculate days in current month view
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Calculate first day offset for grid alignment
  const firstDayOffset = getDay(startOfMonth(currentMonth));

  // Calculate projected earnings based on planned days
  const projectedEarnings = useMemo(() => {
    const totalPlannedDays = getPlannedDaysCount();
    if (totalPlannedDays === 0) return null;

    // Assume 6 knocking days per week based on weeksWorking
    const totalKnockingDays = weeksWorking * 6;
    const fpPerDay = fpGoal / totalKnockingDays;
    
    // Project FP+ based on planned days
    const projectedFp = fpPerDay * totalPlannedDays;
    
    const result = calculateTakeHome({
      fpGoal: projectedFp,
      avgPrmrPerFp,
      rentType,
      weeksWorking,
      upgradeFpGoal: upgradeFpGoal * (totalPlannedDays / totalKnockingDays),
    });

    return {
      projectedFp: projectedFp.toFixed(1),
      takeHome: result.takeHomePay,
      fpPerDay: fpPerDay.toFixed(2),
    };
  }, [plannedDays, fpGoal, avgPrmrPerFp, rentType, weeksWorking, upgradeFpGoal, getPlannedDaysCount]);

  const handleDayClick = async (date: Date) => {
    // Don't allow planning past days
    if (isBefore(date, today)) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    await togglePlannedDay(dateStr);
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Calendar Planning
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[100px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {dayNames.map((day) => (
            <div key={day} className="text-xs text-muted-foreground font-medium py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          
          {/* Day cells */}
          {monthDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isPlanned = isDatePlanned(dateStr);
            const isPast = isBefore(day, today);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

            return (
              <button
                key={dateStr}
                onClick={() => handleDayClick(day)}
                disabled={isPast || isToggling}
                className={cn(
                  "aspect-square rounded-lg text-sm font-medium transition-all",
                  "flex items-center justify-center",
                  isPast && "opacity-40 cursor-not-allowed",
                  !isPast && "hover:bg-accent cursor-pointer",
                  isPlanned && !isPast && "bg-primary text-primary-foreground hover:bg-primary/90",
                  isToday && !isPlanned && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  !isCurrentMonth && "opacity-30"
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        {/* Summary */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Planned Days</span>
            <span className="text-sm font-semibold">{getPlannedDaysCount()}</span>
          </div>
          
          {projectedEarnings ? (
            <div className="space-y-2 p-3 rounded-lg bg-accent/30">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Projected FP+</span>
                <span className="text-sm font-semibold">{projectedEarnings.projectedFp}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg FP+ / Day</span>
                <span className="text-sm font-semibold">{projectedEarnings.fpPerDay}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <span className="text-sm font-medium flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-green-500" />
                  Projected Earnings
                </span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(projectedEarnings.takeHome)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-3">
              Tap days to mark your planned work schedule
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
