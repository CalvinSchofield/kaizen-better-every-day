import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Circle, AlignJustify, ExternalLink, MessageSquare } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { EffortResult } from "@/utils/effortScore";
import { RepGoalSnapshot } from "./RepGoalSnapshot";
import { useGoalPaceCalculatorForUser } from "@/hooks/useGoalPaceCalculatorForUser";
import { useRepDrillDownData } from "@/hooks/useRepDrillDownData";
import { useRepDayActivity } from "@/hooks/useRepDayActivity";
import { useRepActivityCalendar } from "@/hooks/useRepActivityCalendar";
import { useRepComparison } from "@/hooks/useRepComparison";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { RepPeriodKpis } from "./RepPeriodKpis";
import { RepTimingChart } from "./RepTimingChart";
import { RingSegment } from "@/utils/inHomeZoneCalculator";
import { Sale } from "@/hooks/useDailyEntry";
import { 
  ActivityRingHero, 
  FinalizedStatsGrid, 
  WeekActivityStrip,
  ActivityCalendarDrawer,
  ActivityRingLegend,
  LegendTriggerButton,
  SegmentDetailDrawer,
  SalesLogDrawer,
  HorizontalActivityTimeline,
} from "@/components/activity-ring";
import { format, isSameDay, parseISO, getDay } from "date-fns";
import { calculateEfp } from "@/utils/efp";

interface RepDrillDownData {
  userId: string;
  name: string;
  year?: string;
  teamName?: string;
  phone?: string;
  photoUrl?: string;
  
  doors: number;
  dms: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp: number;
  prmr: number;
  hoursWorked: number;
  effort: EffortResult;
  workStartTime?: string;
  workEndTime?: string;
  coachingFocus?: string;
}

interface RepDrillDownDrawerProps {
  rep: RepDrillDownData | null;
  isOpen: boolean;
  onClose: () => void;
  onSendSms?: (phone: string, message: string) => void;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  /** Date preset from reports page (today, week, month, etc.) */
  datePreset?: string;
}

export const RepDrillDownDrawer = ({
  rep,
  isOpen,
  onClose,
  onSendSms,
  dateRangeStart,
  dateRangeEnd,
  datePreset = 'today',
}: RepDrillDownDrawerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<RingSegment | null>(null);
  const [selectedSegmentSale, setSelectedSegmentSale] = useState<Sale | null>(null);
  const [showSalesLog, setShowSalesLog] = useState(false);
  const [viewMode, setViewMode] = useState<'ring' | 'timeline'>('ring');
  const [showTimingChart, setShowTimingChart] = useState(false);
  
  const userId = isOpen && rep ? rep.userId : undefined;
  
  const downlineGoalPace = useGoalPaceCalculatorForUser(userId);
  const { data: extendedData, isLoading: isLoadingExtended } = useRepDrillDownData(userId);
  const { data: calendarData } = useRepActivityCalendar(userId);
  const { data: dayActivity, isFetching: isDayActivityFetching } = useRepDayActivity(userId, selectedDate);
  
  // Comparison data for the period
  const dateRange = useMemo(() => ({
    start: dateRangeStart ? format(dateRangeStart, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    end: dateRangeEnd ? format(dateRangeEnd, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
  }), [dateRangeStart, dateRangeEnd]);

  const {
    currentTotals,
    comparisonTotals,
    sparklineHistory,
    comparisonLabel,
    isLoading: comparisonLoading,
  } = useRepComparison({
    userId,
    dateRange,
    preset: datePreset,
  });

  // Timing data comes from the comparison hook's raw entries
  // We'll use a separate small query for timing since DaySummary doesn't have work times
  const timingQuery = useQuery({
    queryKey: ['rep-timing', userId, dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date, work_start_time, work_end_time, break_periods, timezone')
        .eq('user_id', userId)
        .gte('entry_date', dateRange.start)
        .lte('entry_date', dateRange.end)
        .not('work_start_time', 'is', null);
      if (error) throw error;
      return (data || []).map(e => {
        let hoursWorked = 0;
        if (e.work_start_time && e.work_end_time) {
          let mins = (new Date(e.work_end_time).getTime() - new Date(e.work_start_time).getTime()) / 60000;
          if (e.break_periods && Array.isArray(e.break_periods)) {
            (e.break_periods as any[]).forEach((bp: any) => {
              const bMins = (new Date(bp.end).getTime() - new Date(bp.start).getTime()) / 60000;
              if (bMins > 0) mins -= bMins;
            });
          }
          hoursWorked = Math.max(0, mins) / 60;
        }
        return {
          date: e.entry_date,
          startTime: e.work_start_time,
          endTime: e.work_end_time,
          hoursWorked,
          timezone: e.timezone,
        };
      });
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  const timingDays = timingQuery.data || [];

  // Compute avg start/end times in rep's local timezone
  const avgTimes = useMemo(() => {
    const valid = timingDays.filter(d => d.startTime && d.endTime);
    if (valid.length === 0) return { avgStart: null, avgEnd: null };
    
    const toLocalHours = (iso: string, tz?: string | null): number => {
      if (tz) {
        try {
          const d = new Date(iso);
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false,
          }).formatToParts(d);
          const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
          const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
          return h + m / 60;
        } catch { /* fallback */ }
      }
      const d = new Date(iso);
      return d.getHours() + d.getMinutes() / 60;
    };

    let sumStart = 0, sumEnd = 0;
    valid.forEach(d => {
      sumStart += toLocalHours(d.startTime!, d.timezone);
      sumEnd += toLocalHours(d.endTime!, d.timezone);
    });
    const avgS = sumStart / valid.length;
    const avgE = sumEnd / valid.length;

    const fmt = (hrs: number) => {
      const h = Math.floor(hrs);
      const m = Math.round((hrs - h) * 60);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return m > 0 ? `${h12}:${m.toString().padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
    };

    return { avgStart: fmt(avgS), avgEnd: fmt(avgE) };
  }, [timingDays]);

  // Period label
  const periodLabel = useMemo(() => {
    const labels: Record<string, string> = {
      today: 'Today', yesterday: 'Yesterday', week: 'This Week', lastWeek: 'Last Week',
      month: 'This Month', lastMonth: 'Last Month', preseason: 'Preseason', ytd: 'YTD',
    };
    return labels[datePreset] || 'Selected Period';
  }, [datePreset]);
  
  // Auto-select best date
  useEffect(() => {
    if (!isOpen) { setHasAutoSelected(false); return; }
    if (hasAutoSelected) return;
    
    const rangeEnd = dateRangeEnd || new Date();
    const rangeStart = dateRangeStart || rangeEnd;
    
    if (calendarData?.summaries && calendarData.summaries.length > 0) {
      const rangeStartStr = format(rangeStart, 'yyyy-MM-dd');
      const rangeEndStr = format(rangeEnd, 'yyyy-MM-dd');
      const daysInRange = calendarData.summaries
        .filter(s => s.hasWork && s.date >= rangeStartStr && s.date <= rangeEndStr)
        .sort((a, b) => b.date.localeCompare(a.date));
      
      if (daysInRange.length > 0) {
        setSelectedDate(parseISO(daysInRange[0].date));
        setHasAutoSelected(true);
        return;
      }
    }
    setSelectedDate(rangeEnd);
    setHasAutoSelected(true);
  }, [isOpen, calendarData, dateRangeStart?.getTime(), dateRangeEnd?.getTime(), hasAutoSelected]);

  const isToday = isSameDay(selectedDate, new Date());
  const displayData = isToday 
    ? {
        doors: rep?.doors ?? 0, dms: rep?.dms ?? 0, pitches: rep?.pitches ?? 0,
        transitions: rep?.transitions ?? 0, presentations: rep?.presentations ?? 0,
        closes: rep?.closes ?? 0, fp: rep?.fp ?? 0, prmr: rep?.prmr ?? 0,
        hoursWorked: rep?.hoursWorked ?? 0,
        workStartTime: rep?.workStartTime, workEndTime: rep?.workEndTime,
      }
    : {
        doors: dayActivity?.doors || 0, dms: dayActivity?.dms || 0, pitches: dayActivity?.pitches || 0,
        transitions: dayActivity?.transitions || 0, presentations: dayActivity?.presentations || 0,
        closes: dayActivity?.closes || 0, fp: dayActivity?.fp || 0, prmr: dayActivity?.prmr || 0,
        hoursWorked: dayActivity?.hoursWorked || 0,
        workStartTime: dayActivity?.workStartTime, workEndTime: dayActivity?.workEndTime,
      };

  const goalData = useMemo(() => {
    const efpModeEnabled = extendedData?.efpModeEnabled ?? false;
    const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';
    const todayMetric = efpModeEnabled ? calculateEfp(displayData.prmr) : displayData.fp;
    const isPreseason = extendedData?.isPreseason ?? true;
    const focusTier = extendedData?.goals?.focusTier;
    const seasonGoal = isPreseason 
      ? extendedData?.goals?.preseasonGoal || 0
      : focusTier === 'couldDo' ? extendedData?.goals?.couldGoal || 0
        : focusTier === 'willDo' ? extendedData?.goals?.willGoal || 0
          : extendedData?.goals?.mustGoal || 0;
    const paceInfo = isPreseason ? extendedData?.goalPace?.preseason
      : focusTier === 'couldDo' ? extendedData?.goalPace?.couldDo
        : focusTier === 'willDo' ? extendedData?.goalPace?.willDo
          : extendedData?.goalPace?.mustDo;
    const seasonTotalDays = paceInfo?.totalPlannedDays || 53;
    const dailyGoalRaw = seasonGoal > 0 && seasonTotalDays > 0 ? (seasonGoal / seasonTotalDays) : 0;
    const dailyGoal = dailyGoalRaw > 0 ? dailyGoalRaw : 2;
    const ringGoalProgress = dailyGoal > 0 ? (todayMetric / dailyGoal) * 100 : 0;
    return { metricLabel, todayMetric, dailyGoal, ringGoalProgress };
  }, [extendedData, displayData.fp, displayData.prmr]);

  if (!rep) return null;

  const getFirstName = (name: string) => {
    const stripped = name.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
    return stripped.split(' ')[0] || stripped;
  };

  const workStart = dayActivity?.workStartTime ? parseISO(dayActivity.workStartTime) : null;
  const workEnd = dayActivity?.workEndTime ? parseISO(dayActivity.workEndTime) : (workStart ? new Date() : null);
  const totalWorkMinutes = workStart && workEnd ? (workEnd.getTime() - workStart.getTime()) / (1000 * 60) : 0;

  const handleSegmentClick = (segment: RingSegment, matchedSale?: Sale) => {
    setSelectedSegment(segment);
    setSelectedSegmentSale(matchedSale || null);
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[92vh] z-[60]">
        {/* Header */}
        <DrawerHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ProfileAvatar
                userId={rep.userId}
                name={rep.name}
                photoUrl={rep.photoUrl}
                className="h-10 w-10"
                fallbackClassName="text-sm"
                onBeforeNavigate={onClose}
              />
              <div>
                <div className="flex items-center gap-2">
                  <DrawerTitle className="text-lg">{rep.name}</DrawerTitle>
                  {rep.year && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{rep.year}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {rep.teamName && <span>{rep.teamName}</span>}
                  {rep.teamName && <span className="opacity-40">·</span>}
                  <span className="text-primary/80 font-medium">{periodLabel}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {rep.phone && onSendSms && (
                <Button variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => {
                    const msg = `Hey ${getFirstName(rep.name)}, checking in - how's it going out there?`;
                    onSendSms(rep.phone!, msg);
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto">
          {/* Period Overview KPIs */}
          <div className="p-4 border-b bg-muted/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{periodLabel}</h3>
            </div>
            <RepPeriodKpis
              current={currentTotals}
              comparison={comparisonTotals}
              sparklineHistory={sparklineHistory}
              comparisonLabel={comparisonLabel}
              repName={rep.name}
              periodLabel={periodLabel}
              isLoading={comparisonLoading}
              avgStartTime={avgTimes.avgStart}
              avgEndTime={avgTimes.avgEnd}
              onSummaryRowClick={timingDays.length > 0 ? () => setShowTimingChart(v => !v) : undefined}
              summaryExpanded={showTimingChart}
            />

            {/* Expandable Timing Chart */}
            {showTimingChart && timingDays.length > 0 && (
              <div className="mt-2">
                <RepTimingChart days={timingDays} />
              </div>
            )}
          </div>

          {/* Goal Progress */}
          {downlineGoalPace.hasGoals && (
            <div className="p-4 border-b">
              <RepGoalSnapshot
                goalPaceData={downlineGoalPace}
                periodFp={currentTotals?.fp || 0}
                periodLabel={periodLabel}
                dateRangeStart={dateRangeStart}
                dateRangeEnd={dateRangeEnd}
              />
            </div>
          )}

          {/* Day View Section */}
          <div className="border-b bg-muted/20">
            {/* Week Activity Strip */}
            <div className="px-4 py-3">
              <WeekActivityStrip
                daySummaries={calendarData?.summaries || []}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                dailyGoal={goalData.dailyGoal}
              />
            </div>
          </div>

          {/* Date header for non-today */}
          {!isToday && (
            <div className="px-4 py-2 text-center">
              <span className="text-xs font-medium text-muted-foreground">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* Activity Visualization */}
            {(displayData.doors > 0 || displayData.hoursWorked > 0) ? (
              <div className="relative" key={format(selectedDate, 'yyyy-MM-dd')}>
                {/* View toggle + Legend */}
                <div className="absolute top-0 right-0 z-10 flex items-center gap-1">
                  <div className="flex items-center bg-muted/50 rounded-full p-0.5">
                    <button
                      onClick={() => setViewMode('ring')}
                      className={cn(
                        "p-1.5 rounded-full transition-all",
                        viewMode === 'ring' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="Ring view"
                    >
                      <Circle className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('timeline')}
                      className={cn(
                        "p-1.5 rounded-full transition-all",
                        viewMode === 'timeline' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="Timeline view"
                    >
                      <AlignJustify className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <LegendTriggerButton onClick={() => setShowLegend(true)} />
                </div>
                
                {viewMode === 'ring' && (
                  <div className="flex justify-center">
                    <ActivityRingHero
                      entry={{
                        doors_knocked: displayData.doors, decision_makers: displayData.dms,
                        pitches: displayData.pitches, transitions: displayData.transitions,
                        presentations: displayData.presentations, closes: displayData.closes,
                        fp_plus: displayData.fp, prmr: displayData.prmr,
                        is_finalized: !isToday || (dayActivity?.isFinalized ?? false),
                        work_start_time: dayActivity?.workStartTime || displayData.workStartTime || null,
                        work_end_time: dayActivity?.workEndTime || displayData.workEndTime || null,
                        break_periods: dayActivity?.breakPeriods || [],
                        counter_timestamps: dayActivity?.counterTimestamps || {},
                        timezone: extendedData?.timezone || null,
                      }}
                      salesLog={dayActivity?.salesLog as any}
                      metricLabel={goalData.metricLabel}
                      metricValue={goalData.todayMetric}
                      goalProgress={goalData.ringGoalProgress}
                      showGoalRing={goalData.ringGoalProgress > 0}
                      showGapPercent={true}
                      showLegend={false}
                      size="md"
                      onSegmentClick={handleSegmentClick}
                    />
                  </div>
                )}
                
                {viewMode === 'timeline' && (
                  <HorizontalActivityTimeline
                    entry={{
                      doors_knocked: displayData.doors, decision_makers: displayData.dms,
                      pitches: displayData.pitches, transitions: displayData.transitions,
                      presentations: displayData.presentations, closes: displayData.closes,
                      fp_plus: displayData.fp, prmr: displayData.prmr,
                      is_finalized: !isToday || (dayActivity?.isFinalized ?? false),
                      work_start_time: dayActivity?.workStartTime || displayData.workStartTime || null,
                      work_end_time: dayActivity?.workEndTime || displayData.workEndTime || null,
                      break_periods: dayActivity?.breakPeriods || [],
                      counter_timestamps: dayActivity?.counterTimestamps || {},
                      timezone: extendedData?.timezone || null,
                    }}
                    salesLog={dayActivity?.salesLog as any}
                    metricLabel={goalData.metricLabel}
                    metricValue={goalData.todayMetric}
                    goalProgress={goalData.ringGoalProgress}
                    onSegmentClick={handleSegmentClick}
                  />
                )}
              </div>
            ) : isDayActivityFetching ? (
              <div className="flex justify-center py-8">
                <div className="w-[220px] h-[220px] rounded-full bg-muted/30 animate-pulse" />
              </div>
            ) : dayActivity?.hasData === false ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No activity recorded
              </div>
            ) : null}
            
            {/* Stats Grid */}
            <FinalizedStatsGrid
              entry={{
                doors_knocked: displayData.doors, decision_makers: displayData.dms,
                pitches: displayData.pitches, transitions: displayData.transitions,
                presentations: displayData.presentations, closes: displayData.closes,
                fp_plus: displayData.fp, prmr: displayData.prmr,
              }}
              salesLog={dayActivity?.salesLog as any}
              onClosesClick={() => setShowSalesLog(true)}
              onFPClick={() => setShowSalesLog(true)}
              onPRMRClick={() => setShowSalesLog(true)}
            />
          </div>
        </div>
        
        {/* Sub-drawers */}
        {userId && (
          <ActivityCalendarDrawer
            open={showCalendar}
            onOpenChange={setShowCalendar}
            userId={userId}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}
        
        <ActivityRingLegend open={showLegend} onOpenChange={setShowLegend} />
        
        <SegmentDetailDrawer
          open={!!selectedSegment}
          onOpenChange={(open) => !open && setSelectedSegment(null)}
          segment={selectedSegment}
          sale={selectedSegmentSale}
          workStart={workStart}
          workEnd={workEnd}
          totalWorkMinutes={totalWorkMinutes}
          repTimezone={extendedData?.timezone || undefined}
        />
        
        <SalesLogDrawer
          open={showSalesLog}
          onOpenChange={setShowSalesLog}
          salesLog={(dayActivity?.salesLog as any) || []}
          repTimezone={extendedData?.timezone || undefined}
        />
      </DrawerContent>
    </Drawer>
  );
};
