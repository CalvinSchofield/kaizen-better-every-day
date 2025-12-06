import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, DollarSign } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, getDay, isBefore, startOfDay, isSameDay } from "date-fns";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { usePlannedDaysSync } from "@/hooks/usePlannedDaysSync";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { calculateTakeHome, formatCurrency } from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";

// Define season boundaries
const PRESEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';
const SUMMER_START = '2026-04-12';
const SUMMER_END = '2026-09-27';

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
  const { plannedDays, togglePlannedDay, isDatePlanned, isToggling } = usePlannedDays();
  const { totalFP: preseasonCurrentFP } = usePreseasonFP();
  const { efpModeEnabled: isEfpMode } = useEfpMode();
  
  // Hook for auto-syncing with blitzes and summer dates
  const { getBlitzDays, getSummerDays } = usePlannedDaysSync();

  const today = startOfDay(new Date());
  const isViewingToday = isSameMonth(currentMonth, today);

  // Calculate days in current month view
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Calculate first day offset for grid alignment
  const firstDayOffset = getDay(startOfMonth(currentMonth));

  // Separate preseason and summer planned days
  const { preseasonPlannedDays, summerPlannedDays } = useMemo(() => {
    const preseasonStart = new Date(PRESEASON_START);
    const preseasonEnd = new Date(PRESEASON_END);
    const summerStart = new Date(SUMMER_START);
    const summerEnd = new Date(SUMMER_END);
    
    const allPlanned = plannedDays?.map(d => d.planned_date) || [];
    
    const preseason = allPlanned.filter(dateStr => {
      const date = new Date(dateStr);
      return date >= preseasonStart && date <= preseasonEnd && !isBefore(date, today);
    });
    
    const summer = allPlanned.filter(dateStr => {
      const date = new Date(dateStr);
      return date >= summerStart && date <= summerEnd && !isBefore(date, today);
    });
    
    return { preseasonPlannedDays: preseason, summerPlannedDays: summer };
  }, [plannedDays, today]);

  const { calculateEfp } = useEfpMode();

  // Calculate preseason stats
  const preseasonStats = useMemo(() => {
    const plannedCount = preseasonPlannedDays.length;
    if (plannedCount === 0) return null;

    // Calculate current daily average based on actual preseason FP+
    const currentFP = preseasonCurrentFP || 0;
    
    // Goal daily - fpGoal is stored as FP+, convert if EFP mode
    const goalDailyFPRaw = fpGoal && weeksWorking ? fpGoal / (weeksWorking * 6) : 0;
    
    // Past preseason days for pace calculation
    const pastPreseasonDays = (plannedDays?.map(d => d.planned_date) || []).filter(dateStr => {
      const date = new Date(dateStr);
      const preseasonStart = new Date(PRESEASON_START);
      const preseasonEnd = new Date(PRESEASON_END);
      return date >= preseasonStart && date <= preseasonEnd && isBefore(date, today);
    });
    
    const daysWorked = pastPreseasonDays.length || 1;
    const currentDailyAvgRaw = currentFP / daysWorked;
    
    // Projected total based on current daily average
    const projectedTotalRaw = currentDailyAvgRaw * (plannedCount + pastPreseasonDays.length);
    
    // Goal total based on goal daily
    const goalTotalRaw = goalDailyFPRaw * (plannedCount + pastPreseasonDays.length);

    // Convert to EFP if mode is enabled (EFP = PRMR / 85, and FP+ ≈ PRMR/avgPrmrPerFp)
    // When converting FP+ to EFP: EFP = FP+ * avgPrmrPerFp / 85
    const conversionFactor = isEfpMode ? avgPrmrPerFp / 85 : 1;

    return {
      plannedCount,
      goalDailyFP: (goalDailyFPRaw * conversionFactor).toFixed(2),
      goalTotal: (goalTotalRaw * conversionFactor).toFixed(1),
      currentDailyAvg: (currentDailyAvgRaw * conversionFactor).toFixed(2),
      projectedTotal: (projectedTotalRaw * conversionFactor).toFixed(1),
      currentFP: (currentFP * conversionFactor).toFixed(1),
    };
  }, [preseasonPlannedDays, preseasonCurrentFP, fpGoal, weeksWorking, plannedDays, today, isEfpMode, avgPrmrPerFp]);

  // Calculate summer stats
  const summerStats = useMemo(() => {
    const plannedCount = summerPlannedDays.length;
    if (plannedCount === 0) return null;

    // Goal daily average from settings (fpGoal is stored as FP+)
    const goalDailyFPRaw = fpGoal && weeksWorking ? fpGoal / (weeksWorking * 6) : 0;
    const goalTotalRaw = goalDailyFPRaw * plannedCount;

    // Calculate projected earnings (always uses FP+ for payscale calculation)
    const result = calculateTakeHome({
      fpGoal: goalTotalRaw,
      avgPrmrPerFp,
      rentType,
      weeksWorking,
      upgradeFpGoal: upgradeFpGoal * (plannedCount / (weeksWorking * 6)),
    });

    // Convert to EFP if mode is enabled
    const conversionFactor = isEfpMode ? avgPrmrPerFp / 85 : 1;

    return {
      plannedCount,
      goalDailyFP: (goalDailyFPRaw * conversionFactor).toFixed(2),
      goalTotal: (goalTotalRaw * conversionFactor).toFixed(1),
      projectedEarnings: result.takeHomePay,
    };
  }, [summerPlannedDays, fpGoal, avgPrmrPerFp, rentType, weeksWorking, upgradeFpGoal, isEfpMode]);

  const handleDayClick = async (date: Date) => {
    const dayOfWeek = getDay(date);
    // Don't allow Sundays or past days
    if (dayOfWeek === 0 || isBefore(date, today)) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    await togglePlannedDay(dateStr);
  };

  const handleGoToToday = () => {
    setCurrentMonth(new Date());
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
            <button 
              onClick={handleGoToToday}
              className={cn(
                "text-sm font-medium min-w-[100px] text-center transition-colors",
                !isViewingToday && "text-primary underline underline-offset-2 cursor-pointer"
              )}
            >
              {format(currentMonth, 'MMMM yyyy')}
            </button>
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
        {/* Info text */}
        <p className="text-xs text-muted-foreground">
          Auto-synced from blitzes & summer dates. Tap to adjust.
        </p>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {dayNames.map((day, idx) => (
            <div 
              key={day} 
              className={cn(
                "text-xs font-medium py-1",
                idx === 0 ? "text-muted-foreground/50" : "text-muted-foreground"
              )}
            >
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
            const isTodayDate = isSameDay(day, today);
            const dayOfWeek = getDay(day);
            const isSunday = dayOfWeek === 0;

            return (
              <button
                key={dateStr}
                onClick={() => handleDayClick(day)}
                disabled={isPast || isToggling || isSunday}
                className={cn(
                  "aspect-square rounded-lg text-sm font-medium transition-all",
                  "flex items-center justify-center",
                  isSunday && "opacity-30 cursor-not-allowed",
                  isPast && !isSunday && "opacity-40 cursor-not-allowed",
                  !isPast && !isSunday && "hover:bg-accent cursor-pointer",
                  isPlanned && !isPast && !isSunday && "bg-primary text-primary-foreground hover:bg-primary/90",
                  isTodayDate && !isPlanned && !isSunday && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  !isCurrentMonth && "opacity-30"
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        {/* Preseason Stats */}
        {preseasonStats && (
          <div className="pt-3 border-t border-border/50">
            <h4 className="text-sm font-semibold mb-2">Preseason</h4>
            <div className="space-y-2 p-3 rounded-lg bg-accent/30">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Goal Daily</p>
                  <p className="text-sm font-semibold">{preseasonStats.goalDailyFP} {isEfpMode ? 'EFP' : 'FP+'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Avg</p>
                  <p className="text-sm font-semibold">{preseasonStats.currentDailyAvg} {isEfpMode ? 'EFP' : 'FP+'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/30">
                <div>
                  <p className="text-xs text-muted-foreground">Goal Total</p>
                  <p className="text-sm font-semibold">{preseasonStats.goalTotal} {isEfpMode ? 'EFP' : 'FP+'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">On Pace For</p>
                  <p className="text-sm font-semibold">{preseasonStats.projectedTotal} {isEfpMode ? 'EFP' : 'FP+'}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/30">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">Current Total</p>
                  <p className="text-sm font-bold text-primary">{preseasonStats.currentFP} {isEfpMode ? 'EFP' : 'FP+'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summer Stats */}
        {summerStats && (
          <div className="pt-3 border-t border-border/50">
            <h4 className="text-sm font-semibold mb-2">Summer</h4>
            <div className="space-y-2 p-3 rounded-lg bg-accent/30">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Planned Days</span>
                <span className="text-sm font-semibold">{summerStats.plannedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Goal Daily</span>
                <span className="text-sm font-semibold">{summerStats.goalDailyFP} {isEfpMode ? 'EFP' : 'FP+'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Goal Total</span>
                <span className="text-sm font-semibold">{summerStats.goalTotal} {isEfpMode ? 'EFP' : 'FP+'}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <span className="text-sm font-medium flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-green-500" />
                  Projected Earnings
                </span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(summerStats.projectedEarnings)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!preseasonStats && !summerStats && (
          <p className="text-sm text-muted-foreground text-center py-3">
            Set your summer dates above to auto-populate work days
          </p>
        )}
      </CardContent>
    </Card>
  );
};