import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clearPreseasonFPCache } from './usePreseasonFP';
import { getInstantBackup, smartMergeEntries, getCurrentUserId } from './useTrackBackup';
import { getSessionSafe } from "@/utils/authSession";

// Helper to get backup from localStorage (kept for compatibility)
const getBackupFromStorage = (userId: string, entryDate: string): Partial<DailyEntry> | null => {
  return getInstantBackup(userId, entryDate);
};

interface TrackBackupRecord {
  entry: Record<string, unknown>;
  timestamp: string;
  userId: string;
  lastServerSync?: string;
}

const getBackupRecord = (userId: string, entryDate: string): TrackBackupRecord | null => {
  try {
    const key = `track-backup-${userId}-${entryDate}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrackBackupRecord;
    if (parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
};

const getBackupComparisonTimestamp = (backup: TrackBackupRecord): number | null => {
  const referenceIso = backup.lastServerSync || backup.timestamp;
  const ts = new Date(referenceIso).getTime();
  return Number.isNaN(ts) ? null : ts;
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
  // Normalize legacy install_status values
  install_status: sale.install_status === 'funded' ? 'installed' : sale.install_status,
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
  last_reset_at?: string | null;
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

      const backupRecord = getBackupRecord(userId, entryDate);
      const backup = getInstantBackup(userId, entryDate);
      if (!backup || getActivityTotal(backup) === 0) return;

      try {
        const { data: serverRaw, error: serverError } = await supabase
          .from('daily_entries')
          .select('doors_knocked, decision_makers, pitches, transitions, presentations, closes, is_finalized, last_reset_at')
          .eq('user_id', userId)
          .eq('entry_date', entryDate)
          .maybeSingle();

        if (serverError) {
          console.error('[useDailyEntry] Failed to check server state before reconnect sync:', serverError);
          return;
        }

        const serverEntry = serverRaw as Partial<DailyEntry> | null;
        if (serverEntry?.is_finalized) return;

        const serverTotal = getActivityTotal(serverEntry);
        const backupTotal = getActivityTotal(backup);

        // No-op if backup isn't ahead of server
        if (backupTotal <= serverTotal) return;

        // If server was reset after this backup's last server-confirmed point, discard backup
        const lastResetAt = serverEntry?.last_reset_at;
        const backupComparisonTs = backupRecord ? getBackupComparisonTimestamp(backupRecord) : null;
        if (lastResetAt && backupComparisonTs) {
          const resetTs = new Date(lastResetAt).getTime();
          if (!Number.isNaN(resetTs) && backupComparisonTs < resetTs) {
            localStorage.removeItem(`track-backup-${userId}-${entryDate}`);
            sessionStorage.removeItem(`backup-push-${entryDate}`);
            console.log('[useDailyEntry] Discarded stale backup on reconnect (older than server reset)');
            return;
          }
        }

        console.log('[useDailyEntry] Back online - pushing backup to server via safe upsert');
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
      // PERF FIX: Use getSession() (reads local cache, instant) instead of getUser() (network call).
      // HydrationGate already verified auth. Only fall back to refreshSession if no session.
      const { session: resolvedSession } = await getSessionSafe();
      if (!resolvedSession?.user) {
        console.error('[useDailyEntry] Auth session expired - could not refresh');
        throw new Error('AUTH_SESSION_EXPIRED');
      }
      const session = resolvedSession;
      const activeUser = session.user;

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
      
      // Recover from backup if backup has more data than server and entry isn't finalized
      // MULTI-DEVICE SAFETY: Check last_reset_at to prevent stale backups from undoing resets
      if (backup && backupTotal > serverTotal && !serverEntry?.is_finalized) {
        // Check if backup is older than a server-side reset
        const lastResetAt = (serverEntry as DailyEntry | null)?.last_reset_at;
        if (lastResetAt) {
          try {
            const backupKey = `track-backup-${activeUser.id}-${entryDate}`;
            const backupRecord = getBackupRecord(activeUser.id, entryDate);
            const backupTime = backupRecord ? getBackupComparisonTimestamp(backupRecord) : null;
            const resetTime = new Date(lastResetAt).getTime();

            if (backupTime && !Number.isNaN(resetTime) && backupTime < resetTime) {
              console.log('[DailyEntry] Discarding stale backup (older than server reset)', {
                backupTime: new Date(backupTime).toISOString(),
                resetTime: new Date(resetTime).toISOString(),
              });
              // Clear stale backup on this device
              localStorage.removeItem(backupKey);
              sessionStorage.removeItem(`backup-push-${entryDate}`);
              return serverEntry;
            }
          } catch (e) {
            console.error('[DailyEntry] Error checking backup vs reset timestamp:', e);
          }
        }
        console.log('[DailyEntry] Recovering from backup - backup has more data:', backupTotal, 'vs server:', serverTotal);
        
        // PHASE 3: Use smart merge to take higher values
        const merged = smartMergeEntries(serverEntry, backup);
        
        const mergedEntry = {
          id: serverEntry?.id || '',
          user_id: activeUser.id,
          entry_date: entryDate,
          ...merged,
          is_finalized: false,
        } as DailyEntry;
        
        // AUTO-PUSH: Write merged values back to server so they don't keep diverging.
        // This prevents the "Syncing..." loop where backup > server on every fetch.
        const pushKey = `backup-push-${entryDate}`;
        const alreadyPushed = sessionStorage.getItem(pushKey);
        if (!alreadyPushed) {
          sessionStorage.setItem(pushKey, 'true');
          // Fire-and-forget push to server (don't await to avoid blocking the query)
          Promise.resolve(
            supabase.rpc('upsert_daily_entry_safe', {
              p_user_id: activeUser.id,
              p_entry_date: entryDate,
              p_doors_knocked: mergedEntry.doors_knocked ?? null,
              p_decision_makers: mergedEntry.decision_makers ?? null,
              p_pitches: mergedEntry.pitches ?? null,
              p_transitions: mergedEntry.transitions ?? null,
              p_presentations: mergedEntry.presentations ?? null,
              p_closes: mergedEntry.closes ?? null,
              p_fp_plus: mergedEntry.fp_plus ?? null,
              p_prmr: mergedEntry.prmr ?? null,
              p_upgrade_prmr: mergedEntry.upgrade_prmr ?? null,
              p_work_start_time: mergedEntry.work_start_time ?? null,
              p_work_end_time: mergedEntry.work_end_time ?? null,
              p_break_periods: mergedEntry.break_periods ? JSON.parse(JSON.stringify(mergedEntry.break_periods)) : null,
              p_counter_timestamps: mergedEntry.counter_timestamps ? JSON.parse(JSON.stringify(mergedEntry.counter_timestamps)) : null,
              p_custom_counters: mergedEntry.custom_counters ? JSON.parse(JSON.stringify(mergedEntry.custom_counters)) : null,
              p_timezone: mergedEntry.timezone ?? null,
              p_sales_log: mergedEntry.sales_log ? JSON.parse(JSON.stringify(mergedEntry.sales_log)) : null,
              p_is_finalized: null,
            })
          ).then(() => {
            console.log('[DailyEntry] Auto-pushed merged backup to server');
          }).catch((err) => {
            console.error('[DailyEntry] Failed to auto-push backup:', err);
            // Clear push flag so it retries next fetch
            sessionStorage.removeItem(pushKey);
          });
        }
        
        return mergedEntry;
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
      // PERF FIX: Use getSession() (local cache) instead of getUser() (network call)
      const { session } = await getSessionSafe();
      if (!session?.user) {
        throw new Error('AUTH_SESSION_EXPIRED');
      }
      const user = session.user;

      // Use the safe upsert function that merges sales_log instead of overwriting
      // This prevents iPad/phone sync issues where stale cache overwrites sales
      const salesPayload = updates.sales_log ? JSON.parse(JSON.stringify(updates.sales_log)) : null;
      
      // DIAGNOSTIC: Log when sales are being sent to server
      if (salesPayload && salesPayload.length > 0) {
        console.log('[useDailyEntry] RPC call includes sales_log:', {
          salesCount: salesPayload.length,
          saleIds: salesPayload.map((s: any) => s.id?.substring(0, 8)),
          fp_plus: updates.fp_plus,
          prmr: updates.prmr,
        });
      }
      
      const rpcResult = await Promise.race([
        supabase.rpc('upsert_daily_entry_safe', {
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
          p_sales_log: salesPayload,
          p_is_finalized: updates.is_finalized ?? null,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('COUNTER_SYNC_TIMEOUT')), 15000);
        }),
      ]) as { data: any; error: any };

      const { data, error } = rpcResult;

      if (error) {
        console.error('[useDailyEntry] RPC error:', error.message, { hasSales: !!salesPayload });
        // Check for finalized entry error
        if (error.message?.includes('finalized')) {
          throw new Error('ENTRY_ALREADY_FINALIZED');
        }
        throw error;
      }
      
      // DIAGNOSTIC: Verify server response includes sales
      if (salesPayload && salesPayload.length > 0) {
        const returnedSales = (data as any)?.sales_log;
        const returnedCount = Array.isArray(returnedSales) ? returnedSales.length : 0;
        console.log('[useDailyEntry] RPC response sales count:', returnedCount, 
          returnedCount >= salesPayload.length ? '✅' : '⚠️ MISMATCH');
      }
      
      return data;
    },
    // OFFLINE SUPPORT: Queue mutations when offline, retry when back online
    networkMode: 'offlineFirst',
    retry: (failureCount, error) => {
      // Don't retry auth errors beyond 1 attempt (refresh already tried in mutationFn)
      if (error?.message === 'AUTH_SESSION_EXPIRED') return false;
      if (error?.message === 'ENTRY_ALREADY_FINALIZED') return false;
      return failureCount < 3;
    },
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
      // FIX: Only rollback if the previous entry had EQUAL or HIGHER values.
      // If rollback would reduce counter values, keep the optimistic update
      // to prevent backup overwrite with lower values.
      const currentCache = queryClient.getQueryData<DailyEntry>(['daily-entry', entryDate]);
      const previousEntry = context?.previousEntry as DailyEntry | null | undefined;
      
      if (previousEntry && currentCache) {
        const currentTotal = getActivityTotal(currentCache);
        const previousTotal = getActivityTotal(previousEntry);
        
        if (previousTotal < currentTotal) {
          // DON'T rollback — keep higher values in cache so backup stays intact
          console.warn('[useDailyEntry] Mutation failed but keeping optimistic values to protect backup');
          return;
        }
      }
      
      // Safe to rollback (previous had same or higher values)
      queryClient.setQueryData(['daily-entry', entryDate], context?.previousEntry);
    },
    onSuccess: (data) => {
      if (data) {
        const normalized = {
          ...(data as any),
          break_periods: ((data as any).break_periods as any) || [],
          counter_timestamps: ((data as any).counter_timestamps as any) || {},
          custom_counters: ((data as any).custom_counters as any) || {},
          sales_log: ((data as any).sales_log as any) || [],
        } as DailyEntry;

        queryClient.setQueryData(['daily-entry', entryDate], normalized);
      }

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
      // Wait for any pending counter updates to complete first (with timeout to prevent hanging)
      try {
        await Promise.race([
          queryClient.refetchQueries({ queryKey: ['update-counter', data.saveDate] }),
          new Promise(resolve => setTimeout(resolve, 3000)), // 3s timeout
        ]);
      } catch (e) {
        console.warn('[finalizeEntry] refetchQueries timed out or failed, proceeding anyway');
      }
      
      const { user } = await getSessionSafe();
      if (!user) throw new Error('Not authenticated');

      // BULLETPROOF: Use safe upsert RPC for finalization to prevent data overwrites
      // This ensures sales_log, counter_timestamps etc. are merged, not replaced
      const rpcPromise = supabase.rpc('upsert_daily_entry_safe', {
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

      // Timeout protection: prevent indefinite hanging on iOS/mobile
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Finalize request timed out after 15s')), 15000);
      });

      const { data: result, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

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
      
      // Fire-and-forget: Non-critical post-save enhancements (stage progression, personal records)
      // These run in background and never block the save flow
      if (data.fp_plus > 0) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            supabase.functions.invoke('check-auto-stage-progression', {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).catch(e => console.error('Auto stage progression error:', e));
          }
        }).catch(() => {});
      }
      
      if (data.fp_plus > 0 || data.prmr > 0) {
        supabase.functions.invoke('check-personal-records', {
          body: {
            userId: user.id,
            entryId: entry?.id || '',
            fpPlus: data.fp_plus,
            prmr: data.prmr,
            entryDate: data.saveDate
          }
        }).catch(e => console.error('Personal records check error:', e));
      }
    },
    onSuccess: async (_, variables) => {
      // Clear localStorage caches that might have stale data
      const { user } = await getSessionSafe();
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
      const { user } = await getSessionSafe();
      if (!user) throw new Error('Not authenticated');

      const resetTimestamp = new Date().toISOString();
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
          last_reset_at: resetTimestamp,
        } as any, {
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
      
      // CRITICAL: Clear localStorage backup so smartMerge/auto-push recovery
      // doesn't restore old counter values after reset
      try {
        const userId = getCurrentUserId();
        if (userId) {
          const backupKey = `track-backup-${userId}-${entryDate}`;
          localStorage.removeItem(backupKey);
          // Also clear the auto-push guard so future legitimate pushes aren't blocked
          sessionStorage.removeItem(`backup-push-${entryDate}`);
          console.log('[useDailyEntry] Reset: cleared localStorage backup and push guard');
        }
      } catch (e) {
        console.error('[useDailyEntry] Reset: failed to clear backup', e);
      }
      
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

  // If query has ever resolved once (even to null), we have a usable baseline snapshot.
  // This prevents background refetches from locking counters behind a stale "Syncing..." gate.
  const hasResolvedEntrySnapshot = entry !== undefined;

  // Show syncing indicator only for true cold-start fetches with no usable baseline.
  const isRefreshing =
    fetchStatus === 'fetching' &&
    !isOfflineWithBackup &&
    !hasValidBackup &&
    !hasResolvedEntrySnapshot;
  
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
    // True only during cold-start fetches without usable baseline data.
    isRefreshing,
    // PHASE 2: Freshness gate - true when:
    // 1. Query has completed fetching (fetchStatus is 'idle')
    // 2. OR we're offline with a valid backup
    // 3. OR we have a valid backup
    // 4. OR we already have a resolved entry snapshot and are only background-refetching
    isFreshDataVerified:
      fetchStatus === 'idle' ||
      isOfflineWithBackup ||
      hasValidBackup ||
      hasResolvedEntrySnapshot,
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