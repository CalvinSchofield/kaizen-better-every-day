import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, BarChart3, Loader2, Calendar } from "lucide-react";
import { useRepData } from "@/hooks/useRepData";
import { useRookieUnlockStatus } from "@/hooks/useRookieUnlockStatus";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { useVisualizationPreference } from "@/hooks/useVisualizationPreference";
import { useEfpMode } from "@/hooks/useEfpMode";
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
  FinalizedStatsGrid,
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

        {/* Compact Stats Sheet - right below visualization */}
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
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Doors</span>
                <span className="font-semibold tabular-nums">{entry.doors_knocked || 0}</span>
              </div>
              <span className="text-border">•</span>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Pitches</span>
                <span className="font-semibold tabular-nums">{entry.pitches || 0}</span>
              </div>
              <span className="text-border">•</span>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Trans</span>
                <span className="font-semibold tabular-nums">{entry.transitions || 0}</span>
              </div>
            </div>
            <motion.span
              className="text-xs text-muted-foreground"
              animate={{ rotate: showStats ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              ▾
            </motion.span>
          </motion.button>
          
          {showStats && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <FinalizedStatsGrid
                entry={entry}
                salesLog={salesLog}
                onClosesClick={() => {
                  if (salesLog.length > 0) {
                    setScrollToSaleId(null);
                    setShowSalesDrawer(true);
                  }
                }}
                onFPClick={() => {
                  if (salesLog.length > 0) {
                    setScrollToSaleId(null);
                    setShowSalesDrawer(true);
                  }
                }}
                onPRMRClick={() => {
                  if (salesLog.length > 0) {
                    setScrollToSaleId(null);
                    setShowSalesDrawer(true);
                  }
                }}
              />
            </motion.div>
          )}
        </div>

        {/* Activity Calendar Drawer */}
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
          onOpenChange={setShowSalesDrawer}
          salesLog={salesLog}
        />

        {/* Segment Detail Drawer - for clicking ring/timeline segments */}
        <SegmentDetailDrawer
          open={showSegmentDetail}
          onOpenChange={setShowSegmentDetail}
          segment={selectedSegment}
          sale={selectedSegmentSale}
          workStart={entry.work_start_time ? parseISO(entry.work_start_time) : null}
          workEnd={entry.work_end_time ? parseISO(entry.work_end_time) : null}
          totalWorkMinutes={
            entry.work_start_time && entry.work_end_time 
              ? differenceInMinutes(parseISO(entry.work_end_time), parseISO(entry.work_start_time))
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
