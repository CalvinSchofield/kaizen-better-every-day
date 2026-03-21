import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { DailyEntry } from './useDailyEntry';

export interface CounterEvent {
  id: string; // UUID idempotency key
  field: string;
  delta: number; // +1 or -1
  timestampValue: string | null; // ISO timestamp for the tap
  entryDate: string; // YYYY-MM-DD
  workStartTime?: string | null; // Auto-start on first tap
  timezone?: string | null;
  breakPeriods?: any[] | null; // Auto-end break
  createdAt: string; // When event was created locally
}

const QUEUE_KEY_PREFIX = 'counter-queue-';
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1000;
const RETRY_PAUSE_MS = 10000;

function getQueueKey(userId: string): string {
  return `${QUEUE_KEY_PREFIX}${userId}`;
}

function loadQueue(userId: string): CounterEvent[] {
  try {
    const raw = localStorage.getItem(getQueueKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(userId: string, queue: CounterEvent[]): void {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(getQueueKey(userId));
    } else {
      localStorage.setItem(getQueueKey(userId), JSON.stringify(queue));
    }
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Durable counter queue that persists events to localStorage and processes
 * them one at a time via the atomic apply_counter_event RPC.
 * 
 * Events survive app restarts, offline periods, and auth expiry.
 * Each event has a UUID idempotency key so retries never double-apply.
 */
export function usePendingCounterQueue(userId: string | null) {
  const queryClient = useQueryClient();
  const [queueLength, setQueueLength] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Sync queue length from localStorage
  const refreshQueueLength = useCallback(() => {
    if (!userId) { setQueueLength(0); return; }
    const q = loadQueue(userId);
    setQueueLength(q.length);
  }, [userId]);

  // Process queue: send events one at a time
  const processQueue = useCallback(async () => {
    if (!userId || processingRef.current) return;
    
    processingRef.current = true;
    if (mountedRef.current) setIsProcessing(true);

    try {
      let queue = loadQueue(userId);
      
      while (queue.length > 0 && mountedRef.current) {
        const event = queue[0];

        // Ensure we have a valid session
        let user = (await supabase.auth.getUser()).data.user;
        if (!user) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          user = refreshData?.user ?? null;
          if (!user) {
            console.warn('[CounterQueue] Auth expired, pausing queue');
            break; // Stop processing, will resume on auth change
          }
        }

        try {
          const rpcResult = await Promise.race([
            supabase.rpc('apply_counter_event', {
              p_user_id: user.id,
              p_entry_date: event.entryDate,
              p_field: event.field,
              p_delta: event.delta,
              p_idempotency_key: event.id,
              p_timestamp_value: event.timestampValue,
              p_work_start_time: event.workStartTime ?? null,
              p_timezone: event.timezone ?? null,
              p_break_periods: event.breakPeriods ? JSON.parse(JSON.stringify(event.breakPeriods)) : null,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('COUNTER_EVENT_TIMEOUT')), 12000)
            ),
          ]) as { data: any; error: any };

          if (rpcResult.error) {
            // If entry is finalized, discard the event
            if (rpcResult.error.message?.includes('finalized')) {
              console.warn('[CounterQueue] Entry finalized, discarding event:', event.id);
              queue.shift();
              saveQueue(userId, queue);
              if (mountedRef.current) setQueueLength(queue.length);
              continue;
            }
            throw rpcResult.error;
          }

          // Success! Remove from queue
          queue.shift();
          saveQueue(userId, queue);
          retryCountRef.current = 0;
          if (mountedRef.current) setQueueLength(queue.length);

          // Update React Query cache with server response
          if (rpcResult.data) {
            const serverEntry = {
              ...(rpcResult.data as any),
              break_periods: ((rpcResult.data as any).break_periods as any) || [],
              counter_timestamps: ((rpcResult.data as any).counter_timestamps as any) || {},
              custom_counters: ((rpcResult.data as any).custom_counters as any) || {},
              sales_log: ((rpcResult.data as any).sales_log as any) || [],
            } as DailyEntry;
            queryClient.setQueryData(['daily-entry', event.entryDate], serverEntry);
          }

          // Invalidate leaderboard/report queries (not daily-entry to avoid overwrite)
          queryClient.invalidateQueries({ queryKey: ['activity-summary'], refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: ['today-leaderboard'], refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: ['team-live-data'], refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: ['expanded-leaderboard'], refetchType: 'all' });

        } catch (err: any) {
          console.error('[CounterQueue] Failed to process event:', event.id, err?.message);
          retryCountRef.current++;
          
          if (retryCountRef.current >= MAX_RETRIES) {
            // Pause briefly, then auto-resume processing. This prevents permanent stuck queues.
            console.error('[CounterQueue] Max retries reached, pausing briefly');
            if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
            retryTimerRef.current = window.setTimeout(() => {
              retryTimerRef.current = null;
              retryCountRef.current = 0;
              if (mountedRef.current) void processQueue();
            }, RETRY_PAUSE_MS);
            break;
          }

          // Exponential backoff
          const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCountRef.current), 30000);
          await new Promise(resolve => {
            retryTimerRef.current = window.setTimeout(resolve, delay);
          });
          
          // Re-read queue in case it was modified
          queue = loadQueue(userId);
        }
      }
    } finally {
      processingRef.current = false;
      if (mountedRef.current) {
        setIsProcessing(false);
        refreshQueueLength();
      }
    }
  }, [userId, queryClient, refreshQueueLength]);

  // Push a new event to the queue and start processing
  const pushEvent = useCallback((event: CounterEvent) => {
    if (!userId) return;

    // If queue was paused from prior failures, reset and retry on the next user action.
    retryCountRef.current = 0;
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    
    const queue = loadQueue(userId);
    queue.push(event);
    saveQueue(userId, queue);
    setQueueLength(queue.length);
    
    // Start processing immediately
    void processQueue();
  }, [userId, processQueue]);

  // Resume processing on online/visibility events
  useEffect(() => {
    if (!userId) return;
    mountedRef.current = true;

    const handleResume = () => {
      refreshQueueLength();
      void processQueue();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleResume();
    };

    window.addEventListener('online', handleResume);
    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleVisibility);

    // Safety net: if anything pauses unexpectedly, keep trying while queue has items.
    const intervalId = window.setInterval(() => {
      if (loadQueue(userId).length > 0) void processQueue();
    }, 10000);

    // Process any leftover events from previous session
    const queue = loadQueue(userId);
    if (queue.length > 0) {
      setQueueLength(queue.length);
      // Small delay to let auth hydrate
      setTimeout(() => void processQueue(), 1500);
    }

    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      window.removeEventListener('online', handleResume);
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(intervalId);
    };
  }, [userId, processQueue, refreshQueueLength]);

  // Clear queue (used on reset/finalization)
  const clearQueue = useCallback(() => {
    if (!userId) return;
    saveQueue(userId, []);
    setQueueLength(0);
  }, [userId]);

  return {
    pushEvent,
    queueLength,
    isProcessing,
    clearQueue,
    processQueue,
  };
}
