import { Lock, BarChart3 } from "lucide-react";
import { useRepData } from "@/hooks/useRepData";
import { Card, CardContent } from "@/components/ui/card";
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
}

const Track = ({
  entry,
  onCounterChange,
  onStartWork,
  onEndWork,
  onStartBreak,
  onEndBreak,
  onUpdateTime,
}: TrackProps) => {
  const { repData, loading: loadingRepData } = useRepData();

  // Get custom counter config for Vets/Sophomores
  const customCounterConfig = Array.isArray(repData?.custom_counter_config)
    ? (repData.custom_counter_config as any[]).map((c: any) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
      }))
    : [];
  
  // Check if user is a pre-blitz rookie
  const year = repData?.year || "Rookie";
  const isRookie = year === "Rookie";
  
  // Check if rookie has attended a blitz (any blitz with endDate in the past)
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];
  const hasAttendedBlitz = blitzes.some((blitz: any) => {
    if (blitz.endDate) {
      const endDate = new Date(blitz.endDate);
      return endDate < new Date();
    }
    return false;
  });

  const isPreBlitzRookie = isRookie && !hasAttendedBlitz;

  // Show loading state while fetching rep data - render layout immediately to prevent flash
  if (loadingRepData) {
    return (
      <div className="min-h-screen bg-background" />
    );
  }

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
          />
        </div>
      </div>
    </div>
  );
};

export default Track;
