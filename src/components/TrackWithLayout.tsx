import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "./Layout";
import Track from "@/pages/Track";
import { SaveEntrySheet } from "./SaveEntrySheet";
import { ResetConfirmSheet } from "./ResetConfirmSheet";
import { PreviousDayReviewSheet } from "./PreviousDayReviewSheet";
import { EarlySaveConfirmSheet } from "./EarlySaveConfirmSheet";
import { EarlyEndConfirmSheet } from "./EarlyEndConfirmSheet";
import { PostSaveSuccessSheet } from "./PostSaveSuccessSheet";
import { SyncIndicator } from "./SyncIndicator";
import { LogSaleSheet, Sale } from "./LogSaleSheet";
import { DeleteSalePickerSheet } from "./DeleteSalePickerSheet";
import { NotificationPermissionPrompt } from "./NotificationPermissionPrompt";
import { PageTour } from "./PageTour";
import { useDailyEntry } from "@/hooks/useDailyEntry";
import { useTrackBackup, getCurrentUserId } from "@/hooks/useTrackBackup";
import { useCompetitorNudge } from "@/hooks/useCompetitorNudge";
import { usePageTour } from "@/hooks/usePageTour";
import { trackTourSteps } from "@/config/pageTours";
import { supabase } from "@/integrations/supabase/client";
import { useRepData } from "@/hooks/useRepData";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { hapticSuccess } from "@/utils/haptics";

// Helper to check if it's before typical end of work day (9 PM local - summer hours)
const isBeforeSunset = () => {
  const now = new Date();
  const hour = now.getHours();
  return hour < 21; // Before 9 PM (summer hours)
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { repData } = useRepData();
  const { totalFP: preseasonFP } = usePreseasonFP();
  const { entry, updateCounter, finalizeEntry, resetEntry, clearLocalEntry, isFinalizing, isResetting, isLoading: isLoadingEntry } = useDailyEntry();
  
  // Page tour
  const { showTour, completeTour, skipTour } = usePageTour({
    page: 'track',
    enabled: !!repData && !isLoadingEntry,
  });

  // Enable demo mode when tour starts to prevent any data changes
  useEffect(() => {
    if (showTour) {
      setIsTourDemoMode(true);
    }
  }, [showTour]);
  const [isSaveSheetOpen, setIsSaveSheetOpen] = useState(false);
  const [isResetSheetOpen, setIsResetSheetOpen] = useState(false);
  const [unfinalizedEntries, setUnfinalizedEntries] = useState<any[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [isPreviousDayReviewOpen, setIsPreviousDayReviewOpen] = useState(false);
  const [isSaveInProgress, setIsSaveInProgress] = useState(false);
  // PROTECTION LAYER 5: Track if entry was saved this session to block further changes
  const [savedThisSession, setSavedThisSession] = useState(false);
  
  // New state for bulletproof features
  const [isEarlySaveConfirmOpen, setIsEarlySaveConfirmOpen] = useState(false);
  const [isEarlyEndConfirmOpen, setIsEarlyEndConfirmOpen] = useState(false);
  const [isPostSaveSuccessOpen, setIsPostSaveSuccessOpen] = useState(false);
  const [lastSavedSummary, setLastSavedSummary] = useState({ doors: 0, dms: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0, fpPlus: 0, prmr: 0, hoursWorked: 0 });
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'offline' | 'error'>('synced');
  
  // Sales logger state
  const [isLogSaleSheetOpen, setIsLogSaleSheetOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [pendingCloseIncrement, setPendingCloseIncrement] = useState(false);
  const [isDeleteSalePickerOpen, setIsDeleteSalePickerOpen] = useState(false);
  const [isTourDemoMode, setIsTourDemoMode] = useState(false); // Prevents real data changes during tour
  const [tourForceUpgrade, setTourForceUpgrade] = useState(false); // Force upgrade mode in sale sheet
  const [tourForceCalculatorOpen, setTourForceCalculatorOpen] = useState(false); // Force calculator open
  
  // Local backup for data recovery
  const userId = getCurrentUserId();
  const { saveBackup, loadBackup, clearBackup, hasUnsavedBackup } = useTrackBackup(userId, getTodayDate());
  
  // Competitor nudge for early save motivation
  const { competitor: competitorNudge, loading: competitorLoading } = useCompetitorNudge();
  
  // Debounce ref for batching rapid updates
  const pendingUpdateRef = useRef<any>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Rapid-tap detection: track recent taps per field
  const recentTapsRef = useRef<Record<string, number[]>>({});
  const rapidTapWarningShownRef = useRef(false);
  
  // Handle ?prompt=save or ?save=true URL parameter (from push notification or home alert)
  useEffect(() => {
    const shouldOpenSave = searchParams.get('prompt') === 'save' || searchParams.get('save') === 'true';
    if (shouldOpenSave) {
      // Wait a short moment for entry data to load, then open save sheet
      const timer = setTimeout(() => {
        if (entry.work_start_time && !entry.is_finalized) {
          setIsSaveSheetOpen(true);
        }
        // Clear the URL parameters
        searchParams.delete('prompt');
        searchParams.delete('save');
        setSearchParams(searchParams, { replace: true });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams, entry.work_start_time, entry.is_finalized]);
  
  // Track if user has started tracking (for notification prompt)
  const hasStartedTracking = entry.work_start_time !== null && !entry.is_finalized;

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

  // Check for ALL unsaved work from previous days on mount
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
      
      // Query for ALL unfinalized entries before today (no limit)
      const { data: entries } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_finalized', false)
        .lt('entry_date', today)
        .order('entry_date', { ascending: true }); // Show oldest first

      if (entries && entries.length > 0) {
        // Filter to only entries with actual activity
        const entriesWithActivity = entries.filter(entry => 
          entry.doors_knocked > 0 || 
          entry.decision_makers > 0 || 
          entry.pitches > 0 || 
          entry.transitions > 0 || 
          entry.presentations > 0 || 
          entry.closes > 0
        );
        
        if (entriesWithActivity.length > 0) {
          setUnfinalizedEntries(entriesWithActivity);
          setCurrentReviewIndex(0);
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

  // OFFLINE SUPPORT: Background sync when coming back online
  useEffect(() => {
    const handleOnline = async () => {
      // Check if we have unsaved backup data that needs syncing
      const backup = loadBackup();
      if (backup && hasUnsavedBackup(entry)) {
        setSyncStatus('pending');
        toast.info('Syncing your offline data...', { icon: '🔄', duration: 2000 });
        try {
          await updateCounter(backup);
          clearBackup();
          setSyncStatus('synced');
          toast.success('Offline data synced!', { duration: 3000 });
        } catch {
          setSyncStatus('error');
          toast.error('Sync failed - will retry later');
        }
      } else if (syncStatus === 'offline') {
        // Just came back online, update status
        setSyncStatus('synced');
      }
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [loadBackup, hasUnsavedBackup, entry, updateCounter, clearBackup, syncStatus]);

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
    // OFFLINE PROTECTION: Block finalization when offline
    if (!navigator.onLine) {
      toast.error('Cannot save while offline. Please reconnect and try again.', {
        description: 'Your data is safely backed up locally.',
        duration: 5000,
      });
      return;
    }
    
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
      // Store summary for success sheet (including Me vs Me comparison data)
      // Calculate hours worked from start/end times
      let hoursWorked = 0;
      if (data.work_start_time && data.work_end_time) {
        const start = new Date(data.work_start_time);
        const end = new Date(data.work_end_time);
        hoursWorked = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
        
        // Subtract break time
        if (data.break_periods && Array.isArray(data.break_periods)) {
          const breakMinutes = data.break_periods.reduce((total: number, bp: any) => {
            if (bp.start && bp.end) {
              return total + (new Date(bp.end).getTime() - new Date(bp.start).getTime()) / (1000 * 60);
            }
            return total;
          }, 0);
          hoursWorked = Math.max(0, hoursWorked - breakMinutes / 60);
        }
      }
      
      setLastSavedSummary({
        doors: data.doors_knocked || 0,
        dms: data.decision_makers || 0,
        pitches: data.pitches || 0,
        transitions: data.transitions || 0,
        presentations: data.presentations || 0,
        closes: data.closes || 0,
        fpPlus: data.fp_plus || 0,
        prmr: data.prmr || 0,
        hoursWorked,
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

  // Get current entry being reviewed from the queue
  const currentReviewEntry = unfinalizedEntries[currentReviewIndex] || null;
  const totalUnfinalizedCount = unfinalizedEntries.length;
  const remainingCount = totalUnfinalizedCount - currentReviewIndex;

  // Move to next entry in queue or close if done
  const advanceToNextEntry = () => {
    if (currentReviewIndex < unfinalizedEntries.length - 1) {
      setCurrentReviewIndex(prev => prev + 1);
    } else {
      // All entries processed
      setUnfinalizedEntries([]);
      setCurrentReviewIndex(0);
      setIsPreviousDayReviewOpen(false);
    }
  };

  // Handle previous day save
  const handlePreviousDaySave = async (data: { 
    fp_plus: number; 
    prmr: number; 
    work_end_time: string;
    saveDate: string;
    upgrade_prmr?: number | null;
  }) => {
    if (!currentReviewEntry) return;
    
    await finalizeEntry({
      doors_knocked: currentReviewEntry.doors_knocked,
      decision_makers: currentReviewEntry.decision_makers,
      pitches: currentReviewEntry.pitches,
      transitions: currentReviewEntry.transitions,
      presentations: currentReviewEntry.presentations,
      closes: currentReviewEntry.closes,
      fp_plus: data.fp_plus,
      prmr: data.prmr,
      upgrade_prmr: data.upgrade_prmr,
      work_start_time: currentReviewEntry.work_start_time,
      work_end_time: data.work_end_time,
      saveDate: data.saveDate,
    });
    
    advanceToNextEntry();
  };

  // Handle previous day discard
  const handlePreviousDayDiscard = async () => {
    if (!currentReviewEntry) return;
    
    const { error } = await supabase
      .from('daily_entries')
      .delete()
      .eq('id', currentReviewEntry.id);
    
    if (!error) {
      advanceToNextEntry();
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

  // Sales logger is now enabled by default for all users
  const salesLoggerEnabled = true;

  // Show PRMR helper for all rookies or any rep with less than 20 FP+
  const isRookie = repData?.year === "Rookie";
  const showPrmrHelper = isRookie || preseasonFP < 20;

  const handleCounterChange = useCallback(async (field: string, value: number) => {
    // CRITICAL PROTECTION: Block counter changes while data is still loading
    // This prevents overwriting existing data with zeros + new tap
    if (isLoadingEntry) {
      console.log('BLOCKED: Counter change while data is loading - this would overwrite existing data');
      toast.error('Please wait for your data to load before tracking', { duration: 3000 });
      return;
    }
    
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

    // PROTECTION LAYER 8: Block all changes during tour demo mode
    if (isTourDemoMode) {
      console.log('Ignoring counter change - tour demo mode active');
      return;
    }
    
    // Get current value to determine if adding or subtracting
    const currentValue = field.startsWith('custom_') 
      ? (entry.custom_counters?.[field.replace('custom_', '')] || 0)
      : (entry[field as keyof typeof entry] as number || 0);
    
    const isAdding = value > currentValue;
    const isSubtracting = value < currentValue;
    
    // RAPID-TAP DETECTION: Track taps and warn if 5+ taps in 30 seconds
    if (isAdding && !field.startsWith('custom_')) {
      const now = Date.now();
      const fieldTaps = recentTapsRef.current[field] || [];
      
      // Keep only taps from last 60 seconds
      const recentFieldTaps = [...fieldTaps.filter(t => now - t < 60000), now];
      recentTapsRef.current[field] = recentFieldTaps;
      
      // Check if 5+ taps in last 30 seconds
      const last30SecondsTaps = recentFieldTaps.filter(t => now - t < 30000);
      if (last30SecondsTaps.length >= 5 && !rapidTapWarningShownRef.current) {
        rapidTapWarningShownRef.current = true;
        toast.warning("Slow down! 🐢", {
          description: "If you're catching up on data, consider using Calendar to log previous days.",
          duration: 6000,
        });
        // Reset warning flag after 2 minutes
        setTimeout(() => {
          rapidTapWarningShownRef.current = false;
        }, 120000);
      }
    }
    
    // SALES LOGGER: Intercept closes counter when adding and sales logger is enabled
    // Block if LogSaleSheet is already open to prevent orphaned closes
    if (field === 'closes' && isAdding && salesLoggerEnabled) {
      if (isLogSaleSheetOpen || pendingCloseIncrement) {
        // Already logging a sale - ignore this tap
        return;
      }
      setPendingCloseIncrement(true);
      setEditingSale(null);
      setIsLogSaleSheetOpen(true);
      return; // Don't increment closes yet - wait for sale to be logged
    }
    
    // SALES LOGGER: Intercept closes counter when subtracting and there are logged sales
    // Show picker to choose which sale to delete instead of just decrementing
    const salesLog = entry.sales_log || [];
    if (field === 'closes' && isSubtracting && salesLoggerEnabled && salesLog.length > 0) {
      setIsDeleteSalePickerOpen(true);
      return; // Don't decrement closes yet - wait for sale selection
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
      } else if (!navigator.onLine) {
        // OFFLINE SUPPORT: Show friendly offline message
        setSyncStatus('offline');
        toast.info('Saved locally - will sync when online', { 
          icon: '📶',
          duration: 3000 
        });
      } else {
        // Connection issue but online
        setSyncStatus('error');
        toast.error('Connection issue - your data is backed up locally', {
          duration: 4000
        });
      }
    }
  }, [entry, updateCounter, isSaveInProgress, savedThisSession, salesLoggerEnabled, isLoadingEntry]);

  // Sales logger handlers
  const handleLogSale = useCallback(async (saleData: Omit<Sale, 'id' | 'timestamp'>) => {
    // Block during tour demo mode
    if (isTourDemoMode) return;
    if (!pendingCloseIncrement) return;
    
    const newSale: Sale = {
      id: crypto.randomUUID(),
      ...saleData,
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
    
    // Fire confetti and haptic
    hapticSuccess();
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
    // Block during tour demo mode
    if (isTourDemoMode) return;
    
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
    // Block during tour demo mode
    if (isTourDemoMode) return;
    
    // Check if it's before sunset (7 PM)
    if (isBeforeSunset()) {
      setIsEarlyEndConfirmOpen(true);
      return;
    }
    updateCounter({ work_end_time: new Date().toISOString() });
  };

  const handleConfirmEndWork = () => {
    updateCounter({ work_end_time: new Date().toISOString() });
  };

  const handleClearEndTime = () => {
    updateCounter({ work_end_time: null });
    toast.success("End time cleared — you can keep tracking!");
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
      // Fix timezone/day rollover: if end time is before start time, 
      // the user likely worked past midnight and we need to ensure proper ordering
      const startTime = entry.work_start_time;
      let endTime = new Date(time);
      
      if (startTime) {
        const start = new Date(startTime);
        
        // If end time appears to be before start time, it means the time picker
        // set the time on the wrong day. Add 24 hours to fix it.
        if (endTime < start) {
          endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
        }
        
        // Also handle the reverse case: if end time is MORE than 24 hours after start,
        // the user probably meant the same day (subtract 24 hours)
        const hoursDiff = (endTime.getTime() - start.getTime()) / (1000 * 60 * 60);
        if (hoursDiff > 18) {
          // If they worked "18+ hours", they probably meant same day - subtract a day
          const sameDayEnd = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
          // Only use same-day if it's still after start
          if (sameDayEnd > start) {
            endTime = sameDayEnd;
          }
        }
      }
      
      updateCounter({ work_end_time: endTime.toISOString() });
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
        {/* Notification Permission Prompt */}
        <NotificationPermissionPrompt hasStartedTracking={hasStartedTracking} />
        
        <Track
          entry={entry}
          updateCounter={updateCounter}
          onCounterChange={handleCounterChange}
          onStartWork={handleStartWork}
          onEndWork={handleEndWork}
          onStartBreak={handleStartBreak}
          onEndBreak={handleEndBreak}
          onUpdateTime={handleUpdateTime}
          onClearEndTime={handleClearEndTime}
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
          // Don't allow closing during tour demo mode (they need to complete tour)
          if (isTourDemoMode && !open) return;
          setIsLogSaleSheetOpen(open);
          if (!open) {
            setPendingCloseIncrement(false);
            setEditingSale(null);
            setTourForceUpgrade(false);
            setTourForceCalculatorOpen(false);
          }
        }}
        onLogSale={handleLogSale}
        editingSale={editingSale}
        onUpdateSale={handleUpdateSale}
        onDeleteSale={handleDeleteSale}
        showPrmrHelper={showPrmrHelper}
        crmEnabled={(repData as any)?.crm_enabled || false}
        crmDetailedEnabled={(repData as any)?.crm_detailed_enabled || false}
        counterTimestamps={entry.counter_timestamps}
        tourForceUpgrade={tourForceUpgrade}
        tourForceCalculatorOpen={tourForceCalculatorOpen}
      />

      {/* Delete Sale Picker Sheet */}
      <DeleteSalePickerSheet
        open={isDeleteSalePickerOpen}
        onOpenChange={setIsDeleteSalePickerOpen}
        salesLog={entry.sales_log || []}
        closesCount={entry.closes || 0}
        onDeleteSale={handleDeleteSale}
        onDecrementOrphanedClose={async () => {
          // Decrement closes counter without deleting a sale
          // This handles the case where closes > sales_log.length
          const newClosesCount = Math.max(0, (entry.closes || 0) - 1);
          const timestamps = entry.counter_timestamps || {} as Record<string, string[]>;
          const closesTimestamps: string[] = (timestamps as any).closes || [];
          
          // Find and remove the orphaned timestamp (one that doesn't match any sale)
          const salesLog = entry.sales_log || [];
          const saleTimestamps = salesLog.map(s => s.timestamp);
          const orphanedTimestamps = closesTimestamps.filter(t => !saleTimestamps.includes(t));
          
          // Remove the most recent orphaned timestamp, or just the most recent if none found
          let updatedTimestamps = [...closesTimestamps];
          if (orphanedTimestamps.length > 0) {
            const timestampToRemove = orphanedTimestamps[orphanedTimestamps.length - 1];
            updatedTimestamps = closesTimestamps.filter(t => t !== timestampToRemove);
          } else {
            updatedTimestamps = closesTimestamps.slice(0, -1);
          }
          
          await updateCounter({
            closes: newClosesCount,
            counter_timestamps: {
              ...timestamps,
              closes: updatedTimestamps
            }
          });
          toast.success("Removed extra close");
        }}
      />

      {/* Early Save Confirmation Sheet */}
      <EarlySaveConfirmSheet
        open={isEarlySaveConfirmOpen}
        onOpenChange={setIsEarlySaveConfirmOpen}
        currentTime={formatCurrentTime()}
        competitor={competitorNudge}
        loading={competitorLoading}
        onConfirm={() => setIsSaveSheetOpen(true)}
        onKeepWorking={() => {}}
      />

      {/* Early End Confirmation Sheet */}
      <EarlyEndConfirmSheet
        open={isEarlyEndConfirmOpen}
        onOpenChange={setIsEarlyEndConfirmOpen}
        currentTime={formatCurrentTime()}
        onConfirm={handleConfirmEndWork}
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

      {/* Previous Day Review Sheet - handles multi-day queue */}
      {currentReviewEntry && (
        <PreviousDayReviewSheet
          open={isPreviousDayReviewOpen}
          onOpenChange={setIsPreviousDayReviewOpen}
          entry={currentReviewEntry}
          entryDate={currentReviewEntry.entry_date}
          latestCounterTimestamp={getLatestCounterTimestamp(currentReviewEntry)}
          onSave={handlePreviousDaySave}
          onDiscard={handlePreviousDayDiscard}
          isSaving={isFinalizing}
          queuePosition={currentReviewIndex + 1}
          queueTotal={totalUnfinalizedCount}
        />
      )}

      {/* Page Tour */}
      <PageTour
        steps={trackTourSteps}
        isOpen={showTour}
        onComplete={() => {
          // Reset all tour state
          setIsTourDemoMode(false);
          setIsLogSaleSheetOpen(false);
          setTourForceUpgrade(false);
          setTourForceCalculatorOpen(false);
          completeTour();
        }}
        onSkip={() => {
          // Reset all tour state
          setIsTourDemoMode(false);
          setIsLogSaleSheetOpen(false);
          setTourForceUpgrade(false);
          setTourForceCalculatorOpen(false);
          skipTour();
        }}
        onStepAction={(action) => {
          if (action === 'openLogSaleSheet') {
            setIsTourDemoMode(true);
            setTourForceUpgrade(false);
            setTourForceCalculatorOpen(false);
            setIsLogSaleSheetOpen(true);
          } else if (action === 'switchToUpgradeAndShowHelp') {
            setTourForceUpgrade(true);
          } else if (action === 'openUpgradeCalculator') {
            setTourForceUpgrade(true);
            setTourForceCalculatorOpen(true);
          }
        }}
      />
    </>
  );
};

export default TrackWithLayout;
