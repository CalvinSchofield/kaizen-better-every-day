import { useState, useRef, useCallback } from "react";
import { Lock, BarChart3 } from "lucide-react";
import { useRepData } from "@/hooks/useRepData";
import { useRookieUnlockStatus } from "@/hooks/useRookieUnlockStatus";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TimeTrackingBar } from "@/components/TimeTrackingBar";
import { QTallyGrid } from "@/components/QTallyGrid";
import { SalesLoggerCard } from "@/components/SalesLoggerCard";
import { BulkEntryWarning } from "@/components/ui/BulkEntryWarning";
import { DailyEntry, Sale } from "@/hooks/useDailyEntry";
import {
  ActivityRingHero,
  FinalizedDayHeader,
  FinalizedStatsGrid,
  RingGoalProgress,
} from "@/components/activity-ring";

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
}: TrackProps) => {
  const { repData, loading: loadingRepData, isInitializing } = useRepData();
  
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

  // Only show skeleton if truly initializing AND we have no entry data
  // If we have cached entry data, show it instantly - Monarch-style
  const hasEntryData = entry && (entry.doors_knocked > 0 || entry.work_start_time);
  
  if (isInitializing && !hasEntryData) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 p-4">
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
        <div className="flex-1 px-4 pt-4 pb-4">
          <div className="grid grid-cols-2 gap-3 h-full">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-full min-h-[100px] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // Check if user is a pre-blitz rookie - use centralized hook
  const { isPreBlitzRookie } = useRookieUnlockStatus(repData);

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
      <div className="flex flex-col h-full overflow-y-auto pb-24">
        {/* Finalized Day Header */}
        <FinalizedDayHeader
          workStart={entry.work_start_time}
          workEnd={entry.work_end_time}
          entryDate={'entry_date' in entry ? entry.entry_date : undefined}
        />

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
      </div>
    );
  }

  // Active tracking state - show normal counters
  return (
    <div className="flex flex-col h-full">
      {/* Time Tracking Bar */}
      <div className="flex-shrink-0">
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
      </div>

      {/* Bulk Entry Warning Banner */}
      <BulkEntryWarning 
        show={showBulkWarning} 
        onDismiss={() => setShowBulkWarning(false)} 
      />

      {/* Counter Grid - Fills remaining space */}
      <div className="flex-1 px-4 pt-4 pb-4 overflow-hidden flex flex-col gap-4">
        <div className="flex-1 min-h-0">
          <QTallyGrid
            entry={entry}
            onCounterChange={onCounterChange}
            customCounterConfig={customCounterConfig}
            counterLayoutConfig={counterLayoutConfig}
            isLoading={isLoadingEntry}
            counterTimestamps={counterTimestamps}
            onRapidTapDetected={handleRapidTapDetected}
          />
        </div>
        
        {/* Sales Logger Card - Only show when enabled and has sales */}
        {salesLoggerEnabled && salesLog.length > 0 && onEditSale && onDeleteSale && (
          <div className="flex-shrink-0">
            <SalesLoggerCard
              salesLog={salesLog}
              onEditSale={onEditSale}
              onDeleteSale={onDeleteSale}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Track;
