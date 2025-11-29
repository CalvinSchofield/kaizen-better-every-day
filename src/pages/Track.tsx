import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Save, Lock, BarChart3 } from "lucide-react";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { QTallyGrid } from "@/components/QTallyGrid";
import { SaveEntrySheet } from "@/components/SaveEntrySheet";
import { ResetConfirmSheet } from "@/components/ResetConfirmSheet";
import { useRepData } from "@/hooks/useRepData";
import { Card, CardContent } from "@/components/ui/card";
import { TimeTrackingBar } from "@/components/TimeTrackingBar";

const Track = () => {
  const { entry, updateCounter, finalizeEntry, resetEntry, isFinalizing, isResetting } = useDailyEntry();
  const { repData, loading: loadingRepData } = useRepData();
  
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
  const [isSaveSheetOpen, setIsSaveSheetOpen] = useState(false);
  const [isResetSheetOpen, setIsResetSheetOpen] = useState(false);

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });

  const handleCounterChange = (field: string, value: number) => {
    const updates: any = { [field]: Math.max(0, value) };
    
    // Auto-start work time on first counter tap
    if (!entry.work_start_time && value > 0) {
      const now = new Date();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      updates.work_start_time = now.toISOString();
      updates.timezone = timezone;
    }
    
    // Add timestamp to counter_timestamps
    const timestamps = entry.counter_timestamps || {};
    const fieldTimestamps = timestamps[field] || [];
    updates.counter_timestamps = {
      ...timestamps,
      [field]: [...fieldTimestamps, new Date().toISOString()]
    };
    
    updateCounter(updates);
  };

  const handleReset = () => {
    resetEntry();
  };

  const handleStartWork = () => {
    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    updateCounter({ 
      work_start_time: now.toISOString(),
      timezone
    });
  };

  const handleEndWork = () => {
    updateCounter({ work_end_time: new Date().toISOString() });
  };

  const handleStartBreak = () => {
    const breakPeriods = entry.break_periods || [];
    updateCounter({
      break_periods: [...breakPeriods, { start: new Date().toISOString(), end: '' }]
    });
  };

  const handleEndBreak = () => {
    const breakPeriods = entry.break_periods || [];
    const currentBreak = breakPeriods.find(bp => !bp.end);
    if (currentBreak) {
      const updatedBreaks = breakPeriods.map(bp => 
        bp === currentBreak ? { ...bp, end: new Date().toISOString() } : bp
      );
      updateCounter({ break_periods: updatedBreaks });
    }
  };

  const handleUpdateTime = (field: 'start' | 'end', time: string) => {
    if (field === 'start') {
      updateCounter({ work_start_time: time });
    } else {
      updateCounter({ work_end_time: time });
    }
  };

  // Show loading state while fetching rep data
  if (loadingRepData) {
    return null;
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
    <div className="bg-background flex flex-col overflow-hidden touch-none h-screen">
      {/* Header */}
      <div className="bg-background px-6 py-4 flex-shrink-0 border-b border-border/40">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Today's Progress</h1>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsSaveSheetOpen(true)}
              disabled={isFinalizing}
              className="h-10 px-4 bg-primary hover:bg-primary-dark text-primary-foreground font-semibold shadow-md"
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsResetSheetOpen(true)}
              disabled={isResetting}
              className="h-10 w-10"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Time Tracking Bar */}
      <TimeTrackingBar
        workStartTime={entry.work_start_time}
        workEndTime={entry.work_end_time}
        breakPeriods={entry.break_periods}
        onStartWork={handleStartWork}
        onEndWork={handleEndWork}
        onStartBreak={handleStartBreak}
        onEndBreak={handleEndBreak}
        onUpdateTime={handleUpdateTime}
      />

      {/* Counter Grid - Fills all available space with safe bottom padding */}
      <div className="flex-1 px-4 pt-4 min-h-0 overflow-hidden" style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}>
        <QTallyGrid
          entry={entry}
          onCounterChange={handleCounterChange}
        />
      </div>

      {/* Save Entry Sheet */}
      <SaveEntrySheet
        open={isSaveSheetOpen}
        onOpenChange={setIsSaveSheetOpen}
        entry={entry}
        date={new Date()} // Track page always saves to today
        onSave={finalizeEntry}
        isSaving={isFinalizing}
      />

      {/* Reset Confirm Sheet */}
      <ResetConfirmSheet
        open={isResetSheetOpen}
        onOpenChange={setIsResetSheetOpen}
        onConfirm={handleReset}
        isResetting={isResetting}
      />
    </div>
  );
};

export default Track;