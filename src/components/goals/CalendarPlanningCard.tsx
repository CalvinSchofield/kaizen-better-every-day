import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, DollarSign, TrendingUp, TrendingDown, Loader2, Pencil, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, getDay, isBefore, isSameDay, differenceInDays } from "date-fns";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { usePlannedDaysSync } from "@/hooks/usePlannedDaysSync";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useRepGoals } from "@/hooks/useRepGoals";
import { calculateTakeHome, formatCurrency } from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useRepData } from "@/hooks/useRepData";

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
  cancelRate?: number; // decimal, e.g., 0.10 = 10%
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
  cancelRate = 0.10, // Default 10% for rookies
  onPreseasonGoalChange,
}: CalendarPlanningCardProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [preseasonInputMode, setPreseasonInputMode] = useState<'total' | 'daily'>('total');
  const [preseasonTotalInput, setPreseasonTotalInput] = useState(preseasonFpGoal.toString());
  const [preseasonDailyInput, setPreseasonDailyInput] = useState('');
  const [selectedTier, setSelectedTier] = useState<'must' | 'will' | 'could'>('will');
  const [isPreseasonOpen, setIsPreseasonOpen] = useState(false);
  const [isEditingPreseasonGoal, setIsEditingPreseasonGoal] = useState(false);
  const [isSummerOpen, setIsSummerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dateOutOfRangeSheet, setDateOutOfRangeSheet] = useState<{open: boolean; date: string; isBeforeStart: boolean} | null>(null);
  
  const { plannedDays, togglePlannedDay, isDatePlanned, isToggling } = usePlannedDays();
  const { 
    totalFP: preseasonCurrentFP, 
    totalEFP: preseasonCurrentEFP,
    fundedFP: preseasonFundedFP,
    fundedEFP: preseasonFundedEFP,
    fundedPRMR: preseasonFundedPRMR
  } = usePreseasonFP();
  const { efpModeEnabled: isEfpMode, calculateEfp } = useEfpMode();
  const { updateGoals, isUpdating } = useRepGoals();
  const { repData } = useRepData();
  
  // Debounce timer ref for saving preseason goal
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Hook for auto-syncing with blitzes and summer dates
  const { getBlitzDays, getSummerDays, excludedSummerDays, addSummerOffDay, removeSummerOffDay } = usePlannedDaysSync();

  // Fetch user's personal summer dates
  const { data: seasonConfig } = useQuery({
    queryKey: ['season-config-for-goals', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return null;
      const { data, error } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end')
        .eq('user_id', repData.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!repData?.user_id,
  });

  // Use personal summer dates or fallback to defaults
  const personalSummerStart = seasonConfig?.personal_summer_start || SUMMER_START;
  const personalSummerEnd = seasonConfig?.personal_summer_end || SUMMER_END;

  // Query to get actual days worked (finalized entries)
  const { data: workedDays } = useQuery({
    queryKey: ['worked-days-count', personalSummerStart, personalSummerEnd],
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
      const summerStart = parseLocalDate(personalSummerStart);
      const summerEnd = parseLocalDate(personalSummerEnd);

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
  // Summer days now use PERSONAL dates from user's season_config
  const { preseasonPlannedDays, summerPlannedDays } = useMemo(() => {
    const preseasonStart = parseLocalDate(PRESEASON_START);
    const preseasonEnd = parseLocalDate(PRESEASON_END);
    const summerStart = parseLocalDate(personalSummerStart);
    const summerEnd = parseLocalDate(personalSummerEnd);
    
    const allPlanned = plannedDays?.map(d => d.planned_date) || [];
    
    // Future preseason planned days only (not past)
    const preseasonFuture = allPlanned.filter(dateStr => {
      const date = parseLocalDate(dateStr);
      return date >= preseasonStart && date <= preseasonEnd && !isBefore(date, today);
    });
    
    // Future summer planned days only (not past) - using USER'S personal dates
    const summerFuture = allPlanned.filter(dateStr => {
      const date = parseLocalDate(dateStr);
      return date >= summerStart && date <= summerEnd && !isBefore(date, today);
    });
    
    return { 
      preseasonPlannedDays: preseasonFuture, 
      summerPlannedDays: summerFuture,
    };
  }, [plannedDays, today, personalSummerStart, personalSummerEnd]);

  // Get selected summer goal based on tier
  const selectedSummerGoal = useMemo(() => {
    switch (selectedTier) {
      case 'must': return mustDoFpGoal;
      case 'will': return willDoFpGoal;
      case 'could': return couldDoFpGoal;
    }
  }, [selectedTier, mustDoFpGoal, willDoFpGoal, couldDoFpGoal]);

  // Calculate preseason stats - now using actual worked days from database
  // Adjusts goals for cancel rate (what you need to SELL to end up with your goal after cancels)
  const preseasonStats = useMemo(() => {
    const futurePlannedCount = preseasonPlannedDays.length;
    const daysWorkedCount = workedDays?.preseasonDaysWorked || 0;
    const totalPreseasonDays = futurePlannedCount + daysWorkedCount;
    
    if (totalPreseasonDays === 0) return null;

    // Use EFP if in EFP mode, otherwise use FP+
    const currentProgress = isEfpMode ? preseasonCurrentEFP : preseasonCurrentFP;
    
    // Convert input goal to raw value and adjust for cancel rate
    // User inputs what they want to END UP with, we calculate what they need to SELL
    const inputGoal = parseFloat(preseasonTotalInput) || 0;
    const adjustedGoal = inputGoal / (1 - cancelRate); // e.g., 100 / 0.90 = 111.1 if 10% cancel
    const goalTotal = adjustedGoal;
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
    
    // Calculate extra per week needed to catch up (if behind pace)
    // Weeks left = remaining days / 6 (Mon-Sat)
    const weeksLeft = remainingDays / 6;
    const behindBy = Math.max(0, goalTotal - projectedTotal);
    const extraPerWeek = weeksLeft > 0 ? behindBy / weeksLeft : 0;

    return {
      futurePlannedCount,
      daysWorkedCount,
      totalDays: totalPreseasonDays,
      daysLeft: futurePlannedCount,
      goalTotal: goalTotal.toFixed(1),
      goalTotalRaw: goalTotal,
      inputGoal: inputGoal.toFixed(1), // What user wants to end up with
      goalDaily: goalDaily.toFixed(2),
      currentDailyAvg: currentDailyAvg.toFixed(2),
      projectedTotal: projectedTotal.toFixed(1),
      currentFP: currentProgress.toFixed(1),
      currentFPRaw: currentProgress,
      remainingGoal: remainingGoal.toFixed(1),
      neededDaily: neededDaily.toFixed(2),
      onPace,
      pacePercent,
      extraPerWeek: extraPerWeek.toFixed(1),
      behindBy: behindBy.toFixed(1),
    };
  }, [preseasonPlannedDays, workedDays, preseasonCurrentFP, preseasonCurrentEFP, preseasonTotalInput, isEfpMode, cancelRate]);

  // Calculate summer stats based on selected tier
  // Use the personal summer date range to calculate available days, not just planned days in DB
  // Adjusts goals for cancel rate
  const summerStats = useMemo(() => {
    // Calculate total workdays (Mon-Sat) within personal summer range
    const summerStart = parseLocalDate(personalSummerStart);
    const summerEnd = parseLocalDate(personalSummerEnd);
    
    // Get all Mon-Sat days in summer range
    const allSummerWorkDays: string[] = [];
    const interval = eachDayOfInterval({ start: summerStart, end: summerEnd });
    for (const day of interval) {
      const dayOfWeek = getDay(day);
      // Skip Sundays (0)
      if (dayOfWeek !== 0) {
        allSummerWorkDays.push(format(day, 'yyyy-MM-dd'));
      }
    }
    
    // Filter out excluded off-days
    const availableSummerDays = allSummerWorkDays.filter(d => !excludedSummerDays.includes(d));
    
    // Total available summer days (excluding off-days)
    const totalSummerDays = availableSummerDays.length;
    const offDaysCount = allSummerWorkDays.length - availableSummerDays.length;
    
    // Future days left (not including today and past, excluding off-days)
    const futureDaysLeft = availableSummerDays.filter(dateStr => {
      const date = parseLocalDate(dateStr);
      return !isBefore(date, today);
    }).length;
    
    // Days already worked in summer
    const daysWorkedCount = workedDays?.summerDaysWorked || 0;
    
    if (totalSummerDays === 0) return null;

    // Preseason goal is in the current mode already (adjusted for cancel rate)
    const preseasonGoal = parseFloat(preseasonTotalInput) || 0;
    const adjustedPreseasonGoal = preseasonGoal / (1 - cancelRate);
    
    // Remaining summer goal = Selected tier (converted to current mode) - preseason goal
    // Also adjust for cancel rate
    const conversionFactor = isEfpMode ? avgPrmrPerFp / 85 : 1;
    const selectedGoalInMode = selectedSummerGoal * conversionFactor;
    const adjustedSelectedGoal = selectedGoalInMode / (1 - cancelRate);
    const remainingSummerGoal = Math.max(0, adjustedSelectedGoal - adjustedPreseasonGoal);
    
    const goalDaily = totalSummerDays > 0 ? remainingSummerGoal / totalSummerDays : 0;

    // Calculate projected earnings (using original goal for payscale)
    const result = calculateTakeHome({
      fpGoal: selectedSummerGoal,
      avgPrmrPerFp,
      rentType,
      weeksWorking,
      upgradeFpGoal,
    });
    
    // Calculate catch-up: extra per week needed if behind
    // For summer, we calculate based on current pace vs needed pace
    const weeksLeft = futureDaysLeft / 6;
    // Current summer progress (using worked days in summer only)
    const summerProgress = 0; // Summer hasn't started yet for preseason user
    const projectedSummer = daysWorkedCount > 0 ? (summerProgress / daysWorkedCount) * totalSummerDays : 0;
    const behindBy = Math.max(0, remainingSummerGoal - projectedSummer);
    const extraPerWeek = weeksLeft > 0 ? behindBy / weeksLeft : 0;

    return {
      futurePlannedCount: futureDaysLeft,
      daysWorkedCount,
      totalDays: totalSummerDays,
      daysLeft: futureDaysLeft,
      offDaysCount,
      goalTotal: remainingSummerGoal.toFixed(1),
      goalTotalRaw: remainingSummerGoal,
      goalDaily: goalDaily.toFixed(2),
      projectedEarnings: result.takeHomePay,
      extraPerWeek: extraPerWeek.toFixed(1),
      weeksLeft: Math.round(weeksLeft),
    };
  }, [personalSummerStart, personalSummerEnd, workedDays, selectedSummerGoal, preseasonTotalInput, avgPrmrPerFp, rentType, weeksWorking, upgradeFpGoal, isEfpMode, today, excludedSummerDays, cancelRate]);

  // Calculate total stats
  const totalStats = useMemo(() => {
    // Use EFP if in EFP mode, otherwise use FP+
    const currentProgress = isEfpMode ? preseasonCurrentEFP : preseasonCurrentFP;
    const onPace = preseasonStats ? preseasonStats.onPace : true;
    
    // Total goal is the selected tier (convert to current mode), adjusted for cancel rate
    const conversionFactor = isEfpMode ? avgPrmrPerFp / 85 : 1;
    const baseGoal = selectedSummerGoal * conversionFactor;
    const adjustedGoal = baseGoal / (1 - cancelRate);

    // Calculate projected earnings (using original goal for payscale)
    const result = calculateTakeHome({
      fpGoal: selectedSummerGoal,
      avgPrmrPerFp,
      rentType,
      weeksWorking,
      upgradeFpGoal,
    });

    return {
      goalTotal: adjustedGoal.toFixed(1),
      baseGoal: baseGoal.toFixed(1), // What user wants to end up with
      currentFP: currentProgress.toFixed(1),
      onPace,
      projectedEarnings: result.takeHomePay,
    };
  }, [selectedSummerGoal, preseasonCurrentFP, preseasonCurrentEFP, preseasonStats, avgPrmrPerFp, rentType, weeksWorking, upgradeFpGoal, isEfpMode, cancelRate]);

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
    const globalSummerEnd = parseLocalDate(SUMMER_END);
    // Don't allow Sundays, past days, or days after global summer end
    if (dayOfWeek === 0 || isBefore(date, today) || date > globalSummerEnd) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const isCurrentlyPlanned = isDatePlanned(dateStr);
    
    // Check if this is a summer day (within personal summer range)
    const userSummerStart = parseLocalDate(personalSummerStart);
    const userSummerEnd = parseLocalDate(personalSummerEnd);
    const isInSummerRange = date >= userSummerStart && date <= userSummerEnd;
    
    // If day is in summer range, handle as summer off-day toggle
    if (isInSummerRange) {
      const isExcluded = excludedSummerDays.includes(dateStr);
      if (isExcluded) {
        // Re-add the day (remove from exclusions)
        removeSummerOffDay(dateStr);
        // Also add to planned days if not already
        if (!isCurrentlyPlanned) {
          await togglePlannedDay(dateStr);
        }
      } else {
        // Mark as off-day (add to exclusions)
        addSummerOffDay(dateStr);
        // Also remove from planned days if planned
        if (isCurrentlyPlanned) {
          await togglePlannedDay(dateStr);
        }
      }
      return;
    }
    
    // If ADDING a day (not currently planned) that's outside their summer range, show popup
    if (!isCurrentlyPlanned) {
      if (date < userSummerStart) {
        setDateOutOfRangeSheet({ open: true, date: dateStr, isBeforeStart: true });
        return;
      }
      if (date > userSummerEnd) {
        setDateOutOfRangeSheet({ open: true, date: dateStr, isBeforeStart: false });
        return;
      }
    }
    
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
          Tap summer days to mark off-days you won't be working.
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
            
            // Check if this is a summer off-day (excluded)
            const isExcludedSummerDay = excludedSummerDays.includes(dateStr);
            
            // Check if this is within summer range
            const userSummerStart = parseLocalDate(personalSummerStart);
            const userSummerEnd = parseLocalDate(personalSummerEnd);
            const isInSummerRange = day >= userSummerStart && day <= userSummerEnd && !isPast;

            return (
              <button
                key={dateStr}
                onClick={() => handleDayClick(day)}
                disabled={isDisabled || isToggling}
                className={cn(
                  "aspect-square rounded-lg text-sm font-medium transition-all",
                  "flex items-center justify-center relative",
                  (isSunday || isAfterSummerEnd) && "opacity-30 cursor-not-allowed",
                  isPast && !isSunday && !isAfterSummerEnd && "opacity-40 cursor-not-allowed",
                  !isDisabled && "hover:bg-accent cursor-pointer",
                  // Planned and not excluded = solid primary
                  isPlanned && !isDisabled && !isExcludedSummerDay && "bg-primary text-primary-foreground hover:bg-primary/90",
                  // Summer off-day (excluded) = strikethrough style
                  isExcludedSummerDay && !isDisabled && "bg-destructive/20 text-destructive line-through hover:bg-destructive/30",
                  isTodayDate && !isPlanned && !isSunday && !isAfterSummerEnd && !isExcludedSummerDay && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  !isCurrentMonth && "opacity-30"
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        {/* Preseason Goal - Collapsible */}
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
                    {preseasonStats.neededDaily}/day · {preseasonStats.daysLeft} left
                  </span>
                )}
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-3">
              <div className="flex justify-end mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingPreseasonGoal(!isEditingPreseasonGoal);
                  }}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  <span className="text-xs">{isEditingPreseasonGoal ? 'Done' : 'Edit'}</span>
                </Button>
              </div>
          
              {preseasonStats && (
                <div className="p-3 rounded-lg bg-accent/30 space-y-2">
                  {/* Current pace info - based on actual days worked, not calendar days */}
                  {preseasonStats.daysWorkedCount > 0 && parseFloat(preseasonStats.goalTotal) > 0 && (
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">Your Daily Pace</span>
                        <span className="text-[10px] text-muted-foreground/70">
                          ({preseasonStats.daysWorkedCount} days worked)
                        </span>
                      </div>
                      <span className={cn(
                        "text-sm font-semibold flex items-center gap-1",
                        preseasonStats.onPace ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                      )}>
                        {preseasonStats.onPace ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {preseasonStats.currentDailyAvg} {metricLabel}/day
                      </span>
                    </div>
                  )}

                  {/* Projected total at current pace */}
                  {preseasonStats.daysWorkedCount > 0 && parseFloat(preseasonStats.goalTotal) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">At this pace you'll hit</span>
                      <span className={cn(
                        "text-sm font-bold",
                        preseasonStats.onPace ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                      )}>
                        {preseasonStats.projectedTotal} {metricLabel}
                      </span>
                    </div>
                  )}
                  
                  {/* Main focus: What you need today */}
                  <div className="flex justify-between items-center pt-2 border-t border-border/30">
                    <span className="text-sm font-medium">Need Today</span>
                    <span className={cn(
                      "text-lg font-bold",
                      preseasonStats.onPace ? "text-green-600 dark:text-green-400" : "text-primary"
                    )}>
                      {preseasonStats.neededDaily} {metricLabel}
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  {parseFloat(preseasonStats.goalTotal) > 0 && (
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          preseasonStats.onPace ? "bg-green-500" : "bg-orange-500"
                        )}
                        style={{ width: `${Math.min(100, preseasonStats.pacePercent)}%` }}
                      />
                    </div>
                  )}
                  
                  {/* Summary stats - clarify this includes unfunded */}
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{preseasonStats.currentFP} / {preseasonStats.goalTotal} {metricLabel}</span>
                    <span>{preseasonStats.daysLeft} days left</span>
                  </div>
                  
                  {/* Note about what's included */}
                  <p className="text-[10px] text-muted-foreground/70 italic">
                    Includes unfunded sales (installed but cancelled). Never-installed sales should be deleted.
                  </p>
                  
                  {/* Catch-up message when behind pace */}
                  {!preseasonStats.onPace && parseFloat(preseasonStats.extraPerWeek) > 0 && (
                    <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-500/10 p-2 rounded-md">
                      You need to sell an extra <span className="font-semibold">{preseasonStats.extraPerWeek} {metricLabel}/week</span> to get back on pace
                    </div>
                  )}
                  
                  {/* Edit mode - goal inputs */}
                  {isEditingPreseasonGoal && (
                    <div className="pt-3 mt-2 border-t border-border/30 space-y-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{preseasonStats.totalDays} total days</span>
                      </div>
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
                          {preseasonStats.totalDays > 0 && (
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
                          {preseasonStats.totalDays > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              = {preseasonStats.goalTotal} {metricLabel} total funded
                            </p>
                          )}
                        </div>
                      )}
                    </div>
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
              {/* Days summary - show off-days if any */}
              {summerStats && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {summerStats.totalDays} work days
                    {summerStats.offDaysCount > 0 && (
                      <span className="text-destructive ml-1">({summerStats.offDaysCount} off)</span>
                    )}
                  </span>
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
                  
                  {/* Catch-up message for summer - show weekly goal */}
                  {summerStats.weeksLeft > 0 && parseFloat(summerStats.goalTotalRaw.toString()) > 0 && (
                    <div className="text-xs text-muted-foreground pt-1 border-t border-border/30">
                      Weekly goal: <span className="font-semibold">{(summerStats.goalTotalRaw / summerStats.weeksLeft).toFixed(1)} {metricLabel}/week</span> over {summerStats.weeksLeft} weeks
                    </div>
                  )}
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

      {/* Date Out of Range Sheet */}
      <Sheet 
        open={dateOutOfRangeSheet?.open || false} 
        onOpenChange={(open) => !open && setDateOutOfRangeSheet(null)}
      >
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <div className="flex items-center gap-2 text-amber-500">
              <AlertCircle className="h-5 w-5" />
              <SheetTitle className="text-amber-500">Date Outside Your Summer</SheetTitle>
            </div>
            <SheetDescription>
              {dateOutOfRangeSheet?.isBeforeStart 
                ? `This date is before your summer start date (${format(parseLocalDate(personalSummerStart), 'MMM d, yyyy')}).`
                : `This date is after your summer end date (${format(parseLocalDate(personalSummerEnd), 'MMM d, yyyy')}).`
              }
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              Would you like to update your official summer dates, or mark specific days as off-days?
            </p>
            
            <div className="space-y-2">
              <Button 
                variant="default"
                className="w-full"
                onClick={() => {
                  setDateOutOfRangeSheet(null);
                  // Navigate to settings/setup to change dates
                  // For now, just close - user can use the setup wizard
                }}
              >
                Update Summer Dates in Settings
              </Button>
              
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => setDateOutOfRangeSheet(null)}
              >
                Cancel
              </Button>
            </div>
            
            <p className="text-xs text-center text-muted-foreground pt-2">
              Off-days feature coming soon
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
};