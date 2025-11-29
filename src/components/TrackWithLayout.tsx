import { useState, useRef, useCallback, useEffect } from "react";
import Layout from "./Layout";
import Track from "@/pages/Track";
import { SaveEntrySheet } from "./SaveEntrySheet";
import { ResetConfirmSheet } from "./ResetConfirmSheet";
import { useDailyEntry } from "@/hooks/useDailyEntry";

const TrackWithLayout = () => {
  const { entry, updateCounter, finalizeEntry, resetEntry, isFinalizing, isResetting } = useDailyEntry();
  const [isSaveSheetOpen, setIsSaveSheetOpen] = useState(false);
  const [isResetSheetOpen, setIsResetSheetOpen] = useState(false);
  
  // Debounce refs for batching rapid updates
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<any>({});
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const handleCounterChange = useCallback(async (field: string, value: number) => {
    const updates: any = { [field]: Math.max(0, value) };
    
    // Auto-end break if one is active when counter is tapped
    const breakPeriods = entry.break_periods || [];
    const currentBreak = breakPeriods.find(bp => !bp.end);
    if (currentBreak) {
      const updatedBreaks = breakPeriods.map(bp => 
        bp === currentBreak ? { ...bp, end: new Date().toISOString() } : bp
      );
      updates.break_periods = updatedBreaks;
    }
    
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
    
    // Accumulate updates
    pendingUpdatesRef.current = {
      ...pendingUpdatesRef.current,
      ...updates
    };
    
    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // Set new timeout to batch updates
    updateTimeoutRef.current = setTimeout(async () => {
      const batchedUpdates = { ...pendingUpdatesRef.current };
      pendingUpdatesRef.current = {};
      await updateCounter(batchedUpdates);
    }, 300); // 300ms debounce
  }, [entry, updateCounter]);

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

  return (
    <>
      <Layout
        onSave={() => setIsSaveSheetOpen(true)}
        onReset={() => setIsResetSheetOpen(true)}
        isSaving={isFinalizing}
        isResetting={isResetting}
      >
        <Track
          entry={entry}
          updateCounter={updateCounter}
          onCounterChange={handleCounterChange}
          onStartWork={handleStartWork}
          onEndWork={handleEndWork}
          onStartBreak={handleStartBreak}
          onEndBreak={handleEndBreak}
          onUpdateTime={handleUpdateTime}
        />
      </Layout>

      {/* Save Entry Sheet */}
      <SaveEntrySheet
        open={isSaveSheetOpen}
        onOpenChange={setIsSaveSheetOpen}
        entry={entry}
        date={new Date()}
        onSave={finalizeEntry}
        isSaving={isFinalizing}
      />

      {/* Reset Confirm Sheet */}
      <ResetConfirmSheet
        open={isResetSheetOpen}
        onOpenChange={setIsResetSheetOpen}
        onConfirm={resetEntry}
        isResetting={isResetting}
      />
    </>
  );
};

export default TrackWithLayout;
