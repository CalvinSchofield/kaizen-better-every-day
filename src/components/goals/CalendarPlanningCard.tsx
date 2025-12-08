import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, DollarSign, TrendingUp, TrendingDown, Loader2, Pencil, AlertCircle, MessageCircle, Plane, CalendarDays } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, getDay, isBefore, isSameDay, differenceInDays } from "date-fns";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { usePlannedDaysSync } from "@/hooks/usePlannedDaysSync";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useBlitzes } from "@/hooks/useBlitzes";
import { calculateTakeHome, formatCurrency } from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useRepData } from "@/hooks/useRepData";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { CalendarIcon, Check } from "lucide-react";
import { toast } from "sonner";

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
  activeTier?: 'preseason' | 'mustDo' | 'willDo' | 'couldDo'; // From hero
  isUserSummerStarted?: boolean; // Whether user's personal summer has started
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
  activeTier = 'willDo', // Default to willDo if not provided
  isUserSummerStarted = false,
}: CalendarPlanningCardProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [preseasonInputMode, setPreseasonInputMode] = useState<'total' | 'daily'>('total');
  const [preseasonTotalInput, setPreseasonTotalInput] = useState(preseasonFpGoal.toString());
  const [preseasonDailyInput, setPreseasonDailyInput] = useState('');
  const [isPreseasonOpen, setIsPreseasonOpen] = useState(false);
  const [isEditingPreseasonGoal, setIsEditingPreseasonGoal] = useState(false);
  const [isSummerOpen, setIsSummerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Derive selected tier from activeTier prop (map from hero tier to internal tier)
  const selectedTier: 'must' | 'will' | 'could' = useMemo(() => {
    if (activeTier === 'mustDo') return 'must';
    if (activeTier === 'couldDo') return 'could';
    return 'will'; // Default for preseason or willDo
  }, [activeTier]);
  
  // Show preseason section: always during preseason (when not user's summer yet), but static once summer starts
  const showPreseasonSection = !isUserSummerStarted || preseasonFpGoal > 0;
  const isPreseasonEditable = !isUserSummerStarted;
  
  // Show summer section: only when a summer tier is selected (not preseason)
  const showSummerSection = activeTier !== 'preseason';
  const [dateOutOfRangeSheet, setDateOutOfRangeSheet] = useState<{open: boolean; date: string; isBeforeStart: boolean; isTakingOffDay?: boolean} | null>(null);
  const [dismissedSummerBoundaryWarning, setDismissedSummerBoundaryWarning] = useState<'start' | 'end' | 'both' | null>(null);
  const [showBlitzDrawer, setShowBlitzDrawer] = useState(false);
  const [isCommitting, setIsCommitting] = useState<string | null>(null);
  const [dismissedTakeOffDayWarning, setDismissedTakeOffDayWarning] = useState(false);
  
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
  const { allBlitzes } = useBlitzes();
  const queryClient = useQueryClient();
  
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

  // Helper to determine if an entry is a "worked day" - aligns with memory definition
  // A worked day has: doors_knocked >= 5 OR work times set OR any FP+/PRMR/upgrade_prmr results
  const isWorkedDay = (entry: { doors_knocked: number | null; work_start_time: string | null; work_end_time: string | null; fp_plus: number | null; prmr: number | null; upgrade_prmr: number | null }): boolean => {
    const hasDoors = (entry.doors_knocked || 0) >= 5;
    const hasWorkSession = entry.work_start_time || entry.work_end_time;
    const hasResults = (entry.fp_plus || 0) > 0 || (entry.prmr || 0) > 0 || (entry.upgrade_prmr || 0) > 0;
    return hasDoors || !!hasWorkSession || hasResults;
  };

  // Query to get actual days worked (finalized entries with real activity)
  const { data: workedDaysData, refetch: refetchWorkedDays } = useQuery({
    queryKey: ['worked-days-data', repData?.user_id, personalSummerStart, personalSummerEnd],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { preseasonDaysWorked: 0, summerDaysWorked: 0, workedDates: new Set<string>() };

      // Get all finalized entries with activity fields
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date, doors_knocked, work_start_time, work_end_time, fp_plus, prmr, upgrade_prmr')
        .eq('user_id', user.id)
        .eq('is_finalized', true);

      if (error) {
        console.error('Error fetching worked days:', error);
        return { preseasonDaysWorked: 0, summerDaysWorked: 0, workedDates: new Set<string>() };
      }

      console.log('Fetched worked days entries:', entries?.length, 'for user:', user.id);

      const preseasonStart = parseLocalDate(PRESEASON_START);
      const preseasonEnd = parseLocalDate(PRESEASON_END);
      const summerStart = parseLocalDate(personalSummerStart);
      const summerEnd = parseLocalDate(personalSummerEnd);

      let preseasonCount = 0;
      let summerCount = 0;
      const workedDates = new Set<string>();

      // Count entries that are "worked days" per the memory definition
      entries?.forEach(entry => {
        if (!isWorkedDay(entry)) return; // Skip non-worked days
        
        workedDates.add(entry.entry_date);
        
        const date = parseLocalDate(entry.entry_date);
        if (date >= preseasonStart && date <= preseasonEnd) {
          preseasonCount++;
        } else if (date >= summerStart && date <= summerEnd) {
          summerCount++;
        }
      });

      console.log('Worked dates set:', Array.from(workedDates));

      return { preseasonDaysWorked: preseasonCount, summerDaysWorked: summerCount, workedDates };
    },
    staleTime: 0, // Always refetch - important for accurate calendar display
    enabled: !!repData?.user_id,
  });

  // Derived values from workedDaysData
  const workedDays = workedDaysData ? {
    preseasonDaysWorked: workedDaysData.preseasonDaysWorked,
    summerDaysWorked: workedDaysData.summerDaysWorked
  } : undefined;
  
  const workedDatesSet = workedDaysData?.workedDates || new Set<string>();
  const isDateWorked = (dateStr: string) => workedDatesSet.has(dateStr);

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

    // Calculate projected earnings using the ORIGINAL FP+ goal (not EFP-converted)
    // selectedSummerGoal is always stored in FP+ units in the database
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

  // Calculate weekly pace stats
  const weeklyPaceStats = useMemo(() => {
    if (!preseasonStats) return null;
    
    const now = new Date();
    // Get start of this week (Monday)
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    // Get end of this week (Saturday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 5);
    weekEnd.setHours(23, 59, 59, 999);
    
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
    
    // Count planned days this week that are in the future
    const todayStr = format(now, 'yyyy-MM-dd');
    const plannedThisWeek = (plannedDays || []).filter(d => {
      return d.planned_date >= weekStartStr && d.planned_date <= weekEndStr;
    });
    
    // Days already worked this week (approximation - days before today that are planned)
    const workedThisWeek = plannedThisWeek.filter(d => d.planned_date < todayStr).length;
    const totalDaysThisWeek = plannedThisWeek.length;
    
    if (totalDaysThisWeek === 0) return null;
    
    // Weekly goal = daily goal × planned days this week
    const dailyGoal = parseFloat(preseasonStats.goalDaily);
    const weeklyGoal = dailyGoal * totalDaysThisWeek;
    
    // Expected progress by now = daily goal × days already worked this week
    const expectedByNow = dailyGoal * workedThisWeek;
    
    // We'd need this week's actual FP+ - for now use days worked ratio as approximation
    // In reality, the user can see their week progress in the main preseasonStats
    const weekPaceDiff = preseasonStats.currentFPRaw - expectedByNow;
    const isAheadThisWeek = weekPaceDiff >= 0.1;
    const isBehindThisWeek = weekPaceDiff <= -0.1;
    
    return {
      weeklyGoal: weeklyGoal.toFixed(1),
      totalDaysThisWeek,
      workedThisWeek,
      expectedByNow: expectedByNow.toFixed(1),
      paceDiff: weekPaceDiff,
      isAheadThisWeek,
      isBehindThisWeek,
    };
  }, [preseasonStats, plannedDays]);

  // Get committed blitzes
  interface CommittedBlitz {
    id: string;
    name: string;
    date: string;
    endDate?: string;
    location?: string;
  }

  const committedBlitzes = useMemo(() => {
    return (repData?.committed_blitzes as CommittedBlitz[]) || [];
  }, [repData?.committed_blitzes]);

  // Future available blitzes (not yet committed)
  const futureAvailableBlitzes = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allBlitzes.filter(blitz => {
      const blitzStart = new Date(blitz.date);
      blitzStart.setHours(0, 0, 0, 0);
      const isNotCommitted = !committedBlitzes.some(c => c.id === blitz.id);
      return blitzStart >= today && isNotCommitted;
    });
  }, [allBlitzes, committedBlitzes]);

  // All future blitzes (committed or not)
  const allFutureBlitzes = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allBlitzes.filter(blitz => {
      const blitzStart = new Date(blitz.date);
      blitzStart.setHours(0, 0, 0, 0);
      return blitzStart >= today;
    });
  }, [allBlitzes]);

  const hasAnyFutureBlitzes = allFutureBlitzes.length > 0;

  const handleCommitToBlitz = async (blitz: { id: string; name: string; date: string; endDate?: string | null; location?: string | null }) => {
    if (!repData?.id || !repData?.user_id) return;
    setIsCommitting(blitz.id);
    
    try {
      const newCommitment: CommittedBlitz = {
        id: blitz.id,
        name: blitz.name,
        date: blitz.date,
        endDate: blitz.endDate || undefined,
        location: blitz.location || undefined,
      };
      
      const updatedCommitments = [...committedBlitzes, newCommitment];
      
      // Optimistically update the cache immediately - use the correct query key with userId
      queryClient.setQueryData(['rep-data', repData.user_id], (old: typeof repData) => {
        if (!old) return old;
        return { ...old, committed_blitzes: updatedCommitments };
      });
      
      const { error } = await supabase
        .from('reps')
        .update({ committed_blitzes: updatedCommitments as unknown as null })
        .eq('id', repData.id);
      
      if (error) throw error;
      
      // Invalidate planned days to trigger calendar update
      queryClient.invalidateQueries({ queryKey: ['planned-days'] });
      toast.success(`Committed to ${blitz.name}!`);
    } catch (error) {
      console.error('Error committing to blitz:', error);
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['rep-data', repData.user_id] });
      toast.error("Failed to commit to blitz");
    } finally {
      setIsCommitting(null);
    }
  };

  const handleUncommitFromBlitz = async (blitzId: string) => {
    if (!repData?.id || !repData?.user_id) return;
    setIsCommitting(blitzId);
    
    try {
      const updatedCommitments = committedBlitzes.filter(b => b.id !== blitzId);
      
      // Optimistically update the cache immediately - use the correct query key with userId
      queryClient.setQueryData(['rep-data', repData.user_id], (old: typeof repData) => {
        if (!old) return old;
        return { ...old, committed_blitzes: updatedCommitments };
      });
      
      const { error } = await supabase
        .from('reps')
        .update({ committed_blitzes: updatedCommitments as unknown as null })
        .eq('id', repData.id);
      
      if (error) throw error;
      
      // Invalidate planned days to trigger calendar update
      queryClient.invalidateQueries({ queryKey: ['planned-days'] });
      toast.success("Uncommitted from blitz");
    } catch (error) {
      console.error('Error uncommitting from blitz:', error);
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['rep-data', repData.user_id] });
      toast.error("Failed to uncommit");
    } finally {
      setIsCommitting(null);
    }
  };

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
    const userSummerEndDate = parseLocalDate(personalSummerEnd);
    // Don't allow Sundays, past days, or days after personal summer end
    if (dayOfWeek === 0 || isBefore(date, today) || date > userSummerEndDate) return;
    
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
        // User is trying to mark a day OFF within their summer range
        // Check if this is within first 10 knocking days of their summer start
        // This is critical - they'll still be charged rent even if they take days off
        let knockingDaysFromStart = 0;
        let current = new Date(userSummerStart);
        while (current <= date) {
          const dow = getDay(current);
          if (dow !== 0) knockingDaysFromStart++; // Count if not Sunday
          current.setDate(current.getDate() + 1);
        }
        
        // Show warning if within first 10 knocking days of start and not dismissed
        if (knockingDaysFromStart <= 10 && !dismissedTakeOffDayWarning) {
          setDateOutOfRangeSheet({ 
            open: true, 
            date: dateStr, 
            isBeforeStart: true, 
            isTakingOffDay: true 
          });
          return;
        }
        
        // Mark as off-day (add to exclusions)
        addSummerOffDay(dateStr);
        // Also remove from planned days if planned
        if (isCurrentlyPlanned) {
          await togglePlannedDay(dateStr);
        }
      }
      return;
    }
    
    // If ADDING a day (not currently planned) that's outside their summer range
    // Only show popup if within 10 knocking days (Mon-Sat) of summer boundary and not dismissed
    if (!isCurrentlyPlanned) {
      const isBeforeStart = date < userSummerStart;
      const isAfterEnd = date > userSummerEnd;
      
      if (isBeforeStart || isAfterEnd) {
        // Calculate knocking days distance to boundary
        const boundaryDate = isBeforeStart ? userSummerStart : userSummerEnd;
        let knockingDaysDistance = 0;
        const startDate = isBeforeStart ? date : userSummerEnd;
        const endDate = isBeforeStart ? userSummerStart : date;
        
        // Count Mon-Sat days between the dates
        let current = new Date(startDate);
        while (current < endDate) {
          const dow = getDay(current);
          if (dow !== 0) knockingDaysDistance++; // Count if not Sunday
          current.setDate(current.getDate() + 1);
        }
        
        // Only show popup if within 10 knocking days AND not already dismissed for this boundary
        const shouldShowPopup = knockingDaysDistance <= 10 && (
          (isBeforeStart && dismissedSummerBoundaryWarning !== 'start' && dismissedSummerBoundaryWarning !== 'both') ||
          (isAfterEnd && dismissedSummerBoundaryWarning !== 'end' && dismissedSummerBoundaryWarning !== 'both')
        );
        
        if (shouldShowPopup) {
          setDateOutOfRangeSheet({ open: true, date: dateStr, isBeforeStart });
          return;
        }
        // If dismissed or too far from boundary, just toggle the day normally
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
    <div className="space-y-3">
      {/* Period Navigation */}
      <div className="flex items-center justify-between">
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
          className="text-base font-semibold hover:text-primary transition-colors"
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
          const isWorked = isDateWorked(dateStr); // Check if this is a past day where user worked
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isSameDay(day, today);
          const dayOfWeek = getDay(day);
          const isSunday = dayOfWeek === 0;
          const userSummerStart = parseLocalDate(personalSummerStart);
          const userSummerEnd = parseLocalDate(personalSummerEnd);
          const isAfterPersonalSummerEnd = day > userSummerEnd;
          const isDisabled = isPast || isSunday || isAfterPersonalSummerEnd;
          
          // Check if this is a summer off-day (excluded)
          const isExcludedSummerDay = excludedSummerDays.includes(dateStr);
          
          // Check if this is within summer range
          const isInSummerRange = day >= userSummerStart && day <= userSummerEnd && !isPast;

          return (
            <button
              key={dateStr}
              onClick={() => handleDayClick(day)}
              disabled={isDisabled || isToggling}
              className={cn(
                "aspect-square rounded-lg text-sm font-medium transition-all",
                "flex items-center justify-center relative",
                (isSunday || isAfterPersonalSummerEnd) && "opacity-30 cursor-not-allowed",
                // Finalized/worked days - show with green/success style (finalized = done, regardless of date)
                isWorked && !isSunday && "bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 cursor-default",
                // Future planned days (NOT worked) - show as orange/primary
                isPlanned && !isWorked && !isExcludedSummerDay && "bg-primary text-primary-foreground hover:bg-primary/90",
                // Past non-worked days - muted
                isPast && !isWorked && !isSunday && !isAfterPersonalSummerEnd && "opacity-30 cursor-not-allowed",
                // Hoverable future days (not planned, not worked)
                !isDisabled && !isPlanned && !isWorked && !isExcludedSummerDay && "hover:bg-accent cursor-pointer",
                // Summer off-day (excluded) = strikethrough style
                isExcludedSummerDay && !isWorked && "bg-destructive/20 text-destructive line-through hover:bg-destructive/30",
                // Today indicator ring (only if not planned and not worked)
                isTodayDate && !isPlanned && !isWorked && !isSunday && !isAfterPersonalSummerEnd && !isExcludedSummerDay && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                !isCurrentMonth && "opacity-30"
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      {/* Calendar Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground pt-2">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500/30" />
          Worked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-primary" />
          Planned
        </span>
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
          
          <AnimatePresence initial={false}>
            {isPreseasonOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="mt-3">
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
                
                {/* Weekly pace indicator */}
                {weeklyPaceStats && (
                  <div className={cn(
                    "flex items-center justify-between text-xs px-3 py-2 rounded-lg",
                    weeklyPaceStats.isAheadThisWeek && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    weeklyPaceStats.isBehindThisWeek && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    !weeklyPaceStats.isAheadThisWeek && !weeklyPaceStats.isBehindThisWeek && "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  )}>
                    <span className="font-medium">This Week</span>
                    <span>
                      {weeklyPaceStats.isAheadThisWeek && `+${weeklyPaceStats.paceDiff.toFixed(1)} ahead`}
                      {weeklyPaceStats.isBehindThisWeek && `${Math.abs(weeklyPaceStats.paceDiff).toFixed(1)} behind`}
                      {!weeklyPaceStats.isAheadThisWeek && !weeklyPaceStats.isBehindThisWeek && "On pace"}
                    </span>
                  </div>
                )}
                
                {/* Remaining daily needed */}
                {parseFloat(preseasonStats.neededDaily) > 0 && parseFloat(preseasonStats.remainingGoal) > 0 && (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    Need <span className="font-semibold text-foreground">{preseasonStats.neededDaily}</span> {metricLabel}/day to finish
                  </div>
                )}
                
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
            
            {/* Empty state when no preseason planned days */}
            {!preseasonStats && (
              <div className="p-4 rounded-xl bg-muted/50 border-2 border-dashed border-muted-foreground/20 text-center space-y-3">
                <div className="flex justify-center">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">No preseason days planned</p>
                  <p className="text-xs text-muted-foreground">
                    Tap dates in the calendar above to plan your knocking days, or commit to a blitz trip below.
                  </p>
                </div>
                
                {/* Blitz commitment CTA - only if blitzes exist */}
                {hasAnyFutureBlitzes && (
                  <Button
                    variant="default"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowBlitzDrawer(true)}
                  >
                    <Plane className="h-4 w-4 mr-1.5" />
                    Commit to a Blitz
                  </Button>
                )}
              </div>
            )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Collapsible>

      {/* Summer Goal - Only show when a summer tier is selected in hero */}
      {showSummerSection && (
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
              
              {/* Daily/Weekly goal card - keep this useful card */}
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
      )}

      {/* Total Summary */}
      {totalStats && (
        <div className="pt-3 border-t border-border/50">
          <h4 className="text-sm font-semibold mb-2">Total Summary</h4>
          <div className="p-3 rounded-lg bg-primary/10 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Goal Total{activeTier === 'preseason' && ' (Will Do)'}
              </span>
              <span className="text-lg font-bold">{totalStats.baseGoal} {metricLabel}</span>
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

      {/* Date Near Summer Boundary Sheet */}
      <Sheet 
        open={dateOutOfRangeSheet?.open || false} 
        onOpenChange={(open) => !open && setDateOutOfRangeSheet(null)}
      >
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-2 text-amber-500">
              <AlertCircle className="h-5 w-5" />
              <SheetTitle className="text-amber-500">
                {dateOutOfRangeSheet?.isTakingOffDay 
                  ? "Taking Time Off at the Start of Summer?"
                  : dateOutOfRangeSheet?.isBeforeStart 
                    ? "Starting Earlier Than Your Official Date?"
                    : "Working After Your Official Summer End?"
                }
              </SheetTitle>
            </div>
            <SheetDescription className="text-left">
              {dateOutOfRangeSheet?.isTakingOffDay 
                ? `This day is within the first days of your summer (starts ${format(parseLocalDate(personalSummerStart), 'MMM d, yyyy')}). You'll still be charged rent for these days even if you're not working.`
                : dateOutOfRangeSheet?.isBeforeStart 
                  ? `This date is before your official summer start (${format(parseLocalDate(personalSummerStart), 'MMM d, yyyy')}).`
                  : `This date is after your official summer end (${format(parseLocalDate(personalSummerEnd), 'MMM d, yyyy')}).`
              }
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-4 space-y-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-foreground">
                {dateOutOfRangeSheet?.isTakingOffDay ? (
                  <>
                    <strong>Important:</strong> If you're arriving to the summer market later, you should update your official summer start date to avoid paying rent for days you're not there. If you're working locally (not at the summer market) on other days, you can mark this day off anyway.
                  </>
                ) : (
                  <>
                    <strong>Important:</strong> Marking extra days here doesn't change your official summer dates with Vivint or affect your rent deductions. To officially change your start/end dates, coordinate with your leader.
                  </>
                )}
              </p>
            </div>

            {/* Inline Date Picker for quick update */}
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {dateOutOfRangeSheet?.isTakingOffDay 
                  ? "Delay your summer start date to avoid extra rent:"
                  : dateOutOfRangeSheet?.isBeforeStart 
                    ? "Move up your summer start date:"
                    : "Update your summer end date:"
                }
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateOutOfRangeSheet?.isBeforeStart || dateOutOfRangeSheet?.isTakingOffDay
                      ? format(parseLocalDate(personalSummerStart), 'MMM d, yyyy')
                      : format(parseLocalDate(personalSummerEnd), 'MMM d, yyyy')
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <CalendarPicker
                    mode="single"
                    selected={dateOutOfRangeSheet?.isBeforeStart || dateOutOfRangeSheet?.isTakingOffDay
                      ? parseLocalDate(personalSummerStart)
                      : parseLocalDate(personalSummerEnd)
                    }
                    onSelect={async (selectedDate) => {
                      if (!selectedDate || !repData?.user_id) return;
                      
                      const dateStr = format(selectedDate, 'yyyy-MM-dd');
                      const updateField = (dateOutOfRangeSheet?.isBeforeStart || dateOutOfRangeSheet?.isTakingOffDay)
                        ? 'personal_summer_start' 
                        : 'personal_summer_end';
                      
                      const { error } = await supabase
                        .from('season_config')
                        .upsert({
                          user_id: repData.user_id,
                          [updateField]: dateStr,
                        }, { onConflict: 'user_id' });
                      
                      if (error) {
                        toast.error('Failed to update summer dates');
                        console.error(error);
                      } else {
                        // Sync to Notion
                        if (repData?.notion_page_id) {
                          const isStart = updateField === 'personal_summer_start';
                          await supabase.functions.invoke('update-summer-dates', {
                            body: {
                              notionPageId: repData.notion_page_id,
                              startDate: isStart ? dateStr : undefined,
                              endDate: isStart ? undefined : dateStr,
                            },
                          });
                        }
                        
                        toast.success(`Summer ${updateField === 'personal_summer_start' ? 'start' : 'end'} date updated to ${format(selectedDate, 'MMM d, yyyy')}!`);
                        queryClient.invalidateQueries({ queryKey: ['season-config-for-goals'] });
                        queryClient.invalidateQueries({ queryKey: ['season-config'] });
                        
                        // For "taking off day" case, we don't toggle the day since they're delaying start
                        // For "before start" case, we do toggle since they're starting earlier
                        if (!dateOutOfRangeSheet?.isTakingOffDay) {
                          const clickedDate = dateOutOfRangeSheet?.date;
                          if (clickedDate) {
                            await togglePlannedDay(clickedDate);
                          }
                        }
                        setDateOutOfRangeSheet(null);
                      }
                    }}
                    disabled={(date) => {
                      const summerStart = parseLocalDate(SUMMER_START);
                      const summerEnd = parseLocalDate(SUMMER_END);
                      // For start date: must be within global summer bounds
                      // For end date: must be after personal start and within global bounds
                      if (dateOutOfRangeSheet?.isBeforeStart || dateOutOfRangeSheet?.isTakingOffDay) {
                        return date < summerStart || date > summerEnd;
                      } else {
                        return date < parseLocalDate(personalSummerStart) || date > summerEnd;
                      }
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              {repData?.team_leader_phone && (
                <Button 
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    const phone = repData.team_leader_phone?.replace(/\D/g, '');
                    const message = encodeURIComponent(
                      dateOutOfRangeSheet?.isTakingOffDay 
                        ? `Hey! I need to delay my summer start date because I won't be arriving until later. Can you help me get my official dates changed with the company so I don't get charged extra rent?`
                        : dateOutOfRangeSheet?.isBeforeStart 
                          ? `Hey! I'd like to start working earlier than my current official summer start date. Can you help me get my dates changed with the company?`
                          : `Hey! I'd like to extend my summer end date. Can you help me get my dates changed with the company?`
                    );
                    window.open(`sms:${phone}?body=${message}`, '_blank');
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Text {repData.team_leader || 'My Leader'} About Official Dates
                </Button>
              )}
              
              <Button 
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  const dateStr = dateOutOfRangeSheet?.date;
                  const isTakingOff = dateOutOfRangeSheet?.isTakingOffDay;
                  const isBeforeStart = dateOutOfRangeSheet?.isBeforeStart;
                  
                  if (isTakingOff) {
                    // Dismiss the take-off warning and mark the day as off
                    setDismissedTakeOffDayWarning(true);
                    setDateOutOfRangeSheet(null);
                    
                    if (dateStr) {
                      addSummerOffDay(dateStr);
                      if (isDatePlanned(dateStr)) {
                        await togglePlannedDay(dateStr);
                      }
                    }
                  } else {
                    // Dismiss warnings for this boundary
                    setDismissedSummerBoundaryWarning(prev => {
                      if (prev === 'start' && !isBeforeStart) return 'both';
                      if (prev === 'end' && isBeforeStart) return 'both';
                      return isBeforeStart ? 'start' : 'end';
                    });
                    
                    setDateOutOfRangeSheet(null);
                    
                    // Now toggle the day
                    if (dateStr) {
                      await togglePlannedDay(dateStr);
                    }
                  }
                }}
              >
                {dateOutOfRangeSheet?.isTakingOffDay 
                  ? "I'm Working Locally, Mark Day Off Anyway"
                  : "Keep Current Dates, Mark Day Anyway"
                }
              </Button>
              
              <Button 
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => setDateOutOfRangeSheet(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Blitz Commitment Drawer */}
      <Drawer open={showBlitzDrawer} onOpenChange={setShowBlitzDrawer}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-center pb-2">
            <DrawerTitle className="flex items-center justify-center gap-2">
              <Plane className="h-5 w-5 text-red-500" />
              Commit to a Blitz
            </DrawerTitle>
            <DrawerDescription>
              {committedBlitzes.length} committed · {futureAvailableBlitzes.length} available
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Committed blitzes */}
            {committedBlitzes.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Your Committed Blitzes</h4>
                {committedBlitzes.map((blitz) => {
                  const blitzDate = new Date(blitz.date);
                  return (
                    <div 
                      key={blitz.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 ring-1 ring-green-500/30"
                    >
                      <div>
                        <p className="font-medium">{blitz.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {blitzDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {blitz.location && ` · ${blitz.location}`}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-500/50 text-green-600"
                        onClick={() => handleUncommitFromBlitz(blitz.id)}
                        disabled={isCommitting === blitz.id}
                      >
                        {isCommitting === blitz.id ? "..." : (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Going
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Available blitzes */}
            {futureAvailableBlitzes.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Available Blitzes</h4>
                {futureAvailableBlitzes.map((blitz) => {
                  const blitzDate = new Date(blitz.date);
                  return (
                    <div 
                      key={blitz.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50"
                    >
                      <div>
                        <p className="font-medium">{blitz.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {blitzDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {blitz.location && ` · ${blitz.location}`}
                        </p>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleCommitToBlitz(blitz)}
                        disabled={isCommitting === blitz.id}
                      >
                        {isCommitting === blitz.id ? "..." : "Commit"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {futureAvailableBlitzes.length === 0 && committedBlitzes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming blitzes scheduled
              </p>
            )}
          </div>

          <div className="px-4 pb-6">
            <Button
              variant="outline"
              onClick={() => setShowBlitzDrawer(false)}
              className="w-full"
              size="lg"
            >
              Done
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};