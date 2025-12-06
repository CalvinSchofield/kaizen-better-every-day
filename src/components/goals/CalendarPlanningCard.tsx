import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, DollarSign, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, getDay, isBefore, isSameDay } from "date-fns";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { usePlannedDaysSync } from "@/hooks/usePlannedDaysSync";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useRepGoals } from "@/hooks/useRepGoals";
import { calculateTakeHome, formatCurrency } from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const [preseasonInputMode, setPreseasonInputMode] = useState<'total' | 'daily'>('total');
  const [preseasonTotalInput, setPreseasonTotalInput] = useState(preseasonFpGoal.toString());
  const [preseasonDailyInput, setPreseasonDailyInput] = useState('');
  const [selectedTier, setSelectedTier] = useState<'must' | 'will' | 'could'>('will');
  const [isPreseasonOpen, setIsPreseasonOpen] = useState(true);
  const [isSummerOpen, setIsSummerOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const { plannedDays, togglePlannedDay, isDatePlanned, isToggling } = usePlannedDays();
  const { totalFP: preseasonCurrentFP, totalEFP: preseasonCurrentEFP } = usePreseasonFP();
  const { efpModeEnabled: isEfpMode, calculateEfp } = useEfpMode();
  const { updateGoals, isUpdating } = useRepGoals();
  
  // Debounce timer ref for saving preseason goal
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Hook for auto-syncing with blitzes and summer dates
  const { getBlitzDays, getSummerDays } = usePlannedDaysSync();

  // Query to get actual days worked (finalized entries)
  const { data: workedDays } = useQuery({
    queryKey: ['worked-days-count'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { preseasonDaysWorked: 0, summerDaysWorked: 0 };

      // Get all finalized entries
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date')
        .eq('user_id', user.id)
        .eq('is_finalized', true);

      if (error) {
        console.error('Error fetching worked days:', error);
        return { preseasonDaysWorked: 0, summerDaysWorked: 0 };
      }

      const preseasonStart = parseLocalDate(PRESEASON_START);
      const preseasonEnd = parseLocalDate(PRESEASON_END);
      const summerStart = parseLocalDate(SUMMER_START);
      const summerEnd = parseLocalDate(SUMMER_END);

      let preseasonCount = 0;
      let summerCount = 0;

      entries?.forEach(entry => {
        const date = parseLocalDate(entry.entry_date);
        if (date >= preseasonStart && date <= preseasonEnd) {
          preseasonCount++;
        } else if (date >= summerStart && date <= summerEnd) {
          summerCount++;
        }
      });

      return { preseasonDaysWorked: preseasonCount, summerDaysWorked: summerCount };
    },
    staleTime: 1000 * 60 * 5,
  });

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
  const { preseasonPlannedDays, summerPlannedDays } = useMemo(() => {
    const preseasonStart = parseLocalDate(PRESEASON_START);
    const preseasonEnd = parseLocalDate(PRESEASON_END);
    const summerStart = parseLocalDate(SUMMER_START);
    const summerEnd = parseLocalDate(SUMMER_END);
    
    const allPlanned = plannedDays?.map(d => d.planned_date) || [];
    
    // Future preseason planned days only (not past)
    const preseasonFuture = allPlanned.filter(dateStr => {
      const date = parseLocalDate(dateStr);
      return date >= preseasonStart && date <= preseasonEnd && !isBefore(date, today);
    });
    
    // Future summer planned days only (not past)
    const summerFuture = allPlanned.filter(dateStr => {
      const date = parseLocalDate(dateStr);
      return date >= summerStart && date <= summerEnd && !isBefore(date, today);
    });
    
    return { 
      preseasonPlannedDays: preseasonFuture, 
      summerPlannedDays: summerFuture,
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

  // Calculate preseason stats - now using actual worked days from database
  const preseasonStats = useMemo(() => {
    const futurePlannedCount = preseasonPlannedDays.length;
    const daysWorkedCount = workedDays?.preseasonDaysWorked || 0;
    const totalPreseasonDays = futurePlannedCount + daysWorkedCount;
    
    if (totalPreseasonDays === 0) return null;

    // Use EFP if in EFP mode, otherwise use FP+
    const currentProgress = isEfpMode ? preseasonCurrentEFP : preseasonCurrentFP;
    
    // Convert input goal to raw value
    const inputGoal = parseFloat(preseasonTotalInput) || 0;
    const goalTotal = inputGoal; // Goal is already in the correct mode unit
    const goalDaily = totalPreseasonDays > 0 ? goalTotal / totalPreseasonDays : 0;
    
    const daysWorked = daysWorkedCount || 1;
    const currentDailyAvg = currentProgress / daysWorked;
    const projectedTotal = currentDailyAvg * totalPreseasonDays;
    
    // Calculate remaining goal (what's left after current progress)
    const remainingGoal = Math.max(0, goalTotal - currentProgress);
    const remainingDays = futurePlannedCount;
    const neededDaily = remainingDays > 0 ? remainingGoal / remainingDays : 0;
    
    const onPace = projectedTotal >= goalTotal;
    const pacePercent = goalTotal > 0 ? (currentProgress / goalTotal) * 100 : 0;

    return {
      futurePlannedCount,
      daysWorkedCount,
      totalDays: totalPreseasonDays,
      daysLeft: futurePlannedCount,
      goalTotal: goalTotal.toFixed(1),
      goalTotalRaw: goalTotal,
      goalDaily: goalDaily.toFixed(2),
      currentDailyAvg: currentDailyAvg.toFixed(2),
      projectedTotal: projectedTotal.toFixed(1),
      currentFP: currentProgress.toFixed(1),
      currentFPRaw: currentProgress,
      remainingGoal: remainingGoal.toFixed(1),
      neededDaily: neededDaily.toFixed(2),
      onPace,
      pacePercent,
    };
  }, [preseasonPlannedDays, workedDays, preseasonCurrentFP, preseasonCurrentEFP, preseasonTotalInput, isEfpMode]);

  // Calculate summer stats based on selected tier
  const summerStats = useMemo(() => {
    const futurePlannedCount = summerPlannedDays.length;
    const daysWorkedCount = workedDays?.summerDaysWorked || 0;
    const totalSummerDays = futurePlannedCount + daysWorkedCount;
    
    if (totalSummerDays === 0) return null;

    // Preseason goal is in the current mode already
    const preseasonGoal = parseFloat(preseasonTotalInput) || 0;
    
    // Remaining summer goal = Selected tier (converted to current mode) - preseason goal
    const conversionFactor = isEfpMode ? avgPrmrPerFp / 85 : 1;
    const selectedGoalInMode = selectedSummerGoal * conversionFactor;
    const remainingSummerGoal = Math.max(0, selectedGoalInMode - preseasonGoal);
    
    const goalDaily = totalSummerDays > 0 ? remainingSummerGoal / totalSummerDays : 0;

    // Calculate projected earnings
    const result = calculateTakeHome({
      fpGoal: selectedSummerGoal,
      avgPrmrPerFp,
      rentType,
      weeksWorking,
      upgradeFpGoal,
    });

    return {
      futurePlannedCount,
      daysWorkedCount,
      totalDays: totalSummerDays,
      daysLeft: futurePlannedCount,
      goalTotal: remainingSummerGoal.toFixed(1),
      goalDaily: goalDaily.toFixed(2),
      projectedEarnings: result.takeHomePay,
    };
  }, [summerPlannedDays, workedDays, selectedSummerGoal, preseasonTotalInput, avgPrmrPerFp, rentType, weeksWorking, upgradeFpGoal, isEfpMode]);

  // Calculate total stats
  const totalStats = useMemo(() => {
    // Use EFP if in EFP mode, otherwise use FP+
    const currentProgress = isEfpMode ? preseasonCurrentEFP : preseasonCurrentFP;
    const onPace = preseasonStats ? preseasonStats.onPace : true;
    
    // Total goal is the selected tier (convert to current mode)
    const conversionFactor = isEfpMode ? avgPrmrPerFp / 85 : 1;
    const goalTotal = selectedSummerGoal * conversionFactor;

    // Calculate projected earnings
    const result = calculateTakeHome({
      fpGoal: selectedSummerGoal,
      avgPrmrPerFp,
      rentType,
      weeksWorking,
      upgradeFpGoal,
    });

    return {
      goalTotal: goalTotal.toFixed(1),
      currentFP: currentProgress.toFixed(1),
      onPace,
      projectedEarnings: result.takeHomePay,
    };
  }, [selectedSummerGoal, preseasonCurrentFP, preseasonCurrentEFP, preseasonStats, avgPrmrPerFp, rentType, weeksWorking, upgradeFpGoal, isEfpMode]);

  // Save preseason goal to database with debounce
  const savePreseasonGoal = (value: number) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      await updateGoals({ preseason_fp_goal: value });
      setIsSaving(false);
    }, 800);
  };


  // Handle preseason total input change
  const handlePreseasonTotalChange = (value: string) => {
    setPreseasonTotalInput(value);
    const numValue = parseFloat(value) || 0;
    if (preseasonStats && preseasonStats.totalDays > 0) {
      setPreseasonDailyInput((numValue / preseasonStats.totalDays).toFixed(2));
    }
    onPreseasonGoalChange?.(numValue);
    savePreseasonGoal(numValue);
  };

  // Handle preseason daily input change
  const handlePreseasonDailyChange = (value: string) => {
    setPreseasonDailyInput(value);
    const numValue = parseFloat(value) || 0;
    if (preseasonStats && preseasonStats.totalDays > 0) {
      const total = numValue * preseasonStats.totalDays;
      setPreseasonTotalInput(total.toFixed(1));
      onPreseasonGoalChange?.(total);
      savePreseasonGoal(total);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleDayClick = async (date: Date) => {
    const dayOfWeek = getDay(date);
    const summerEnd = parseLocalDate(SUMMER_END);
    // Don't allow Sundays, past days, or days after summer end
    if (dayOfWeek === 0 || isBefore(date, today) || date > summerEnd) return;
    
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
            const summerEnd = parseLocalDate(SUMMER_END);
            const isAfterSummerEnd = day > summerEnd;
            const isDisabled = isPast || isSunday || isAfterSummerEnd;

            return (
              <button
                key={dateStr}
                onClick={() => handleDayClick(day)}
                disabled={isDisabled || isToggling}
                className={cn(
                  "aspect-square rounded-lg text-sm font-medium transition-all",
                  "flex items-center justify-center",
                  (isSunday || isAfterSummerEnd) && "opacity-30 cursor-not-allowed",
                  isPast && !isSunday && !isAfterSummerEnd && "opacity-40 cursor-not-allowed",
                  !isDisabled && "hover:bg-accent cursor-pointer",
                  isPlanned && !isDisabled && "bg-primary text-primary-foreground hover:bg-primary/90",
                  isTodayDate && !isPlanned && !isSunday && !isAfterSummerEnd && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  !isCurrentMonth && "opacity-30"
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        {/* Preseason Goal Inputs - Collapsible */}
        <Collapsible open={isPreseasonOpen} onOpenChange={setIsPreseasonOpen}>
          <div className="pt-3 border-t border-border/50">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  Preseason Goal
                  {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    isPreseasonOpen && "rotate-180"
                  )} />
                </h4>
                {!isPreseasonOpen && preseasonStats && (
                  <span className="text-xs text-muted-foreground">
                    {preseasonStats.currentFP}/{preseasonStats.goalTotal} {metricLabel} · {preseasonStats.daysLeft} days left
                  </span>
                )}
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-3 space-y-3">
              {/* Days summary - simplified */}
              {preseasonStats && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{preseasonStats.totalDays} total days</span>
                  <span>{preseasonStats.daysLeft} days left</span>
                </div>
              )}
              <div className="flex justify-end">
                <div className="flex rounded-lg border border-border/50 overflow-hidden">
                  <button
                    onClick={() => setPreseasonInputMode('total')}
                    className={cn(
                      "px-3 py-1 text-xs font-medium transition-colors",
                      preseasonInputMode === 'total' 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    Total
                  </button>
                  <button
                    onClick={() => setPreseasonInputMode('daily')}
                    className={cn(
                      "px-3 py-1 text-xs font-medium transition-colors",
                      preseasonInputMode === 'daily' 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    Daily
                  </button>
                </div>
              </div>
              
              {preseasonInputMode === 'total' ? (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Total {metricLabel} Goal</label>
                  <Input
                    type="number"
                    value={preseasonTotalInput}
                    onChange={(e) => handlePreseasonTotalChange(e.target.value)}
                    placeholder="e.g. 10"
                    className="h-10 text-lg font-semibold"
                  />
                  {preseasonStats && preseasonStats.totalDays > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      = {preseasonStats.goalDaily} {metricLabel}/day
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Daily {metricLabel} Goal</label>
                  <Input
                    type="number"
                    value={preseasonDailyInput}
                    onChange={(e) => handlePreseasonDailyChange(e.target.value)}
                    placeholder="e.g. 0.5"
                    className="h-10 text-lg font-semibold"
                  />
                  {preseasonStats && preseasonStats.totalDays > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      = {preseasonStats.goalTotal} {metricLabel} total
                    </p>
                  )}
                </div>
              )}
              
              {preseasonStats && (
                <div className="p-3 rounded-lg bg-accent/30 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Current Progress</span>
                    <span className="text-sm font-bold text-primary">{preseasonStats.currentFP} {metricLabel}</span>
                  </div>
                  {parseFloat(preseasonStats.goalTotal) > 0 && (
                    <>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all",
                            preseasonStats.onPace ? "bg-green-500" : "bg-orange-500"
                          )}
                          style={{ width: `${Math.min(100, preseasonStats.pacePercent)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">
                          {preseasonStats.remainingGoal} {metricLabel} left
                        </span>
                        <span className={cn(
                          "font-medium",
                          preseasonStats.onPace ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                        )}>
                          Need {preseasonStats.neededDaily}/day
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Summer Goal Tier Selection - Always show */}
        <Collapsible open={isSummerOpen} onOpenChange={setIsSummerOpen}>
          <div className="pt-3 border-t border-border/50">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  Summer Goal
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    isSummerOpen && "rotate-180"
                  )} />
                </h4>
                {!isSummerOpen && summerStats && (
                  <span className="text-xs text-muted-foreground">
                    {selectedTier === 'must' ? 'Must Do' : selectedTier === 'will' ? 'Will Do' : 'Could Do'}: {summerStats.goalDaily}/day · {summerStats.daysLeft} left
                  </span>
                )}
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-3 space-y-3">
              {/* Days summary - simplified */}
              {summerStats && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{summerStats.totalDays} total days</span>
                  <span>{summerStats.daysLeft} days left</span>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-2">
                {(['must', 'will', 'could'] as const).map((tier) => {
                  const tierGoalFp = tier === 'must' ? mustDoFpGoal : tier === 'will' ? willDoFpGoal : couldDoFpGoal;
                  const tierLabel = tier === 'must' ? 'Must Do' : tier === 'will' ? 'Will Do' : 'Could Do';
                  const conversionFactor = isEfpMode ? avgPrmrPerFp / 85 : 1;
                  const displayGoal = (tierGoalFp * conversionFactor).toFixed(1);
                  return (
                    <Button
                      key={tier}
                      variant={selectedTier === tier ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTier(tier)}
                      className="flex flex-col h-auto py-2"
                    >
                      <span className="text-xs">{tierLabel}</span>
                      <span className="font-bold">{displayGoal}</span>
                    </Button>
                  );
                })}
              </div>
              {summerStats && (
                <div className="p-3 rounded-lg bg-accent/30 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Daily Goal</span>
                    <span className="text-sm font-semibold">{summerStats.goalDaily} {metricLabel}</span>
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>

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