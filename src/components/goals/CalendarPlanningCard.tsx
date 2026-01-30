import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, DollarSign, TrendingUp, TrendingDown, Loader2, Pencil, AlertCircle, MessageCircle, Plane, CalendarDays, Sparkles, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, getDay, isBefore, isSameDay, differenceInDays, isAfter } from "date-fns";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { usePlannedDaysSync } from "@/hooks/usePlannedDaysSync";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useBlitzes } from "@/hooks/useBlitzes";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateTakeHome, formatCurrency } from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useRepData } from "@/hooks/useRepData";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { CalendarIcon, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { PayEstimateDisclaimer } from "@/components/PayEstimateDisclaimer";

// Define season boundaries
// October 2025 is the earliest visible month (season start)
const EARLIEST_VISIBLE_MONTH = new Date(2025, 9, 1); // October 2025
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
  const [blitzCommitPrompt, setBlitzCommitPrompt] = useState<{ blitz: { id: string; name: string; date: string; endDate?: string | null; location?: string | null } } | null>(null);
  const [declinedBlitzPrompts, setDeclinedBlitzPrompts] = useState<Set<string>>(new Set());
  
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
  const { allBlitzes, loading: blitzesLoading } = useBlitzes();
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

  // Helper to determine if an entry is a "knocking day" for pace calculation
  // A knocking day MUST have: doors_knocked >= 4 AND work_start_time AND work_end_time
  // This is used for calculating daily average and pace
  const isKnockingDay = (entry: { doors_knocked: number | null; work_start_time: string | null; work_end_time: string | null }): boolean => {
    const hasDoors = (entry.doors_knocked || 0) >= 4;
    const hasWorkSession = !!entry.work_start_time && !!entry.work_end_time;
    return hasDoors && hasWorkSession;
  };
  
  // Helper to determine if an entry is a "worked day" for calendar display
  // A worked day has: doors_knocked >= 4 OR work times set OR any FP+/PRMR/upgrade_prmr results
  const isWorkedDay = (entry: { doors_knocked: number | null; work_start_time: string | null; work_end_time: string | null; fp_plus: number | null; prmr: number | null; upgrade_prmr: number | null }): boolean => {
    const hasDoors = (entry.doors_knocked || 0) >= 4;
    const hasWorkSession = entry.work_start_time || entry.work_end_time;
    const hasResults = (entry.fp_plus || 0) > 0 || (entry.prmr || 0) > 0 || (entry.upgrade_prmr || 0) > 0;
    return hasDoors || !!hasWorkSession || hasResults;
  };

  // Query to get actual days worked (finalized entries with real activity) AND FP+ data
  // Also tracks "knocking days" (doors >= 5 AND work times) for pace calculation
  const { data: workedDaysData, refetch: refetchWorkedDays } = useQuery({
    queryKey: ['worked-days-data', repData?.user_id, personalSummerStart, personalSummerEnd],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { 
        preseasonDaysWorked: 0, 
        summerDaysWorked: 0, 
        preseasonKnockingDays: 0,
        summerKnockingDays: 0,
        workedDates: new Set<string>(), 
        knockingDates: new Set<string>(),
        fpByDate: new Map<string, number>() 
      };

      // Get all finalized entries with activity fields
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date, doors_knocked, work_start_time, work_end_time, fp_plus, prmr, upgrade_prmr')
        .eq('user_id', user.id)
        .eq('is_finalized', true);

      if (error) {
        console.error('Error fetching worked days:', error);
        return { 
          preseasonDaysWorked: 0, 
          summerDaysWorked: 0, 
          preseasonKnockingDays: 0,
          summerKnockingDays: 0,
          workedDates: new Set<string>(), 
          knockingDates: new Set<string>(),
          fpByDate: new Map<string, number>() 
        };
      }

      console.log('Fetched worked days entries:', entries?.length, 'for user:', user.id);

      const preseasonStart = parseLocalDate(PRESEASON_START);
      const preseasonEnd = parseLocalDate(PRESEASON_END);
      const summerStart = parseLocalDate(personalSummerStart);
      const summerEnd = parseLocalDate(personalSummerEnd);

      let preseasonWorkedCount = 0;
      let summerWorkedCount = 0;
      let preseasonKnockingCount = 0;
      let summerKnockingCount = 0;
      const workedDates = new Set<string>();
      const knockingDates = new Set<string>();
      const fpByDate = new Map<string, number>(); // Store FP+ by date

      entries?.forEach(entry => {
        // Check if it's a "worked day" (for calendar display)
        const isWorked = isWorkedDay(entry);
        // Check if it's a "knocking day" (for pace calculation: doors >= 5 AND work times)
        const isKnocking = isKnockingDay(entry);
        
        if (!isWorked) return; // Skip non-worked days entirely
        
        workedDates.add(entry.entry_date);
        
        // Store FP+ (or calculate EFP from PRMR)
        const fpValue = entry.fp_plus || 0;
        const prmrValue = entry.prmr || 0;
        fpByDate.set(entry.entry_date, isEfpMode ? prmrValue / 85 : fpValue);
        
        const date = parseLocalDate(entry.entry_date);
        if (date >= preseasonStart && date <= preseasonEnd) {
          preseasonWorkedCount++;
          if (isKnocking) {
            preseasonKnockingCount++;
            knockingDates.add(entry.entry_date);
          }
        } else if (date >= summerStart && date <= summerEnd) {
          summerWorkedCount++;
          if (isKnocking) {
            summerKnockingCount++;
            knockingDates.add(entry.entry_date);
          }
        }
      });

      console.log('Worked dates:', Array.from(workedDates).length, 'Knocking days:', preseasonKnockingCount);

      return { 
        preseasonDaysWorked: preseasonWorkedCount, 
        summerDaysWorked: summerWorkedCount,
        preseasonKnockingDays: preseasonKnockingCount,
        summerKnockingDays: summerKnockingCount,
        workedDates, 
        knockingDates,
        fpByDate 
      };
    },
    staleTime: 0, // Always refetch - important for accurate calendar display
    enabled: !!repData?.user_id,
  });

  // Derived values from workedDaysData
  const workedDays = workedDaysData ? {
    preseasonDaysWorked: workedDaysData.preseasonDaysWorked,
    summerDaysWorked: workedDaysData.summerDaysWorked,
    preseasonKnockingDays: workedDaysData.preseasonKnockingDays,
    summerKnockingDays: workedDaysData.summerKnockingDays,
  } : undefined;
  
  // Re-hydrate Sets and Maps from query data - React Query persistence may serialize them
  const workedDatesSet = useMemo(() => {
    const data = workedDaysData?.workedDates;
    if (!data) return new Set<string>();
    if (data instanceof Set) return data;
    // If serialized, convert back from array or object
    if (Array.isArray(data)) return new Set<string>(data);
    if (typeof data === 'object') return new Set<string>(Object.keys(data));
    return new Set<string>();
  }, [workedDaysData?.workedDates]);
  
  const knockingDatesSet = useMemo(() => {
    const data = workedDaysData?.knockingDates;
    if (!data) return new Set<string>();
    if (data instanceof Set) return data;
    if (Array.isArray(data)) return new Set<string>(data);
    if (typeof data === 'object') return new Set<string>(Object.keys(data));
    return new Set<string>();
  }, [workedDaysData?.knockingDates]);
  
  const fpByDateMap = useMemo(() => {
    const data = workedDaysData?.fpByDate;
    if (!data) return new Map<string, number>();
    if (data instanceof Map) return data;
    // If serialized as object, convert back
    if (typeof data === 'object' && !Array.isArray(data)) {
      return new Map<string, number>(Object.entries(data));
    }
    return new Map<string, number>();
  }, [workedDaysData?.fpByDate]);
  
  const isDateWorked = (dateStr: string) => workedDatesSet.has(dateStr);
  const isDateKnocking = (dateStr: string) => knockingDatesSet.has(dateStr);
  const getFpForDate = (dateStr: string): number | undefined => fpByDateMap.get(dateStr);

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

  // Calculate preseason stats - using KNOCKING days (doors >= 5 + work times) for pace
  // Adjusts goals for cancel rate (what you need to SELL to end up with your goal after cancels)
  const preseasonStats = useMemo(() => {
    const futurePlannedCount = preseasonPlannedDays.length;
    // Use knocking days for daily average calculation (doors >= 5 AND work times)
    const knockingDaysCount = workedDays?.preseasonKnockingDays || 0;
    const daysWorkedCount = workedDays?.preseasonDaysWorked || 0;
    const totalPreseasonDays = futurePlannedCount + knockingDaysCount;
    
    if (totalPreseasonDays === 0 && knockingDaysCount === 0) return null;

    // Use EFP if in EFP mode, otherwise use FP+
    const currentProgress = isEfpMode ? preseasonCurrentEFP : preseasonCurrentFP;
    
    // Convert input goal to raw value and adjust for cancel rate
    // User inputs what they want to END UP with, we calculate what they need to SELL
    const inputGoal = parseFloat(preseasonTotalInput) || 0;
    const adjustedGoal = inputGoal / (1 - cancelRate); // e.g., 100 / 0.90 = 111.1 if 10% cancel
    const goalTotal = adjustedGoal;
    const goalDaily = totalPreseasonDays > 0 ? goalTotal / totalPreseasonDays : 0;
    
    // Daily average based on KNOCKING days only (doors >= 5 AND work times)
    const daysForAvg = knockingDaysCount || 1;
    const currentDailyAvg = currentProgress / daysForAvg;
    const projectedTotal = totalPreseasonDays > 0 ? currentDailyAvg * totalPreseasonDays : currentProgress;
    
    // Calculate remaining goal (what's left after current progress)
    const remainingGoal = Math.max(0, goalTotal - currentProgress);
    const remainingDays = futurePlannedCount;
    const neededDaily = remainingDays > 0 ? remainingGoal / remainingDays : 0;
    
    // Pace calculation: expected progress by now = goal daily × knocking days already done
    const expectedByNow = goalDaily * knockingDaysCount;
    const paceDiff = currentProgress - expectedByNow;
    const onPace = paceDiff >= -0.1; // On pace if not behind by more than 0.1
    const pacePercent = goalTotal > 0 ? (currentProgress / goalTotal) * 100 : 0;
    
    // Calculate extra per week needed to catch up (if behind pace)
    // Weeks left = remaining days / 6 (Mon-Sat)
    const weeksLeft = remainingDays / 6;
    const behindBy = Math.max(0, goalTotal - projectedTotal);
    const extraPerWeek = weeksLeft > 0 ? behindBy / weeksLeft : 0;

    return {
      futurePlannedCount,
      daysWorkedCount,
      knockingDaysCount,
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
      paceDiff,
      expectedByNow,
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

    // Use preseason PACING projection (what user is on track to sell based on current pace)
    // NOT the preseason goal input - this reflects reality rather than aspirations
    const preseasonPacingTotal = preseasonStats ? parseFloat(preseasonStats.projectedTotal) : 0;
    
    // Remaining summer goal = Selected tier (converted to current mode, adjusted for cancel rate) - preseason pacing total
    // The pacing total is already in the correct mode (EFP or FP+) and represents what user will likely sell
    const conversionFactor = isEfpMode ? avgPrmrPerFp / 85 : 1;
    const selectedGoalInMode = selectedSummerGoal * conversionFactor;
    // Adjust for cancel rate - user needs to SELL this much to END UP with their goal after cancels
    const adjustedSelectedGoal = selectedGoalInMode / (1 - cancelRate);
    // Subtract what they're pacing for in preseason (already includes cancels implicitly since it's based on actual sales pace)
    const remainingSummerGoal = Math.max(0, adjustedSelectedGoal - preseasonPacingTotal);
    
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
  }, [personalSummerStart, personalSummerEnd, workedDays, selectedSummerGoal, preseasonStats, avgPrmrPerFp, rentType, weeksWorking, upgradeFpGoal, isEfpMode, today, excludedSummerDays, cancelRate]);

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

  // Calculate weekly pace stats - compares THIS WEEK's progress to expected
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
    const todayStr = format(now, 'yyyy-MM-dd');
    
    // Count planned days this week
    const plannedThisWeek = (plannedDays || []).filter(d => {
      return d.planned_date >= weekStartStr && d.planned_date <= weekEndStr;
    });
    
    // Count KNOCKING days this week (actual days that count for pace)
    const knockingDaysThisWeek = Array.from(knockingDatesSet).filter(d => 
      d >= weekStartStr && d <= weekEndStr
    );
    
    const totalDaysThisWeek = plannedThisWeek.length;
    const workedThisWeek = knockingDaysThisWeek.length;
    
    if (totalDaysThisWeek === 0) return null;
    
    // Daily goal based on total goal / total planned days
    const dailyGoal = parseFloat(preseasonStats.goalDaily);
    const weeklyGoal = dailyGoal * totalDaysThisWeek;
    
    // Calculate THIS WEEK's FP (sum of FP for knocking days this week)
    let thisWeekFP = 0;
    knockingDaysThisWeek.forEach(dateStr => {
      thisWeekFP += fpByDateMap.get(dateStr) || 0;
    });
    
    // Expected progress THIS WEEK based on knocking days already done
    const expectedByNow = dailyGoal * workedThisWeek;
    
    // Pace diff is THIS WEEK's actual vs expected (not total season)
    const weekPaceDiff = thisWeekFP - expectedByNow;
    const isAheadThisWeek = weekPaceDiff >= 0.1;
    const isBehindThisWeek = weekPaceDiff <= -0.1;
    
    return {
      weeklyGoal: weeklyGoal.toFixed(1),
      totalDaysThisWeek,
      workedThisWeek,
      thisWeekFP: thisWeekFP.toFixed(1),
      expectedByNow: expectedByNow.toFixed(1),
      paceDiff: weekPaceDiff,
      isAheadThisWeek,
      isBehindThisWeek,
    };
  }, [preseasonStats, plannedDays, knockingDatesSet, fpByDateMap]);

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

  // Check if a date is part of a committed blitz
  const getCommittedBlitzForDate = (dateStr: string): CommittedBlitz | undefined => {
    const date = parseLocalDate(dateStr);
    return committedBlitzes.find(blitz => {
      const start = parseLocalDate(blitz.date);
      const end = blitz.endDate ? parseLocalDate(blitz.endDate) : start;
      return date >= start && date <= end;
    });
  };

  const isCommittedBlitzDay = (dateStr: string): boolean => !!getCommittedBlitzForDate(dateStr);

  // Filter to only future blitzes (end date >= today) for display purposes
  const futureBlitzesForDisplay = useMemo(() => {
    const todayDate = getLocalToday();
    return allBlitzes.filter(blitz => {
      const end = blitz.endDate ? parseLocalDate(blitz.endDate) : parseLocalDate(blitz.date);
      return end >= todayDate;
    });
  }, [allBlitzes]);

  // Check if a date is part of ANY future blitz (committed or not)
  const getAnyBlitzForDate = (dateStr: string): typeof allBlitzes[0] | undefined => {
    const date = parseLocalDate(dateStr);
    return futureBlitzesForDisplay.find(blitz => {
      const start = parseLocalDate(blitz.date);
      const end = blitz.endDate ? parseLocalDate(blitz.endDate) : start;
      return date >= start && date <= end;
    });
  };

  const isAnyBlitzDay = (dateStr: string): boolean => !!getAnyBlitzForDate(dateStr);
  
  // Check if a date is an UNCOMMITTED blitz day (blitz day user hasn't committed to)
  const getUncommittedBlitzForDate = (dateStr: string): typeof allBlitzes[0] | undefined => {
    const anyBlitz = getAnyBlitzForDate(dateStr);
    if (!anyBlitz) return undefined;
    const isCommitted = committedBlitzes.some(c => c.id === anyBlitz.id);
    return isCommitted ? undefined : anyBlitz;
  };
  
  const isUncommittedBlitzDay = (dateStr: string): boolean => !!getUncommittedBlitzForDate(dateStr);

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

  // Helper to check if we should prompt for blitz commitment
  const checkBlitzCommitmentPrompt = async (dateStr: string): Promise<boolean> => {
    const uncommittedBlitz = getUncommittedBlitzForDate(dateStr);
    if (!uncommittedBlitz) return false;
    
    // Skip if user already declined this blitz prompt
    if (declinedBlitzPrompts.has(uncommittedBlitz.id)) return false;
    
    // Count how many days the user has already marked within this blitz range (excluding this one)
    const blitzStart = parseLocalDate(uncommittedBlitz.date);
    const blitzEnd = uncommittedBlitz.endDate ? parseLocalDate(uncommittedBlitz.endDate) : blitzStart;
    
    let markedDaysInBlitz = 0;
    const allPlanned = plannedDays?.map(d => d.planned_date) || [];
    for (const pd of allPlanned) {
      const pDate = parseLocalDate(pd);
      if (pDate >= blitzStart && pDate <= blitzEnd && getDay(pDate) !== 0) {
        markedDaysInBlitz++;
      }
    }
    
    // If this would make 2+ days marked in the blitz range, show prompt
    // (markedDaysInBlitz >= 1 because we're about to add another one)
    if (markedDaysInBlitz >= 1) {
      setBlitzCommitPrompt({ blitz: uncommittedBlitz });
      return true;
    }
    return false;
  };

  const handleDayClick = async (date: Date) => {
    const dayOfWeek = getDay(date);
    const userSummerEndDate = parseLocalDate(personalSummerEnd);
    const isPast = isBefore(date, today);
    const dateStr = format(date, 'yyyy-MM-dd');
    const isCurrentlyPlanned = isDatePlanned(dateStr);
    const isWorked = isDateWorked(dateStr);
    
    // Don't allow Sundays or days after personal summer end
    if (dayOfWeek === 0 || date > userSummerEndDate) return;
    
    // For past dates: only allow REMOVING planned days that weren't worked
    if (isPast) {
      if (isCurrentlyPlanned && !isWorked) {
        // Allow removal of past planned day that wasn't worked
        await togglePlannedDay(dateStr);
      }
      // Block all other past date interactions
      return;
    }
    
    // Note: dateStr and isCurrentlyPlanned are now defined above
    
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
          // Check for blitz commitment prompt when ADDING a day
          const shouldPrompt = await checkBlitzCommitmentPrompt(dateStr);
          await togglePlannedDay(dateStr);
          // Prompt shows after toggling (user already added the day)
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
      
      // Check for blitz commitment prompt when ADDING a day (preseason days too)
      const shouldPrompt = await checkBlitzCommitmentPrompt(dateStr);
      await togglePlannedDay(dateStr);
      return;
    }
    
    // Removing a planned day (outside summer range)
    await togglePlannedDay(dateStr);
  };

  const metricLabel = isEfpMode ? 'EFP' : 'FP+';

  const handleGoToToday = () => {
    setCurrentMonth(new Date());
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Navigation functions for swipe
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToPrevMonth = () => {
    if (!isBefore(startOfMonth(subMonths(currentMonth, 1)), EARLIEST_VISIBLE_MONTH)) {
      setCurrentMonth(subMonths(currentMonth, 1));
    }
  };

  // Swipe navigation for mobile
  const { swipeState, ...swipeHandlers } = useSwipeNavigation({
    onSwipeLeft: goToNextMonth,
    onSwipeRight: goToPrevMonth,
  });

  // Calculate swipe transform style
  const swipeStyle = swipeState.isSwiping ? {
    transform: `translateX(${swipeState.direction === 'left' ? -swipeState.offset * 0.3 : swipeState.offset * 0.3}px)`,
    opacity: 1 - (swipeState.offset * 0.002),
    transition: 'none',
  } : {
    transform: 'translateX(0)',
    opacity: 1,
    transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
  };

  return (
    <div className="space-y-3">
      {/* Period Navigation - Limit to October 2025 and later */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={goToPrevMonth}
          disabled={isBefore(startOfMonth(subMonths(currentMonth, 1)), EARLIEST_VISIBLE_MONTH)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleGoToToday}
            className="text-base font-semibold hover:text-primary transition-colors"
          >
            {format(currentMonth, 'MMMM yyyy')}
          </button>
          {!isViewingToday && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleGoToToday} 
              className="h-6 px-2 text-xs"
            >
              Today
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={goToNextMonth}
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

      {/* Calendar Grid - Rendered by week rows for blitz range highlighting */}
      <div 
        className="space-y-1" 
        style={swipeStyle} 
        {...swipeHandlers}
        data-tour="goals-date-grid"
      >
        {(() => {
          // Build week rows with empty cells for offset
          const allCells: (Date | null)[] = [
            ...Array.from({ length: firstDayOffset }, () => null),
            ...monthDays
          ];
          
          // Split into weeks (7 cells each)
          const weeks: (Date | null)[][] = [];
          for (let i = 0; i < allCells.length; i += 7) {
            weeks.push(allCells.slice(i, i + 7));
          }
          
          return weeks.map((week, weekIndex) => {
            // Find blitz range within this week row (show ALL blitzes, not just committed)
            const weekBlitzDays = week.map((day, idx) => {
              if (!day) return { idx, isBlitz: false, isCommitted: false, isSunday: false, blitz: null };
              const dateStr = format(day, 'yyyy-MM-dd');
              const isSunday = getDay(day) === 0;
              const anyBlitz = getAnyBlitzForDate(dateStr);
              const isCommitted = isCommittedBlitzDay(dateStr);
              return { idx, isBlitz: !!anyBlitz, isCommitted, isSunday, blitz: anyBlitz, day };
            });
            
            // Find first and last blitz day indices in this week
            // BUT only include a Sunday if there are non-Sunday blitz days in the same week row
            const nonSundayBlitzDays = weekBlitzDays.filter(d => d.isBlitz && !d.isSunday);
            const hasNonSundayBlitzDays = nonSundayBlitzDays.length > 0;
            
            // If only Sundays are blitz days (no working days in this row), don't show the highlight
            const blitzIndicesToShow = hasNonSundayBlitzDays 
              ? weekBlitzDays.filter(d => d.isBlitz).map(d => d.idx)
              : [];
            
            const hasBlitzInWeek = blitzIndicesToShow.length > 0;
            const firstBlitzIdx = hasBlitzInWeek ? Math.min(...blitzIndicesToShow) : -1;
            const lastBlitzIdx = hasBlitzInWeek ? Math.max(...blitzIndicesToShow) : -1;
            
            // Check if any blitz day in this week is committed vs uncommitted
            const hasCommittedBlitz = weekBlitzDays.some(d => d.isBlitz && d.isCommitted);
            const hasUncommittedBlitz = weekBlitzDays.some(d => d.isBlitz && !d.isCommitted);
            
            return (
              <div key={weekIndex} className="grid grid-cols-7 gap-1 relative">
                {/* Subtle connecting background for blitz range */}
                {hasBlitzInWeek && (
                  <div 
                    className={cn(
                      "absolute top-1 bottom-1 rounded-lg pointer-events-none z-0",
                      hasCommittedBlitz && !hasUncommittedBlitz && "bg-sky-500/10 dark:bg-sky-400/10",
                      hasUncommittedBlitz && !hasCommittedBlitz && "bg-amber-500/10 dark:bg-amber-400/10 border border-dashed border-amber-500/30",
                      hasCommittedBlitz && hasUncommittedBlitz && "bg-gradient-to-r from-sky-500/10 to-amber-500/10"
                    )}
                    style={{
                      left: `calc(${(firstBlitzIdx / 7) * 100}% + 2px)`,
                      right: `calc(${((6 - lastBlitzIdx) / 7) * 100}% + 2px)`,
                    }}
                  />
                )}
                
                {week.map((day, dayIdx) => {
                  if (!day) {
                    return <div key={`empty-${weekIndex}-${dayIdx}`} className="aspect-square" />;
                  }
                  
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isPlanned = isDatePlanned(dateStr);
                  const isPast = isBefore(day, today);
                  const isWorked = isDateWorked(dateStr);
                  const fpValue = getFpForDate(dateStr);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isTodayDate = isSameDay(day, today);
                  const dayOfWeek = getDay(day);
                  const isSunday = dayOfWeek === 0;
                  const userSummerStart = parseLocalDate(personalSummerStart);
                  const userSummerEnd = parseLocalDate(personalSummerEnd);
                  const isAfterPersonalSummerEnd = day > userSummerEnd;
                  // Allow past planned days that weren't worked to be clickable for removal
                  const canRemovePastPlanned = isPast && isPlanned && !isWorked;
                  const isDisabled = (isPast && !canRemovePastPlanned) || isSunday || isAfterPersonalSummerEnd;
                  
                  const isExcludedSummerDay = excludedSummerDays.includes(dateStr);
                  const isInSummerRange = day >= userSummerStart && day <= userSummerEnd && !isPast;
                  const isPartOfCommittedBlitz = isCommittedBlitzDay(dateStr);
                  const isPartOfUncommittedBlitz = isUncommittedBlitzDay(dateStr);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleDayClick(day)}
                      disabled={isDisabled || isToggling}
                      className={cn(
                        "aspect-square rounded-lg text-sm font-medium transition-all relative z-10",
                        "flex flex-col items-center justify-center",
                        (isSunday || isAfterPersonalSummerEnd) && "opacity-30 cursor-not-allowed",
                        isWorked && !isSunday && "bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 cursor-default",
                        isPlanned && !isWorked && !isExcludedSummerDay && "bg-primary text-primary-foreground hover:bg-primary/90",
                        isPast && !isWorked && !isSunday && !isAfterPersonalSummerEnd && "opacity-30 cursor-not-allowed",
                        !isDisabled && !isPlanned && !isWorked && !isExcludedSummerDay && "hover:bg-accent cursor-pointer",
                        isExcludedSummerDay && !isWorked && "bg-destructive/20 text-destructive line-through hover:bg-destructive/30",
                        isTodayDate && !isPlanned && !isWorked && !isSunday && !isAfterPersonalSummerEnd && !isExcludedSummerDay && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                        !isCurrentMonth && "opacity-30"
                      )}
                    >
                      <span>{format(day, 'd')}</span>
                      {/* Show FP+/EFP on past worked days */}
                      {isWorked && isPast && fpValue !== undefined && fpValue > 0 && (
                        <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-300 absolute bottom-0">
                          {Math.floor(fpValue) === fpValue ? fpValue : fpValue.toFixed(1)}
                        </span>
                      )}
                      {/* Committed blitz indicator */}
                      {isPartOfCommittedBlitz && !isPast && !isSunday && (
                        <Plane className="h-2.5 w-2.5 text-sky-500 dark:text-sky-400 absolute bottom-0.5" />
                      )}
                      {/* Uncommitted blitz indicator - different style */}
                      {isPartOfUncommittedBlitz && !isPast && !isSunday && (
                        <MapPin className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400 absolute bottom-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          });
        })()}
      </div>

      {/* Calendar Legend */}
      <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground pt-2 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500/30" />
          Worked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-primary" />
          Planned
        </span>
        {committedBlitzes.length > 0 && (
          <span className="flex items-center gap-1.5">
            <Plane className="h-3 w-3 text-sky-500" />
            Your Blitz
          </span>
        )}
        {futureAvailableBlitzes.length > 0 && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-amber-500" />
            Available Blitz
          </span>
        )}
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
                {/* Current pace info - based on KNOCKING days (doors >= 5 + work times) */}
                {preseasonStats.knockingDaysCount > 0 && parseFloat(preseasonStats.goalTotal) > 0 && (
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Your Daily Pace</span>
                      <span className="text-[10px] text-muted-foreground/70">
                        ({preseasonStats.knockingDaysCount} days knocked)
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
                {preseasonStats.knockingDaysCount > 0 && parseFloat(preseasonStats.goalTotal) > 0 && (
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
                
                {/* Main focus: What you need today or daily - based on whether today is a planned day */}
                {(() => {
                  const todayStr = format(today, 'yyyy-MM-dd');
                  const isTodayPlanned = isDatePlanned(todayStr);
                  
                  return (
                    <div className="flex justify-between items-center pt-2 border-t border-border/30">
                      <span className="text-sm font-medium">
                        {isTodayPlanned ? 'Need Today' : 'Need Daily'}
                      </span>
                      <span className={cn(
                        "text-lg font-bold",
                        preseasonStats.onPace ? "text-green-600 dark:text-green-400" : "text-primary"
                      )}>
                        {preseasonStats.neededDaily} {metricLabel}
                      </span>
                    </div>
                  );
                })()}
                
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
                
                {/* Catch-up or encouragement message based on whether working today */}
                {(() => {
                  const todayStr = format(today, 'yyyy-MM-dd');
                  const isTodayPlanned = isDatePlanned(todayStr);
                  
                  // If not working today, show encouraging prep message instead of catch-up pressure
                  if (!isTodayPlanned && !preseasonStats.onPace && parseFloat(preseasonStats.extraPerWeek) > 0) {
                    return (
                      <div className="text-xs bg-primary/10 p-3 rounded-md space-y-1">
                        <div className="flex items-center gap-2 text-primary font-medium">
                          <Sparkles className="h-3 w-3" />
                          Rest Day Prep
                        </div>
                        <p className="text-muted-foreground">
                          Use today to prepare—review your pitch, study competitors, or practice. Good prep makes each selling day more productive!
                        </p>
                      </div>
                    );
                  }
                  
                  // If working today and behind pace, show the catch-up message
                  if (isTodayPlanned && !preseasonStats.onPace && parseFloat(preseasonStats.extraPerWeek) > 0) {
                    return (
                      <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-500/10 p-2 rounded-md">
                        You need to sell an extra <span className="font-semibold">{preseasonStats.extraPerWeek} {metricLabel}/week</span> to get back on pace
                      </div>
                    );
                  }
                  
                  return null;
                })()}
                
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
            
            {/* Loading skeleton while blitz data is loading */}
            {!preseasonStats && blitzesLoading && (
              <div className="p-4 rounded-xl bg-muted/50 border-2 border-dashed border-muted-foreground/20 space-y-3">
                <div className="flex justify-center">
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3 mx-auto" />
                </div>
                <Skeleton className="h-8 w-32 mx-auto" />
              </div>
            )}
            
            {/* Empty state when no preseason planned days - only show after loading */}
            {!preseasonStats && !blitzesLoading && (
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
                    data-tour="goals-blitz-button"
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
                {formatCurrency(totalStats.projectedEarnings)}*
              </span>
            </div>
            <PayEstimateDisclaimer className="mt-3" />
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
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85dvh] overflow-y-auto">
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
                        // Sync to reps table via edge function
                        if (repData?.id) {
                          const isStart = updateField === 'personal_summer_start';
                          await supabase.functions.invoke('update-summer-dates', {
                            body: {
                              repId: repData.id,
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
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="text-center pb-2">
            <DrawerTitle className="flex items-center justify-center gap-2">
              <Plane className="h-5 w-5 text-red-500" />
              Commit to a Blitz
            </DrawerTitle>
            <DrawerDescription>
              {committedBlitzes.length} committed · {futureAvailableBlitzes.length} available
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-4 overflow-y-auto max-h-[60dvh] flex-1 min-h-0">
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

      {/* Blitz Commitment Prompt - appears when user marks 2+ days in an uncommitted blitz week */}
      <Drawer open={!!blitzCommitPrompt} onOpenChange={(open) => !open && setBlitzCommitPrompt(null)}>
        <DrawerContent className="max-h-[70dvh]">
          <DrawerHeader className="text-center pb-2">
            <DrawerTitle className="flex items-center justify-center gap-2">
              <MapPin className="h-5 w-5 text-amber-500" />
              Attending {blitzCommitPrompt?.blitz.name}?
            </DrawerTitle>
            <DrawerDescription>
              You're marking multiple days during this blitz trip. Would you like to commit?
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-3">
            {blitzCommitPrompt?.blitz && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="font-medium">{blitzCommitPrompt.blitz.name}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(blitzCommitPrompt.blitz.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {blitzCommitPrompt.blitz.endDate && ` - ${new Date(blitzCommitPrompt.blitz.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  {blitzCommitPrompt.blitz.location && ` · ${blitzCommitPrompt.blitz.location}`}
                </p>
              </div>
            )}

            <Button
              className="w-full gap-2"
              onClick={async () => {
                if (blitzCommitPrompt?.blitz) {
                  await handleCommitToBlitz(blitzCommitPrompt.blitz);
                  setBlitzCommitPrompt(null);
                }
              }}
              disabled={isCommitting === blitzCommitPrompt?.blitz.id}
            >
              <Plane className="h-4 w-4" />
              {isCommitting === blitzCommitPrompt?.blitz.id ? "Committing..." : "Yes, I'm Going!"}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (blitzCommitPrompt?.blitz) {
                  setDeclinedBlitzPrompts(prev => new Set([...prev, blitzCommitPrompt.blitz.id]));
                }
                setBlitzCommitPrompt(null);
              }}
            >
              No, Just Knocking Elsewhere
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};