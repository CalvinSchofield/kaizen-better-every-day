import { useState, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Lock, BarChart3, Calendar, Loader2 } from "lucide-react";
import { useRepData } from "@/hooks/useRepData";
import { useRookieUnlockStatus } from "@/hooks/useRookieUnlockStatus";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TimeTrackingBar } from "@/components/TimeTrackingBar";
import { QTallyGrid } from "@/components/QTallyGrid";
import { SalesLoggerCard } from "@/components/SalesLoggerCard";
import { BulkEntryWarning } from "@/components/ui/BulkEntryWarning";
import { DailyEntry, Sale } from "@/hooks/useDailyEntry";
import { detectBulkEntry } from "@/utils/bulkEntryDetector";
import {
  ActivityRingHero,
  FinalizedDayHeader,
  FinalizedStatsGrid,
  RingGoalProgress,
  ActivityCalendarDrawer,
  BulkEntryCoaching,
} from "@/components/activity-ring";
import { PreWorkingState } from "@/components/track";

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
}: TrackProps) => {
  const { repData, loading: loadingRepData, isInitializing } = useRepData();
  const userIdData = useCurrentUserId();
  const userId = userIdData.userId;
  
  // Check if user is a pre-blitz rookie - use centralized hook (must be before early returns)
  const { isPreBlitzRookie } = useRookieUnlockStatus(repData);
  
  // Calendar drawer state for finalized view
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Bulk entry warning state
  const [showBulkWarning, setShowBulkWarning] = useState(false);
  const rapidTapCountRef = useRef(0);
  const rapidTapTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    return (
      <div className="flex flex-col h-full overflow-y-auto pb-24 relative">
        {/* Subtle refreshing indicator for finalized view */}
        {isRefreshing && (
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-2 bg-background/80 backdrop-blur-sm">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mr-1.5" />
            <span className="text-xs text-muted-foreground">Syncing data...</span>
          </div>
        )}
        {/* Finalized Day Header with Calendar Access */}
        <div className="flex items-center justify-between mx-4 mt-4 mb-2">
          <div className="flex-1">
            <FinalizedDayHeader
              workStart={entry.work_start_time}
              workEnd={entry.work_end_time}
              entryDate={'entry_date' in entry ? entry.entry_date : undefined}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowCalendar(true)}
            className="h-10 w-10 rounded-full bg-muted/50 hover:bg-muted ml-2 flex-shrink-0"
          >
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>

        {/* Activity Ring Hero - replaces QTallyGrid */}
        <div className="px-4 py-6 flex justify-center">
          <ActivityRingHero
            entry={entry}
            counterTimestamps={counterTimestamps}
            salesLog={salesLog}
            showGoalRing={true}
            size="lg"
          />
        </div>

        {/* Bulk Entry Coaching for Reps - simple, money-focused */}
        {bulkEntryStats.bulkEntryDetected && (
          <BulkEntryCoaching
            batchedEventsPercent={bulkEntryStats.batchedEventsPercent}
            largestBatch={bulkEntryStats.largestBatch}
            className="mb-4"
          />
        )}

        {/* Stats summary grid */}
        <FinalizedStatsGrid
          entry={entry}
          salesLog={salesLog}
          className="mb-4"
        />

        {/* Goal progress context */}
        <RingGoalProgress
          className="mb-4"
        />

        {/* Sales Logger Card - Show when enabled and has sales */}
        {salesLoggerEnabled && salesLog.length > 0 && onEditSale && onDeleteSale && (
          <div className="px-4 pb-4">
            <SalesLoggerCard
              salesLog={salesLog}
              onEditSale={onEditSale}
              onDeleteSale={onDeleteSale}
            />
          </div>
        )}

        {/* Activity Calendar Drawer */}
        {userId && (
          <ActivityCalendarDrawer
            open={showCalendar}
            onOpenChange={setShowCalendar}
            userId={userId}
            selectedDate={new Date()}
            onSelectDate={(date) => {
              // For now, just close - in future could navigate to that day's details
              setShowCalendar(false);
            }}
          />
        )}
      </div>
    );
  }

  // Pre-working state - show mission briefing before day starts
  if (!entry.work_start_time) {
    return (
      <PreWorkingState
        repName={repData?.name}
        onStartDay={onStartWork}
      />
    );
  }

  // Active tracking state - show normal counters with entrance animation
  return (
    <div className="flex flex-col h-full">
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
