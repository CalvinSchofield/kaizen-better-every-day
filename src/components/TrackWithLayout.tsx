import { useState, useCallback, useEffect, useRef } from "react";
import Layout from "./Layout";
import Track from "@/pages/Track";
import { SaveEntrySheet } from "./SaveEntrySheet";
import { ResetConfirmSheet } from "./ResetConfirmSheet";
import { PreviousDayReviewSheet } from "./PreviousDayReviewSheet";
import { EarlySaveConfirmSheet } from "./EarlySaveConfirmSheet";
import { PostSaveSuccessSheet } from "./PostSaveSuccessSheet";
import { SyncIndicator } from "./SyncIndicator";
import { LogSaleSheet, Sale } from "./LogSaleSheet";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { useTrackBackup, getCurrentUserId } from "@/hooks/useTrackBackup";
import { supabase } from "@/integrations/supabase/client";
import { useRepData } from "@/hooks/useRepData";
import confetti from "canvas-confetti";
import { toast } from "sonner";

// Helper to check if it's before typical end of work day (7 PM local)
const isBeforeSunset = () => {
  const now = new Date();
  const hour = now.getHours();
  return hour < 19; // Before 7 PM
};

// Helper to format current time
const formatCurrentTime = () => {
  return new Date().toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
};

// Helper to get today's date in local timezone
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TrackWithLayout = () => {
  const { repData } = useRepData();
  const { entry, updateCounter, finalizeEntry, resetEntry, clearLocalEntry, isFinalizing, isResetting } = useDailyEntry();
  const [isSaveSheetOpen, setIsSaveSheetOpen] = useState(false);
  const [isResetSheetOpen, setIsResetSheetOpen] = useState(false);
  const [previousDayEntry, setPreviousDayEntry] = useState<any>(null);
  const [isPreviousDayReviewOpen, setIsPreviousDayReviewOpen] = useState(false);
  const [isSaveInProgress, setIsSaveInProgress] = useState(false);
  // PROTECTION LAYER 5: Track if entry was saved this session to block further changes
  const [savedThisSession, setSavedThisSession] = useState(false);
  
  // New state for bulletproof features
  const [isEarlySaveConfirmOpen, setIsEarlySaveConfirmOpen] = useState(false);
  const [isPostSaveSuccessOpen, setIsPostSaveSuccessOpen] = useState(false);
  const [lastSavedSummary, setLastSavedSummary] = useState({ doors: 0, presentations: 0, closes: 0, fpPlus: 0, prmr: 0 });
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'error'>('synced');
  
  // Sales logger state
  const [isLogSaleSheetOpen, setIsLogSaleSheetOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [pendingCloseIncrement, setPendingCloseIncrement] = useState(false);
  
  // Local backup for data recovery
  const userId = getCurrentUserId();
  const { saveBackup, loadBackup, clearBackup, hasUnsavedBackup } = useTrackBackup(userId, getTodayDate());
  
  // Debounce ref for batching rapid updates
  const pendingUpdateRef = useRef<any>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // BULLETPROOF: Save backup to localStorage on every entry change
  useEffect(() => {
    if (!entry.is_finalized && userId) {
      const hasActivity = entry.doors_knocked > 0 || 
                         entry.decision_makers > 0 || 
                         entry.pitches > 0 || 
                         entry.transitions > 0 || 
                         entry.presentations > 0 || 
                         entry.closes > 0;
      if (hasActivity) {
        saveBackup(entry);
      }
    }
  }, [entry, userId, saveBackup]);

  // Handle save button click - check if before sunset
  const handleSaveButtonClick = () => {
    // Check if it's before typical end of work day
    if (isBeforeSunset()) {
      setIsEarlySaveConfirmOpen(true);
    } else {
      setIsSaveSheetOpen(true);
    }
  };

  // Handle save - reset local UI state ONLY after confirmed successful save
  const handleSave = async (data: any) => {
    setIsSaveInProgress(true);
    setSyncStatus('pending');
    try {
      await finalizeEntry(data);
      // PROTECTION LAYER 6: Mark session as saved BEFORE clearing UI
      setSavedThisSession(true);
      // Save succeeded - now safe to clear the UI
      clearLocalEntry();
      // Clear localStorage backup
      clearBackup();
      setSyncStatus('synced');
      // Store summary for success sheet
      setLastSavedSummary({
        doors: data.doors_knocked || 0,
        presentations: data.presentations || 0,
        closes: data.closes || 0,
        fpPlus: data.fp_plus || 0,
        prmr: data.prmr || 0,
      });
      // Show success sheet
      setIsPostSaveSuccessOpen(true);
    } catch (error) {
      console.error('Save failed:', error);
      setSyncStatus('error');
      toast.error('Failed to save. Your data is backed up locally.');
      // Don't clear - keep the data visible so user can try again
    } finally {
      setIsSaveInProgress(false);
    }
  };

  // Handle "keep working" after save - unfinalize the entry
  const handleKeepWorkingAfterSave = async () => {
    // Reset the saved state to allow new tracking
    setSavedThisSession(false);
    // The user can now continue tracking - their data will be added to today's entry
    toast.info("You can continue tracking. Your previous data is saved in Calendar.");
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

  // Check if sales logger is enabled
  const salesLoggerEnabled = (repData as any)?.sales_logger_enabled || false;

  const handleCounterChange = useCallback(async (field: string, value: number) => {
    // PROTECTION LAYER 7: Multiple checks to prevent counter changes after save
    if (isSaveInProgress) {
      console.log('Ignoring counter change - save in progress');
      return;
    }
    
    if (savedThisSession) {
      console.log('Ignoring counter change - already saved this session');
      toast.info("Today's work is already saved. Start fresh tomorrow!");
      return;
    }
    
    if (entry.is_finalized) {
      console.log('Ignoring counter change - entry is finalized');
      toast.info("Today's work is already saved. Start fresh tomorrow!");
      return;
    }
    
    // Get current value to determine if adding or subtracting
    const currentValue = field.startsWith('custom_') 
      ? (entry.custom_counters?.[field.replace('custom_', '')] || 0)
      : (entry[field as keyof typeof entry] as number || 0);
    
    const isAdding = value > currentValue;
    const isSubtracting = value < currentValue;
    
    // SALES LOGGER: Intercept closes counter when adding and sales logger is enabled
    if (field === 'closes' && isAdding && salesLoggerEnabled) {
      setPendingCloseIncrement(true);
      setEditingSale(null);
      setIsLogSaleSheetOpen(true);
      return; // Don't increment closes yet - wait for sale to be logged
    }
    
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
    
    // Set sync status to pending
    setSyncStatus('pending');
    
    // Immediately call updateCounter for instant optimistic UI update
    try {
      await updateCounter(updates);
      setSyncStatus('synced');
    } catch (error: any) {
      // PROTECTION: If entry was finalized between checks, show friendly message
      if (error?.message === 'ENTRY_ALREADY_FINALIZED') {
        toast.info("Today's work is already saved. Start fresh tomorrow!");
        setSavedThisSession(true); // Prevent further attempts
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    }
  }, [entry, updateCounter, isSaveInProgress, savedThisSession, salesLoggerEnabled]);

  // Sales logger handlers
  const handleLogSale = useCallback(async (saleData: { type: 'fp' | 'upgrade'; prmr: number }) => {
    if (!pendingCloseIncrement) return;
    
    const newSale: Sale = {
      id: crypto.randomUUID(),
      type: saleData.type,
      prmr: saleData.prmr,
      timestamp: new Date().toISOString(),
    };
    
    const currentSalesLog = entry.sales_log || [];
    const updatedSalesLog = [...currentSalesLog, newSale];
    
    // Increment closes and add sale to log
    const updates: any = {
      closes: (entry.closes || 0) + 1,
      sales_log: updatedSalesLog,
    };
    
    // Handle timestamps
    const timestamps = entry.counter_timestamps || {};
    const closesTimestamps = timestamps['closes'] || [];
    updates.counter_timestamps = {
      ...timestamps,
      closes: [...closesTimestamps, new Date().toISOString()]
    };
    
    // Auto-start work if not started
    if (!entry.work_start_time) {
      const now = new Date();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      updates.work_start_time = now.toISOString();
      updates.timezone = timezone;
    }
    
    // Auto-end break if active
    const breakPeriods = entry.break_periods || [];
    const currentBreak = breakPeriods.find(bp => !bp.end);
    if (currentBreak) {
      const updatedBreaks = breakPeriods.map(bp => 
        bp === currentBreak ? { ...bp, end: new Date().toISOString() } : bp
      );
      updates.break_periods = updatedBreaks;
    }
    
    // Fire confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    setSyncStatus('pending');
    try {
      await updateCounter(updates);
      setSyncStatus('synced');
    } catch (error: any) {
      if (error?.message === 'ENTRY_ALREADY_FINALIZED') {
        toast.info("Today's work is already saved. Start fresh tomorrow!");
        setSavedThisSession(true);
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    }
    
    setPendingCloseIncrement(false);
  }, [entry, updateCounter, pendingCloseIncrement]);

  const handleSkipSaleLog = useCallback(async () => {
    if (!pendingCloseIncrement) return;
    
    // Just increment closes without logging sale
    const updates: any = {
      closes: (entry.closes || 0) + 1,
    };
    
    // Handle timestamps
    const timestamps = entry.counter_timestamps || {};
    const closesTimestamps = timestamps['closes'] || [];
    updates.counter_timestamps = {
      ...timestamps,
      closes: [...closesTimestamps, new Date().toISOString()]
    };
    
    // Auto-start work if not started
    if (!entry.work_start_time) {
      const now = new Date();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      updates.work_start_time = now.toISOString();
      updates.timezone = timezone;
    }
    
    // Auto-end break if active
    const breakPeriods = entry.break_periods || [];
    const currentBreak = breakPeriods.find(bp => !bp.end);
    if (currentBreak) {
      const updatedBreaks = breakPeriods.map(bp => 
        bp === currentBreak ? { ...bp, end: new Date().toISOString() } : bp
      );
      updates.break_periods = updatedBreaks;
    }
    
    // Fire confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    setSyncStatus('pending');
    try {
      await updateCounter(updates);
      setSyncStatus('synced');
    } catch (error: any) {
      if (error?.message === 'ENTRY_ALREADY_FINALIZED') {
        toast.info("Today's work is already saved. Start fresh tomorrow!");
        setSavedThisSession(true);
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    }
    
    setPendingCloseIncrement(false);
  }, [entry, updateCounter, pendingCloseIncrement]);

  const handleEditSale = useCallback((sale: Sale) => {
    setEditingSale(sale);
    setIsLogSaleSheetOpen(true);
  }, []);

  const handleUpdateSale = useCallback(async (updatedSale: Sale) => {
    const currentSalesLog = entry.sales_log || [];
    const updatedSalesLog = currentSalesLog.map(s => 
      s.id === updatedSale.id ? updatedSale : s
    );
    
    setSyncStatus('pending');
    try {
      await updateCounter({ sales_log: updatedSalesLog });
      setSyncStatus('synced');
    } catch (error) {
      setSyncStatus('error');
    }
    
    setEditingSale(null);
  }, [entry.sales_log, updateCounter]);

  const handleDeleteSale = useCallback(async (saleId: string) => {
    const currentSalesLog = entry.sales_log || [];
    const updatedSalesLog = currentSalesLog.filter(s => s.id !== saleId);
    
    // Also decrement closes to keep in sync
    const updates: any = {
      sales_log: updatedSalesLog,
      closes: Math.max(0, (entry.closes || 0) - 1),
    };
    
    // Remove last closes timestamp
    const timestamps = entry.counter_timestamps || {};
    const closesTimestamps = timestamps['closes'] || [];
    if (closesTimestamps.length > 0) {
      updates.counter_timestamps = {
        ...timestamps,
        closes: closesTimestamps.slice(0, -1)
      };
    }
    
    setSyncStatus('pending');
    try {
      await updateCounter(updates);
      setSyncStatus('synced');
    } catch (error) {
      setSyncStatus('error');
    }
    
    setEditingSale(null);
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
        onSave={handleSaveButtonClick}
        onReset={() => setIsResetSheetOpen(true)}
        isSaving={isFinalizing}
        isResetting={isResetting}
        syncIndicator={<SyncIndicator status={syncStatus} />}
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
          salesLog={entry.sales_log || []}
          salesLoggerEnabled={salesLoggerEnabled}
          onEditSale={handleEditSale}
          onDeleteSale={handleDeleteSale}
        />
      </Layout>

      {/* Log Sale Sheet */}
      <LogSaleSheet
        open={isLogSaleSheetOpen}
        onOpenChange={(open) => {
          setIsLogSaleSheetOpen(open);
          if (!open) {
            setPendingCloseIncrement(false);
            setEditingSale(null);
          }
        }}
        onLogSale={handleLogSale}
        onSkip={handleSkipSaleLog}
        editingSale={editingSale}
        onUpdateSale={handleUpdateSale}
        onDeleteSale={handleDeleteSale}
      />

      {/* Early Save Confirmation Sheet */}
      <EarlySaveConfirmSheet
        open={isEarlySaveConfirmOpen}
        onOpenChange={setIsEarlySaveConfirmOpen}
        currentTime={formatCurrentTime()}
        onConfirm={() => setIsSaveSheetOpen(true)}
        onKeepWorking={() => {}}
      />

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
        salesLog={entry.sales_log || []}
      />

      {/* Post-Save Success Sheet */}
      <PostSaveSuccessSheet
        open={isPostSaveSuccessOpen}
        onOpenChange={setIsPostSaveSuccessOpen}
        summary={lastSavedSummary}
        onKeepWorking={handleKeepWorkingAfterSave}
      />

      {/* Reset Confirm Sheet */}
      <ResetConfirmSheet
        open={isResetSheetOpen}
        onOpenChange={setIsResetSheetOpen}
        onConfirm={resetEntry}
        isResetting={isResetting}
        entrySummary={{
          doors: entry.doors_knocked || 0,
          decisionMakers: entry.decision_makers || 0,
          pitches: entry.pitches || 0,
          transitions: entry.transitions || 0,
          presentations: entry.presentations || 0,
          closes: entry.closes || 0,
        }}
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
