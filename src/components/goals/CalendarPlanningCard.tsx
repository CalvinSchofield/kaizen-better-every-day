import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, ChevronLeft, ChevronRight, DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, getDay, isBefore, isSameDay } from "date-fns";
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

// Parse date string as local date (not UTC) to avoid timezone offset issues
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Get today as local start of day
const getLocalToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

interface CalendarPlanningCardProps {
  mustDoFpGoal: number;
  willDoFpGoal: number;
  couldDoFpGoal: number;
  avgPrmrPerFp: number;
  rentType: string;
  weeksWorking: number;
  upgradeFpGoal?: number;
  preseasonFpGoal?: number;
  onPreseasonGoalChange?: (goal: number) => void;
}

export const CalendarPlanningCard = ({
  mustDoFpGoal,
  willDoFpGoal,
  couldDoFpGoal,
  avgPrmrPerFp,
  rentType,
  weeksWorking,
  upgradeFpGoal = 0,
  preseasonFpGoal = 0,
  onPreseasonGoalChange,
}: CalendarPlanningCardProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [preseasonTotalInput, setPreseasonTotalInput] = useState(preseasonFpGoal.toString());
  const [preseasonDailyInput, setPreseasonDailyInput] = useState('');
  const [selectedTier, setSelectedTier] = useState<'must' | 'will' | 'could'>('will');
  
  const { plannedDays, togglePlannedDay, isDatePlanned, isToggling } = usePlannedDays();
  const { totalFP: preseasonCurrentFP } = usePreseasonFP();
  const { efpModeEnabled: isEfpMode, calculateEfp } = useEfpMode();
  
  // Hook for auto-syncing with blitzes and summer dates
  const { getBlitzDays, getSummerDays } = usePlannedDaysSync();

  const today = getLocalToday();
  const isViewingToday = isSameMonth(currentMonth, today);

  // Calculate days in current month view
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Calculate first day offset for grid alignment
  const firstDayOffset = getDay(startOfMonth(currentMonth));

  // Separate preseason and summer planned days - use parseLocalDate to avoid timezone issues
  const { preseasonPlannedDays, summerPlannedDays, pastPreseasonDays } = useMemo(() => {
    const preseasonStart = parseLocalDate(PRESEASON_START);
    const preseasonEnd = parseLocalDate(PRESEASON_END);
    const summerStart = parseLocalDate(SUMMER_START);
    const summerEnd = parseLocalDate(SUMMER_END);
    
    const allPlanned = plannedDays?.map(d => d.planned_date) || [];
    
    const preseasonFuture = allPlanned.filter(dateStr => {
      const date = parseLocalDate(dateStr);
      return date >= preseasonStart && date <= preseasonEnd && !isBefore(date, today);
    });
    
    const preseasonPast = allPlanned.filter(dateStr => {
      const date = parseLocalDate(dateStr);
      return date >= preseasonStart && date <= preseasonEnd && isBefore(date, today);
    });
    
    const summer = allPlanned.filter(dateStr => {
      const date = parseLocalDate(dateStr);
      return date >= summerStart && date <= summerEnd && !isBefore(date, today);
    });
    
    return { 
      preseasonPlannedDays: preseasonFuture, 
      summerPlannedDays: summer,
      pastPreseasonDays: preseasonPast 
    };
  }, [plannedDays, today]);

  // Get selected summer goal based on tier
  const selectedSummerGoal = useMemo(() => {
    switch (selectedTier) {
      case 'must': return mustDoFpGoal;
      case 'will': return willDoFpGoal;
      case 'could': return couldDoFpGoal;
    }
  }, [selectedTier, mustDoFpGoal, willDoFpGoal, couldDoFpGoal]);

  // Calculate preseason stats
  const preseasonStats = useMemo(() => {
    const futurePlannedCount = preseasonPlannedDays.length;
    const pastCount = pastPreseasonDays.length;
    const totalPreseasonDays = futurePlannedCount + pastCount;
    
    if (totalPreseasonDays === 0) return null;

    const currentFP = preseasonCurrentFP || 0;
    const goalTotal = parseFloat(preseasonTotalInput) || 0;
    const goalDailyRaw = totalPreseasonDays > 0 ? goalTotal / totalPreseasonDays : 0;
    
    const daysWorked = pastCount || 1;
    const currentDailyAvgRaw = currentFP / daysWorked;
    const projectedTotalRaw = currentDailyAvgRaw * totalPreseasonDays;

    // Convert to EFP if mode is enabled
    const conversionFactor = isEfpMode ? avgPrmrPerFp / 85 : 1;
    
    const onPace = projectedTotalRaw >= goalTotal;
    const pacePercent = goalTotal > 0 ? (projectedTotalRaw / goalTotal) * 100 : 0;

    return {
      futurePlannedCount,
      pastCount,
      totalDays: totalPreseasonDays,
      goalTotal: (goalTotal * conversionFactor).toFixed(1),
      goalDaily: (goalDailyRaw * conversionFactor).toFixed(2),
      currentDailyAvg: (currentDailyAvgRaw * conversionFactor).toFixed(2),
      projectedTotal: (projectedTotalRaw * conversionFactor).toFixed(1),
      currentFP: (currentFP * conversionFactor).toFixed(1),
      onPace,
      pacePercent,
    };
  }, [preseasonPlannedDays, pastPreseasonDays, preseasonCurrentFP, preseasonTotalInput, isEfpMode, avgPrmrPerFp]);

  // Calculate summer stats based on selected tier
  const summerStats = useMemo(() => {
    const plannedCount = summerPlannedDays.length;
    if (plannedCount === 0) return null;

    // Remaining summer goal = Selected tier - preseason goal - current preseason FP
    const preseasonGoal = parseFloat(preseasonTotalInput) || 0;
    const currentPreseasonFP = preseasonCurrentFP || 0;
    const remainingSummerGoal = Math.max(0, selectedSummerGoal - preseasonGoal);
    
    const goalDailyRaw = plannedCount > 0 ? remainingSummerGoal / plannedCount : 0;

    // Calculate projected earnings
    const result = calculateTakeHome({
      fpGoal: selectedSummerGoal,
      avgPrmrPerFp,
      rentType,
      weeksWorking,
      upgradeFpGoal,
    });

    const conversionFactor = isEfpMode ? avgPrmrPerFp / 85 : 1;

    return {
      plannedCount,
      goalTotal: (remainingSummerGoal * conversionFactor).toFixed(1),
      goalDaily: (goalDailyRaw * conversionFactor).toFixed(2),
      projectedEarnings: result.takeHomePay,
    };
  }, [summerPlannedDays, selectedSummerGoal, preseasonTotalInput, preseasonCurrentFP, avgPrmrPerFp, rentType, weeksWorking, upgradeFpGoal, isEfpMode]);

  // Calculate total stats
  const totalStats = useMemo(() => {
    const currentFP = preseasonCurrentFP || 0;
    const preseasonGoal = parseFloat(preseasonTotalInput) || 0;
    const onPace = preseasonStats ? preseasonStats.onPace : true;
    
    // Total goal is the selected tier
    const goalTotal = selectedSummerGoal;

    // Calculate projected earnings
    const result = calculateTakeHome({
      fpGoal: goalTotal,
      avgPrmrPerFp,
      rentType,
      weeksWorking,
      upgradeFpGoal,
    });

    const conversionFactor = isEfpMode ? avgPrmrPerFp / 85 : 1;

    return {
      goalTotal: (goalTotal * conversionFactor).toFixed(1),
      currentFP: (currentFP * conversionFactor).toFixed(1),
      onPace,
      projectedEarnings: result.takeHomePay,
    };
  }, [selectedSummerGoal, preseasonCurrentFP, preseasonTotalInput, preseasonStats, avgPrmrPerFp, rentType, weeksWorking, upgradeFpGoal, isEfpMode]);

  // Handle preseason total input change
  const handlePreseasonTotalChange = (value: string) => {
    setPreseasonTotalInput(value);
    const numValue = parseFloat(value) || 0;
    if (preseasonStats && preseasonStats.totalDays > 0) {
      setPreseasonDailyInput((numValue / preseasonStats.totalDays).toFixed(2));
    }
    onPreseasonGoalChange?.(numValue);
  };

  // Handle preseason daily input change
  const handlePreseasonDailyChange = (value: string) => {
    setPreseasonDailyInput(value);
    const numValue = parseFloat(value) || 0;
    if (preseasonStats && preseasonStats.totalDays > 0) {
      const total = numValue * preseasonStats.totalDays;
      setPreseasonTotalInput(total.toFixed(1));
      onPreseasonGoalChange?.(total);
    }
  };

  const handleDayClick = async (date: Date) => {
    const dayOfWeek = getDay(date);
    // Don't allow Sundays or past days
    if (dayOfWeek === 0 || isBefore(date, today)) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    await togglePlannedDay(dateStr);
  };

  const metricLabel = isEfpMode ? 'EFP' : 'FP+';

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
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Navigation - matches CalendarView style */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button 
          variant={isViewingToday ? "ghost" : "default"} 
          size="sm" 
          onClick={handleGoToToday}
          className={cn("w-full", isViewingToday && "text-xs")}
        >
          Today
        </Button>

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

        {/* Preseason Goal Inputs */}
        <div className="pt-3 border-t border-border/50">
          <h4 className="text-sm font-semibold mb-2">Preseason Goal</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Total {metricLabel}</label>
              <Input
                type="number"
                value={preseasonTotalInput}
                onChange={(e) => handlePreseasonTotalChange(e.target.value)}
                placeholder="e.g. 10"
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Daily {metricLabel}</label>
              <Input
                type="number"
                value={preseasonDailyInput}
                onChange={(e) => handlePreseasonDailyChange(e.target.value)}
                placeholder="auto"
                className="h-9"
              />
            </div>
          </div>
          {preseasonStats && (
            <div className="mt-3 p-3 rounded-lg bg-accent/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Current</span>
                <span className="text-sm font-bold text-primary">{preseasonStats.currentFP} {metricLabel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Pace</span>
                <span className={cn(
                  "text-sm font-semibold flex items-center gap-1",
                  preseasonStats.onPace ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                )}>
                  {preseasonStats.onPace ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {preseasonStats.projectedTotal} {metricLabel}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Summer Goal Tier Selection */}
        <div className="pt-3 border-t border-border/50">
          <h4 className="text-sm font-semibold mb-2">Summer Goal Tier</h4>
          <div className="grid grid-cols-3 gap-2">
            {(['must', 'will', 'could'] as const).map((tier) => {
              const tierGoal = tier === 'must' ? mustDoFpGoal : tier === 'will' ? willDoFpGoal : couldDoFpGoal;
              const tierLabel = tier === 'must' ? 'Must Do' : tier === 'will' ? 'Will Do' : 'Could Do';
              return (
                <Button
                  key={tier}
                  variant={selectedTier === tier ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTier(tier)}
                  className="flex flex-col h-auto py-2"
                >
                  <span className="text-xs">{tierLabel}</span>
                  <span className="font-bold">{tierGoal}</span>
                </Button>
              );
            })}
          </div>
          {summerStats && (
            <div className="mt-3 p-3 rounded-lg bg-accent/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Days Planned</span>
                <span className="text-sm font-semibold">{summerStats.plannedCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Daily Goal</span>
                <span className="text-sm font-semibold">{summerStats.goalDaily} {metricLabel}</span>
              </div>
            </div>
          )}
        </div>

        {/* Total Summary */}
        {totalStats && (
          <div className="pt-3 border-t border-border/50">
            <h4 className="text-sm font-semibold mb-2">Total Summary</h4>
            <div className="p-3 rounded-lg bg-primary/10 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Goal Total</span>
                <span className="text-lg font-bold">{totalStats.goalTotal} {metricLabel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Current</span>
                <span className={cn(
                  "text-sm font-semibold flex items-center gap-1",
                  totalStats.onPace ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                )}>
                  {totalStats.onPace ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {totalStats.currentFP} {metricLabel}
                </span>
              </div>
              <div className="pt-2 border-t border-border/30 flex justify-between items-center">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  Projected Earnings
                </span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(totalStats.projectedEarnings)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!totalStats && (
          <p className="text-sm text-muted-foreground text-center py-3">
            Set your summer dates to see projections
          </p>
        )}
      </CardContent>
    </Card>
  );
};