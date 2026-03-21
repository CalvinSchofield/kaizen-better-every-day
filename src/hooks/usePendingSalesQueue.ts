import { useEffect, useCallback, useRef } from 'react';
import { Sale } from './useDailyEntry';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PENDING_SALES_KEY = 'pending-sales-queue';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

interface PendingSale {
  id: string;
  entryDate: string;
  sale: Omit<Sale, 'id' | 'timestamp'>;
  saleId: string;
  saleTimestamp: string;
  createdAt: string;
  retryCount: number;
  userId: string;
}

interface PendingSalesQueue {
  sales: PendingSale[];
  version: number;
}

/**
 * Pending sales queue with localStorage persistence
 * Ensures sales are never lost even if app closes or network fails
 */
export const usePendingSalesQueue = (userId: string | null) => {
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);

  // Load queue from localStorage
  const loadQueue = useCallback((): PendingSalesQueue => {
    try {
      const stored = localStorage.getItem(PENDING_SALES_KEY);
      if (!stored) return { sales: [], version: 1 };
      const parsed = JSON.parse(stored);
      // Filter to only current user's sales
      return {
        ...parsed,
        sales: (parsed.sales || []).filter((s: PendingSale) => s.userId === userId),
      };
    } catch (error) {
      console.error('[PendingSalesQueue] Failed to load queue:', error);
      return { sales: [], version: 1 };
    }
  }, [userId]);

  // Save queue to localStorage
  const saveQueue = useCallback((queue: PendingSalesQueue) => {
    try {
      // Merge with other users' sales
      const existingStored = localStorage.getItem(PENDING_SALES_KEY);
      let allSales: PendingSale[] = [];
      if (existingStored) {
        const existing = JSON.parse(existingStored);
        allSales = (existing.sales || []).filter((s: PendingSale) => s.userId !== userId);
      }
      const merged = {
        sales: [...allSales, ...queue.sales],
        version: queue.version,
      };
      localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(merged));
    } catch (error) {
      console.error('[PendingSalesQueue] Failed to save queue:', error);
    }
  }, [userId]);

  // Add sale to queue BEFORE attempting to save
  const queueSale = useCallback((
    entryDate: string, 
    sale: Omit<Sale, 'id' | 'timestamp'>
  ): { saleId: string; saleTimestamp: string } => {
    if (!userId) throw new Error('Not authenticated');
    
    const saleId = crypto.randomUUID();
    const saleTimestamp = new Date().toISOString();
    
    const pendingSale: PendingSale = {
      id: crypto.randomUUID(),
      entryDate,
      sale,
      saleId,
      saleTimestamp,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      userId,
    };
    
    const queue = loadQueue();
    queue.sales.push(pendingSale);
    saveQueue(queue);
    
    console.log('[PendingSalesQueue] Sale queued:', pendingSale.id);
    return { saleId, saleTimestamp };
  }, [userId, loadQueue, saveQueue]);

  // Remove sale from queue after successful save
  const dequeueSale = useCallback((pendingId: string) => {
    const queue = loadQueue();
    queue.sales = queue.sales.filter(s => s.id !== pendingId);
    saveQueue(queue);
    console.log('[PendingSalesQueue] Sale dequeued:', pendingId);
  }, [loadQueue, saveQueue]);

  const ensureAuthenticatedUser = async (expectedUserId: string) => {
    let user = (await supabase.auth.getUser()).data.user;

    if (!user) {
      const { data: refreshData } = await supabase.auth.refreshSession();
      user = refreshData?.user ?? null;
    }

    if (!user || user.id !== expectedUserId) return null;
    return user;
  };

  // Process a single pending sale
  const processSale = async (pending: PendingSale): Promise<boolean> => {
    try {
      const user = await ensureAuthenticatedUser(pending.userId);
      if (!user) {
        console.log('[PendingSalesQueue] User mismatch, skipping');
        return false;
      }

      // Create the full sale object
      const fullSale: Sale = {
        id: pending.saleId,
        ...pending.sale,
        timestamp: pending.saleTimestamp,
      };

      const { data, error } = await supabase.rpc('upsert_daily_entry_safe', {
        p_user_id: user.id,
        p_entry_date: pending.entryDate,
        p_sales_log: JSON.parse(JSON.stringify([fullSale])),
        p_doors_knocked: null,
        p_decision_makers: null,
        p_pitches: null,
        p_transitions: null,
        p_presentations: null,
        p_closes: null,
        p_fp_plus: null,
        p_prmr: null,
        p_upgrade_prmr: null,
        p_work_start_time: null,
        p_work_end_time: null,
        p_break_periods: null,
        p_counter_timestamps: null,
        p_custom_counters: null,
        p_timezone: null,
        p_is_finalized: null,
      });

      if (error) throw error;

      const mergedSalesLog = ((data as { sales_log?: unknown } | null)?.sales_log as Sale[]) || [];
      const wasPersisted = mergedSalesLog.some((sale) => sale.id === pending.saleId);

      if (!wasPersisted) {
        console.warn('[PendingSalesQueue] Sale not confirmed in merged sales_log, will retry');
        return false;
      }

      console.log('[PendingSalesQueue] Sale saved successfully');
      return true;
    } catch (error) {
      console.error('[PendingSalesQueue] Failed to save sale:', error);
      return false;
    }
  };

  // Process entire queue
  const processQueue = useCallback(async () => {
    if (!userId || isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const queue = loadQueue();
      if (queue.sales.length === 0) {
        return;
      }

      console.log('[PendingSalesQueue] Processing queue:', queue.sales.length, 'pending');

      const remainingSales: PendingSale[] = [];

      for (const pending of queue.sales) {
        const success = await processSale(pending);

        if (success) {
          toast.success('Pending sale saved! 💰', { duration: 3000 });
          continue;
        }

        const updatedPending: PendingSale = {
          ...pending,
          retryCount: pending.retryCount + 1,
        };

        if (updatedPending.retryCount >= MAX_RETRIES) {
          toast.error('Sale failed to save after retries. Please check your connection.', {
            duration: 5000,
          });
        }

        remainingSales.push(updatedPending);
      }

      saveQueue({
        ...queue,
        sales: remainingSales,
      });

      // Schedule retry for remaining items
      if (remainingSales.length > 0) {
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          void processQueue();
        }, RETRY_DELAY);
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [userId, loadQueue, saveQueue]);

  // Check for pending sales count
  const getPendingCount = useCallback((): number => {
    const queue = loadQueue();
    return queue.sales.length;
  }, [loadQueue]);

  // Check if there are any pending sales
  const hasPendingSales = useCallback((): boolean => {
    return getPendingCount() > 0;
  }, [getPendingCount]);

  // Get pending sales for display
  const getPendingSales = useCallback((): PendingSale[] => {
    return loadQueue().sales;
  }, [loadQueue]);

  // Process queue on mount and when coming online
  useEffect(() => {
    if (!userId) return;

    // Process on mount
    const timeout = setTimeout(() => {
      processQueue();
    }, 1000);

    // Process when coming back online
    const handleOnline = () => {
      console.log('[PendingSalesQueue] Back online, processing queue');
      processQueue();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('online', handleOnline);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [userId, processQueue]);

  return {
    queueSale,
    dequeueSale,
    processQueue,
    hasPendingSales,
    getPendingCount,
    getPendingSales,
  };
};

// Static helper to check pending sales without hook
export const checkPendingSales = (userId: string): number => {
  try {
    const stored = localStorage.getItem(PENDING_SALES_KEY);
    if (!stored) return 0;
    const parsed = JSON.parse(stored);
    return (parsed.sales || []).filter((s: PendingSale) => s.userId === userId).length;
  } catch {
    return 0;
  }
};
