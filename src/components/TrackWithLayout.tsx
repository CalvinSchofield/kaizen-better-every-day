import { useState, useCallback, useEffect } from "react";
import Layout from "./Layout";
import Track from "@/pages/Track";
import { SaveEntrySheet } from "./SaveEntrySheet";
import { ResetConfirmSheet } from "./ResetConfirmSheet";
import { PreviousDayReviewSheet } from "./PreviousDayReviewSheet";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { supabase } from "@/integrations/supabase/client";
import { useRepData } from "@/hooks/useRepData";
import confetti from "canvas-confetti";

const TrackWithLayout = () => {
  const { repData } = useRepData();
  const { entry, updateCounter, finalizeEntry, resetEntry, isFinalizing, isResetting } = useDailyEntry();
  const [isSaveSheetOpen, setIsSaveSheetOpen] = useState(false);
  const [isResetSheetOpen, setIsResetSheetOpen] = useState(false);
  const [previousDayEntry, setPreviousDayEntry] = useState<any>(null);
  const [isPreviousDayReviewOpen, setIsPreviousDayReviewOpen] = useState(false);

  // Get custom counter config
  const customCounterConfig = Array.isArray(repData?.custom_counter_config)
    ? (repData.custom_counter_config as any[]).map((c: any) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        hidden: c.hidden,
      }))
    : [];

  // Get counter layout config
  const counterLayoutConfig = (repData as any)?.counter_layout_config || undefined;

  // Check for unsaved work from previous days on mount
  useEffect(() => {
    const checkPreviousDayWork = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use local timezone to prevent timezone-related date mismatches
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;
      
      // Query for unfinalized entries before today
      const { data: entries } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_finalized', false)
        .lt('entry_date', today)
        .order('entry_date', { ascending: false })
        .limit(1);

      if (entries && entries.length > 0) {
        const entry = entries[0];
        // Only show if there's actual activity
        const hasActivity = entry.doors_knocked > 0 || 
                          entry.decision_makers > 0 || 
                          entry.pitches > 0 || 
                          entry.transitions > 0 || 
                          entry.presentations > 0 || 
                          entry.closes > 0;
        
        if (hasActivity) {
          setPreviousDayEntry(entry);
          setIsPreviousDayReviewOpen(true);
        }
      }
    };

    checkPreviousDayWork();
  }, []);

  // Auto-save at midnight if work is in progress
  useEffect(() => {
    const checkMidnightAutoSave = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Check if it's midnight (00:00-00:05) and there's unsaved work
      if (hours === 0 && minutes < 5 && entry.work_start_time && !entry.is_finalized) {
        const hasActivity = entry.doors_knocked > 0 || 
                          entry.decision_makers > 0 || 
                          entry.pitches > 0 || 
                          entry.transitions > 0 || 
                          entry.presentations > 0 || 
                          entry.closes > 0;
        
        if (hasActivity) {
          // Auto-save with current data
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayDate = yesterday.toISOString().split('T')[0];
          
          finalizeEntry({
            ...entry,
            saveDate: yesterdayDate,
            work_end_time: entry.work_end_time || new Date(now.getTime() - 5 * 60000).toISOString(), // 5 minutes ago
          });
        }
      }
    };

    // Check every minute
    const interval = setInterval(checkMidnightAutoSave, 60000);
    return () => clearInterval(interval);
  }, [entry, finalizeEntry]);

  // Handle save - only reset UI state, don't overwrite the finalized entry
  const handleSave = async (data: any) => {
    await finalizeEntry(data);
    // Note: Do NOT call resetEntry() here - it would overwrite the just-saved entry
    // The UI will naturally reset when the user navigates away or the page refreshes
  };

  // Handle previous day save
  const handlePreviousDaySave = async (data: { 
    fp_plus: number; 
    prmr: number; 
    work_end_time: string;
    saveDate: string;
    upgrade_prmr?: number | null;
  }) => {
    if (!previousDayEntry) return;
    
    await finalizeEntry({
      doors_knocked: previousDayEntry.doors_knocked,
      decision_makers: previousDayEntry.decision_makers,
      pitches: previousDayEntry.pitches,
      transitions: previousDayEntry.transitions,
      presentations: previousDayEntry.presentations,
      closes: previousDayEntry.closes,
      fp_plus: data.fp_plus,
      prmr: data.prmr,
      upgrade_prmr: data.upgrade_prmr,
      work_start_time: previousDayEntry.work_start_time,
      work_end_time: data.work_end_time,
      saveDate: data.saveDate,
    });
    
    setPreviousDayEntry(null);
  };

  // Handle previous day discard
  const handlePreviousDayDiscard = async () => {
    if (!previousDayEntry) return;
    
    const { error } = await supabase
      .from('daily_entries')
      .delete()
      .eq('id', previousDayEntry.id);
    
    if (!error) {
      setPreviousDayEntry(null);
    }
  };

  // Get latest counter timestamp from previous day entry
  const getLatestCounterTimestamp = (entry: any) => {
    if (!entry?.counter_timestamps) return null;
    
    let latestTimestamp: string | null = null;
    Object.values(entry.counter_timestamps as Record<string, string[]>).forEach(timestamps => {
      if (timestamps && timestamps.length > 0) {
        const latest = timestamps[timestamps.length - 1];
        if (!latestTimestamp || new Date(latest) > new Date(latestTimestamp)) {
          latestTimestamp = latest;
        }
      }
    });
    
    return latestTimestamp;
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
    
    // Trigger confetti on close (only when adding)
    if (field === 'closes' && isAdding) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
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
          counterTimestamps={entry.counter_timestamps}
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
        customCounterConfig={customCounterConfig}
        counterLayoutConfig={counterLayoutConfig}
      />

      {/* Reset Confirm Sheet */}
      <ResetConfirmSheet
        open={isResetSheetOpen}
        onOpenChange={setIsResetSheetOpen}
        onConfirm={resetEntry}
        isResetting={isResetting}
      />

      {/* Previous Day Review Sheet */}
      {previousDayEntry && (
        <PreviousDayReviewSheet
          open={isPreviousDayReviewOpen}
          onOpenChange={setIsPreviousDayReviewOpen}
          entry={previousDayEntry}
          entryDate={previousDayEntry.entry_date}
          latestCounterTimestamp={getLatestCounterTimestamp(previousDayEntry)}
          onSave={handlePreviousDaySave}
          onDiscard={handlePreviousDayDiscard}
          isSaving={isFinalizing}
        />
      )}
    </>
  );
};

export default TrackWithLayout;
