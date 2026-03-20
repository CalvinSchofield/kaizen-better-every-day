import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { formatFP, formatPRMR } from "@/lib/formatters";
import { motion } from "framer-motion";
import { Lock, BarChart3, Loader2, Calendar } from "lucide-react";
import { useRepData } from "@/hooks/useRepData";
import { useRookieUnlockStatus } from "@/hooks/useRookieUnlockStatus";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { useVisualizationPreference } from "@/hooks/useVisualizationPreference";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useGoalPaceCalculator } from "@/hooks/useGoalPaceCalculator";
import { useSmartActivityGoals } from "@/hooks/useSmartActivityGoals";
import { useHeader } from "@/contexts/HeaderContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TimeTrackingBar } from "@/components/TimeTrackingBar";
import { QTallyGrid } from "@/components/QTallyGrid";
import { SalesLoggerCard } from "@/components/SalesLoggerCard";
import { BulkEntryWarning } from "@/components/ui/BulkEntryWarning";
import { DailyEntry, Sale } from "@/hooks/useDailyEntry";
import { detectBulkEntry } from "@/utils/bulkEntryDetector";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";
import { calculateEfp } from "@/utils/efp";
import { hapticLight } from "@/utils/haptics";
import { addDays, subDays, parseISO, differenceInMinutes } from "date-fns";
import {
  ActivityRingHero,
  ActivityRingLegend,
  FinalizedDayHeader,
  ActivityCalendarDrawer,
  HorizontalActivityTimeline,
  GoalResultCard,
  MeVsMeCard,
  CompetitionsCard,
  CoachingCard,
  DayDetailDrawer,
  SalesLogDrawer,
  UnifiedVisualizationToggle,
  SegmentDetailDrawer,
} from "@/components/activity-ring";
import { RingSegment } from "@/utils/inHomeZoneCalculator";
import { PreWorkingState } from "@/components/track";
import { CompetitorNudgeBanner } from "@/components/track/CompetitorNudgeBanner";
import { PendingInstallAlertCard } from "@/components/PendingInstallAlertCard";

interface TrackProps {
  entry: DailyEntry | {
    doors_knocked: number;
    decision_makers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp_plus: number;
    prmr: number;
    is_finalized: boolean;
    work_start_time: string | null;
    work_end_time: string | null;
    break_periods: Array<{ start: string; end: string }>;
    counter_timestamps: Record<string, string[]>;
    timezone: string | null;
  };
  updateCounter: (updates: Partial<DailyEntry>) => Promise<any>;
  onCounterChange: (field: string, value: number) => Promise<void>;
  onStartWork: () => void;
  onEndWork: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onUpdateTime: (field: 'start' | 'end', time: string) => void;
  onClearEndTime?: () => void;
  counterTimestamps?: Record<string, string[]>;
  salesLog?: Sale[];
  salesLoggerEnabled?: boolean;
  onEditSale?: (sale: Sale) => void;
  onDeleteSale?: (saleId: string) => void;
  isLoadingEntry?: boolean;
  isRefreshing?: boolean;
  competitorNudge?: { name: string; metric: string; metricLabel: string; timeframe: string; gap: number; userValue: number; competitorValue: number } | null;
  competitorLoading?: boolean;
}

const Track = ({
  entry,
  onCounterChange,
  onStartWork,
  onEndWork,
  onStartBreak,
  onEndBreak,
  onUpdateTime,
  onClearEndTime,
  counterTimestamps,
  salesLog = [],
  salesLoggerEnabled = false,
  onEditSale,
  onDeleteSale,
  isLoadingEntry = false,
  isRefreshing = false,
  competitorNudge,
  competitorLoading,
}: TrackProps) => {
  const { repData, loading: loadingRepData, isInitializing } = useRepData();
  const userIdData = useCurrentUserId();
  const userId = userIdData.userId;
  
  // Check if user is a pre-blitz rookie - use centralized hook (must be before early returns)
  const { isPreBlitzRookie } = useRookieUnlockStatus(repData);
  
  // EFP mode for vets
  const { efpModeEnabled } = useEfpMode();
  
  // Smart activity goals
  const goalPaceData = useGoalPaceCalculator();
  const isRookie = repData?.year === 'Rookie';
  const dailyFpGoal = goalPaceData.hasGoals ? Math.round(goalPaceData.dailyNeeded * 10) / 10 : 1;
  const smartGoals = useSmartActivityGoals({ dailyFpGoal, isRookie });
  
  // Visualization preference (ring vs timeline)
  const { mode: visualizationMode, toggle: toggleVisualization } = useVisualizationPreference();
  
  // Header context for setting right content
  const { setCustomRightContent } = useHeader();
  
  // Drawer states for finalized view
  const [showCalendar, setShowCalendar] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showSalesDrawer, setShowSalesDrawer] = useState(false);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [showSegmentDetail, setShowSegmentDetail] = useState(false);
  const [selectedHistoricalDate, setSelectedHistoricalDate] = useState(new Date());
  const [selectedSaleForDrawer, setSelectedSaleForDrawer] = useState<Sale | null>(null);
  const [scrollToSaleId, setScrollToSaleId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<RingSegment | null>(null);
  const [selectedSegmentSale, setSelectedSegmentSale] = useState<Sale | null>(null);
  
  // Set header calendar button when finalized
  useEffect(() => {
    if (entry.is_finalized) {
      setCustomRightContent(
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            hapticLight();
            setShowCalendar(true);
          }}
          className="h-10 w-10"
          aria-label="View activity history"
        >
          <Calendar className="h-5 w-5" />
        </Button>
      );
    } else {
      setCustomRightContent(null);
    }
    
    // Cleanup on unmount
    return () => setCustomRightContent(null);
  }, [entry.is_finalized, setCustomRightContent]);
  
  // Bulk entry warning state
  const [showBulkWarning, setShowBulkWarning] = useState(false);
  const rapidTapCountRef = useRef(0);
  const rapidTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Callback for when rapid tapping is detected on any counter
  const handleRapidTapDetected = useCallback(() => {
    rapidTapCountRef.current += 1;
    
    // Start or reset the 30 second window
    if (rapidTapTimerRef.current) {
      clearTimeout(rapidTapTimerRef.current);
    }
    
    rapidTapTimerRef.current = setTimeout(() => {
      rapidTapCountRef.current = 0;
    }, 30000);
    
    // If 10+ rapid tap events in 30 seconds, show warning
    if (rapidTapCountRef.current >= 10) {
      setShowBulkWarning(true);
      rapidTapCountRef.current = 0; // Reset to avoid repeated triggers
    }
  }, []);

  // Get custom counter config for Vets/Sophomores
  const customCounterConfig = Array.isArray(repData?.custom_counter_config)
    ? (repData.custom_counter_config as any[]).map((c: any) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
      }))
    : [];
  
  // Get counter layout config
  const counterLayoutConfig = (repData as any)?.counter_layout_config || undefined;

  // Detect bulk entry for rep coaching (must be before early returns)
  const bulkEntryStats = useMemo(() => {
    const timestamps = counterTimestamps || entry.counter_timestamps || {};
    return detectBulkEntry(timestamps);
  }, [counterTimestamps, entry.counter_timestamps]);

  // Only show skeleton if truly initializing AND we have no entry data
  // If we have cached entry data, show it instantly - Monarch-style
  const hasEntryData = entry && (entry.doors_knocked > 0 || entry.work_start_time);

  // Show locked state for pre-blitz rookies
  if (isPreBlitzRookie) {
    return (
      <div className="min-h-screen bg-background p-4 pb-24 flex items-center justify-center">
        <Card className="w-full max-w-md border-border/40">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <BarChart3 className="h-16 w-16 text-muted-foreground/40" />
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Track Unlocks on Your Blitz!</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your digital tally sheet is waiting for you! Once you start knocking doors on your first blitz, 
                you'll track every door, pitch, and close right here in real-time.
              </p>
            </div>
            <div className="pt-2">
              <p className="text-sm text-primary font-medium">
                Get hyped—your first sale is just around the corner! 💪
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if entry is finalized - show Activity Ring view instead
  if (entry.is_finalized) {
    // Calculate FP and PRMR for goal result card
    const calculated = salesLog.length > 0 
      ? calculateFromSalesLog(salesLog) 
      : { fp: entry.fp_plus || 0, prmr: entry.prmr || 0 };
    const fp = calculated.fp;
    const prmr = 'prmr' in calculated ? calculated.prmr : (entry.prmr || 0);

    return (
      <div className="flex flex-col h-full overflow-y-auto pb-24 relative">
        {/* Subtle refreshing indicator for finalized view */}
        {isRefreshing && (
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-2 bg-background/80 backdrop-blur-sm">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mr-1.5" />
            <span className="text-xs text-muted-foreground">Syncing data...</span>
          </div>
        )}
        
        {/* Finalized Day Header - simplified */}
        <div className="mx-4 mt-4 mb-2">
          <FinalizedDayHeader
            workStart={entry.work_start_time}
            workEnd={entry.work_end_time}
            entryDate={'entry_date' in entry ? entry.entry_date : undefined}
          />
        </div>
        
        {/* Unified Visualization Toggle - outside Day Complete card */}
        <div className="flex justify-end px-4 mb-2">
          <UnifiedVisualizationToggle
            mode={visualizationMode}
            onToggle={toggleVisualization}
            onLegendClick={() => setShowLegend(true)}
          />
        </div>

        {/* Activity Visualization - Ring or Timeline based on preference */}
        <div className="px-4 py-2 flex justify-center">
          {visualizationMode === 'ring' ? (
            <ActivityRingHero
              entry={entry}
              counterTimestamps={counterTimestamps}
              salesLog={salesLog}
              showGoalRing={true}
              size="lg"
              metricLabel={efpModeEnabled ? 'EFP' : 'FP+'}
              metricValue={efpModeEnabled ? calculateEfp(prmr) : fp}
              onSegmentClick={(segment, matchedSale) => {
                setSelectedSegment(segment);
                setSelectedSegmentSale(matchedSale || null);
                setShowSegmentDetail(true);
              }}
            />
          ) : (
            <HorizontalActivityTimeline
              entry={entry}
              counterTimestamps={counterTimestamps}
              salesLog={salesLog}
              onSegmentClick={(segment, matchedSale) => {
                setSelectedSegment(segment);
                setSelectedSegmentSale(matchedSale || null);
                setShowSegmentDetail(true);
              }}
              onSaleChipClick={(sale) => {
                setScrollToSaleId(sale.id || null);
                setShowSalesDrawer(true);
              }}
            />
          )}
        </div>

        {/* Inline Stat Ribbon */}
        <div className="px-4 mt-2">
          <motion.button
            className="w-full flex items-center justify-between py-2 px-1 active:scale-[0.99] transition-transform"
            onClick={() => {
              hapticLight();
              setShowStats(!showStats);
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-1.5 text-[13px] flex-wrap">
              <span className="tabular-nums font-semibold">{entry.doors_knocked || 0}</span>
              <span className="text-muted-foreground">doors</span>
              <span className="text-border">·</span>
              <span className="tabular-nums font-semibold">{entry.pitches || 0}</span>
              <span className="text-muted-foreground">pitches</span>
              <span className="text-border">·</span>
              <span className="tabular-nums font-semibold">{entry.transitions || 0}</span>
              <span className="text-muted-foreground">trans</span>
              <span className="text-border">·</span>
              <span className="tabular-nums font-semibold">{entry.presentations || 0}</span>
              <span className="text-muted-foreground">pres</span>
              <span className="text-border">·</span>
              <span className="tabular-nums font-semibold">{entry.closes || 0}</span>
              <span className="text-muted-foreground">closes</span>
            </div>
            <motion.span
              className="text-xs text-muted-foreground ml-2 flex-shrink-0"
              animate={{ rotate: showStats ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              ▾
            </motion.span>
          </motion.button>
          
          {showStats && (() => {
            const doors = entry.doors_knocked || 0;
            const dms = entry.decision_makers || 0;
            const pitches = entry.pitches || 0;
            const trans = entry.transitions || 0;
            const pres = entry.presentations || 0;
            const closes = entry.closes || 0;
            const dmRate = doors > 0 ? Math.round((dms / doors) * 100) : 0;
            const transRate = pitches > 0 ? Math.round((trans / pitches) * 100) : 0;
            const closeRate = pres > 0 ? Math.round((closes / pres) * 100) : 0;

            return (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="py-2 px-1 space-y-1.5 text-[13px]">
                  {/* Funnel with conversion rates */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Doors</span>
                    <span className="tabular-nums font-medium">{doors}</span>
                  </div>
                  <div className="flex justify-between pl-3">
                    <span className="text-muted-foreground/70">└ DM Rate</span>
                    <span className="tabular-nums text-muted-foreground">{dmRate}% <span className="text-muted-foreground/50">({dms}/{doors})</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pitches</span>
                    <span className="tabular-nums font-medium">{pitches}</span>
                  </div>
                  <div className="flex justify-between pl-3">
                    <span className="text-muted-foreground/70">└ Trans Rate</span>
                    <span className="tabular-nums text-muted-foreground">{transRate}% <span className="text-muted-foreground/50">({trans}/{pitches})</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Presentations</span>
                    <span className="tabular-nums font-medium">{pres}</span>
                  </div>
                  <div className="flex justify-between pl-3">
                    <span className="text-muted-foreground/70">└ Close Rate</span>
                    <span className="tabular-nums text-muted-foreground">{closeRate}% <span className="text-muted-foreground/50">({closes}/{pres})</span></span>
                  </div>

                  {/* FP & PRMR */}
                  <div className="border-t border-border/30 mt-2 pt-2 flex justify-between">
                    <span className="text-muted-foreground">FP+</span>
                    <span className="tabular-nums font-semibold text-primary">{formatFP(fp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PRMR</span>
                    <span className="tabular-nums font-semibold text-primary">${formatPRMR(prmr)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </div>

        {/* Pending Install Alert - actionable after finalizing */}
        <div className="px-4 mt-2">
          <PendingInstallAlertCard alwaysShow />
        </div>

        {/* Contextual Card Stack */}
        <div className="px-4 space-y-3 mt-3">
          {/* Goal Result Card - daily goal progress */}
          <GoalResultCard fpToday={fp} prmrToday={prmr} />

          {/* Me vs Me Card - historical comparison */}
          <MeVsMeCard
            currentFP={fp}
            currentPRMR={prmr}
            currentDoors={entry.doors_knocked || 0}
            entryDate={'entry_date' in entry ? entry.entry_date : undefined}
          />

          {/* Active Competitions */}
          <CompetitionsCard />

          {/* Coaching Insights - tips for tomorrow */}
          <CoachingCard
            workStartTime={entry.work_start_time}
            workEndTime={entry.work_end_time}
            breakPeriods={entry.break_periods}
            counterTimestamps={counterTimestamps}
            dayOfWeek={new Date().getDay()}
            doors={entry.doors_knocked ?? 0}
            pitches={entry.pitches ?? 0}
            transitions={entry.transitions ?? 0}
            presentations={entry.presentations ?? 0}
            closes={entry.closes ?? 0}
            salesLog={salesLog}
            fp={fp}
            prmr={prmr}
          />
        </div>

        {userId && (
          <ActivityCalendarDrawer
            open={showCalendar}
            onOpenChange={setShowCalendar}
            userId={userId}
            selectedDate={selectedHistoricalDate}
            onSelectDate={(date) => {
              setSelectedHistoricalDate(date);
              setShowDayDetail(true);
              setShowCalendar(false);
            }}
          />
        )}

        {/* Day Detail Drawer for historical dates */}
        {userId && (
          <DayDetailDrawer
            open={showDayDetail}
            onOpenChange={setShowDayDetail}
            selectedDate={selectedHistoricalDate}
            onNavigateDay={(direction) => {
              setSelectedHistoricalDate(prev => 
                direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1)
              );
            }}
            userId={userId}
          />
        )}

        {/* Activity Ring Legend Drawer */}
        <ActivityRingLegend
          open={showLegend}
          onOpenChange={setShowLegend}
        />

        {/* Sales Log Drawer */}
        <SalesLogDrawer
          open={showSalesDrawer}
          onOpenChange={(open) => {
            setShowSalesDrawer(open);
            if (!open) setScrollToSaleId(null);
          }}
          salesLog={salesLog}
          scrollToSaleId={scrollToSaleId}
        />

        {/* Segment Detail Drawer - for clicking ring/timeline segments */}
        <SegmentDetailDrawer
          open={showSegmentDetail}
          onOpenChange={setShowSegmentDetail}
          segment={selectedSegment}
          sale={selectedSegmentSale}
          workStart={entry.work_start_time ? parseISO(entry.work_start_time) : null}
          workEnd={entry.work_end_time ? parseISO(entry.work_end_time) : (entry.work_start_time ? new Date() : null)}
          totalWorkMinutes={
            entry.work_start_time 
              ? differenceInMinutes(entry.work_end_time ? parseISO(entry.work_end_time) : new Date(), parseISO(entry.work_start_time))
              : 0
          }
        />
      </div>
    );
  }

  // Pre-working state - show mission briefing before day starts
  if (!entry.work_start_time) {
    return (
      <PreWorkingState
        repName={repData?.name}
        repData={repData}
        onStartDay={onStartWork}
      />
    );
  }

  // Active tracking state - show normal counters with entrance animation
  return (
    <div className="flex flex-col h-full">
      {/* Competitor Nudge Banner - subtle motivational strip */}
      <CompetitorNudgeBanner competitor={competitorNudge as any} loading={competitorLoading} />

      {/* Time Tracking Bar */}
      <motion.div 
        className="flex-shrink-0"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <TimeTrackingBar
          workStartTime={entry.work_start_time}
          workEndTime={entry.work_end_time}
          breakPeriods={entry.break_periods}
          counterTimestamps={counterTimestamps}
          onStartWork={onStartWork}
          onEndWork={onEndWork}
          onStartBreak={onStartBreak}
          onEndBreak={onEndBreak}
          onUpdateTime={onUpdateTime}
          onClearEndTime={onClearEndTime}
        />
      </motion.div>

      {/* Bulk Entry Warning Banner */}
      <BulkEntryWarning 
        show={showBulkWarning} 
        onDismiss={() => setShowBulkWarning(false)} 
      />

      {/* Counter Grid - Fills remaining space with staggered entrance */}
      <motion.div 
        className="flex-1 px-4 pt-4 pb-4 overflow-hidden flex flex-col gap-4"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          duration: 0.5, 
          delay: 0.15,
          ease: [0.25, 0.1, 0.25, 1] 
        }}
      >
        <div className="flex-1 min-h-0">
          <QTallyGrid
            entry={entry}
            onCounterChange={onCounterChange}
            customCounterConfig={customCounterConfig}
            counterLayoutConfig={counterLayoutConfig}
            isLoading={isLoadingEntry}
            isRefreshing={isRefreshing}
            counterTimestamps={counterTimestamps}
            onRapidTapDetected={handleRapidTapDetected}
          />
        </div>
        
        {/* Sales Logger Card - Only show when enabled and has sales */}
        {salesLoggerEnabled && salesLog.length > 0 && onEditSale && onDeleteSale && (
          <motion.div 
            className="flex-shrink-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <SalesLoggerCard
              salesLog={salesLog}
              onEditSale={onEditSale}
              onDeleteSale={onDeleteSale}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default Track;
