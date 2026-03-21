import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import Layout from "./Layout";
import Track from "@/pages/Track";
import { SaveEntrySheet } from "./SaveEntrySheet";
import { ResetConfirmSheet } from "./ResetConfirmSheet";
import { PreviousDayReviewSheet } from "./PreviousDayReviewSheet";
import { EarlySaveConfirmSheet } from "./EarlySaveConfirmSheet";
import { EarlyEndConfirmSheet } from "./EarlyEndConfirmSheet";
import { PostSaveSuccessSheet } from "./PostSaveSuccessSheet";
import { SyncIndicator } from "./SyncIndicator";
import { LogSaleSheet } from "./LogSaleSheet";
import { Sale } from "@/hooks/useDailyEntry";
import { SaleDetailSheet } from "./SaleDetailSheet";
import { DeleteSalePickerSheet } from "./DeleteSalePickerSheet";
import { NotificationPermissionPrompt } from "./NotificationPermissionPrompt";
import { PendingSalesAlert } from "./PendingSalesAlert";

import { useDailyEntry } from "@/hooks/useDailyEntry";
import { useAddSaleToEntry } from "@/hooks/useAddSaleToEntry";
import { useSaleUpdate } from "@/hooks/useSaleUpdate";
import { usePendingSalesQueue } from "@/hooks/usePendingSalesQueue";
import { useTrackBackup, getCurrentUserId } from "@/hooks/useTrackBackup";
import { useCompetitorNudge } from "@/hooks/useCompetitorNudge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRepData } from "@/hooks/useRepData";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useConfetti } from "@/hooks/useConfetti";
import { useSalesRealtime } from "@/hooks/useSalesRealtime";
import { useGoalPaceCalculator } from "@/hooks/useGoalPaceCalculator";
import { toast } from "sonner";
import { hapticSuccess } from "@/utils/haptics";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";

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
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { repData } = useRepData();
  const { totalFP: preseasonFP } = usePreseasonFP();
  const goalPaceData = useGoalPaceCalculator();
  const { entry, updateCounter, finalizeEntry, resetEntry, clearLocalEntry, isFinalizing, isResetting, isLoading: isLoadingEntry, isRefreshing, isFreshDataVerified, isOfflineWithBackup } = useDailyEntry();
  const { addSale: addSaleToEntry, isAddingSale } = useAddSaleToEntry();
  const { updateSale, deleteSale: deleteSaleFromEntry, isDeleting: isDeletingSale } = useSaleUpdate();
  
  // CRITICAL: Subscribe to realtime updates for multi-device sync
  // This ensures iPad and Phone stay in sync automatically
  useSalesRealtime();
  
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
  const [isSaleDetailOpen, setIsSaleDetailOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [pendingCloseIncrement, setPendingCloseIncrement] = useState(false);
  const [pendingPostFinalizationSale, setPendingPostFinalizationSale] = useState(false); // For sales after finalization
  const [isDeleteSalePickerOpen, setIsDeleteSalePickerOpen] = useState(false);
  
  // Confetti hook for celebrations
  const { fireConfetti } = useConfetti();
  
  // AUTH HEALTH MONITOR: Periodically check auth session is alive
  // Prevents silent data loss when session expires mid-tracking
  const [authHealthy, setAuthHealthy] = useState(true);
  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (mounted) {
          if (!user) {
            // Try to refresh before marking unhealthy
            const { data: refreshData } = await supabase.auth.refreshSession();
            setAuthHealthy(!!refreshData?.user);
            if (!refreshData?.user) {
              console.error('[TrackWithLayout] Auth session expired - data may not save!');
            }
          } else {
            setAuthHealthy(true);
          }
        }
      } catch {
        if (mounted) setAuthHealthy(false);
      }
    };
    
    // Check immediately and every 60 seconds
    checkAuth();
    const interval = setInterval(checkAuth, 60_000);
    
    // Also check on visibility change (app resume)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkAuth();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
  
  // Local backup for data recovery
  const userId = getCurrentUserId();
  const { saveBackup, loadBackup, clearBackup, hasUnsavedBackup } = useTrackBackup(userId, getTodayDate());
  
  // Pending sales queue for bulletproof sale saving
  const { queueSale, processQueue } = usePendingSalesQueue(userId);
  
  // Competitor nudge for early save motivation
  const { competitor: competitorNudge, loading: competitorLoading } = useCompetitorNudge();
  
  // Debounce ref for batching rapid updates
  const pendingUpdateRef = useRef<any>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Rapid-tap detection: track recent taps per field
  const recentTapsRef = useRef<Record<string, number[]>>({});
  const rapidTapWarningShownRef = useRef(false);
  const latestEntryRef = useRef(entry);

  // Auto-heal sync when server is behind local counters
  const autoResyncInFlightRef = useRef(false);
  const lastAutoResyncAttemptRef = useRef(0);

  useEffect(() => {
    latestEntryRef.current = entry;
  }, [entry]);
  
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
  
  // Handle returning from LogSale page with sale data
  useEffect(() => {
    const navState = location.state as {
      saleLogged?: boolean;
      saleData?: Omit<Sale, 'id' | 'timestamp'>;
      saleCancelled?: boolean;
      saleDeleted?: boolean;
      deletedSaleId?: string;
      editingSaleId?: string;
    } | null;
    
    if (navState?.saleLogged && navState.saleData) {
      // Clear the navigation state to prevent re-processing
      navigate(location.pathname, { replace: true, state: null });
      
      // Trigger the sale logging flow
      if (navState.editingSaleId) {
        // Editing an existing sale - find and update it
        const existingSale = (entry.sales_log || []).find(s => s.id === navState.editingSaleId);
        if (existingSale) {
          handleUpdateSale({
            ...existingSale,
            ...navState.saleData,
          });
        }
      } else {
        // New sale - call handleLogSaleFromPage directly
        // This bypasses the pendingCloseIncrement check since we KNOW this is a valid sale
        // from the LogSale page. This fixes the race condition where state wasn't updated.
        handleLogSaleFromPage(navState.saleData!);
      }
    } else if (navState?.saleCancelled) {
      // User cancelled - clear any pending state
      navigate(location.pathname, { replace: true, state: null });
      setPendingCloseIncrement(false);
      setPendingPostFinalizationSale(false);
    } else if (navState?.saleDeleted && navState.deletedSaleId) {
      // User deleted a sale
      navigate(location.pathname, { replace: true, state: null });
      handleDeleteSale(navState.deletedSaleId);
    }
  }, [location.state]);
  
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
  // FIX: Only save when values go UP — prevents rollback from overwriting backup with lower values
  const lastBackupTotalRef = useRef<number>(0);
  useEffect(() => {
    if (!entry.is_finalized && userId) {
      const currentTotal = (entry.doors_knocked || 0) + 
                           (entry.decision_makers || 0) + 
                           (entry.pitches || 0) + 
                           (entry.transitions || 0) + 
                           (entry.presentations || 0) + 
                           (entry.closes || 0);
      // Only save if activity total is >= our last saved total (never go backwards)
      if (currentTotal > 0 && currentTotal >= lastBackupTotalRef.current) {
        lastBackupTotalRef.current = currentTotal;
        saveBackup(entry);
      }
    }
  }, [entry, userId, saveBackup]);

  // REMOVED: Duplicate online handler was here. The authoritative one lives in
  // useDailyEntry.ts which checks server state + last_reset_at before pushing.
  // Having two handlers caused race conditions and premature backup clearing.

  // Server-verified sync status: confirms data actually landed on the server
  const verifyServerSync = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    try {
      const userId = getCurrentUserId();
      if (!userId) return;
      const todayDate = getTodayDate();

      const { data: serverRow, error } = await supabase
        .from('daily_entries')
        .select('doors_knocked, decision_makers, pitches, transitions, presentations, closes, is_finalized, updated_at')
        .eq('user_id', userId)
        .eq('entry_date', todayDate)
        .maybeSingle();

      if (error) {
        console.warn('[TrackSync] Server verify failed:', error.message);
        setSyncStatus('error');
        return;
      }

      const localTotal =
        (entry.doors_knocked || 0) +
        (entry.decision_makers || 0) +
        (entry.pitches || 0) +
        (entry.transitions || 0) +
        (entry.presentations || 0) +
        (entry.closes || 0);

      if (!serverRow) {
        // No server row yet — if we have local activity, it hasn't synced
        setSyncStatus(localTotal > 0 ? 'pending' : 'synced');
        return;
      }

      const serverTotal =
        (serverRow.doors_knocked || 0) +
        (serverRow.decision_makers || 0) +
        (serverRow.pitches || 0) +
        (serverRow.transitions || 0) +
        (serverRow.presentations || 0) +
        (serverRow.closes || 0);

      if (serverTotal > localTotal) {
        // If another device (or server-side safety merge) is ahead, force-refresh
        // local Track cache so UI reflects true server totals immediately.
        queryClient.invalidateQueries({
          queryKey: ['daily-entry', todayDate],
          refetchType: 'all',
        });
      }

      if (serverTotal >= localTotal) {
        setSyncStatus('synced');
        return;
      }

      console.warn('[TrackSync] Server behind local:', { serverTotal, localTotal });
      setSyncStatus('pending');

      const now = Date.now();
      const shouldAttemptAutoResync =
        !entry.is_finalized &&
        !serverRow.is_finalized &&
        localTotal > 0 &&
        !autoResyncInFlightRef.current &&
        now - lastAutoResyncAttemptRef.current > 15000;

      if (!shouldAttemptAutoResync) {
        return;
      }

      autoResyncInFlightRef.current = true;
      lastAutoResyncAttemptRef.current = now;

      try {
        await updateCounter({
          doors_knocked: entry.doors_knocked || 0,
          decision_makers: entry.decision_makers || 0,
          pitches: entry.pitches || 0,
          transitions: entry.transitions || 0,
          presentations: entry.presentations || 0,
          closes: entry.closes || 0,
          fp_plus: entry.fp_plus || 0,
          prmr: entry.prmr || 0,
          
          work_start_time: entry.work_start_time ?? null,
          work_end_time: entry.work_end_time ?? null,
          break_periods: entry.break_periods || [],
          counter_timestamps: entry.counter_timestamps || {},
          custom_counters: entry.custom_counters || {},
          timezone: entry.timezone ?? null,
          sales_log: entry.sales_log || [],
        });

        setTimeout(() => {
          void verifyServerSync();
        }, 1500);
      } catch (resyncError) {
        console.warn('[TrackSync] Auto-resync failed:', resyncError);
      } finally {
        autoResyncInFlightRef.current = false;
      }
    } catch {
      setSyncStatus('error');
    }
  }, [entry, updateCounter, queryClient]);

  // Sync status tracking: listen for online/offline changes + periodic server verification
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('pending');
      // Verify after reconnect sync has time to complete
      setTimeout(verifyServerSync, 3000);
    };
    const handleOffline = () => setSyncStatus('offline');
    const handleFocus = () => {
      if (navigator.onLine && !entry.is_finalized) {
        verifyServerSync();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && !entry.is_finalized) {
        verifyServerSync();
      }
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    
    // Periodic server verification every 30 seconds when online
    const interval = setInterval(() => {
      if (navigator.onLine && !entry.is_finalized) {
        verifyServerSync();
      }
    }, 30000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [verifyServerSync, entry.is_finalized]);

  // Handle save button click - check if before sunset
  const handleSaveButtonClick = () => {
    // Check if it's before typical end of work day
    if (isBeforeSunset()) {
      setIsEarlySaveConfirmOpen(true);
    } else {
      // Direct save without opening drawer - just finalize immediately
      handleDirectSave();
    }
  };

  // Direct save without drawer - used when skipSummaryView would be true
  const handleDirectSave = async () => {
    if (isSaveInProgress || isFinalizing) return;
    
    // Check if there are unmarked sales that need install tracking
    const salesLog = entry.sales_log || [];
    const hasUnmarkedSales = salesLog.some((s: Sale) => s.install_status === undefined);
    
    if (hasUnmarkedSales) {
      // Need to show the SaveEntrySheet for install step only
      setIsSaveSheetOpen(true);
      return;
    }
    
    // No unmarked sales - save directly without any drawer
    setIsSaveInProgress(true);
    setSyncStatus('pending');
    
    try {
      const saveDate = format(new Date(), 'yyyy-MM-dd');
      const now = new Date();
      
      // Auto-fill end time if not set
      const workEndTime = entry.work_end_time || now.toISOString();
      
      // Calculate metrics from sales_log
      const fundedSales = salesLog.filter((s: Sale) => s.install_status !== 'cancelled' && s.install_status !== 'never_installed');
      const fpSales = fundedSales.filter((s: Sale) => s.type === 'fp');
      const upgradeSales = fundedSales.filter((s: Sale) => s.type === 'upgrade');
      
      const fpCount = fpSales.length;
      const fpPrmrTotal = fpSales.reduce((sum: number, s: Sale) => sum + (s.prmr || 0), 0);
      const upgradePrmrTotal = upgradeSales.reduce((sum: number, s: Sale) => sum + (s.prmr || 0), 0);
      const totalPrmr = fpPrmrTotal + upgradePrmrTotal;
      const fpPlus = fpCount + (upgradePrmrTotal / 85);
      
      const saveData = {
        doors_knocked: entry.doors_knocked || 0,
        decision_makers: entry.decision_makers || 0,
        pitches: entry.pitches || 0,
        transitions: entry.transitions || 0,
        presentations: entry.presentations || 0,
        closes: salesLog.length,
        fp_plus: fpPlus,
        prmr: totalPrmr,
        upgrade_prmr: upgradePrmrTotal || null,
        saveDate,
        work_start_time: entry.work_start_time,
        work_end_time: workEndTime,
        sales_log: salesLog,
        daily_target: goalPaceData.hasGoals ? goalPaceData.dailyNeeded : null,
      };
      
      await finalizeEntry(saveData);
      setSavedThisSession(true);
      // DON'T call clearLocalEntry - let the invalidation refetch the real finalized data from DB
      // This prevents the bug where navigating away and back shows zeros/unfinalized state
      clearBackup();
      setSyncStatus('synced');
      toast.success('Entry saved!');
      
      // Fire confetti for celebration
      if (fpPlus > 0) {
        hapticSuccess();
        fireConfetti({ variant: 'money' });
      }
    } catch (error) {
      console.error('Save failed:', error);
      setSyncStatus('error');
      toast.error('Failed to save. Your data is backed up locally.');
    } finally {
      setIsSaveInProgress(false);
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
      // DON'T call clearLocalEntry - let the invalidation refetch the real finalized data from DB
      // This prevents the bug where navigating away and back shows zeros/unfinalized state
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
      // Post-save success sheet removed - go straight to pending sales flow or show toast
      toast.success('Entry saved!');
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

  // Handle viewing the recap (after finalization)
  const handleViewRecap = useCallback(() => {
    // Calculate hours worked from entry times
    let hoursWorked = 0;
    if (entry.work_start_time && entry.work_end_time) {
      const start = new Date(entry.work_start_time);
      const end = new Date(entry.work_end_time);
      hoursWorked = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      
      // Subtract break time
      if (entry.break_periods && Array.isArray(entry.break_periods)) {
        const breakPeriods = entry.break_periods as Array<{ start: string; end: string }>;
        const breakMinutes = breakPeriods.reduce((total, bp) => {
          if (bp.start && bp.end) {
            return total + (new Date(bp.end).getTime() - new Date(bp.start).getTime()) / (1000 * 60);
          }
          return total;
        }, 0);
        hoursWorked = Math.max(0, hoursWorked - breakMinutes / 60);
      }
    }
    
    // Populate summary from current entry
    setLastSavedSummary({
      doors: entry.doors_knocked || 0,
      dms: entry.decision_makers || 0,
      pitches: entry.pitches || 0,
      transitions: entry.transitions || 0,
      presentations: entry.presentations || 0,
      closes: entry.closes || 0,
      fpPlus: entry.fp_plus || 0,
      prmr: entry.prmr || 0,
      hoursWorked,
    });
    
    setIsPostSaveSuccessOpen(true);
  }, [entry]);

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

  const handleCounterChange = useCallback(async (
    field: string,
    value: number,
    operation?: 'increment' | 'decrement'
  ) => {
    const latestEntry = latestEntryRef.current;

    // PHASE 2: FRESHNESS GATE - Only block if NO backup AND still loading
    // With a valid backup, allow immediate interaction (snappy UX)
    if (!isFreshDataVerified && !isOfflineWithBackup) {
      console.log('[BULLETPROOF] Counter change blocked - no backup and still loading');
      setSyncStatus('pending');
      return;
    }
    
    // PROTECTION LAYER 7: Multiple checks to prevent counter changes after save
    if (isSaveInProgress) {
      console.log('Ignoring counter change - save in progress');
      return;
    }
    
    if (savedThisSession || latestEntry.is_finalized) {
      // SPECIAL CASE: Allow adding closes via post-finalization flow
      if (field === 'closes' && value >= (latestEntry.closes || 0) && salesLoggerEnabled) {
        if (isLogSaleSheetOpen || pendingPostFinalizationSale) {
          return; // Already logging
        }
        // Navigate to LogSale page for post-finalization sale
        setPendingPostFinalizationSale(true);
        setEditingSale(null);
        navigate('/log-sale', { 
          state: { 
            crmEnabled: true, 
            crmDetailedEnabled: true,
            counterTimestamps: latestEntry.counter_timestamps,
            returnPath: '/track'
          } 
        });
        return;
      }
      // Block other counter changes
      console.log('Ignoring counter change - entry is finalized');
      toast.info("Today's work is already saved. You can still add sales though!");
      return;
    }

    
    // Get current value to determine if adding or subtracting
    const currentValue = field.startsWith('custom_') 
      ? (latestEntry.custom_counters?.[field.replace('custom_', '')] || 0)
      : (latestEntry[field as keyof typeof latestEntry] as number || 0);

    const resolvedOperation =
      operation ?? (value < currentValue ? 'decrement' : 'increment');

    const nextValue =
      resolvedOperation === 'decrement' ? Math.max(0, currentValue - 1) : currentValue + 1;
    
    const isAdding = nextValue > currentValue;
    const isSubtracting = nextValue < currentValue;

    if (!isAdding && !isSubtracting) return;
    
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
      navigate('/log-sale', { 
        state: { 
          crmEnabled: true, 
          crmDetailedEnabled: true,
          counterTimestamps: entry.counter_timestamps,
          returnPath: '/track'
        } 
      });
      return; // Don't increment closes yet - wait for sale to be logged
    }
    
    // SALES LOGGER: Intercept closes counter when subtracting and there are logged sales
    // Show picker to choose which sale to delete instead of just decrementing
    const salesLog = latestEntry.sales_log || [];
    if (field === 'closes' && isSubtracting && salesLoggerEnabled && salesLog.length > 0) {
      setIsDeleteSalePickerOpen(true);
      return; // Don't decrement closes yet - wait for sale selection
    }
    
    // Immediately trigger optimistic update through mutation
    const updates: any = { [field]: nextValue };
    
    // Handle custom counters separately
    if (field.startsWith('custom_')) {
      const customId = field.replace('custom_', '');
      const customCounters = latestEntry.custom_counters || {};
      updates.custom_counters = {
        ...customCounters,
        [customId]: nextValue,
      };
      delete updates[field]; // Remove the custom_ prefixed field
    }
    
    // Auto-end break if one is active when counter is tapped (only when adding)
    if (isAdding) {
      const breakPeriods = latestEntry.break_periods || [];
      const currentBreak = breakPeriods.find(bp => !bp.end);
      if (currentBreak) {
        const updatedBreaks = breakPeriods.map(bp => 
          bp === currentBreak ? { ...bp, end: new Date().toISOString() } : bp
        );
        updates.break_periods = updatedBreaks;
      }
    }
    
    // Auto-start work time on first counter tap (only when adding)
    if (isAdding && !latestEntry.work_start_time && nextValue > 0) {
      const now = new Date();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      updates.work_start_time = now.toISOString();
      updates.timezone = timezone;
    }
    
    // Handle timestamps: add when increasing, remove when decreasing
    const timestamps = latestEntry.counter_timestamps || {};
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
    
    // Trigger money confetti on close (only when adding)
    if (field === 'closes' && isAdding) {
      fireConfetti({ variant: 'money', duration: 2500 });
    }
    
    // Fire-and-forget: notify recruiter when rookie transitions
    if (field === 'transitions' && isAdding) {
      const uid = getCurrentUserId();
      if (uid) {
        supabase.functions.invoke('notify-recruiter-transition', {
          body: { repUserId: uid },
        }).catch(() => {});
      }
    }
    
    // Set sync status to pending
    setSyncStatus('pending');

    // Keep a local source-of-truth in sync so rapid taps cannot regress from stale props
    latestEntryRef.current = {
      ...latestEntry,
      ...updates,
      custom_counters: updates.custom_counters ?? latestEntry.custom_counters,
      break_periods: updates.break_periods ?? latestEntry.break_periods,
      counter_timestamps: updates.counter_timestamps ?? latestEntry.counter_timestamps,
    } as typeof latestEntry;

    const syncedEntry = latestEntryRef.current;
    const syncPayload = {
      doors_knocked: syncedEntry.doors_knocked || 0,
      decision_makers: syncedEntry.decision_makers || 0,
      pitches: syncedEntry.pitches || 0,
      transitions: syncedEntry.transitions || 0,
      presentations: syncedEntry.presentations || 0,
      closes: syncedEntry.closes || 0,
      fp_plus: syncedEntry.fp_plus || 0,
      prmr: syncedEntry.prmr || 0,
      upgrade_prmr: syncedEntry.upgrade_prmr ?? null,
      work_start_time: syncedEntry.work_start_time ?? null,
      work_end_time: syncedEntry.work_end_time ?? null,
      break_periods: syncedEntry.break_periods || [],
      counter_timestamps: syncedEntry.counter_timestamps || {},
      custom_counters: syncedEntry.custom_counters || {},
      timezone: syncedEntry.timezone ?? null,
      sales_log: syncedEntry.sales_log || [],
    };
    
    // Immediately call updateCounter for instant optimistic UI update
    try {
      await updateCounter(syncPayload);
      // Keep pending until server verification confirms parity
      setSyncStatus('pending');
      setTimeout(() => {
        void verifyServerSync();
      }, 1000);
    } catch (error: any) {
      // PROTECTION: If entry was finalized between checks, show friendly message
      if (error?.message === 'ENTRY_ALREADY_FINALIZED') {
        toast.info("Today's work is already saved. Start fresh tomorrow!");
        setSavedThisSession(true); // Prevent further attempts
        setSyncStatus('synced');
      } else if (error?.message === 'AUTH_SESSION_EXPIRED') {
        // FIX: Explicit auth error feedback — user needs to know their session died
        setSyncStatus('error');
        toast.error('Session expired — please close and reopen the app to continue tracking', {
          duration: 8000,
          id: 'auth-expired', // Prevent duplicate toasts
        });
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
  }, [
    updateCounter,
    verifyServerSync,
    isSaveInProgress,
    savedThisSession,
    salesLoggerEnabled,
    isFreshDataVerified,
    isOfflineWithBackup,
    isLogSaleSheetOpen,
    pendingPostFinalizationSale,
    pendingCloseIncrement,
    navigate,
  ]);

  // Sales logger handlers
  const handleLogSale = useCallback(async (saleData: Omit<Sale, 'id' | 'timestamp'>) => {
    
    const today = getTodayDate();
    
    // POST-FINALIZATION: Use addSaleToEntry hook - only queue on failure
    if (pendingPostFinalizationSale) {
      const saleTimestamp = new Date().toISOString();
      
      try {
        // Try direct save FIRST (no queue)
        await addSaleToEntry({
          entryDate: today,
          sale: saleData,
          saleTimestamp,
        });
        // Success!
        hapticSuccess();
        fireConfetti({ variant: 'money', duration: 2500 });
      } catch (error) {
        console.error('[TrackWithLayout] Post-finalization sale failed, queuing:', error);
        // Only queue if save fails
        queueSale(today, saleData);
        toast.info('Sale queued - will save when connection restores', { 
          icon: '📶',
          duration: 3000 
        });
        processQueue();
      }
      setPendingPostFinalizationSale(false);
      return;
    }
    
    if (!pendingCloseIncrement) return;
    
    // Generate sale ID and timestamp upfront
    const saleId = crypto.randomUUID();
    const saleTimestamp = new Date().toISOString();
    
    const newSale: Sale = {
      id: saleId,
      ...saleData,
      timestamp: saleTimestamp,
    };
    
    const currentSalesLog = entry.sales_log || [];
    const updatedSalesLog = [...currentSalesLog, newSale];
    
    // Calculate fp_plus and prmr from the updated sales_log
    const { fp, prmr: totalPrmr } = calculateFromSalesLog(updatedSalesLog);
    const upgradePrmr = updatedSalesLog
      .filter(s => s.type === 'upgrade' && s.install_status !== 'never_installed')
      .reduce((sum, s) => sum + (s.prmr || 0), 0);
    
    // Increment closes and add sale to log with recalculated totals
    const updates: any = {
      closes: (entry.closes || 0) + 1,
      sales_log: updatedSalesLog,
      fp_plus: Math.round(fp * 100) / 100,
      prmr: Math.round(totalPrmr * 100) / 100,
      upgrade_prmr: Math.round(upgradePrmr * 100) / 100,
    };
    
    // Handle timestamps
    const timestamps = entry.counter_timestamps || {};
    const closesTimestamps = timestamps['closes'] || [];
    updates.counter_timestamps = {
      ...timestamps,
      closes: [...closesTimestamps, saleTimestamp]
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
    
    // Fire money rain confetti and haptic IMMEDIATELY for responsive feel
    hapticSuccess();
    fireConfetti({ variant: 'money', duration: 2500 });
    
    setSyncStatus('pending');
    try {
      // Try direct save FIRST (no queue)
      console.log('[handleLogSale] Sending sale to server:', {
        salesCount: updatedSalesLog.length,
        fp: Math.round(fp * 100) / 100,
        prmr: Math.round(totalPrmr * 100) / 100,
        hasSalesLog: !!updates.sales_log,
        salesLogLength: updates.sales_log?.length,
      });
      await updateCounter(updates);
      setSyncStatus('synced');
      
      // CRITICAL: Verify sale actually landed on server — if not, retry via dedicated sale path
      setTimeout(async () => {
        try {
          const uid = getCurrentUserId();
          if (!uid) return;
          const { data: serverRow } = await supabase
            .from('daily_entries')
            .select('sales_log')
            .eq('user_id', uid)
            .eq('entry_date', today)
            .maybeSingle();
          const serverSales = (serverRow?.sales_log as any[]) || [];
          const saleOnServer = serverSales.some((s: any) => s.id === saleId);
          if (!saleOnServer) {
            console.warn('[handleLogSale] Sale NOT found on server — retrying via addSaleToEntry');
            await addSaleToEntry({ entryDate: today, sale: saleData, saleTimestamp });
          } else {
            console.log('[handleLogSale] Sale confirmed on server ✅');
          }
          verifyServerSync();
        } catch (e) {
          console.error('[handleLogSale] Post-sale verification failed:', e);
        }
      }, 3000);
      
      console.log('[handleLogSale] Sale mutation completed successfully');
      // Fire-and-forget: notify watchlist watchers and recruiter about this sale
      const currentUid = getCurrentUserId();
      if (currentUid) {
        const salePayload = {
          sellerUserId: currentUid,
          prmr: saleData.prmr || 0,
          fpPlus: Math.round(fp * 100) / 100,
        };
        supabase.functions.invoke('notify-watchlist-sale', { body: salePayload }).catch(() => {});
        supabase.functions.invoke('notify-recruiter-sale', { body: salePayload }).catch(() => {});
      }
    } catch (error: any) {
      if (error?.message === 'ENTRY_ALREADY_FINALIZED') {
        toast.info("Today's work is already saved. Start fresh tomorrow!");
        setSavedThisSession(true);
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
        // Only queue if save fails
        queueSale(today, saleData);
        toast.info('Sale saved locally - will sync when connection restores', { 
          icon: '📶',
          duration: 3000 
        });
        processQueue(); // Trigger retry
      }
    }
    
    setPendingCloseIncrement(false);
  }, [entry, updateCounter, pendingCloseIncrement, pendingPostFinalizationSale, addSaleToEntry, fireConfetti, queueSale, processQueue]);

  // Direct handler for sales from LogSale page - bypasses pendingCloseIncrement check
  // This fixes the race condition where the navigation state handler couldn't reliably
  // set pendingCloseIncrement before calling handleLogSale
  const handleLogSaleFromPage = useCallback(async (saleData: Omit<Sale, 'id' | 'timestamp'>) => {
    
    const today = getTodayDate();
    
    // Generate sale ID and timestamp
    const saleId = crypto.randomUUID();
    const saleTimestamp = new Date().toISOString();
    
    const newSale: Sale = {
      id: saleId,
      ...saleData,
      timestamp: saleTimestamp,
    };
    
    const currentSalesLog = entry.sales_log || [];
    const updatedSalesLog = [...currentSalesLog, newSale];
    
    // Calculate fp_plus and prmr from the updated sales_log
    const { fp, prmr: totalPrmr } = calculateFromSalesLog(updatedSalesLog);
    const upgradePrmr = updatedSalesLog
      .filter(s => s.type === 'upgrade' && s.install_status !== 'never_installed')
      .reduce((sum, s) => sum + (s.prmr || 0), 0);
    
    // Build updates with recalculated totals
    const updates: any = {
      closes: (entry.closes || 0) + 1,
      sales_log: updatedSalesLog,
      fp_plus: Math.round(fp * 100) / 100,
      prmr: Math.round(totalPrmr * 100) / 100,
      upgrade_prmr: Math.round(upgradePrmr * 100) / 100,
    };
    
    // Handle timestamps
    const timestamps = entry.counter_timestamps || {};
    const closesTimestamps = timestamps['closes'] || [];
    updates.counter_timestamps = {
      ...timestamps,
      closes: [...closesTimestamps, saleTimestamp]
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
    
    // Fire confetti and haptic immediately
    hapticSuccess();
    fireConfetti({ variant: 'money', duration: 2500 });
    
    setSyncStatus('pending');
    try {
      console.log('[handleLogSaleFromPage] Sending sale to server:', {
        salesCount: updatedSalesLog.length,
        fp: Math.round(fp * 100) / 100,
        prmr: Math.round(totalPrmr * 100) / 100,
        hasSalesLog: !!updates.sales_log,
        salesLogLength: updates.sales_log?.length,
      });
      await updateCounter(updates);
      setSyncStatus('synced');
      
      // CRITICAL: Verify sale actually landed on server — if not, retry via dedicated sale path
      setTimeout(async () => {
        try {
          const uid = getCurrentUserId();
          if (!uid) return;
          const { data: serverRow } = await supabase
            .from('daily_entries')
            .select('sales_log')
            .eq('user_id', uid)
            .eq('entry_date', today)
            .maybeSingle();
          const serverSales = (serverRow?.sales_log as any[]) || [];
          const saleOnServer = serverSales.some((s: any) => s.id === saleId);
          if (!saleOnServer) {
            console.warn('[handleLogSaleFromPage] Sale NOT found on server — retrying via addSaleToEntry');
            await addSaleToEntry({ entryDate: today, sale: saleData, saleTimestamp });
          } else {
            console.log('[handleLogSaleFromPage] Sale confirmed on server ✅');
          }
          verifyServerSync();
        } catch (e) {
          console.error('[handleLogSaleFromPage] Post-sale verification failed:', e);
        }
      }, 3000);
      
      console.log('[handleLogSaleFromPage] Sale mutation completed successfully');
      // Fire-and-forget: notify recruiter about this sale
      const currentUid = getCurrentUserId();
      if (currentUid) {
        const salePayload = {
          sellerUserId: currentUid,
          prmr: saleData.prmr || 0,
          fpPlus: Math.round(fp * 100) / 100,
        };
        supabase.functions.invoke('notify-watchlist-sale', { body: salePayload }).catch(() => {});
        supabase.functions.invoke('notify-recruiter-sale', { body: salePayload }).catch(() => {});
      }
    } catch (error: any) {
      if (error?.message === 'ENTRY_ALREADY_FINALIZED') {
        toast.info("Today's work is already saved. Start fresh tomorrow!");
        setSavedThisSession(true);
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
        queueSale(today, saleData);
        toast.info('Sale saved locally - will sync when connection restores', { 
          icon: '📶',
          duration: 3000 
        });
        processQueue();
      }
    }
  }, [entry, updateCounter, fireConfetti, queueSale, processQueue]);

  const handleEditSale = useCallback((sale: Sale) => {
    setEditingSale(sale);
    setIsSaleDetailOpen(true);
  }, []);

  const handleUpdateSale = useCallback(async (updatedSale: Sale) => {
    // Use the dedicated useSaleUpdate hook which properly:
    // 1. Updates the sale in sales_log
    // 2. Recalculates closes, fp_plus, prmr, upgrade_prmr based on all funded sales
    // 3. Invalidates all relevant caches
    const entryId = (entry as any).id;
    if (!entryId) {
      console.error('[handleUpdateSale] No entry ID available');
      toast.error('Cannot update sale - entry not found');
      return;
    }
    
    updateSale({
      entryId,
      entryDate: getTodayDate(),
      saleId: updatedSale.id,
      updates: updatedSale,
    });
    
    setEditingSale(null);
  }, [entry, updateSale]);

  const handleDeleteSale = useCallback(async (saleId: string) => {
    // Use the dedicated useSaleUpdate hook which properly:
    // 1. Removes the sale from sales_log
    // 2. Recalculates closes, fp_plus, prmr, upgrade_prmr based on remaining funded sales
    // 3. Invalidates all relevant caches
    const entryId = (entry as any).id;
    if (!entryId) {
      console.error('[handleDeleteSale] No entry ID available');
      toast.error('Cannot delete sale - entry not found');
      return;
    }
    
    const todayDate = getTodayDate();
    
    setSyncStatus('pending');
    try {
      deleteSaleFromEntry({
        entryId,
        entryDate: todayDate,
        saleId,
      });
      setSyncStatus('synced');
    } catch (error) {
      console.error('[handleDeleteSale] Error:', error);
      setSyncStatus('error');
    }
    
    setEditingSale(null);
  }, [entry, deleteSaleFromEntry]);

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
        isEntryFinalized={entry.is_finalized || savedThisSession}
        onViewRecap={handleViewRecap}
        hasWorkStarted={!!entry.work_start_time}
      >
        {/* Auth Health Warning - unmissable banner when session is expired */}
        {!authHealthy && (
          <div className="mx-4 mb-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
            <span className="text-destructive text-sm font-medium">
              ⚠️ Session expired — your data may not be saving. Please close and reopen the app.
            </span>
          </div>
        )}
        
        {/* Pending Sales Alert */}
        <PendingSalesAlert userId={userId} />
        
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
          isLoadingEntry={isLoadingEntry}
          isRefreshing={isRefreshing}
          competitorNudge={competitorNudge}
          competitorLoading={competitorLoading}
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
        editingSale={editingSale}
        onUpdateSale={handleUpdateSale}
        onDeleteSale={handleDeleteSale}
        showPrmrHelper={showPrmrHelper}
        crmEnabled={true}
        crmDetailedEnabled={true}
        counterTimestamps={entry.counter_timestamps}
      />

      {/* Sale Detail Sheet for viewing/editing existing sales */}
      <SaleDetailSheet
        open={isSaleDetailOpen}
        onOpenChange={(open) => {
          setIsSaleDetailOpen(open);
          if (!open) {
            setEditingSale(null);
          }
        }}
        sale={editingSale}
        entryDate={getTodayDate()}
        onUpdateSale={handleUpdateSale}
        onDeleteSale={handleDeleteSale}
        crmEnabled={true}
        crmDetailedEnabled={true}
      />

      {/* Delete Sale Picker Sheet */}
      <DeleteSalePickerSheet
        open={isDeleteSalePickerOpen}
        onOpenChange={setIsDeleteSalePickerOpen}
        salesLog={entry.sales_log || []}
        closesCount={entry.closes || 0}
        onDeleteSale={handleDeleteSale}
        onUpdateSaleStatus={(saleId, status) => {
          const sale = (entry.sales_log || []).find(s => s.id === saleId);
          if (sale) {
            handleUpdateSale({ ...sale, install_status: status });
          }
        }}
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
        onConfirm={handleDirectSave}
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

      {/* Save Entry Sheet - skip summary view for current day, go directly to save */}
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
        skipSummaryView={true}
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
        onConfirm={() => {
          resetEntry(undefined, {
            onSuccess: () => {
              // Clear local ref so counters show 0 immediately
              latestEntryRef.current = {
                ...latestEntryRef.current,
                doors_knocked: 0,
                decision_makers: 0,
                pitches: 0,
                transitions: 0,
                presentations: 0,
                closes: 0,
                fp_plus: 0,
                prmr: 0,
                sales_log: [],
                work_start_time: null,
                work_end_time: null,
                break_periods: [],
                counter_timestamps: {},
                custom_counters: {},
                is_finalized: false,
              };
              setIsResetSheetOpen(false);
            },
            onError: () => {
              setIsResetSheetOpen(false);
            },
          });
        }}
        isResetting={isResetting}
        entrySummary={{
          doors: entry.doors_knocked || 0,
          decisionMakers: entry.decision_makers || 0,
          pitches: entry.pitches || 0,
          transitions: entry.transitions || 0,
          presentations: entry.presentations || 0,
          closes: entry.closes || 0,
          salesCount: Array.isArray(entry.sales_log) ? entry.sales_log.length : 0,
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

    </>
  );
};

export default TrackWithLayout;
