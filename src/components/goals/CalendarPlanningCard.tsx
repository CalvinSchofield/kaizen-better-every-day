import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, ChevronLeft, ChevronRight, DollarSign, Zap, Trash2, Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, getDay, isBefore, startOfDay, addWeeks, isMonday, isTuesday, isWednesday, isThursday, isFriday, isSaturday } from "date-fns";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useRepData } from "@/hooks/useRepData";
import { useBlitzes } from "@/hooks/useBlitzes";
import { calculateTakeHome, formatCurrency } from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const [isAdding, setIsAdding] = useState(false);
  const [customWeeks, setCustomWeeks] = useState("");
  const { plannedDays, togglePlannedDay, addMultipleDays, clearAllPlannedDays, isDatePlanned, getPlannedDaysCount, isToggling } = usePlannedDays();
  const { repData } = useRepData();
  const { allBlitzes } = useBlitzes();

  const today = startOfDay(new Date());
  
  // Get committed blitzes from rep data
  const committedBlitzes = useMemo(() => {
    if (!repData?.committed_blitzes) return [];
    const committed = repData.committed_blitzes as string[];
    return allBlitzes.filter(b => committed.includes(b.name));
  }, [repData?.committed_blitzes, allBlitzes]);

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

  // Check if a day is Mon-Sat (work day)
  const isWorkDay = (date: Date): boolean => {
    return isMonday(date) || isTuesday(date) || isWednesday(date) || 
           isThursday(date) || isFriday(date) || isSaturday(date);
  };

  // Add Mon-Sat for X weeks starting from today
  const handleAddWeeks = async (numWeeks: number) => {
    setIsAdding(true);
    try {
      const dates: string[] = [];
      const endDate = addWeeks(today, numWeeks);
      let current = today;
      
      while (isBefore(current, endDate) || current.getTime() === endDate.getTime()) {
        if (isWorkDay(current) && !isBefore(current, today)) {
          dates.push(format(current, 'yyyy-MM-dd'));
        }
        current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      }
      
      await addMultipleDays(dates);
      toast.success(`Added ${numWeeks} week${numWeeks > 1 ? 's' : ''} of work days`);
      setCustomWeeks("");
    } catch (error) {
      toast.error("Failed to add days");
    } finally {
      setIsAdding(false);
    }
  };

  // Add all committed blitz dates
  const handleAddBlitzDates = async () => {
    if (committedBlitzes.length === 0) {
      toast.error("No committed blitzes found");
      return;
    }
    
    setIsAdding(true);
    try {
      const dates: string[] = [];
      
      for (const blitz of committedBlitzes) {
        const startDate = new Date(blitz.date);
        const endDate = blitz.endDate ? new Date(blitz.endDate) : startDate;
        
        let current = startDate;
        while (isBefore(current, endDate) || current.getTime() === endDate.getTime()) {
          if (!isBefore(current, today)) {
            dates.push(format(current, 'yyyy-MM-dd'));
          }
          current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
        }
      }
      
      await addMultipleDays(dates);
      toast.success(`Added ${dates.length} blitz days`);
    } catch (error) {
      toast.error("Failed to add blitz days");
    } finally {
      setIsAdding(false);
    }
  };

  const handleCustomWeeks = async () => {
    const weeks = parseInt(customWeeks, 10);
    if (isNaN(weeks) || weeks < 1 || weeks > 52) {
      toast.error("Enter a number between 1 and 52");
      return;
    }
    await handleAddWeeks(weeks);
  };

  const handleClearAll = async () => {
    setIsAdding(true);
    try {
      await clearAllPlannedDays();
      toast.success("Cleared all planned days");
    } catch (error) {
      toast.error("Failed to clear days");
    } finally {
      setIsAdding(false);
    }
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
        {/* Quick Presets */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddWeeks(1)}
            disabled={isAdding || isToggling}
            className="text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />
            +1 Wk
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddWeeks(4)}
            disabled={isAdding || isToggling}
            className="text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />
            +4 Wks
          </Button>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              max={52}
              placeholder="#"
              value={customWeeks}
              onChange={(e) => setCustomWeeks(e.target.value.slice(0, 2))}
              disabled={isAdding || isToggling}
              className="w-12 h-8 text-xs text-center px-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCustomWeeks}
              disabled={isAdding || isToggling || !customWeeks}
              className="text-xs h-8 px-2"
            >
              <Plus className="h-3 w-3" />
              Wks
            </Button>
          </div>
          {committedBlitzes.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddBlitzDates}
              disabled={isAdding || isToggling}
              className="text-xs"
            >
              <Zap className="h-3 w-3 mr-1" />
              Blitz Days
            </Button>
          )}
          {getPlannedDaysCount() > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              disabled={isAdding || isToggling}
              className="text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>

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
                disabled={isPast || isToggling || isAdding}
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
              Tap days or use presets to plan your work schedule
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
