import { useState, useCallback } from "react";
import Layout from "./Layout";
import Track from "@/pages/Track";
import { SaveEntrySheet } from "./SaveEntrySheet";
import { ResetConfirmSheet } from "./ResetConfirmSheet";
import { useDailyEntry } from "@/hooks/useDailyEntry";

const TrackWithLayout = () => {
  const { entry, updateCounter, finalizeEntry, resetEntry, isFinalizing, isResetting } = useDailyEntry();
  const [isSaveSheetOpen, setIsSaveSheetOpen] = useState(false);
  const [isResetSheetOpen, setIsResetSheetOpen] = useState(false);

  // Handle save with auto-reset
  const handleSave = async (data: any) => {
    await finalizeEntry(data);
    // Reset counters and timers after successful save
    await resetEntry();
  };

  const handleCounterChange = useCallback(async (field: string, value: number) => {
    // Get current value to determine if adding or subtracting
    const currentValue = field.startsWith('custom_') 
      ? (entry.custom_counters?.[field.replace('custom_', '')] || 0)
      : (entry[field as keyof typeof entry] as number || 0);
    
    const isAdding = value > currentValue;
    const isSubtracting = value < currentValue;
    
    // Immediately trigger optimistic update through mutation
    const updates: any = { [field]: Math.max(0, value) };
    
    // Handle custom counters separately
    if (field.startsWith('custom_')) {
      const customId = field.replace('custom_', '');
      const customCounters = entry.custom_counters || {};
      updates.custom_counters = {
        ...customCounters,
        [customId]: Math.max(0, value),
      };
      delete updates[field]; // Remove the custom_ prefixed field
    }
    
    // Auto-end break if one is active when counter is tapped (only when adding)
    if (isAdding) {
      const breakPeriods = entry.break_periods || [];
      const currentBreak = breakPeriods.find(bp => !bp.end);
      if (currentBreak) {
        const updatedBreaks = breakPeriods.map(bp => 
          bp === currentBreak ? { ...bp, end: new Date().toISOString() } : bp
        );
        updates.break_periods = updatedBreaks;
      }
    }
    
    // Auto-start work time on first counter tap (only when adding)
    if (isAdding && !entry.work_start_time && value > 0) {
      const now = new Date();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      updates.work_start_time = now.toISOString();
      updates.timezone = timezone;
    }
    
    // Handle timestamps: add when increasing, remove when decreasing
    const timestamps = entry.counter_timestamps || {};
    const fieldTimestamps = timestamps[field] || [];
    
    if (isAdding) {
      // Adding: append new timestamp
      updates.counter_timestamps = {
        ...timestamps,
        [field]: [...fieldTimestamps, new Date().toISOString()]
      };
    } else if (isSubtracting) {
      // Subtracting: remove most recent timestamp
      updates.counter_timestamps = {
        ...timestamps,
        [field]: fieldTimestamps.slice(0, -1)
      };
    }
    
    // Immediately call updateCounter for instant optimistic UI update
    await updateCounter(updates);
  }, [entry, updateCounter]);

  const handleStartWork = () => {
    // If work already started but not ended, end it instead
    if (entry.work_start_time && !entry.work_end_time) {
      handleEndWork();
      return;
    }
    
    // Otherwise start work
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
    const currentBreak = breakPeriods.find(bp => !bp.end);
    
    // If break already started but not ended, end it instead
    if (currentBreak) {
      handleEndBreak();
      return;
    }
    
    // Otherwise start break
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
        onSave={handleSave}
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
