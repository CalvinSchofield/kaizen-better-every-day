import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Ban } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek, isSameDay, getDay, addWeeks, subWeeks, addMonths, subMonths, parseISO, isBefore } from "date-fns";
import { SaveEntrySheet } from "@/components/SaveEntrySheet";
import { SaleDetailSheet } from "@/components/SaleDetailSheet";
import { useDailyEntry, Sale } from "@/hooks/useDailyEntry";
import { useSaleUpdate } from "@/hooks/useSaleUpdate";
import { useQueryClient } from "@tanstack/react-query";
import { useEfpMode } from "@/hooks/useEfpMode";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useRepData } from "@/hooks/useRepData";
import { GoalProgressCard } from "@/components/GoalProgressCard";
import { CalendarSummaryTeaser } from "@/components/CalendarSummaryTeaser";
import { calculateSalesPace } from "@/utils/salesPaceCalculator";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useCalendarHistorical } from "@/hooks/useCalendarHistorical";

const PRESEASON_END = '2026-04-11';

interface CalendarViewProps {
  entries?: any[];
  blitzes?: any[];
  personalSummerStart?: Date;
  personalSummerEnd?: Date;
  viewMode?: "week" | "month";
  onViewModeChange?: (mode: "week" | "month") => void;
}

export const CalendarView = ({
  entries = [],
  blitzes = [],
  personalSummerStart,
  personalSummerEnd,
  viewMode: controlledViewMode,
  onViewModeChange,
}: CalendarViewProps) => {
  const queryClient = useQueryClient();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const { isDatePlanned, plannedDays } = usePlannedDays();
  const { goals } = useRepGoals();
  const { totalFP: preseasonCurrentFP, totalEFP: preseasonCurrentEFP, totalPRMR: preseasonCurrentPRMR } = usePreseasonFP();
  const { repData } = useRepData();
  const { updateSale } = useSaleUpdate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [internalViewMode, setInternalViewMode] = useState<"month" | "week">("week");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleDetailOpen, setSaleDetailOpen] = useState(false);
  
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
  
  // Calculate daily goal using centralized pace calculator
  const dailyGoal = useMemo(() => {
    if (!goals?.setup_complete) return null;
    
    // Count knocking days from entries
    const preseasonEndDate = parseISO(PRESEASON_END);
    const knockingDays = entries.filter(e => {
      if (!e.is_finalized) return false;
      const entryDate = parseISO(e.entry_date);
      // Must be before preseason end and meet knocking day criteria
      if (!isBefore(entryDate, preseasonEndDate) && entryDate.getTime() !== preseasonEndDate.getTime()) return false;
      return (e.doors_knocked || 0) >= 4 && e.work_start_time && e.work_end_time;
    }).length;
    
    // Use centralized pace calculator
    const result = calculateSalesPace({
      goals,
      plannedDays,
      knockingDays,
      currentFpPlus: preseasonCurrentFP,
      currentPrmr: preseasonCurrentPRMR,
      efpModeEnabled,
      calculateEfp,
      personalSummerStart: personalSummerStart ? format(personalSummerStart, 'yyyy-MM-dd') : undefined,
    });
    
    if (!result) return null;
    
    // Return daily goal (already accounts for cancel rate buffer)
    return Math.round(result.dailyGoal * 10) / 10;
  }, [goals, plannedDays, entries, efpModeEnabled, calculateEfp, preseasonCurrentFP, preseasonCurrentPRMR, personalSummerStart]);


  // Only use useDailyEntry for mutations, NOT for display data
  // Display data comes from the entries prop (source of truth)
  const { finalizeEntry, deleteEntry, isFinalizing } = useDailyEntry(
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
    const isSunday = getDay(date) === 0;
    const entry = getEntryForDate(date);
    
    // Don't allow editing Sundays unless they have existing data
    if (isSunday && !entry) return;
    
    setSelectedDate(date);
    setSheetOpen(true);
  };

  const handleSaveEntry = async (data: {
    doors_knocked: number;
    decision_makers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp_plus: number;
    prmr: number;
    upgrade_prmr?: number | null;
    saveDate: string;
    work_start_time?: string;
    work_end_time?: string;
    custom_counters?: Record<string, number>;
    sales_log?: Sale[];
  }) => {
    await new Promise<void>((resolve) => {
      finalizeEntry(data, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['all-daily-entries'] });
          resolve();
        }
      });
    });
  };

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
    if (entry.is_finalized) {
      // Finalized: use stored values
      totals.fpPlus += entry.fp_plus || 0;
      totals.prmr += entry.prmr || 0;
      totals.upgradePrmr += entry.upgrade_prmr || 0;
      totals.daysWorked += 1;
    } else {
      // Unfinalized: calculate from sales_log for accurate live data
      const salesLog = entry.sales_log || [];
      if (Array.isArray(salesLog)) {
        for (const sale of salesLog) {
          // Skip cancelled/never installed sales
          if (sale.install_status === 'never_installed') continue;
          
          const salePrmr = Number(sale.prmr) || 0;
          totals.prmr += salePrmr;
          
          if (sale.type === 'fp') {
            totals.fpPlus += 1;
          } else if (sale.type === 'upgrade') {
            totals.fpPlus += salePrmr / 85;
            totals.upgradePrmr += salePrmr;
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

    // Parse sales_log to get FP count and PRMR breakdown (only funded sales)
    const salesLog = entry.sales_log || [];
    const fundedSales = Array.isArray(salesLog) 
      ? salesLog.filter((sale: any) => sale.install_status !== 'cancelled' && sale.install_status !== 'never_installed')
      : [];
    
    if (fundedSales.length > 0) {
      // Use sales_log data
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
    upgradePrmrTotal: 0
  }), [entries, viewMode, currentDate, weekStart, weekEnd]);

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Period Navigation */}
      <div className="flex items-center justify-between mb-4">
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

      {/* Calendar Grid */}
      {viewMode === "month" ? (
        <div data-tour="calendar-grid" className="grid grid-cols-7 gap-2" style={swipeStyle} {...swipeHandlers}>
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-sm font-semibold text-muted-foreground pb-2">
              {day}
            </div>
          ))}

          {/* Calendar days */}
{days.map((day, idx) => {
            const entry = getEntryForDate(day);
            const isKnocking = isKnockingDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);
            const isSunday = getDay(day) === 0;
            const sundayHasData = isSunday && entry;
            const dateStr = format(day, 'yyyy-MM-dd');
            const isPlanned = isDatePlanned(dateStr);
            const hasEntry = entry && entry.is_finalized;
            
            // Check for cancelled or never_installed sales
            const salesLog = entry?.sales_log || [];
            const hasCancelledSale = Array.isArray(salesLog) && salesLog.some((s: any) => s.install_status === 'cancelled' || s.install_status === 'never_installed');
            
            // Me vs Me historical data for this day
            const historicalDay = meVsMeEnabled && hasMeVsMeData ? historicalByDate.get(dateStr) : null;

            return (
              <div
                key={idx}
                data-tour={isTodayDate ? "calendar-day-tile" : undefined}
                onClick={() => handleDayClick(day)}
                className={`
                  aspect-square p-1.5 rounded-lg border transition-all relative
                  ${isSunday && !sundayHasData ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                  ${isTodayDate ? 'border-primary border-2' : 'border-border'}
                  ${!isCurrentMonth ? 'opacity-40' : ''}
                  ${isKnocking && (!isSunday || sundayHasData) ? 'bg-primary/10' : isPlanned && !hasEntry ? 'bg-accent/30' : 'bg-card'}
                `}
              >
                {/* Cancelled sale indicator - top right corner */}
                {hasEntry && hasCancelledSale && (
                  <div className="absolute top-0.5 right-0.5 text-destructive">
                    <Ban className="h-3 w-3" />
                  </div>
                )}
                {/* Planned day goal indicator - top right corner */}
                {isPlanned && dailyGoal && !hasEntry && (
                  <div className="absolute top-1 right-1.5 text-[8px] text-muted-foreground/60 font-medium">
                    {formatValue(dailyGoal)}
                  </div>
                )}
                <div className={`text-sm font-semibold ${isKnocking && (!isSunday || sundayHasData) ? 'text-primary' : isPlanned && !hasEntry ? 'text-accent-foreground' : isSunday && !sundayHasData ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {format(day, 'd')}
                </div>
                {hasEntry && (
                  <div className="text-xs text-primary font-semibold mt-0.5">
                    {efpModeEnabled ? formatValue(calculateEfp(entry.prmr || 0)) : formatValue(entry.fp_plus || 0)}
                  </div>
                )}
                {/* Me vs Me historical overlay - bottom left, only show on days without current results */}
                {!hasEntry && historicalDay && historicalDay.fpPlus > 0 && (
                  <div className="absolute bottom-0.5 left-1 text-[8px] text-muted-foreground/50 font-medium">
                    '{String(comparisonYear).slice(-2)}: {efpModeEnabled ? formatValue(historicalDay.prmr / 85) : formatValue(historicalDay.fpPlus)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Week View - Grid layout matching month view */
        <div data-tour="calendar-grid" className="grid grid-cols-7 gap-2" style={swipeStyle} {...swipeHandlers}>
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-sm font-semibold text-muted-foreground pb-2">
              {day}
            </div>
          ))}

          {/* Week days */}
{days.map((day, idx) => {
            const entry = getEntryForDate(day);
            const isKnocking = isKnockingDay(day);
            const isTodayDate = isToday(day);
            const isSunday = getDay(day) === 0;
            const sundayHasData = isSunday && entry;
            const dateStr = format(day, 'yyyy-MM-dd');
            const isPlanned = isDatePlanned(dateStr);
            const hasEntry = entry && entry.is_finalized;
            
            // Check for cancelled sales
            const salesLog = entry?.sales_log || [];
            const hasCancelledSale = Array.isArray(salesLog) && salesLog.some((s: any) => s.install_status === 'cancelled');
            
            // Me vs Me historical data for this day
            const historicalDay = meVsMeEnabled && hasMeVsMeData ? historicalByDate.get(dateStr) : null;

            return (
              <div
                key={idx}
                data-tour={isTodayDate ? "calendar-day-tile" : undefined}
                onClick={() => handleDayClick(day)}
                className={`
                  p-3 rounded-lg border transition-all min-h-[100px] flex flex-col relative
                  ${isSunday && !sundayHasData ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
                  ${isTodayDate ? 'border-primary border-2' : 'border-border'}
                  ${isKnocking && (!isSunday || sundayHasData) ? 'bg-primary/10' : isPlanned && !hasEntry ? 'bg-accent/30' : 'bg-card'}
                `}
              >
                {/* Cancelled sale indicator - top right corner */}
                {hasEntry && hasCancelledSale && (
                  <div className="absolute top-1 right-1.5 text-destructive">
                    <Ban className="h-3.5 w-3.5" />
                  </div>
                )}
                {/* Planned day goal indicator - top right corner */}
                {isPlanned && dailyGoal && !hasEntry && (
                  <div className="absolute top-1 right-1.5 text-[10px] text-muted-foreground/60 font-medium">
                    {efpModeEnabled ? formatValue(dailyGoal * (goals?.avg_prmr_per_fp || 85) / 85) : formatValue(dailyGoal)}
                  </div>
                )}
                <div className={`text-lg font-semibold ${isKnocking && (!isSunday || sundayHasData) ? 'text-primary' : isPlanned && !hasEntry ? 'text-accent-foreground' : isSunday && !sundayHasData ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {format(day, 'd')}
                </div>
                {hasEntry && (
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
                )}
                {/* Me vs Me historical overlay - bottom left, only show on days without current results */}
                {!hasEntry && historicalDay && historicalDay.fpPlus > 0 && (
                  <div className="absolute bottom-1 left-1.5 text-[9px] text-muted-foreground/50 font-medium">
                    '{String(comparisonYear).slice(-2)}: {efpModeEnabled ? formatValue(historicalDay.prmr / 85) : formatValue(historicalDay.fpPlus)}
                  </div>
                )}
              </div>
            );
          })}
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

      {/* Goal Progress Card */}
      <div className="mt-4">
        <GoalProgressCard 
          entries={entries} 
          currentDate={currentDate} 
          viewMode={viewMode} 
        />
      </div>

      {/* Summary Teaser - Navigate to Insights */}
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

      {/* Save Entry Sheet */}
      <SaveEntrySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        entry={selectedEntry}
        date={selectedDate || new Date()}
        onSave={handleSaveEntry}
        onDelete={selectedEntry?.is_finalized ? handleDeleteEntry : undefined}
        isSaving={isFinalizing}
        salesLog={selectedEntry?.sales_log || []}
      />

      {/* Sale Detail Sheet - accessed from SalesLoggerCard in Track page */}
      <SaleDetailSheet
        open={saleDetailOpen}
        onOpenChange={setSaleDetailOpen}
        sale={selectedSale}
        entryDate={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
        onUpdateSale={(updatedSale) => {
          if (selectedEntry?.id && selectedDate) {
            updateSale({
              entryId: selectedEntry.id,
              entryDate: format(selectedDate, 'yyyy-MM-dd'),
              saleId: updatedSale.id,
              updates: updatedSale,
            });
          }
        }}
        crmEnabled={repData?.crm_enabled || false}
        crmDetailedEnabled={repData?.crm_detailed_enabled || false}
      />
    </div>
  );
};