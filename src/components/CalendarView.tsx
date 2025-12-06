import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Ban } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek, isSameDay, getDay, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { SaveEntrySheet } from "@/components/SaveEntrySheet";
import { SaleDetailSheet } from "@/components/SaleDetailSheet";
import { useDailyEntry, Sale } from "@/hooks/useDailyEntry";
import { useSaleUpdate } from "@/hooks/useSaleUpdate";
import { useQueryClient } from "@tanstack/react-query";
import { useEfpMode } from "@/hooks/useEfpMode";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { GoalProgressCard } from "@/components/GoalProgressCard";

interface CalendarViewProps {
  entries?: any[];
  blitzes?: any[];
  personalSummerStart?: Date;
  personalSummerEnd?: Date;
}

export const CalendarView = ({
  entries = [],
  blitzes = [],
  personalSummerStart,
  personalSummerEnd,
}: CalendarViewProps) => {
  const queryClient = useQueryClient();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const { isDatePlanned, plannedDays } = usePlannedDays();
  const { goals } = useRepGoals();
  const { totalFP: preseasonCurrentFP, totalEFP: preseasonCurrentEFP } = usePreseasonFP();
  const { updateSale } = useSaleUpdate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("week");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [dataViewMode, setDataViewMode] = useState<"totals" | "weekly" | "daily">("totals");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleDetailOpen, setSaleDetailOpen] = useState(false);
  
  // Calculate daily goal based on preseason goal and planned days
  // Must match CalendarPlanningCard calculation: goal / (future planned days + days worked)
  // Adjusts for cancel rate to show what user needs to SELL
  const dailyGoal = useMemo(() => {
    if (!goals) return null;
    
    // Get cancel rate (default 10% for rookies)
    const cancelRate = goals.cancel_rate ?? 0.10;
    
    // Use preseason_fp_goal if set
    const preseasonFpGoal = goals.preseason_fp_goal || 0;
    if (preseasonFpGoal > 0 && plannedDays && plannedDays.length > 0) {
      // Count preseason planned days (before April 12, 2026)
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const preseasonEnd = new Date(2026, 3, 11); // April 11, 2026
      
      // Future preseason planned days only (same as CalendarPlanningCard)
      const preseasonFuturePlannedCount = plannedDays.filter(d => {
        const date = new Date(d.planned_date);
        return date <= preseasonEnd && d.planned_date >= todayStr;
      }).length;
      
      // Days already worked (finalized entries in preseason)
      const preseasonWorkedCount = entries.filter(e => {
        if (!e.is_finalized) return false;
        const entryDate = new Date(e.entry_date);
        const preseasonStart = new Date(2025, 8, 28); // Sep 28, 2025
        return entryDate >= preseasonStart && entryDate <= preseasonEnd;
      }).length;
      
      const totalPreseasonDays = preseasonFuturePlannedCount + preseasonWorkedCount;
      
      if (totalPreseasonDays > 0) {
        // Adjust for cancel rate: what you need to SELL to end up with goal
        const adjustedGoal = preseasonFpGoal / (1 - cancelRate);
        // Round to 1 decimal for cleaner display
        return Math.round((adjustedGoal / totalPreseasonDays) * 10) / 10;
      }
    }
    
    // Fallback to will_do goal divided by weeks * 6 days
    const weeksWorking = goals.weeks_working || 18;
    const totalDays = weeksWorking * 6;
    const fpGoal = goals.will_do_fp_goal || goals.must_do_fp_goal || 0;
    if (totalDays === 0 || fpGoal === 0) return null;
    // Adjust for cancel rate
    const adjustedGoal = fpGoal / (1 - cancelRate);
    return adjustedGoal / totalDays;
  }, [goals, plannedDays, entries]);

  // When switching to week view, change from totals to weekly if needed
  const handleViewModeChange = (mode: "month" | "week") => {
    setViewMode(mode);
    if (mode === "week" && dataViewMode === "totals") {
      setDataViewMode("weekly");
    }
  };

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
  const viewTotals = useMemo(() => entries.reduce((totals, entry) => {
    // Parse entry_date as local date to avoid timezone issues
    const [year, month, day] = entry.entry_date.split('-').map(Number);
    const entryDate = new Date(year, month - 1, day);
    const isInView = viewMode === "month"
      ? isSameMonth(entryDate, currentDate)
      : entryDate >= weekStart && entryDate <= weekEnd;

    if (isInView && entry.is_finalized) {
      totals.fpPlus += entry.fp_plus || 0;
      totals.prmr += entry.prmr || 0;
      totals.upgradePrmr += entry.upgrade_prmr || 0;
      totals.doorsKnocked += entry.doors_knocked || 0;
      totals.decisionMakers += entry.decision_makers || 0;
      totals.pitches += entry.pitches || 0;
      totals.transitions += entry.transitions || 0;
      totals.presentations += entry.presentations || 0;
      totals.closes += entry.closes || 0;
      totals.daysWorked += 1;

      // Parse sales_log to get FP count and PRMR breakdown (only funded sales)
      // Fall back to column values for entries without sales_log (pre-feature entries)
      const salesLog = entry.sales_log || [];
      const fundedSales = Array.isArray(salesLog) 
        ? salesLog.filter((sale: any) => sale.install_status !== 'cancelled')
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
      } else if ((entry.fp_plus || 0) > 0 || (entry.prmr || 0) > 0) {
        // Fallback for pre-sales_log entries: derive from column values
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

      // Calculate total work time in minutes
      if (entry.work_start_time && entry.work_end_time) {
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

  // Calculate display values based on view mode
  const getDisplayValue = (value: number) => {
    if (dataViewMode === "weekly") {
      // If worked less than 6 days, show what it would be if worked 6 days (daily avg * 6)
      if (viewTotals.daysWorked < 6 && viewTotals.daysWorked > 0) {
        return ((value / viewTotals.daysWorked) * 6).toFixed(1);
      }
      return (value / 6).toFixed(1);
    } else if (dataViewMode === "daily" && viewTotals.daysWorked > 0) {
      return (value / viewTotals.daysWorked).toFixed(1);
    }
    return value.toString();
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => handleViewModeChange("week")}
          >
            Week
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => handleViewModeChange("month")}
          >
            Month
          </Button>
        </div>
      </div>

      {/* Period Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={prevPeriod}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">
          {viewMode === "month" 
            ? format(currentDate, 'MMMM yyyy')
            : `Week of ${format(weekStart, 'MMM d')}`
          }
        </h2>
        <Button variant="ghost" size="icon" onClick={nextPeriod}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <Button 
        variant={isViewingToday ? "ghost" : "default"} 
        size="sm" 
        onClick={goToToday} 
        className={`w-full mb-4 ${isViewingToday ? 'text-xs' : ''}`}
      >
        Today
      </Button>

      {/* Calendar Grid */}
      {viewMode === "month" ? (
        <div className="grid grid-cols-7 gap-2">
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
            
            // Check for cancelled sales
            const salesLog = entry?.sales_log || [];
            const hasCancelledSale = Array.isArray(salesLog) && salesLog.some((s: any) => s.install_status === 'cancelled');

            return (
              <div
                key={idx}
                onClick={() => handleDayClick(day)}
                className={`
                  aspect-square p-1.5 rounded-lg border transition-all relative
                  ${isSunday && !sundayHasData ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
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
              </div>
            );
          })}
        </div>
      ) : (
        /* Week View - Grid layout matching month view */
        <div className="grid grid-cols-7 gap-2">
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

            return (
              <div
                key={idx}
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
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
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

      {/* Summary Card - Expandable (only show if there's data) */}
      {viewTotals.daysWorked > 0 && (
      <div className="mt-6 rounded-lg bg-card border border-border overflow-hidden">
        {/* Header - Always Visible */}
        <button
          onClick={() => setSummaryExpanded(!summaryExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="text-base font-semibold text-foreground">
              {viewMode === "month" ? format(currentDate, 'MMMM yyyy') : `Week of ${format(weekStart, 'MMM d')}`} Summary
            </div>
              <div className="flex gap-4 text-sm">
                {efpModeEnabled ? (
                  <>
                  <div>
                      <span className="font-bold text-primary">
                        {calculateEfp(viewTotals.prmr).toFixed(1)}
                      </span>
                    <span className="text-muted-foreground ml-1">EFP</span>
                  </div>
                  <div>
                    <span className="font-bold text-primary">
                      {viewTotals.fpPlus % 1 === 0 ? viewTotals.fpPlus : viewTotals.fpPlus.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground ml-1">FP+</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="font-bold text-primary">
                      {viewTotals.fpPlus % 1 === 0 ? viewTotals.fpPlus : viewTotals.fpPlus.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground ml-1">FP+</span>
                  </div>
                  <div>
                    <span className="font-bold text-primary">${viewTotals.prmr.toFixed(0)}</span>
                    <span className="text-muted-foreground ml-1">PRMR</span>
                  </div>
                </>
              )}
            </div>
          </div>
          {summaryExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {/* Period-over-Period Comparison (always visible when not expanded) */}
        {!summaryExpanded && prevPeriodTotals && prevPeriodTotals.daysWorked > 0 && (
          <div className="px-4 pb-3">
            {(() => {
              const fpChange = viewTotals.fpPlus - prevPeriodTotals.fpPlus;
              const isImproving = fpChange >= 0;
              return (
                <div className={`flex items-center gap-2 text-xs ${
                  isImproving ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                }`}>
                  {isImproving ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span>
                    {isImproving ? "+" : ""}{fpChange.toFixed(1)} FP+ vs {viewMode === "week" ? "last week" : "last month"}
                  </span>
                </div>
              );
            })()}
          </div>
        )}

        {/* Expanded Content */}
        {summaryExpanded && (
          <div className="px-4 pb-4 space-y-6 border-t border-border pt-4">
            {/* View Mode Toggle */}
            <div className="flex gap-2">
              {viewMode === "month" && (
                <Button
                  variant={dataViewMode === "totals" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDataViewMode("totals")}
                >
                  Totals
                </Button>
              )}
              <Button
                variant={dataViewMode === "weekly" ? "default" : "outline"}
                size="sm"
                onClick={() => setDataViewMode("weekly")}
              >
                Weekly Avg
              </Button>
              <Button
                variant={dataViewMode === "daily" ? "default" : "outline"}
                size="sm"
                onClick={() => setDataViewMode("daily")}
                disabled={viewTotals.daysWorked === 0}
              >
                Daily Avg
              </Button>
            </div>

            {dataViewMode === "totals" && viewTotals.daysWorked > 0 && (
              <div className="text-xs text-muted-foreground">
                {viewTotals.daysWorked} total knocking day{viewTotals.daysWorked !== 1 ? 's' : ''}
              </div>
            )}
            
            {dataViewMode === "weekly" && viewTotals.daysWorked > 0 && viewTotals.daysWorked < 6 && (
              <div className="text-xs text-muted-foreground">
                Based on {viewTotals.daysWorked} day{viewTotals.daysWorked !== 1 ? 's' : ''} worked
              </div>
            )}
            
            {dataViewMode === "daily" && viewTotals.daysWorked > 0 && (
              <div className="text-xs text-muted-foreground">
                Based on {viewTotals.daysWorked} day{viewTotals.daysWorked !== 1 ? 's' : ''} worked
              </div>
            )}

            {/* Show averaged metrics when viewing averages */}
            {(dataViewMode === "weekly" || dataViewMode === "daily") && (
              <div className="flex gap-6 pt-2 pb-4 border-b border-border">
                {efpModeEnabled ? (
                  <>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">
                        {dataViewMode === "weekly" ? "Weekly Avg" : "Daily Avg"} EFP
                      </div>
                      <div className="text-2xl font-semibold text-primary">
                        {dataViewMode === "weekly" 
                          ? viewTotals.daysWorked < 6 && viewTotals.daysWorked > 0
                            ? (((viewTotals.prmr / viewTotals.daysWorked) * 6) / 85).toFixed(1)
                            : (viewTotals.prmr / 6 / 85).toFixed(1)
                          : viewTotals.daysWorked > 0
                            ? (viewTotals.prmr / viewTotals.daysWorked / 85).toFixed(1)
                            : "0.0"
                        }
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">
                        {dataViewMode === "weekly" ? "Weekly Avg" : "Daily Avg"} FP+
                      </div>
                      <div className="text-2xl font-semibold text-primary">
                        {dataViewMode === "weekly" 
                          ? viewTotals.daysWorked < 6 && viewTotals.daysWorked > 0
                            ? ((viewTotals.fpPlus / viewTotals.daysWorked) * 6).toFixed(1)
                            : (viewTotals.fpPlus / 6).toFixed(1)
                          : viewTotals.daysWorked > 0
                            ? (viewTotals.fpPlus / viewTotals.daysWorked).toFixed(1)
                            : "0.0"
                        }
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">
                        {dataViewMode === "weekly" ? "Weekly Avg" : "Daily Avg"} FP+
                      </div>
                      <div className="text-2xl font-semibold text-primary">
                        {dataViewMode === "weekly" 
                          ? viewTotals.daysWorked < 6 && viewTotals.daysWorked > 0
                            ? ((viewTotals.fpPlus / viewTotals.daysWorked) * 6).toFixed(1)
                            : (viewTotals.fpPlus / 6).toFixed(1)
                          : viewTotals.daysWorked > 0
                            ? (viewTotals.fpPlus / viewTotals.daysWorked).toFixed(1)
                            : "0.0"
                        }
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">
                        {dataViewMode === "weekly" ? "Weekly Avg" : "Daily Avg"} PRMR
                      </div>
                      <div className="text-2xl font-semibold text-primary">
                        ${dataViewMode === "weekly" 
                          ? viewTotals.daysWorked < 6 && viewTotals.daysWorked > 0
                            ? (((viewTotals.prmr / viewTotals.daysWorked) * 6)).toFixed(0)
                            : (viewTotals.prmr / 6).toFixed(0)
                          : viewTotals.daysWorked > 0
                            ? (viewTotals.prmr / viewTotals.daysWorked).toFixed(0)
                            : "0"
                        }
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Activity Counters */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Doors Knocked</div>
                <div className="text-2xl font-semibold text-foreground">{getDisplayValue(viewTotals.doorsKnocked)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Decision Makers</div>
                <div className="text-2xl font-semibold text-foreground">{getDisplayValue(viewTotals.decisionMakers)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Pitches</div>
                <div className="text-2xl font-semibold text-foreground">{getDisplayValue(viewTotals.pitches)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Transitions</div>
                <div className="text-2xl font-semibold text-foreground">{getDisplayValue(viewTotals.transitions)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Presentations</div>
                <div className="text-2xl font-semibold text-foreground">{getDisplayValue(viewTotals.presentations)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Closes</div>
                <div className="text-2xl font-semibold text-foreground">{getDisplayValue(viewTotals.closes)}</div>
              </div>
            </div>

            {/* FP+ Breakdown - Use sales_log data for accuracy */}
            {(viewTotals.fpCount > 0 || viewTotals.upgradeCount > 0) && (
              <div className="pt-4 border-t border-border">
                <div className="text-sm font-semibold text-foreground mb-3">FP+ Breakdown</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">FP</div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      {viewTotals.fpCount}
                    </div>
                    {(dataViewMode === "weekly" || dataViewMode === "daily") && viewTotals.daysWorked > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Avg {dataViewMode === "weekly" 
                          ? viewTotals.daysWorked < 6
                            ? ((viewTotals.fpCount / viewTotals.daysWorked) * 6).toFixed(1)
                            : (viewTotals.fpCount / 6).toFixed(1)
                          : (viewTotals.fpCount / viewTotals.daysWorked).toFixed(1)
                        } / day
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Upgrade FP+</div>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {(viewTotals.upgradePrmrTotal / 85).toFixed(1)}
                    </div>
                    {(dataViewMode === "weekly" || dataViewMode === "daily") && viewTotals.daysWorked > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Avg {dataViewMode === "weekly" 
                          ? viewTotals.daysWorked < 6
                            ? (((viewTotals.upgradePrmrTotal / 85) / viewTotals.daysWorked) * 6).toFixed(1)
                            : ((viewTotals.upgradePrmrTotal / 85) / 6).toFixed(1)
                          : ((viewTotals.upgradePrmrTotal / 85) / viewTotals.daysWorked).toFixed(1)
                        } / day
                      </div>
                    )}
                  </div>
                  {viewTotals.fpCount > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Avg PRMR per FP</div>
                      <div className="text-lg font-bold text-primary">
                        ${Math.round(viewTotals.fpPrmrTotal / viewTotals.fpCount)}
                      </div>
                    </div>
                  )}
                  {viewTotals.upgradeCount > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Avg PRMR per Upgrade</div>
                      <div className="text-lg font-bold text-primary">
                        ${Math.round(viewTotals.upgradePrmrTotal / viewTotals.upgradeCount)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mini Funnel Teaser - Relative visualization */}
            {viewTotals.doorsKnocked > 0 && viewTotals.closes > 0 && (
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-muted-foreground">Quick Funnel</h4>
                  <button 
                    onClick={() => window.location.href = '/insights'}
                    className="text-xs text-primary hover:underline"
                  >
                    See full analysis →
                  </button>
                </div>
                <div className="space-y-1">
                  {/* Doors bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">Doors</span>
                    <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
                      <div className="bg-muted h-full" style={{ width: '100%' }} />
                    </div>
                    <span className="text-xs font-semibold w-10 text-right">{viewTotals.doorsKnocked}</span>
                  </div>
                  {/* Pitches bar */}
                  {viewTotals.pitches > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">Pitches</span>
                      <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-primary/40 h-full" 
                          style={{ width: `${Math.min((viewTotals.pitches / viewTotals.doorsKnocked) * 100, 100)}%` }} 
                        />
                      </div>
                      <span className="text-xs font-semibold w-10 text-right">{viewTotals.pitches}</span>
                    </div>
                  )}
                  {/* Closes bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">Closes</span>
                    <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-primary h-full" 
                        style={{ width: `${Math.min((viewTotals.closes / viewTotals.doorsKnocked) * 100, 100)}%` }} 
                      />
                    </div>
                    <span className="text-xs font-semibold w-10 text-right">{viewTotals.closes}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Ratios - What it takes to sell */}
            {viewTotals.closes > 0 && (
              <div className="pt-4 border-t border-border">
                <div className="text-sm font-semibold text-foreground mb-3">What it takes to sell</div>
                <div className="grid grid-cols-2 gap-6">
                  {/* Activity Column */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Doors</span>
                      <span className="font-semibold text-foreground text-base">
                        {(viewTotals.doorsKnocked / viewTotals.closes).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Pitches</span>
                      <span className="font-semibold text-foreground text-base">
                        {(viewTotals.pitches / viewTotals.closes).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Transitions</span>
                      <span className="font-semibold text-foreground text-base">
                        {(viewTotals.transitions / viewTotals.closes).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Presentations</span>
                      <span className="font-semibold text-foreground text-base">
                        {(viewTotals.presentations / viewTotals.closes).toFixed(1)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Time Column */}
                  <div className="space-y-2 text-sm">
                    {viewTotals.totalWorkMinutes > 0 && viewTotals.fpPlus > 0 && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Hours per {efpModeEnabled ? 'EFP' : 'FP+'}</span>
                          <span className="font-semibold text-foreground text-base">
                            {(() => {
                              const value = efpModeEnabled ? ((viewTotals.prmr + viewTotals.upgradePrmr) / 85) : viewTotals.fpPlus;
                              const minutesPerFp = viewTotals.totalWorkMinutes / value;
                              const hours = Math.floor(minutesPerFp / 60);
                              const minutes = Math.round(minutesPerFp % 60);
                              return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Pitches per hour</span>
                          <span className="font-semibold text-foreground text-base">
                            {viewTotals.totalWorkMinutes > 0 
                              ? ((viewTotals.pitches / viewTotals.totalWorkMinutes) * 60).toFixed(1)
                              : '-'
                            }
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Transitions per hour</span>
                          <span className="font-semibold text-foreground text-base">
                            {viewTotals.totalWorkMinutes > 0 
                              ? ((viewTotals.transitions / viewTotals.totalWorkMinutes) * 60).toFixed(1)
                              : '-'
                            }
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Presentations per hour</span>
                          <span className="font-semibold text-foreground text-base">
                            {viewTotals.totalWorkMinutes > 0 
                              ? ((viewTotals.presentations / viewTotals.totalWorkMinutes) * 60).toFixed(1)
                              : '-'
                            }
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
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
      />
    </div>
  );
};