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
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // Process a single pending sale
  const processSale = async (pending: PendingSale): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== pending.userId) {
        console.log('[PendingSalesQueue] User mismatch, skipping');
        return false;
      }

      // Fetch existing entry
      const { data: existingEntry, error: fetchError } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('entry_date', pending.entryDate)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // Check if sale already exists (idempotency)
      const existingSalesLog = existingEntry?.sales_log as unknown as Sale[] || [];
      if (existingSalesLog.some(s => s.id === pending.saleId)) {
        console.log('[PendingSalesQueue] Sale already saved, dequeuing');
        return true;
      }

      // Create the full sale object
      const fullSale: Sale = {
        id: pending.saleId,
        ...pending.sale,
        timestamp: pending.saleTimestamp,
      };

      const updatedSalesLog = [...existingSalesLog, fullSale];

      // Calculate totals
      const fundedSales = updatedSalesLog.filter(s =>
        s.install_status !== 'cancelled' && s.install_status !== 'never_installed'
      );
      const fpSales = fundedSales.filter(s => s.type === 'fp');
      const upgradeSales = fundedSales.filter(s => s.type === 'upgrade');
      const fpCount = fpSales.length;
      const fpPrmrTotal = fpSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
      const upgradePrmrTotal = upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
      const totalPrmr = fpPrmrTotal + upgradePrmrTotal;
      const calculatedFpPlus = fpCount + (upgradePrmrTotal / 85);

      if (existingEntry) {
        const { error: updateError } = await supabase
          .from('daily_entries')
          .update({
            sales_log: updatedSalesLog as unknown as null,
            closes: fundedSales.length,
            fp_plus: Math.round(calculatedFpPlus * 100) / 100,
            prmr: Math.round(totalPrmr * 100) / 100,
            upgrade_prmr: Math.round(upgradePrmrTotal * 100) / 100,
          })
          .eq('user_id', user.id)
          .eq('entry_date', pending.entryDate);

        if (updateError) throw updateError;
      } else {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const now = new Date().toISOString();

        const { error: insertError } = await supabase
          .from('daily_entries')
          .insert({
            user_id: user.id,
            entry_date: pending.entryDate,
            sales_log: updatedSalesLog as unknown as null,
            closes: fundedSales.length,
            fp_plus: Math.round(calculatedFpPlus * 100) / 100,
            prmr: Math.round(totalPrmr * 100) / 100,
            upgrade_prmr: Math.round(upgradePrmrTotal * 100) / 100,
            doors_knocked: 0,
            decision_makers: 0,
            pitches: 0,
            transitions: 0,
            presentations: 0,
            work_start_time: now,
            timezone,
            is_finalized: true,
          });

        if (insertError) throw insertError;
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

    const queue = loadQueue();
    if (queue.sales.length === 0) {
      isProcessingRef.current = false;
      return;
    }

    console.log('[PendingSalesQueue] Processing queue:', queue.sales.length, 'pending');

    for (const pending of queue.sales) {
      const success = await processSale(pending);
      
      if (success) {
        dequeueSale(pending.id);
        toast.success('Pending sale saved! 💰', { duration: 3000 });
      } else {
        // Increment retry count
        pending.retryCount++;
        if (pending.retryCount >= MAX_RETRIES) {
          // Max retries reached - keep in queue but notify user
          toast.error('Sale failed to save after retries. Please check your connection.', {
            duration: 5000,
          });
        }
        saveQueue(loadQueue()); // Update with new retry count
      }
    }

    isProcessingRef.current = false;

    // Schedule retry for remaining items
    const remaining = loadQueue();
    if (remaining.sales.length > 0) {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
        processQueue();
      }, RETRY_DELAY);
    }
  }, [userId, loadQueue, dequeueSale, saveQueue]);

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
