import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clearPreseasonFPCache } from './usePreseasonFP';
import { getInstantBackup, smartMergeEntries, getCurrentUserId } from './useTrackBackup';

// Helper to get backup from localStorage (kept for compatibility)
const getBackupFromStorage = (userId: string, entryDate: string): Partial<DailyEntry> | null => {
  return getInstantBackup(userId, entryDate);
};

// Calculate total activity from entry
const getActivityTotal = (entry: Partial<DailyEntry> | null): number => {
  if (!entry) return 0;
  return (entry.doors_knocked || 0) + 
         (entry.decision_makers || 0) + 
         (entry.pitches || 0) + 
         (entry.transitions || 0) + 
         (entry.presentations || 0) + 
         (entry.closes || 0);
};

export interface Sale {
  id: string;
  type: 'fp' | 'upgrade';
  prmr: number;
  timestamp: string;
  // Install tracking fields (defaults applied on save)
  installed_same_day?: boolean;        // Default: true
  scheduled_install_date?: string;     // YYYY-MM-DD (only if scheduled out)
  install_status?: 'installed' | 'pending' | 'cancelled' | 'never_installed';  // Default: 'installed'
  install_confirmed_at?: string;       // When confirmed (for pending → installed)
  // CRM fields - Simple (canonical names)
  customer_name?: string;
  customer_phone?: string;
  customer_account_number?: string;    // Canonical field name
  customer_address?: string;           // Canonical field name (was customer_location)
  customer_lat?: number;
  customer_lng?: number;
  // CRM fields - Detailed
  time_to_sell_minutes?: number;
  time_to_sell_source?: 'transition' | 'door' | 'manual';
  deal_type?: 'fresh' | 'takeover' | 'diy';
  money_spent?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

// Normalize legacy field names when loading sales data
export const normalizeSale = (sale: any): Sale => ({
  ...sale,
  // Migrate old field names to canonical names
  customer_account_number: sale.customer_account_number || sale.account_number,
  customer_address: sale.customer_address || sale.customer_location,
});

export interface DailyEntry {
  id: string;
  user_id: string;
  entry_date: string;
  doors_knocked: number;
  decision_makers: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp_plus: number;
  prmr: number;
  upgrade_prmr?: number | null;
  is_finalized: boolean;
  notes: string | null;
  work_start_time?: string | null;
  work_end_time?: string | null;
  break_periods?: Array<{ start: string; end: string }>;
  counter_timestamps?: Record<string, string[]>;
  timezone?: string | null;
  custom_counters?: Record<string, number>;
  sales_log?: Sale[];
}

const getTodayDate = () => {
  const today = new Date();
  // Use local timezone instead of UTC to prevent timezone-related date mismatches
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * BULLETPROOF: Get instant hydration data from localStorage
 * This runs SYNCHRONOUSLY before React Query fetches from server
 * Prevents the zeros flash that caused Javier's data loss
 */
const getInitialDataFromBackup = (entryDate: string): DailyEntry | undefined => {
  const userId = getCurrentUserId();
  if (!userId) return undefined;
  
  const backup = getInstantBackup(userId, entryDate);
  if (!backup) return undefined;
  
  // Only use backup as initial data if it has activity
  const hasActivity = getActivityTotal(backup) > 0;
  if (!hasActivity) return undefined;
  
  console.log('[useDailyEntry] Using localStorage backup as initialData for instant hydration');
  
  return {
    id: '',
    user_id: userId,
    entry_date: entryDate,
    doors_knocked: backup.doors_knocked || 0,
    decision_makers: backup.decision_makers || 0,
    pitches: backup.pitches || 0,
    transitions: backup.transitions || 0,
    presentations: backup.presentations || 0,
    closes: backup.closes || 0,
    fp_plus: backup.fp_plus || 0,
    prmr: backup.prmr || 0,
    is_finalized: false,
    notes: null,
    work_start_time: backup.work_start_time,
    work_end_time: backup.work_end_time,
    break_periods: backup.break_periods || [],
    counter_timestamps: backup.counter_timestamps || {},
    timezone: backup.timezone,
    custom_counters: backup.custom_counters || {},
    sales_log: backup.sales_log || [],
  } as DailyEntry;
};

export const useDailyEntry = (date?: string) => {
  const queryClient = useQueryClient();
  const entryDate = date || getTodayDate();

  // Track offline status with valid backup
  const [isOfflineWithBackup, setIsOfflineWithBackup] = useState(false);
  // Track if we have a valid backup (for immediate interaction)
  const [hasValidBackup, setHasValidBackup] = useState(() => {
    const userId = getCurrentUserId();
    const backup = userId ? getInstantBackup(userId, entryDate) : null;
    return getActivityTotal(backup) > 0;
  });

  // Check offline status with valid backup
  useEffect(() => {
    const checkOfflineStatus = () => {
      const userId = getCurrentUserId();
      const backup = userId ? getInstantBackup(userId, entryDate) : null;
      const hasActivity = getActivityTotal(backup) > 0;
      setHasValidBackup(hasActivity);
      
      if (!navigator.onLine) {
        setIsOfflineWithBackup(hasActivity);
      } else {
        setIsOfflineWithBackup(false);
      }
    };
    
    checkOfflineStatus();
    window.addEventListener('online', checkOfflineStatus);
    window.addEventListener('offline', checkOfflineStatus);
    return () => {
      window.removeEventListener('online', checkOfflineStatus);
      window.removeEventListener('offline', checkOfflineStatus);
    };
  }, [entryDate]);

  // AUTO-SYNC: Push backup to server when coming back online
  useEffect(() => {
    const handleOnline = async () => {
      const userId = getCurrentUserId();
      if (!userId) return;
      
      const backup = getInstantBackup(userId, entryDate);
      if (!backup || getActivityTotal(backup) === 0) return;
      
      console.log('[useDailyEntry] Back online - pushing backup to server via safe upsert');
      try {
        await supabase.rpc('upsert_daily_entry_safe', {
          p_user_id: userId,
          p_entry_date: entryDate,
          p_doors_knocked: backup.doors_knocked ?? null,
          p_decision_makers: backup.decision_makers ?? null,
          p_pitches: backup.pitches ?? null,
          p_transitions: backup.transitions ?? null,
          p_presentations: backup.presentations ?? null,
          p_closes: backup.closes ?? null,
          p_fp_plus: backup.fp_plus ?? null,
          p_prmr: backup.prmr ?? null,
          p_upgrade_prmr: backup.upgrade_prmr ?? null,
          p_work_start_time: backup.work_start_time ?? null,
          p_work_end_time: backup.work_end_time ?? null,
          p_break_periods: backup.break_periods ? JSON.parse(JSON.stringify(backup.break_periods)) : null,
          p_counter_timestamps: backup.counter_timestamps ? JSON.parse(JSON.stringify(backup.counter_timestamps)) : null,
          p_custom_counters: backup.custom_counters ? JSON.parse(JSON.stringify(backup.custom_counters)) : null,
          p_timezone: backup.timezone ?? null,
          p_sales_log: backup.sales_log ? JSON.parse(JSON.stringify(backup.sales_log)) : null,
          p_is_finalized: null,
        });
        console.log('[useDailyEntry] Backup synced to server successfully');
        // Refresh from server after sync
        queryClient.invalidateQueries({ queryKey: ['daily-entry', entryDate] });
      } catch (err) {
        console.error('[useDailyEntry] Failed to sync backup on reconnect:', err);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [entryDate, queryClient]);

  // BULLETPROOF: Get initial data from localStorage backup for instant hydration
  const initialData = getInitialDataFromBackup(entryDate);

  // Fetch entry for specific date with backup recovery
  const { data: entry, isLoading, fetchStatus } = useQuery({
    queryKey: ['daily-entry', entryDate],
    // PHASE 1: Instant hydration - show backup data immediately, never zeros
    initialData,
    // CRITICAL: Mark backup as stale so we always fetch fresh server data immediately.
    // This prevents a stale local backup from masking cross-device sales on /track.
    initialDataUpdatedAt: initialData ? 0 : undefined,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // CRITICAL: Don't silently return null - this causes PreWorkingState flash
        // and prevents mutations from saving. Try to refresh the session first.
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (!refreshData?.user) {
          // Truly not authenticated - throw to trigger retry, not return null
          // which would overwrite active tracking state with empty defaults
          console.error('[useDailyEntry] Auth session expired - could not refresh');
          throw new Error('AUTH_SESSION_EXPIRED');
        }
        // Session refreshed successfully
        console.log('[useDailyEntry] Auth session refreshed successfully');
      }
      
      const activeUser = (await supabase.auth.getUser()).data.user;
      if (!activeUser) throw new Error('AUTH_SESSION_EXPIRED');

      const { data, error } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', activeUser.id)
        .eq('entry_date', entryDate)
        .maybeSingle();

      if (error) throw error;
      
      // Transform the data to match our interface
      let serverEntry: DailyEntry | null = null;
      if (data) {
        serverEntry = {
          ...data,
          break_periods: (data.break_periods as any) || [],
          counter_timestamps: (data.counter_timestamps as any) || {},
          custom_counters: (data.custom_counters as any) || {},
          sales_log: (data.sales_log as any) || [],
        } as DailyEntry;
      }
      
      // PHASE 3: Smart merge - backup recovery with HIGHER value wins
      const backup = getBackupFromStorage(activeUser.id, entryDate);
      const serverTotal = getActivityTotal(serverEntry);
      const backupTotal = getActivityTotal(backup);
      
      // Only recover from backup if:
      // 1. Backup exists and has more data than server
      // 2. Entry is not finalized
      // 3. This is a genuine recovery (offline scenario), not just a cache refresh
      // 4. We haven't already shown a recovery toast this session for this date
      const recoveryKey = `backup-recovery-shown-${entryDate}`;
      const alreadyShownThisSession = sessionStorage.getItem(recoveryKey);
      
      if (backup && backupTotal > serverTotal && !serverEntry?.is_finalized && !alreadyShownThisSession) {
        console.log('[DailyEntry] Recovering from backup - backup has more data:', backupTotal, 'vs server:', serverTotal);
        
        // Mark that we've shown recovery for this date this session
        sessionStorage.setItem(recoveryKey, 'true');
        
        // Only show toast if the difference is significant (at least 1 tap difference)
        // AND we're coming back online (navigator.onLine was false or this is first load)
        const significantDifference = backupTotal - serverTotal >= 1;
        if (significantDifference && !navigator.onLine) {
          toast.success('Data recovered from local backup', {
            description: `Your ${backupTotal} taps were protected and restored.`,
            duration: 5000,
          });
        }
        
        // PHASE 3: Use smart merge to take higher values
        const merged = smartMergeEntries(serverEntry, backup);
        
        return {
          id: serverEntry?.id || '',
          user_id: activeUser.id,
          entry_date: entryDate,
          ...merged,
          is_finalized: false,
        } as DailyEntry;
      }
      
      return serverEntry;
    },
    // BULLETPROOF: Increased staleTime to 30 seconds to prevent
    // refetch from overwriting optimistic updates during active tracking
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    // Don't refetch on window focus during active session
    refetchOnWindowFocus: false,
    // Retry on auth errors - session may recover
    retry: (failureCount, error) => {
      if (error?.message === 'AUTH_SESSION_EXPIRED') {
        return failureCount < 3; // Try 3 times with session refresh
      }
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  // Update counter mutation (auto-save) with offline support
  // BULLETPROOF: Uses server-side merge function to prevent multi-device conflicts
  const updateCounterMutation = useMutation({
    mutationKey: ['update-counter', entryDate],
    mutationFn: async (updates: Partial<DailyEntry>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Use the safe upsert function that merges sales_log instead of overwriting
      // This prevents iPad/phone sync issues where stale cache overwrites sales
      const { data, error } = await supabase.rpc('upsert_daily_entry_safe', {
        p_user_id: user.id,
        p_entry_date: entryDate,
        p_doors_knocked: updates.doors_knocked ?? null,
        p_decision_makers: updates.decision_makers ?? null,
        p_pitches: updates.pitches ?? null,
        p_transitions: updates.transitions ?? null,
        p_presentations: updates.presentations ?? null,
        p_closes: updates.closes ?? null,
        p_fp_plus: updates.fp_plus ?? null,
        p_prmr: updates.prmr ?? null,
        p_upgrade_prmr: updates.upgrade_prmr ?? null,
        p_work_start_time: updates.work_start_time ?? null,
        p_work_end_time: updates.work_end_time ?? null,
        p_break_periods: updates.break_periods ? JSON.parse(JSON.stringify(updates.break_periods)) : null,
        p_counter_timestamps: updates.counter_timestamps ? JSON.parse(JSON.stringify(updates.counter_timestamps)) : null,
        p_custom_counters: updates.custom_counters ? JSON.parse(JSON.stringify(updates.custom_counters)) : null,
        p_timezone: updates.timezone ?? null,
        p_sales_log: updates.sales_log ? JSON.parse(JSON.stringify(updates.sales_log)) : null,
        p_is_finalized: updates.is_finalized ?? null,
      });

      if (error) {
        // Check for finalized entry error
        if (error.message?.includes('finalized')) {
          throw new Error('ENTRY_ALREADY_FINALIZED');
        }
        throw error;
      }
      
      return data;
    },
    // OFFLINE SUPPORT: Queue mutations when offline, retry when back online
    networkMode: 'offlineFirst',
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['daily-entry', entryDate] });

      // Snapshot previous value
      const previousEntry = queryClient.getQueryData(['daily-entry', entryDate]);

      // PHASE 3: Smart merge on mutation - NEVER overwrite with zeros
      queryClient.setQueryData(['daily-entry', entryDate], (old: DailyEntry | null) => {
        if (!old) {
          // BULLETPROOF: If cache is empty, check localStorage backup first
          const userId = getCurrentUserId();
          const backup = userId ? getInstantBackup(userId, entryDate) : null;
          
          if (backup && getActivityTotal(backup) > 0) {
            console.log('[useDailyEntry] onMutate: Using backup to prevent zeros overwrite');
            // Smart merge: take HIGHER value for each counter
            return smartMergeEntries(
              {
                doors_knocked: 0,
                decision_makers: 0,
                pitches: 0,
                transitions: 0,
                presentations: 0,
                closes: 0,
                fp_plus: 0,
                prmr: 0,
                is_finalized: false,
                custom_counters: {},
                ...updates,
              },
              backup
            ) as DailyEntry;
          }
          
          // No backup - use updates as-is (this is a genuinely new entry)
          return {
            doors_knocked: 0,
            decision_makers: 0,
            pitches: 0,
            transitions: 0,
            presentations: 0,
            closes: 0,
            fp_plus: 0,
            prmr: 0,
            is_finalized: false,
            custom_counters: {},
            ...updates,
          } as DailyEntry;
        }
        return { ...old, ...updates };
      });

      return { previousEntry };
    },
    onError: (err, updates, context) => {
      // Rollback on error
      queryClient.setQueryData(['daily-entry', entryDate], context?.previousEntry);
      // Don't show generic error toast here - let the caller handle offline-aware messaging
    },
    onSuccess: (data) => {
      // Mark backup as server-confirmed after successful mutation
      const userId = getCurrentUserId();
      if (userId && data) {
        try {
          const key = `track-backup-${userId}-${entryDate}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            const backup = JSON.parse(stored);
            backup.lastServerSync = new Date().toISOString();
            localStorage.setItem(key, JSON.stringify(backup));
            console.log('[useDailyEntry] Backup marked as server-confirmed');
          }
        } catch {}
      }
    },
    onSettled: () => {
      // BULLETPROOF: DON'T invalidate daily-entry during active tracking
      // This was causing race conditions where stale data overwrote optimistic updates
      // Only invalidate activity summary for real-time leaderboard updates
      queryClient.invalidateQueries({ queryKey: ['activity-summary'], refetchType: 'all' });
      // Invalidate today leaderboard for live rankings
      queryClient.invalidateQueries({ queryKey: ['today-leaderboard'], refetchType: 'all' });
      // Invalidate team live data for Team Reports real-time updates
      queryClient.invalidateQueries({ queryKey: ['team-live-data'], refetchType: 'all' });
      // Invalidate expanded leaderboard for Timing Breakdown to show latest timestamps
      queryClient.invalidateQueries({ queryKey: ['expanded-leaderboard'], refetchType: 'all' });
      // Invalidate cumulative-fp for Progress Over Time chart real-time updates
      queryClient.invalidateQueries({ queryKey: ['cumulative-fp'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['all-daily-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['insights-data'], refetchType: 'all' });
      // Invalidate competition/incentive progress for real-time updates
      queryClient.invalidateQueries({ queryKey: ['my-active-incentives'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['incentive-progress'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['my-active-challenges'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['challenge-progress'], refetchType: 'all' });
      // Invalidate goals data
      queryClient.invalidateQueries({ queryKey: ['rep-goals'], refetchType: 'all' });
    },
  });

  // Finalize entry mutation
  const finalizeEntryMutation = useMutation({
    mutationFn: async (data: {
      doors_knocked: number;
      decision_makers: number;
      pitches: number;
      transitions: number;
      presentations: number;
      closes: number;
      fp_plus: number;
      prmr: number;
      upgrade_prmr?: number | null;
      saveDate: string;
      work_start_time?: string;
      work_end_time?: string;
      sales_log?: Sale[];
      daily_target?: number | null;
    }) => {
      // Wait for any pending counter updates to complete first
      await queryClient.refetchQueries({ queryKey: ['update-counter', data.saveDate] });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // BULLETPROOF: Use safe upsert RPC for finalization to prevent data overwrites
      // This ensures sales_log, counter_timestamps etc. are merged, not replaced
      const { data: result, error } = await supabase.rpc('upsert_daily_entry_safe', {
        p_user_id: user.id,
        p_entry_date: data.saveDate,
        p_doors_knocked: data.doors_knocked,
        p_decision_makers: data.decision_makers,
        p_pitches: data.pitches,
        p_transitions: data.transitions,
        p_presentations: data.presentations,
        p_closes: data.closes,
        p_fp_plus: data.fp_plus,
        p_prmr: data.prmr,
        p_upgrade_prmr: data.upgrade_prmr ?? null,
        p_work_start_time: data.work_start_time ?? null,
        p_work_end_time: data.work_end_time ?? null,
        p_break_periods: null,
        p_counter_timestamps: null,
        p_custom_counters: null,
        p_timezone: null,
        p_sales_log: data.sales_log ? JSON.parse(JSON.stringify(data.sales_log)) : null,
        p_is_finalized: true,
      });

      if (error) throw error;

      // Snapshot the daily target at finalization time for "mission complete" tracking
      if (data.daily_target != null && data.daily_target > 0) {
        const entryId = typeof result === 'object' && result !== null ? (result as any).id : null;
        if (entryId) {
          await supabase
            .from('daily_entries')
            .update({ daily_target: data.daily_target } as any)
            .eq('id', entryId);
        }
      }
      
      // Check for automatic stage progression if FP+ is logged
      if (data.fp_plus > 0) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.functions.invoke('check-auto-stage-progression', {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
          }
        } catch (stageError) {
          console.error('Error checking auto stage progression:', stageError);
          // Don't throw - this is a non-critical enhancement
        }
      }
      
      // Check for personal records (best day FP+ or PRMR)
      if (data.fp_plus > 0 || data.prmr > 0) {
        try {
          await supabase.functions.invoke('check-personal-records', {
            body: {
              userId: user.id,
              entryId: entry?.id || '',
              fpPlus: data.fp_plus,
              prmr: data.prmr,
              entryDate: data.saveDate
            }
          });
          console.log('[useDailyEntry] Personal records check completed');
        } catch (recordsError) {
          console.error('Error checking personal records:', recordsError);
          // Don't throw - this is a non-critical enhancement
        }
      }
    },
    onSuccess: async (_, variables) => {
      // Clear localStorage caches that might have stale data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        clearPreseasonFPCache(user.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ['daily-entry', variables.saveDate], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['daily-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['all-daily-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['preseason-fp-total'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['ytd-prmr-total'], refetchType: 'all' });
      // Force refetch activity-summary and cumulative-fp for Home page updates even when not mounted
      queryClient.invalidateQueries({ queryKey: ['activity-summary'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['insights-data'], refetchType: 'all' });
      // Force refetch cumulative-fp for Progress Over Time chart to show finalized data
      queryClient.invalidateQueries({ queryKey: ['cumulative-fp'], refetchType: 'all' });
      // Invalidate worked-days-data for Goals calendar to update worked/planned visuals
      queryClient.invalidateQueries({ queryKey: ['worked-days-data'], refetchType: 'all' });
      // Invalidate all leaderboards so they update immediately
      queryClient.invalidateQueries({ queryKey: ['yesterday-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['weekly-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['monthly-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['ytd-leaderboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['season-leaderboard'], refetchType: 'all' });
      // PROTECTION LAYER 4: Update today leaderboard to show finalized data
      queryClient.invalidateQueries({ queryKey: ['today-leaderboard'], refetchType: 'all' });
      // Invalidate group-recruits in case stage was auto-progressed
      queryClient.invalidateQueries({ queryKey: ['group-recruits'], refetchType: 'all' });
      // Invalidate personal records for any UI that shows them
      queryClient.invalidateQueries({ queryKey: ['personal-records'], refetchType: 'all' });
      // Invalidate competition/incentive progress
      queryClient.invalidateQueries({ queryKey: ['my-active-incentives'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['incentive-progress'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['my-active-challenges'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['challenge-progress'], refetchType: 'all' });
      // Invalidate goals data
      queryClient.invalidateQueries({ queryKey: ['rep-goals'], refetchType: 'all' });
      toast.success('Entry saved successfully!');
    },
  });

  // Reset entry for new day
  const resetEntryMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('daily_entries')
        .upsert({
          user_id: user.id,
          entry_date: entryDate,
          doors_knocked: 0,
          decision_makers: 0,
          pitches: 0,
          transitions: 0,
          presentations: 0,
          closes: 0,
          fp_plus: 0,
          prmr: 0,
          is_finalized: false,
          work_start_time: null,
          work_end_time: null,
          break_periods: [],
          counter_timestamps: {},
          custom_counters: {},
          sales_log: [],
        }, {
          onConflict: 'user_id,entry_date'
        })
        .select()
        .single();

      if (error) throw error;
      
      // Transform the data
      return {
        ...data,
        break_periods: (data.break_periods as any) || [],
        counter_timestamps: (data.counter_timestamps as any) || {},
        custom_counters: (data.custom_counters as any) || {},
        sales_log: (data.sales_log as any) || [],
      } as unknown as DailyEntry;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['daily-entry', entryDate], data);
      // Invalidate all leaderboard and activity queries
      queryClient.invalidateQueries({ queryKey: ['daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['all-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['today-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['yesterday-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['season-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['ytd-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
      queryClient.invalidateQueries({ queryKey: ['competitor-nudge'] });
      queryClient.invalidateQueries({ queryKey: ['week-summary'] });
    },
  });

  // Delete entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('daily_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-entry', entryDate] });
      queryClient.invalidateQueries({ queryKey: ['daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['all-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['preseason-fp-total'] });
      queryClient.invalidateQueries({ queryKey: ['ytd-prmr-total'] });
      queryClient.invalidateQueries({ queryKey: ['week-summary'] });
      queryClient.invalidateQueries({ queryKey: ['last-week-summary'] });
      queryClient.invalidateQueries({ queryKey: ['yesterday-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['season-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['insights-data'] });
      // Invalidate worked-days-data for Goals calendar to update worked/planned visuals
      queryClient.invalidateQueries({ queryKey: ['worked-days-data'] });
      toast.success("Entry deleted");
    },
    onError: (error) => {
      console.error('Error deleting entry:', error);
      toast.error("Failed to delete entry");
    },
  });

  // Clear local cache for Track UI reset (shows zeros after save)
  // IMPORTANT: This only affects Track page display
  // CalendarView uses entries prop (from all-daily-entries query) as source of truth
  const clearLocalEntry = () => {
    // Set zeros with is_finalized: true to:
    // 1. Reset Track UI to zeros (visual confirmation)
    // 2. Block any accidental counter updates via updateCounter
    queryClient.setQueryData(['daily-entry', entryDate], {
      doors_knocked: 0,
      decision_makers: 0,
      pitches: 0,
      transitions: 0,
      presentations: 0,
      closes: 0,
      fp_plus: 0,
      prmr: 0,
      is_finalized: true, // CRITICAL: Blocks updateCounter from overwriting
      work_start_time: null,
      work_end_time: null,
      break_periods: [],
      counter_timestamps: {},
      timezone: null,
      custom_counters: {},
    });
    // Invalidate all-daily-entries so Calendar/Insights show fresh data
    queryClient.invalidateQueries({ queryKey: ['all-daily-entries'] });
  };

  // Detect if data is potentially stale (refetching in background)
  // This helps prevent showing stale cache data that could confuse users
  const isRefreshing = fetchStatus === 'fetching';
  
  return {
    entry: entry || {
      doors_knocked: 0,
      decision_makers: 0,
      pitches: 0,
      transitions: 0,
      presentations: 0,
      closes: 0,
      fp_plus: 0,
      prmr: 0,
      is_finalized: false,
      work_start_time: null,
      work_end_time: null,
      break_periods: [],
      counter_timestamps: {},
      timezone: null,
      custom_counters: {},
      sales_log: [],
    },
    isLoading,
    // True when actively fetching data (initial load or background refresh)
    isRefreshing,
    // PHASE 2: Freshness gate - true when:
    // 1. Query has completed fetching (fetchStatus is 'idle')
    // 2. OR we're offline with a valid backup
    // 3. OR we have a valid backup (allow immediate interaction while syncing in background)
    isFreshDataVerified: fetchStatus === 'idle' || isOfflineWithBackup || hasValidBackup,
    isOfflineWithBackup,
    fetchStatus,
    updateCounter: updateCounterMutation.mutateAsync,
    finalizeEntry: finalizeEntryMutation.mutateAsync, // Use mutateAsync so we can await it
    deleteEntry: deleteEntryMutation.mutate,
    resetEntry: resetEntryMutation.mutate,
    clearLocalEntry,
    isFinalizing: finalizeEntryMutation.isPending,
    isResetting: resetEntryMutation.isPending,
  };
};