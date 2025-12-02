import { Lock, BarChart3 } from "lucide-react";
import { useRepData } from "@/hooks/useRepData";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TimeTrackingBar } from "@/components/TimeTrackingBar";
import { QTallyGrid } from "@/components/QTallyGrid";
import { DailyEntry } from "@/hooks/useDailyEntry";

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
  counterTimestamps?: Record<string, string[]>;
}

const Track = ({
  entry,
  onCounterChange,
  onStartWork,
  onEndWork,
  onStartBreak,
  onEndBreak,
  onUpdateTime,
  counterTimestamps,
}: TrackProps) => {
  const { repData, loading: loadingRepData, isInitializing } = useRepData();

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

  // Show skeleton loader while initializing auth OR loading data - prevents flash of wrong content
  if (isInitializing || (loadingRepData && !repData)) {
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
  
  // Check if user is a pre-blitz rookie - only after data is loaded
  const year = repData?.year || "Rookie";
  const isRookie = year === "Rookie";
  
  // Check if rookie has attended a blitz OR is currently on an active blitz
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];
  
  const now = new Date();
  const hasAttendedOrOnBlitz = blitzes.some((blitz: any) => {
    if (!blitz.date || !blitz.endDate) return false;
    
    // Check if today matches the blitz start date (unlock immediately on blitz day)
    // Use local date, not UTC, to avoid timezone conversion issues
    const yearNum = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yearNum}-${month}-${day}`;
    const blitzStartStr = blitz.date;
    const isStartingToday = todayStr === blitzStartStr;
    
    // Check if blitz is currently active (between start and end date)
    const startDate = new Date(blitz.date + 'T00:00:00');
    const endDate = new Date(blitz.endDate + 'T23:59:59');
    const isCurrentlyActive = now >= startDate && now <= endDate;
    
    // Check if blitz has ended (past)
    const hasEnded = endDate < now;
    
    return isStartingToday || isCurrentlyActive || hasEnded;
  });

  const isPreBlitzRookie = isRookie && !hasAttendedOrOnBlitz;

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
        />
      </div>

      {/* Counter Grid - Fills all remaining space */}
      <div className="flex-1 px-4 pt-4 pb-4 overflow-hidden">
        <div className="h-full">
          <QTallyGrid
            entry={entry}
            onCounterChange={onCounterChange}
            customCounterConfig={customCounterConfig}
            counterLayoutConfig={counterLayoutConfig}
          />
        </div>
      </div>
    </div>
  );
};

export default Track;
