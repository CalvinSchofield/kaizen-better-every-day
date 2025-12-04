import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Helper to get backup from localStorage
const getBackupFromStorage = (userId: string, entryDate: string): Partial<DailyEntry> | null => {
  try {
    const key = `track-backup-${userId}-${entryDate}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const backup = JSON.parse(stored);
    if (backup.userId !== userId) return null;
    
    // Check if backup is recent (within 24 hours)
    const backupTime = new Date(backup.timestamp);
    const hoursDiff = (Date.now() - backupTime.getTime()) / (1000 * 60 * 60);
    if (hoursDiff > 24) return null;
    
    return backup.entry;
  } catch {
    return null;
  }
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
}

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

export const useDailyEntry = (date?: string) => {
  const queryClient = useQueryClient();
  const entryDate = date || getTodayDate();

  // Fetch entry for specific date with backup recovery
  const { data: entry, isLoading } = useQuery({
    queryKey: ['daily-entry', entryDate],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
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
      
      // BACKUP RECOVERY: Check if localStorage backup has more data than server
      // This prevents display resets on multi-device scenarios
      const backup = getBackupFromStorage(user.id, entryDate);
      const serverTotal = getActivityTotal(serverEntry);
      const backupTotal = getActivityTotal(backup);
      
      if (backup && backupTotal > serverTotal && !serverEntry?.is_finalized) {
        console.log('[DailyEntry] Recovering from backup - backup has more data:', backupTotal, 'vs server:', serverTotal);
        
        // Show recovery notification to reassure user
        toast.success('Data recovered from local backup', {
          description: `Your ${backupTotal} taps were protected and restored.`,
          duration: 5000,
        });
        
        // Merge backup data with server entry (backup wins for counters)
        return {
          id: serverEntry?.id || '',
          user_id: user.id,
          entry_date: entryDate,
          doors_knocked: backup.doors_knocked || 0,
          decision_makers: backup.decision_makers || 0,
          pitches: backup.pitches || 0,
          transitions: backup.transitions || 0,
          presentations: backup.presentations || 0,
          closes: backup.closes || 0,
          fp_plus: serverEntry?.fp_plus || backup.fp_plus || 0,
          prmr: serverEntry?.prmr || backup.prmr || 0,
          is_finalized: false,
          notes: serverEntry?.notes || null,
          work_start_time: backup.work_start_time || serverEntry?.work_start_time,
          work_end_time: backup.work_end_time || serverEntry?.work_end_time,
          break_periods: backup.break_periods || serverEntry?.break_periods || [],
          counter_timestamps: backup.counter_timestamps || serverEntry?.counter_timestamps || {},
          timezone: backup.timezone || serverEntry?.timezone,
          custom_counters: backup.custom_counters || serverEntry?.custom_counters || {},
          sales_log: backup.sales_log || serverEntry?.sales_log || [],
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
  });

  // Update counter mutation (auto-save)
  const updateCounterMutation = useMutation({
    mutationKey: ['update-counter', entryDate],
    mutationFn: async (updates: Partial<DailyEntry>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // PROTECTION LAYER 1: Check if entry is already finalized in database
      // This prevents any accidental overwrites of finalized data
      const { data: existingEntry } = await supabase
        .from('daily_entries')
        .select('is_finalized')
        .eq('user_id', user.id)
        .eq('entry_date', entryDate)
        .maybeSingle();

      if (existingEntry?.is_finalized) {
        throw new Error('ENTRY_ALREADY_FINALIZED');
      }

      const currentEntry = entry || {
        doors_knocked: 0,
        decision_makers: 0,
        pitches: 0,
        transitions: 0,
        presentations: 0,
        closes: 0,
        fp_plus: 0,
        prmr: 0,
        custom_counters: {},
        sales_log: [],
      };

      // Build upsert payload with explicit fields to avoid type issues
      const upsertPayload = {
        user_id: user.id,
        entry_date: entryDate,
        doors_knocked: (updates.doors_knocked ?? currentEntry.doors_knocked) as number,
        decision_makers: (updates.decision_makers ?? currentEntry.decision_makers) as number,
        pitches: (updates.pitches ?? currentEntry.pitches) as number,
        transitions: (updates.transitions ?? currentEntry.transitions) as number,
        presentations: (updates.presentations ?? currentEntry.presentations) as number,
        closes: (updates.closes ?? currentEntry.closes) as number,
        fp_plus: (updates.fp_plus ?? currentEntry.fp_plus) as number,
        prmr: (updates.prmr ?? currentEntry.prmr) as number,
        custom_counters: (updates.custom_counters ?? currentEntry.custom_counters) as any,
        sales_log: (updates.sales_log ?? currentEntry.sales_log) as any,
        work_start_time: updates.work_start_time ?? entry?.work_start_time,
        work_end_time: updates.work_end_time ?? entry?.work_end_time,
        break_periods: (updates.break_periods ?? entry?.break_periods ?? []) as any,
        counter_timestamps: (updates.counter_timestamps ?? entry?.counter_timestamps ?? {}) as any,
        timezone: updates.timezone ?? entry?.timezone,
        // PROTECTION LAYER 2: Never allow counter updates to change finalized status
        is_finalized: existingEntry?.is_finalized || false,
      };

      const { data, error } = await supabase
        .from('daily_entries')
        .upsert(upsertPayload, {
          onConflict: 'user_id,entry_date'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['daily-entry', entryDate] });

      // Snapshot previous value
      const previousEntry = queryClient.getQueryData(['daily-entry', entryDate]);

      // Optimistically update
      queryClient.setQueryData(['daily-entry', entryDate], (old: DailyEntry | null) => {
        if (!old) {
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
      toast.error('Failed to save counter');
    },
    onSettled: () => {
      // BULLETPROOF: DON'T invalidate daily-entry during active tracking
      // This was causing race conditions where stale data overwrote optimistic updates
      // Only invalidate activity summary for real-time leaderboard updates
      queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
      // Invalidate today leaderboard for live rankings
      queryClient.invalidateQueries({ queryKey: ['today-leaderboard'] });
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
    }) => {
      // Wait for any pending counter updates to complete first
      await queryClient.refetchQueries({ queryKey: ['update-counter', data.saveDate] });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('daily_entries')
        .upsert({
          user_id: user.id,
          entry_date: data.saveDate,
          doors_knocked: data.doors_knocked,
          decision_makers: data.decision_makers,
          pitches: data.pitches,
          transitions: data.transitions,
          presentations: data.presentations,
          closes: data.closes,
          fp_plus: data.fp_plus,
          prmr: data.prmr,
          upgrade_prmr: data.upgrade_prmr,
          work_start_time: data.work_start_time,
          work_end_time: data.work_end_time,
          is_finalized: true,
        }, {
          onConflict: 'user_id,entry_date'
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['daily-entry', variables.saveDate] });
      queryClient.invalidateQueries({ queryKey: ['daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['all-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['preseason-fp-total'] });
      queryClient.invalidateQueries({ queryKey: ['ytd-prmr-total'] });
      queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
      queryClient.invalidateQueries({ queryKey: ['insights-data'] });
      // Invalidate all leaderboards so they update immediately
      queryClient.invalidateQueries({ queryKey: ['yesterday-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['ytd-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['season-leaderboard'] });
      // PROTECTION LAYER 4: Update today leaderboard to show finalized data
      queryClient.invalidateQueries({ queryKey: ['today-leaderboard'] });
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
    updateCounter: updateCounterMutation.mutateAsync,
    finalizeEntry: finalizeEntryMutation.mutateAsync, // Use mutateAsync so we can await it
    deleteEntry: deleteEntryMutation.mutate,
    resetEntry: resetEntryMutation.mutate,
    clearLocalEntry,
    isFinalizing: finalizeEntryMutation.isPending,
    isResetting: resetEntryMutation.isPending,
  };
};