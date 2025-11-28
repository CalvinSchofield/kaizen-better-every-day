import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
  is_finalized: boolean;
  notes: string | null;
}

const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export const useDailyEntry = (date?: string) => {
  const queryClient = useQueryClient();
  const entryDate = date || getTodayDate();

  // Fetch entry for specific date
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
      return data as DailyEntry | null;
    },
    staleTime: Infinity, // Don't auto-refetch during mutations
    gcTime: Infinity,
  });

  // Update counter mutation (auto-save)
  const updateCounterMutation = useMutation({
    mutationFn: async (updates: Partial<DailyEntry>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const currentEntry = entry || {
        doors_knocked: 0,
        decision_makers: 0,
        pitches: 0,
        transitions: 0,
        presentations: 0,
        closes: 0,
        fp_plus: 0,
        prmr: 0,
        is_finalized: false,
      };

      const { data, error } = await supabase
        .from('daily_entries')
        .upsert({
          user_id: user.id,
          entry_date: entryDate,
          ...currentEntry,
          ...updates,
        }, {
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
      // Refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['daily-entry', entryDate] });
    },
  });

  // Finalize entry mutation
  const finalizeEntryMutation = useMutation({
    mutationFn: async ({ fp_plus, prmr, saveDate }: { fp_plus: number; prmr: number; saveDate: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('daily_entries')
        .upsert({
          user_id: user.id,
          entry_date: saveDate,
          ...entry,
          fp_plus,
          prmr,
          is_finalized: true,
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['daily-entry', variables.saveDate] });
      toast.success('Entry saved successfully!');
    },
  });

  // Reset entry for new day
  const resetEntryMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
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
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-entry', entryDate] });
      toast.success('Counters reset!');
    },
  });

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
    },
    isLoading,
    updateCounter: updateCounterMutation.mutate,
    finalizeEntry: finalizeEntryMutation.mutate,
    resetEntry: resetEntryMutation.mutate,
    isFinalizing: finalizeEntryMutation.isPending,
    isResetting: resetEntryMutation.isPending,
  };
};