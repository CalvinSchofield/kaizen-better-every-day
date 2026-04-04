import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Sparkles, Plane, MapPin, Loader2, CalendarIcon, Check, CircleMinus, DollarSign } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek, getDay, addWeeks, subWeeks, addMonths, subMonths, parseISO, isBefore, differenceInDays } from "date-fns";
import { parseLocalDate } from '@/utils/dateUtils';
import { CalendarDayDrawer } from "@/components/CalendarDayDrawer";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { useQueryClient } from "@tanstack/react-query";
import { useEfpMode } from "@/hooks/useEfpMode";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useBlitzes } from "@/hooks/useBlitzes";
import { hapticLight, hapticSuccess, hapticMedium } from "@/utils/haptics";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useRepData } from "@/hooks/useRepData";
import { CalendarGoalProgress } from "@/components/goals/CalendarGoalProgress";
import { CalendarSummaryTeaser } from "@/components/CalendarSummaryTeaser";


import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useCalendarHistorical } from "@/hooks/useCalendarHistorical";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getSessionSafe } from "@/utils/authSession";
import { invalidateGoalRelatedQueries } from "@/utils/goalInvalidation";
import { formatBlitzDate } from "@/utils/blitzDateUtils";
import { toast } from "sonner";

const PRESEASON_END = '2026-04-11';
const GLOBAL_SUMMER_START = '2026-04-12';

interface CalendarViewProps {
  entries?: any[];
  blitzes?: any[];
  personalSummerStart?: Date;
  personalSummerEnd?: Date;
  viewMode?: "week" | "month";
  onViewModeChange?: (mode: "week" | "month") => void;
  dailyGoal?: number | null;
  preseasonDailyPace?: number | null;
  summerDailyPace?: number | null;
}

export const CalendarView = ({
  entries = [],
  blitzes = [],
  personalSummerStart,
  personalSummerEnd,
  viewMode: controlledViewMode,
  onViewModeChange,
  dailyGoal = null,
  preseasonDailyPace = null,
  summerDailyPace = null,
}: CalendarViewProps) => {
  // Use unified dailyGoal prop from useGoalPaceCalculator (single source of truth)
  const queryClient = useQueryClient();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const { isDatePlanned, plannedDays, togglePlannedDay, isToggling } = usePlannedDays();
  const { goals } = useRepGoals();
  const { totalFP: preseasonCurrentFP, totalEFP: preseasonCurrentEFP, totalPRMR: preseasonCurrentPRMR } = usePreseasonFP();
  const { repData } = useRepData();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [internalViewMode, setInternalViewMode] = useState<"month" | "week">("week");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [planningMode, setPlanningMode] = useState(() => searchParams.get('planning') === 'true');
  const location = useLocation();
  
  // Track recently toggled dates for animation
  const [recentlyToggled, setRecentlyToggled] = useState<Set<string>>(new Set());

  // Clear the query param after reading it so it doesn't persist on refresh
  useEffect(() => {
    if (searchParams.get('planning') === 'true') {
      setPlanningMode(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('planning');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  
  // Auto-exit planning mode when navigating away
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname && planningMode) {
      setPlanningMode(false);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, planningMode]);

  const [confirmCommitBlitz, setConfirmCommitBlitz] = useState<any>(null);
  const [confirmUncommitBlitz, setConfirmUncommitBlitz] = useState<any>(null);
  const [isCommitting, setIsCommitting] = useState<string | null>(null);
  
  // Summer date editing state for planning mode
  const [editSummerStart, setEditSummerStart] = useState<string | null>(null);
  const [editSummerEnd, setEditSummerEnd] = useState<string | null>(null);
  const [startPopoverOpen, setStartPopoverOpen] = useState(false);
  const [endPopoverOpen, setEndPopoverOpen] = useState(false);
  const [savingSummerDates, setSavingSummerDates] = useState(false);
  const [savedSummerDates, setSavedSummerDates] = useState(false);
  
  // Blitz data for planning mode
  const { allBlitzes: futureBlitzes } = useBlitzes();
  const isPreseason = new Date() < new Date(GLOBAL_SUMMER_START);
  const isSummerStarted = personalSummerStart ? new Date() >= personalSummerStart : false;

  // Sync summer date editing state from props
  const personalSummerStartStr = personalSummerStart ? format(personalSummerStart, 'yyyy-MM-dd') : null;
  const personalSummerEndStr = personalSummerEnd ? format(personalSummerEnd, 'yyyy-MM-dd') : null;

  useEffect(() => {
    setEditSummerStart(personalSummerStartStr);
    setEditSummerEnd(personalSummerEndStr);
    setSavedSummerDates(false);
  }, [personalSummerStartStr, personalSummerEndStr, planningMode]);

  interface CommittedBlitz {
    id: string;
    name: string;
    date: string;
    endDate?: string;
    location?: string;
  }

  const committedBlitzes = useMemo(() => {
    return (repData?.committed_blitzes as unknown as CommittedBlitz[]) || [];
  }, [repData?.committed_blitzes]);

  const committedBlitzIds = useMemo(() => new Set(committedBlitzes.map(b => b.id)), [committedBlitzes]);
  // Use controlled or internal state
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;
  
  // Me vs Me historical data for calendar overlay (must be after viewMode is defined)
  const { 
    historicalByDate, 
    cumulativeComparison, 
    periodHistoricalTotals, 
    comparisonYear, 
    hasHistoricalData: hasMeVsMeData,
    isEnabled: meVsMeEnabled 
  } = useCalendarHistorical(currentDate, viewMode, entries);
  // Get date-aware daily goal: preseason pace for pre-summer dates, summer pace for summer dates
  const getDailyGoalForDate = (dateStr: string): number | null => {
    if (preseasonDailyPace != null && summerDailyPace != null && personalSummerStart) {
      const summerStartStr = format(personalSummerStart, 'yyyy-MM-dd');
      return dateStr < summerStartStr ? preseasonDailyPace : summerDailyPace;
    }
    return dailyGoal;
  };

  // Calculate off-day cost for summer
  const offDayCostInfo = useMemo(() => {
    if (!isSummerStarted || !personalSummerStart || !personalSummerEnd) return null;
    
    const summerStartStr = format(personalSummerStart, 'yyyy-MM-dd');
    const summerEndStr = format(personalSummerEnd, 'yyyy-MM-dd');
    
    // Count total summer days (excluding Sundays)
    const allSummerDays = eachDayOfInterval({ start: personalSummerStart, end: personalSummerEnd });
    const workableSummerDays = allSummerDays.filter(d => getDay(d) !== 0).length;
    
    // Count planned summer days
    const plannedSummerDays = plannedDays?.filter(d => d.planned_date >= summerStartStr && d.planned_date <= summerEndStr).length || 0;
    
    const daysOff = workableSummerDays - plannedSummerDays;
    
    // Calculate daily revenue from existing entries if we have data
    const summerEntries = entries.filter(e => e.entry_date >= summerStartStr && e.is_finalized);
    let dailyRevenue: number | null = null;
    
    if (summerEntries.length >= 3) {
      const totalPrmr = summerEntries.reduce((sum: number, e: any) => sum + (e.prmr || 0), 0);
      dailyRevenue = totalPrmr / summerEntries.length;
    } else if (summerDailyPace && summerDailyPace > 0) {
      // Use pace as FP+ proxy: assume ~$85 per FP+ (PRMR)
      dailyRevenue = summerDailyPace * 85;
    }
    
    return {
      daysOff: Math.max(0, daysOff),
      totalWorkable: workableSummerDays,
      plannedDays: plannedSummerDays,
      estimatedCost: dailyRevenue && daysOff > 0 ? Math.round(dailyRevenue * daysOff) : null,
      dailyRevenue: dailyRevenue ? Math.round(dailyRevenue) : null,
    };
  }, [isSummerStarted, personalSummerStart, personalSummerEnd, plannedDays, entries, summerDailyPace]);


  // useDailyEntry for delete mutation only
  const { deleteEntry } = useDailyEntry(
    selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined
  );
  
  // Get entry from entries prop (already fresh from all-daily-entries query)
  const selectedEntry = selectedDate ? entries.find(e => e.entry_date === format(selectedDate, 'yyyy-MM-dd')) : null;

  const { monthStart, monthEnd, calendarStart, calendarEnd, weekStart, weekEnd, days } = useMemo(() => {
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    const cs = startOfWeek(ms);
    const ce = endOfWeek(me);
    const ws = startOfWeek(currentDate);
    const we = endOfWeek(currentDate);
    const d = viewMode === "month" 
      ? eachDayOfInterval({ start: cs, end: ce })
      : eachDayOfInterval({ start: ws, end: we });
    return { monthStart: ms, monthEnd: me, calendarStart: cs, calendarEnd: ce, weekStart: ws, weekEnd: we, days: d };
  }, [currentDate, viewMode]);

  // Calculate previous period totals for comparison (memoized)
  const prevPeriodTotals = useMemo(() => {
    const prevPeriodStart = viewMode === "week" 
      ? subWeeks(weekStart, 1)
      : subMonths(monthStart, 1);
    
    const prevPeriodEnd = viewMode === "week"
      ? subWeeks(weekEnd, 1)
      : subMonths(monthEnd, 1);

    return entries.reduce((totals, entry) => {
      const [year, month, day] = entry.entry_date.split('-').map(Number);
      const entryDate = new Date(year, month - 1, day);
      const isInPrevPeriod = entryDate >= prevPeriodStart && entryDate <= prevPeriodEnd;

      if (isInPrevPeriod && entry.is_finalized) {
        totals.fpPlus += entry.fp_plus || 0;
        totals.prmr += entry.prmr || 0;
        totals.upgradePrmr += entry.upgrade_prmr || 0;
        totals.daysWorked += 1;
      }
      return totals;
    }, { fpPlus: 0, prmr: 0, upgradePrmr: 0, daysWorked: 0 });
  }, [entries, viewMode, weekStart, weekEnd, monthStart, monthEnd]);

  const isKnockingDay = (date: Date) => {
    const isSunday = getDay(date) === 0;
    
    // Check if entry has activity counters (not just FP+/PRMR results)
    const entry = getEntryForDate(date);
    const hasData = entry && entry.is_finalized && (
      (entry.doors_knocked || 0) > 0 ||
      (entry.decision_makers || 0) > 0 ||
      (entry.pitches || 0) > 0 ||
      (entry.transitions || 0) > 0 ||
      (entry.presentations || 0) > 0 ||
      (entry.closes || 0) > 0
    );

    // Sundays are only knocking days if they have data
    if (isSunday) {
      return hasData;
    }

    // All other days are knocking days if they have data
    return hasData;
  };

  // Create entry lookup map (memoized for fast access)
  const entryMap = useMemo(() => {
    const map = new Map<string, any>();
    entries.forEach(e => map.set(e.entry_date, e));
    return map;
  }, [entries]);

  const getEntryForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return entryMap.get(dateStr);
  };

  const nextPeriod = () => {
    if (viewMode === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const prevPeriod = () => {
    if (viewMode === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Swipe navigation for mobile
  const { swipeState, ...swipeHandlers } = useSwipeNavigation({
    onSwipeLeft: nextPeriod,
    onSwipeRight: prevPeriod,
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

  const handleDayClick = (date: Date) => {
    // Planning mode: toggle planned day
    if (planningMode) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const isSunday = getDay(date) === 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Don't allow planning Sundays or past dates
      if (isSunday) return;
      if (date < today) return;
      
      hapticMedium();
      togglePlannedDay(dateStr);
      
      // Track for animation
      setRecentlyToggled(prev => {
        const next = new Set(prev);
        next.add(dateStr);
        return next;
      });
      // Clear animation after 600ms
      setTimeout(() => {
        setRecentlyToggled(prev => {
          const next = new Set(prev);
          next.delete(dateStr);
          return next;
        });
      }, 600);
      return;
    }

    const isSunday = getDay(date) === 0;
    const entry = getEntryForDate(date);
    
    // Don't allow editing Sundays unless they have existing data
    if (isSunday && !entry) return;
    
    setSelectedDate(date);
    setSheetOpen(true);
  };

  // handleSaveEntry removed — CalendarDayDrawer is read-only, no manual entry saving from calendar

  // Helper to format numbers: show 1 decimal place but strip .0
  const formatValue = (value: number): string => {
    return value % 1 === 0 ? value.toString() : value.toFixed(1);
  };

  const handleDeleteEntry = () => {
    if (selectedEntry && 'id' in selectedEntry && selectedEntry.id) {
      deleteEntry(selectedEntry.id);
      setSheetOpen(false);
    }
  };

  // Check if current view is on today's month/week
  const today = new Date();
  const isViewingToday = viewMode === "month" 
    ? isSameMonth(currentDate, today)
    : today >= weekStart && today <= weekEnd;

  // Calculate totals for the current view (memoized)
  // IMPORTANT: Includes BOTH finalized entries AND unfinalized entries (live sales from sales_log)
  const viewTotals = useMemo(() => entries.reduce((totals, entry) => {
    // Parse entry_date as local date to avoid timezone issues
    const [year, month, day] = entry.entry_date.split('-').map(Number);
    const entryDate = new Date(year, month - 1, day);
    const isInView = viewMode === "month"
      ? isSameMonth(entryDate, currentDate)
      : entryDate >= weekStart && entryDate <= weekEnd;

    if (!isInView) return totals;

    // For unfinalized entries, calculate FP+/PRMR from sales_log (live data)
    // For finalized entries, use the stored column values
    // IMPORTANT: Pending sales are tracked separately so the teaser matches calendar display
    if (entry.is_finalized) {
      // Finalized: check sales_log for pending amounts to subtract
      const salesLog = entry.sales_log || [];
      if (Array.isArray(salesLog)) {
        let pendingFp = 0;
        let pendingPrmr = 0;
        for (const sale of salesLog) {
          if (sale.install_status === 'pending') {
            const salePrmr = Number(sale.prmr) || 0;
            pendingPrmr += salePrmr;
            if (sale.type === 'fp') {
              pendingFp += 1;
            } else if (sale.type === 'upgrade') {
              pendingFp += salePrmr / 85;
            }
          }
        }
        totals.fpPlus += (entry.fp_plus || 0) - pendingFp;
        totals.prmr += (entry.prmr || 0) - pendingPrmr;
        totals.upgradePrmr += (entry.upgrade_prmr || 0);
        totals.pendingFp += pendingFp;
        totals.pendingPrmr += pendingPrmr;
      } else {
        // No sales_log, use stored values as-is (legacy entries)
        totals.fpPlus += entry.fp_plus || 0;
        totals.prmr += entry.prmr || 0;
        totals.upgradePrmr += entry.upgrade_prmr || 0;
      }
      totals.daysWorked += 1;
    } else {
      // Unfinalized: calculate from sales_log for accurate live data
      const salesLog = entry.sales_log || [];
      if (Array.isArray(salesLog)) {
        for (const sale of salesLog) {
          if (sale.install_status === 'never_installed') continue;
          
          const salePrmr = Number(sale.prmr) || 0;
          
          if (sale.install_status === 'pending') {
            // Track pending separately
            totals.pendingPrmr += salePrmr;
            if (sale.type === 'fp') {
              totals.pendingFp += 1;
            } else if (sale.type === 'upgrade') {
              totals.pendingFp += salePrmr / 85;
            }
          } else {
            totals.prmr += salePrmr;
            if (sale.type === 'fp') {
              totals.fpPlus += 1;
            } else if (sale.type === 'upgrade') {
              totals.fpPlus += salePrmr / 85;
              totals.upgradePrmr += salePrmr;
            }
          }
        }
      }
      // Count as a worked day if there's activity
      if ((entry.doors_knocked || 0) >= 4) {
        totals.daysWorked += 1;
      }
    }

    // Activity counters (both finalized and unfinalized)
    totals.doorsKnocked += entry.doors_knocked || 0;
    totals.decisionMakers += entry.decision_makers || 0;
    totals.pitches += entry.pitches || 0;
    totals.transitions += entry.transitions || 0;
    totals.presentations += entry.presentations || 0;
    totals.closes += entry.closes || 0;

    // Parse sales_log to get FP count and PRMR breakdown (only funded, non-pending sales)
    const salesLogForBreakdown = entry.sales_log || [];
    const fundedSales = Array.isArray(salesLogForBreakdown) 
      ? salesLogForBreakdown.filter((sale: any) => sale.install_status !== 'cancelled' && sale.install_status !== 'never_installed' && sale.install_status !== 'pending')
      : [];
    
    if (fundedSales.length > 0) {
      fundedSales.forEach((sale: any) => {
        if (sale.type === 'fp') {
          totals.fpCount += 1;
          totals.fpPrmrTotal += sale.prmr || 0;
        } else if (sale.type === 'upgrade') {
          totals.upgradeCount += 1;
          totals.upgradePrmrTotal += sale.prmr || 0;
        }
      });
    } else if (entry.is_finalized && ((entry.fp_plus || 0) > 0 || (entry.prmr || 0) > 0)) {
      // Fallback for pre-sales_log entries: derive from column values (finalized only)
      const upgradeFp = (entry.upgrade_prmr || 0) / 85;
      const newFp = (entry.fp_plus || 0) - upgradeFp;
      const newPrmr = (entry.prmr || 0) - (entry.upgrade_prmr || 0);
      
      if (newFp > 0) {
        totals.fpCount += Math.round(newFp);
        totals.fpPrmrTotal += newPrmr;
      }
      if ((entry.upgrade_prmr || 0) > 0) {
        totals.upgradeCount += Math.round(upgradeFp);
        totals.upgradePrmrTotal += entry.upgrade_prmr || 0;
      }
    }

    // Calculate total work time in minutes (finalized entries only have reliable times)
    if (entry.is_finalized && entry.work_start_time && entry.work_end_time) {
      const start = new Date(entry.work_start_time);
      const end = new Date(entry.work_end_time);
      let workMinutes = (end.getTime() - start.getTime()) / 1000 / 60;

      // Subtract break periods
      if (entry.break_periods && Array.isArray(entry.break_periods)) {
        const breakMinutes = entry.break_periods.reduce((sum: number, period: any) => {
          if (period.start && period.end) {
            const breakStart = new Date(period.start);
            const breakEnd = new Date(period.end);
            return sum + ((breakEnd.getTime() - breakStart.getTime()) / 1000 / 60);
          }
          return sum;
        }, 0);
        workMinutes -= breakMinutes;
      }

      totals.totalWorkMinutes += workMinutes;
    }

    return totals;
  }, { 
    fpPlus: 0, 
    prmr: 0,
    upgradePrmr: 0,
    doorsKnocked: 0,
    decisionMakers: 0,
    pitches: 0,
    transitions: 0,
    presentations: 0,
    closes: 0,
    daysWorked: 0,
    totalWorkMinutes: 0,
    fpCount: 0,
    fpPrmrTotal: 0,
    upgradeCount: 0,
    upgradePrmrTotal: 0,
    pendingFp: 0,
    pendingPrmr: 0,
  }), [entries, viewMode, currentDate, weekStart, weekEnd]);

  // Handle Done button with haptic + toast
  const handleDonePlanning = () => {
    hapticSuccess();
    setPlanningMode(false);
    toast.success("Plan saved", { duration: 2000 });
  };

  // Render a day cell (shared between month & week views)
  const renderDayCell = (day: Date, idx: number, isWeekView: boolean) => {
    const entry = getEntryForDate(day);
    const isKnocking = isKnockingDay(day);
    const isTodayDate = isToday(day);
    const isCurrentMonth = isWeekView ? true : isSameMonth(day, currentDate);
    const isSunday = getDay(day) === 0;
    const sundayHasData = isSunday && entry;
    const dateStr = format(day, 'yyyy-MM-dd');
    const isPlanned = isDatePlanned(dateStr);
    const hasEntry = entry && entry.is_finalized;
    const wasJustToggled = recentlyToggled.has(dateStr);
    
    // Mission complete check
    const dailyTarget = entry?.daily_target;
    const production = efpModeEnabled ? calculateEfp(entry?.prmr || 0) : (entry?.fp_plus || 0);
    const isMissionComplete = hasEntry && dailyTarget != null && dailyTarget > 0 && production >= dailyTarget;
    
    // Me vs Me historical data for this day
    const historicalDay = meVsMeEnabled && hasMeVsMeData ? historicalByDate.get(dateStr) : null;

    // Planning mode visual states
    const isPastDate = (() => {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      return day < t;
    })();
    const isUnplannable = planningMode && (isSunday || isPastDate);

    return (
      <div
        key={idx}
        data-tour={isTodayDate ? "calendar-day-tile" : undefined}
        onClick={() => handleDayClick(day)}
        className={cn(
          "rounded-lg border transition-all relative overflow-hidden",
          isWeekView ? "p-3 min-h-[100px] flex flex-col" : "aspect-square p-1.5",
          isSunday && !sundayHasData ? 'opacity-40 cursor-not-allowed' : isWeekView ? 'cursor-pointer hover:scale-105' : 'cursor-pointer active:scale-95',
          isTodayDate ? 'border-primary border-2' : 'border-border',
          !isCurrentMonth ? 'opacity-40' : '',
          planningMode && isUnplannable ? 'opacity-30' : '',
          isKnocking && (!isSunday || sundayHasData) ? 'bg-primary/10' : isPlanned && !hasEntry ? 'bg-accent/30' : 'bg-card',
        )}
      >
        {/* Checkmark animation when toggled in planning mode */}
        <AnimatePresence>
          {planningMode && wasJustToggled && isPlanned && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            >
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-primary" strokeWidth={3} />
              </div>
            </motion.div>
          )}
          {planningMode && wasJustToggled && !isPlanned && (
            <motion.div
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            >
              <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center">
                <CircleMinus className="w-3.5 h-3.5 text-destructive" strokeWidth={2.5} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Planning mode: persistent checkmark on planned days */}
        {planningMode && isPlanned && !hasEntry && !wasJustToggled && (
          <div className="absolute top-0.5 right-0.5 text-primary">
            <Check className={cn("strokeWidth-3", isWeekView ? "h-3 w-3" : "h-2.5 w-2.5")} strokeWidth={3} />
          </div>
        )}

        {/* Mission complete indicator - top right corner */}
        {!planningMode && isMissionComplete && (
          <div className={cn("absolute text-emerald-500", isWeekView ? "top-1 right-1.5" : "top-0.5 right-0.5")}>
            <Check className={cn(isWeekView ? "h-3 w-3" : "h-2.5 w-2.5")} strokeWidth={3} />
          </div>
        )}
        {/* Planned day goal indicator - top right corner */}
        {!planningMode && (() => {
          const cellGoal = getDailyGoalForDate(dateStr);
          return isPlanned && !hasEntry && cellGoal ? (
            <div className={cn("absolute font-medium text-muted-foreground/60", isWeekView ? "top-1 right-1.5 text-[10px]" : "top-1 right-1.5 text-[8px]")}>
              {formatValue(cellGoal)}
            </div>
          ) : null;
        })()}
        <div className={cn(
          "font-semibold",
          isWeekView ? "text-lg" : "text-sm",
          isKnocking && (!isSunday || sundayHasData) ? 'text-primary' : isPlanned && !hasEntry ? 'text-accent-foreground' : isSunday && !sundayHasData ? 'text-muted-foreground' : 'text-foreground'
        )}>
          {format(day, 'd')}
        </div>
        {hasEntry && (
          isWeekView ? (
            <div className="mt-2 space-y-0.5">
              {efpModeEnabled ? (
                <>
                  <div className="text-xs text-primary font-semibold">
                    {formatValue(calculateEfp(entry.prmr || 0))} EFP
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    {formatValue(entry.fp_plus || 0)} FP+
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-primary font-semibold">
                    {formatValue(entry.fp_plus || 0)} FP+
                  </div>
                  {entry.prmr > 0 && (
                    <div className="text-xs text-muted-foreground font-medium">
                      ${Math.round(entry.prmr || 0)}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="text-xs text-primary font-semibold mt-0.5">
              {efpModeEnabled ? formatValue(calculateEfp(entry.prmr || 0)) : formatValue(entry.fp_plus || 0)}
            </div>
          )
        )}
        {/* Me vs Me historical overlay */}
        {!hasEntry && historicalDay && historicalDay.fpPlus > 0 && (
          <div className={cn(
            "absolute font-medium text-muted-foreground/50",
            isWeekView ? "bottom-1 left-1.5 text-[9px]" : "bottom-0.5 left-1 text-[8px]"
          )}>
            '{String(comparisonYear).slice(-2)}: {efpModeEnabled ? formatValue(historicalDay.prmr / 85) : formatValue(historicalDay.fpPlus)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn(      
      "min-h-screen p-4 transition-all duration-500",
      planningMode ? "pb-44" : "pb-24",
      planningMode
        ? "bg-gradient-to-b from-primary/8 via-primary/3 to-background"
        : "bg-background"
    )}>
      {/* Period Navigation */}
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="icon" onClick={prevPeriod}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            {viewMode === "month" 
              ? format(currentDate, 'MMMM yyyy')
              : `Week of ${format(weekStart, 'MMM d')}`
            }
          </h2>
          {!isViewingToday && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToToday} 
              className="h-7 px-2 text-xs"
            >
              Today
            </Button>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={nextPeriod}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Planning Mode Toggle — hidden when empty state CTA is showing */}
      {!(!planningMode && (!plannedDays || plannedDays.length === 0)) && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => {
              hapticLight();
              if (planningMode) {
                handleDonePlanning();
              } else {
                setPlanningMode(true);
              }
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.97]",
              planningMode
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground"
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {planningMode ? "Planning" : "Plan"}
          </button>
        </div>
      )}

      {/* Planning Mode Top Banner — replaces the old verbose instruction card */}
      <AnimatePresence>
        {planningMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-3 overflow-hidden"
          >
            <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <p className="text-sm font-medium text-primary">
                {isSummerStarted 
                  ? "Tap days you'll take off" 
                  : "Tap the days you'll work"
                }
              </p>
              <span className="text-xs text-primary/70 font-medium">
                {plannedDays?.length || 0} planned
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state CTA - no days planned yet */}
      {!planningMode && (!plannedDays || plannedDays.length === 0) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-center space-y-3"
        >
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">
            {isSummerStarted ? "Mark your off days" : "Plan your season"}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
            {isSummerStarted 
              ? "Tap below, then tap the days you'll take off this summer."
              : "Tap below, then tap the days you'll be working. This powers your daily pace targets."
            }
          </p>
          <button
            onClick={() => {
              hapticLight();
              setPlanningMode(true);
            }}
            className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold active:scale-[0.97] transition-transform"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {isSummerStarted ? "Mark Off Days" : "Start Planning"}
          </button>
        </motion.div>
      )}

      {/* Calendar Grid */}
      {viewMode === "month" ? (
        <div data-tour="calendar-grid" className="grid grid-cols-7 gap-2" style={swipeStyle} {...swipeHandlers}>
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-sm font-semibold text-muted-foreground pb-2">
              {day}
            </div>
          ))}
          {days.map((day, idx) => renderDayCell(day, idx, false))}
        </div>
      ) : (
        /* Week View */
        <div data-tour="calendar-grid" className="grid grid-cols-7 gap-2" style={swipeStyle} {...swipeHandlers}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-sm font-semibold text-muted-foreground pb-2">
              {day}
            </div>
          ))}
          {days.map((day, idx) => renderDayCell(day, idx, true))}
        </div>
      )}

      {/* Legend */}
      <div data-tour="calendar-blitz-indicator" className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary/10 border border-primary/30" />
          <span className="text-muted-foreground">Worked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-accent/30 border border-border" />
          <span className="text-muted-foreground">Planned</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-card border border-border flex items-center justify-center">
            <span className="text-[8px] text-muted-foreground/60 font-medium">0.5</span>
          </div>
          <span className="text-muted-foreground">Daily goal</span>
        </div>
      </div>

      {/* Goal Progress Card - always mounted to keep query subscriptions active */}
      <div className={planningMode ? 'hidden' : undefined}>
        <div className="mt-4">
          <CalendarGoalProgress />
        </div>

        {viewTotals.daysWorked > 0 && (
          <CalendarSummaryTeaser
            viewMode={viewMode}
            weekStart={weekStart}
            weekEnd={new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)}
            currentDate={currentDate}
            viewTotals={viewTotals}
            prevPeriodTotals={prevPeriodTotals}
            entries={entries}
            cumulativeComparison={cumulativeComparison}
            periodHistoricalTotals={periodHistoricalTotals}
            comparisonYear={comparisonYear}
            hasHistoricalData={hasMeVsMeData && meVsMeEnabled}
          />
        )}
      </div>

      {/* Planning mode card — simplified: blitzes + summer dates only, no instructions */}
      <AnimatePresence mode="wait">
        {planningMode && (
          <motion.div
            key="planning-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="mt-6"
          >
            <div className="rounded-2xl border border-primary/20 bg-card/80 backdrop-blur-sm p-5 space-y-4">
              {/* Off-day cost display for summer */}
              {isSummerStarted && offDayCostInfo && offDayCostInfo.daysOff > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <DollarSign className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {offDayCostInfo.daysOff} summer {offDayCostInfo.daysOff === 1 ? 'day' : 'days'} off
                    </p>
                    {offDayCostInfo.estimatedCost && (
                      <p className="text-xs text-muted-foreground">
                        ~${offDayCostInfo.estimatedCost.toLocaleString()} potential revenue
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Blitz Trips Section - only during preseason */}
              {isPreseason && futureBlitzes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">Blitz Trips</h4>
                  </div>
                  <div className="space-y-2">
                    {futureBlitzes.map((blitz) => {
                      const isCommitted = committedBlitzIds.has(blitz.id);
                      const isLoading = isCommitting === blitz.id;
                      return (
                        <div
                          key={blitz.id}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 border transition-all",
                            isCommitted
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : "border-border bg-card"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isCommitted ? (
                              <Plane className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{blitz.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatBlitzDate(blitz.date, 'MMM d')}
                                {blitz.endDate ? ` - ${formatBlitzDate(blitz.endDate, 'MMM d')}` : ''}
                                {blitz.location ? ` · ${blitz.location}` : ''}
                              </p>
                            </div>
                          </div>
                          <button
                            disabled={isLoading}
                            onClick={() => {
                              hapticLight();
                              if (isCommitted) {
                                setConfirmUncommitBlitz({ id: blitz.id, name: blitz.name });
                              } else {
                                setConfirmCommitBlitz({
                                  id: blitz.id,
                                  name: blitz.name,
                                  date: blitz.date,
                                  endDate: blitz.endDate,
                                  location: blitz.location,
                                });
                              }
                            }}
                            className={cn(
                              "text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 active:scale-[0.97] transition-all",
                              isCommitted
                                ? "text-emerald-600 bg-emerald-500/10"
                                : "text-primary bg-primary/10"
                            )}
                          >
                            {isLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isCommitted ? 'Joined' : 'Join'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summer Dates Section */}
              {(() => {
                const showStartDate = !isSummerStarted;
                const summerDatesChanged =
                  editSummerStart !== personalSummerStartStr ||
                  editSummerEnd !== personalSummerEndStr;
                // Show section if there's something to edit (end date always, start date if not started)
                return (showStartDate || true) ? (
                  <div className={cn("space-y-3", (isPreseason && futureBlitzes.length > 0) ? "pt-3 border-t border-border/50" : "")}>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-primary" />
                      <h4 className="text-sm font-semibold text-foreground">Summer Dates</h4>
                    </div>
                    <div className="space-y-2">
                      {/* Start Date - hidden after summer starts */}
                      {showStartDate && (
                        <div className="rounded-xl border border-border bg-card px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="p-1.5 rounded-lg bg-primary/10">
                                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <Label className="text-sm font-medium">Start Date</Label>
                              </div>
                            </div>
                            <Popover open={startPopoverOpen} onOpenChange={setStartPopoverOpen}>
                              <PopoverTrigger asChild>
                                <button
                                  className="text-sm font-semibold text-foreground bg-background/60 border border-border rounded-xl px-3 py-1.5 active:scale-[0.97] transition-transform"
                                  onClick={() => hapticLight()}
                                >
                                  {editSummerStart ? format(parseLocalDate(editSummerStart), 'MMM d') : 'Set'}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                  mode="single"
                                  selected={editSummerStart ? parseLocalDate(editSummerStart) : undefined}
                                  onSelect={(date) => {
                                    if (date) {
                                      setEditSummerStart(format(date, 'yyyy-MM-dd'));
                                      setStartPopoverOpen(false);
                                    }
                                  }}
                                  defaultMonth={editSummerStart ? parseLocalDate(editSummerStart) : new Date(2026, 3)}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      )}

                      {/* End Date */}
                      <div className="rounded-xl border border-border bg-card px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-lg bg-accent/30">
                              <CalendarIcon className="h-3.5 w-3.5 text-accent-foreground" />
                            </div>
                            <div className="min-w-0">
                              <Label className="text-sm font-medium">End Date</Label>
                            </div>
                          </div>
                          <Popover open={endPopoverOpen} onOpenChange={setEndPopoverOpen}>
                            <PopoverTrigger asChild>
                              <button
                                className="text-sm font-semibold text-foreground bg-background/60 border border-border rounded-xl px-3 py-1.5 active:scale-[0.97] transition-transform"
                                onClick={() => hapticLight()}
                              >
                                {editSummerEnd ? format(parseLocalDate(editSummerEnd), 'MMM d') : 'Set'}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <Calendar
                                mode="single"
                                selected={editSummerEnd ? parseLocalDate(editSummerEnd) : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    setEditSummerEnd(format(date, 'yyyy-MM-dd'));
                                    setEndPopoverOpen(false);
                                  }
                                }}
                                defaultMonth={editSummerEnd ? parseLocalDate(editSummerEnd) : new Date(2026, 8)}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>

                    {/* Save button for summer dates */}
                    <AnimatePresence>
                      {summerDatesChanged && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                        >
                          <button
                            disabled={savingSummerDates || savedSummerDates}
                            onClick={async () => {
                              setSavingSummerDates(true);
                              try {
                                const { user } = await getSessionSafe();
                                if (!user) throw new Error('Not authenticated');
                                await supabase
                                  .from('season_config')
                                  .upsert({
                                    user_id: user.id,
                                    updated_at: new Date().toISOString(),
                                    personal_summer_start: editSummerStart,
                                    personal_summer_end: editSummerEnd,
                                  }, { onConflict: 'user_id' });

                                if (repData?.id) {
                                  await supabase.functions.invoke('update-summer-dates', {
                                    body: {
                                      repId: repData.id,
                                      startDate: editSummerStart,
                                      endDate: editSummerEnd,
                                    },
                                  });
                                }

                                invalidateGoalRelatedQueries(queryClient);
                                hapticSuccess();
                                setSavedSummerDates(true);
                                toast.success('Summer dates updated');
                                setTimeout(() => setSavedSummerDates(false), 2000);
                              } catch (err) {
                                console.error('Error saving summer dates:', err);
                                toast.error('Failed to save dates');
                              } finally {
                                setSavingSummerDates(false);
                              }
                            }}
                            className={cn(
                              "w-full py-2.5 rounded-xl text-sm font-semibold active:scale-[0.97] transition-all",
                              savedSummerDates
                                ? "bg-primary/10 text-primary"
                                : "bg-primary text-primary-foreground"
                            )}
                          >
                            {savedSummerDates ? (
                              <span className="flex items-center justify-center gap-1.5">
                                <Check className="w-4 h-4" /> Saved
                              </span>
                            ) : savingSummerDates ? 'Saving…' : 'Save Dates'}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : null;
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar Day Drawer - read-only summary or nudge */}
      <CalendarDayDrawer
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        entry={selectedEntry}
        date={selectedDate || new Date()}
        onSaleAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['all-daily-entries'] });
        }}
      />

      {/* Planning Mode Floating Summary Bar */}
      <AnimatePresence>
        {planningMode && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-40"
          >
            <div className="bg-card border border-border rounded-2xl shadow-lg px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-4 h-4 text-primary" />
                <div className="flex flex-col">
                  {(() => {
                    const summerStartStr = personalSummerStart ? format(personalSummerStart, 'yyyy-MM-dd') : null;
                    const preseasonCount = summerStartStr
                      ? plannedDays?.filter(d => d.planned_date < summerStartStr).length || 0
                      : plannedDays?.length || 0;
                    const summerCount = summerStartStr
                      ? plannedDays?.filter(d => d.planned_date >= summerStartStr).length || 0
                      : 0;
                    return (
                      <span className="text-sm font-medium">
                        {plannedDays?.length || 0} days planned
                        {summerStartStr && (
                          <span className="text-muted-foreground text-[10px] ml-1">
                            ({preseasonCount} pre · {summerCount} sum)
                          </span>
                        )}
                      </span>
                    );
                  })()}
                  {isSummerStarted && offDayCostInfo && offDayCostInfo.daysOff > 0 && offDayCostInfo.estimatedCost && (
                    <span className="text-[10px] text-amber-600/80">
                      {offDayCostInfo.daysOff} off · ~${offDayCostInfo.estimatedCost.toLocaleString()}
                    </span>
                  )}
                  {!isSummerStarted && viewTotals.daysWorked > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {viewTotals.daysWorked} worked this {viewMode === 'week' ? 'week' : 'month'}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleDonePlanning}
                className="text-xs font-semibold text-primary px-3 py-1.5 rounded-full bg-primary/10 active:scale-[0.97] transition-transform"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blitz Commit Confirmation Drawer */}
      <Drawer open={!!confirmCommitBlitz} onOpenChange={(o) => !o && setConfirmCommitBlitz(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Join {confirmCommitBlitz?.name}?</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Committing to this blitz will automatically add all work days (Mon–Sat) during the trip as planned days.
            </p>
            {confirmCommitBlitz && (
              <p className="text-sm text-foreground font-medium">
                {formatBlitzDate(confirmCommitBlitz.date, 'MMM d')}
                {confirmCommitBlitz.endDate ? ` – ${formatBlitzDate(confirmCommitBlitz.endDate, 'MMM d')}` : ''}
                {confirmCommitBlitz.location ? ` · ${confirmCommitBlitz.location}` : ''}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setConfirmCommitBlitz(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={async () => {
                  const blitz = confirmCommitBlitz;
                  if (!blitz || !repData?.id) return;
                  setIsCommitting(blitz.id);
                  setConfirmCommitBlitz(null);
                  try {
                    const newCommitment = {
                      id: blitz.id,
                      name: blitz.name,
                      date: blitz.date,
                      endDate: blitz.endDate || undefined,
                      location: blitz.location || undefined,
                    };
                    const newCommitments = [...committedBlitzes, newCommitment];
                    const newBlitzIds = newCommitments.map(b => b.id);
                    const { error } = await supabase
                      .from('reps')
                      .update({ committed_blitzes: newCommitments as any })
                      .eq('id', repData.id);
                    if (error) throw error;
                    await supabase.functions.invoke('update-blitz-commitment', {
                      body: { repId: repData.id, blitzPageIds: newBlitzIds },
                    });
                    await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
                    hapticSuccess();
                    toast.success(`Committed to ${blitz.name}`);
                  } catch (err) {
                    console.error('Error committing to blitz:', err);
                    toast.error('Failed to commit');
                  } finally {
                    setIsCommitting(null);
                  }
                }}
              >
                Join
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Blitz Uncommit Confirmation Drawer */}
      <Drawer open={!!confirmUncommitBlitz} onOpenChange={(o) => !o && setConfirmUncommitBlitz(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Leave {confirmUncommitBlitz?.name}?</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              This will remove you from the blitz and the associated planned work days.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setConfirmUncommitBlitz(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl"
                onClick={async () => {
                  const blitz = confirmUncommitBlitz;
                  if (!blitz || !repData?.id) return;
                  setIsCommitting(blitz.id);
                  setConfirmUncommitBlitz(null);
                  try {
                    const newCommitments = committedBlitzes.filter(b => b.id !== blitz.id);
                    const newBlitzIds = newCommitments.map(b => b.id);
                    const { error } = await supabase
                      .from('reps')
                      .update({ committed_blitzes: newCommitments as any })
                      .eq('id', repData.id);
                    if (error) throw error;
                    await supabase.functions.invoke('update-blitz-commitment', {
                      body: { repId: repData.id, blitzPageIds: newBlitzIds },
                    });
                    await queryClient.invalidateQueries({ queryKey: ['rep-data'] });
                    hapticSuccess();
                    toast.success('Removed from blitz');
                  } catch (err) {
                    console.error('Error uncommitting:', err);
                    toast.error('Failed to leave blitz');
                  } finally {
                    setIsCommitting(null);
                  }
                }}
              >
                Leave
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
