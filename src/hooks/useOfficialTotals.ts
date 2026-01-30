import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "./useCurrentUserId";
import { toast } from "sonner";

export interface OfficialTotals {
  id: string;
  user_id: string;
  season_year: number;
  season_type: 'preseason' | 'summer';
  fp_plus: number;
  prmr: number;
  knocking_days: number;
  baseline_spent: number; // Pre-tracking spending baseline, added to tracked spending for season totals
  last_verified_at: string | null;
  verified_by: 'self' | 'leader' | 'import' | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertOfficialTotalsParams {
  season_year: number;
  season_type: 'preseason' | 'summer';
  fp_plus: number;
  prmr: number;
  knocking_days: number;
  baseline_spent?: number; // Pre-tracking spending baseline
  verified_by?: 'self' | 'leader' | 'import';
  notes?: string;
  user_id?: string; // For leader updates
}

const CURRENT_SEASON_YEAR = 2025;

export const useOfficialTotals = (seasonType?: 'preseason' | 'summer') => {
  const { userId, isReady } = useCurrentUserId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['official-totals', userId, seasonType],
    enabled: isReady && !!userId,
    queryFn: async () => {
      let queryBuilder = supabase
        .from('official_totals')
        .select('*')
        .eq('user_id', userId!)
        .eq('season_year', CURRENT_SEASON_YEAR);

      if (seasonType) {
        queryBuilder = queryBuilder.eq('season_type', seasonType);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return (data as OfficialTotals[]) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const upsertMutation = useMutation({
    mutationFn: async (params: UpsertOfficialTotalsParams) => {
      const targetUserId = params.user_id || userId;
      if (!targetUserId) throw new Error('No user ID');

      const { data, error } = await supabase
        .from('official_totals')
        .upsert({
          user_id: targetUserId,
          season_year: params.season_year,
          season_type: params.season_type,
          fp_plus: params.fp_plus,
          prmr: params.prmr,
          knocking_days: params.knocking_days,
          baseline_spent: params.baseline_spent ?? 0,
          last_verified_at: new Date().toISOString(),
          verified_by: params.verified_by || 'self',
          notes: params.notes,
        }, {
          onConflict: 'user_id,season_year,season_type',
        })
        .select()
        .single();

      if (error) throw error;
      return data as OfficialTotals;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['official-totals'] });
      queryClient.invalidateQueries({ queryKey: ['effective-fp'] });
      queryClient.invalidateQueries({ queryKey: ['preseason-fp'] });
      queryClient.invalidateQueries({ queryKey: ['cumulative-fp'] });
      toast.success('Official totals updated');
    },
    onError: (error) => {
      console.error('Failed to update official totals:', error);
      toast.error('Failed to update official totals');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (params: { seasonType: 'preseason' | 'summer'; notes?: string }) => {
      if (!userId) throw new Error('No user ID');

      // Get existing record
      const { data: existing, error: fetchError } = await supabase
        .from('official_totals')
        .select('*')
        .eq('user_id', userId)
        .eq('season_year', CURRENT_SEASON_YEAR)
        .eq('season_type', params.seasonType)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      if (!existing) {
        throw new Error('No official totals to verify');
      }

      const { data, error } = await supabase
        .from('official_totals')
        .update({
          last_verified_at: new Date().toISOString(),
          verified_by: 'self',
          notes: params.notes,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data as OfficialTotals;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['official-totals'] });
      toast.success('Numbers verified');
    },
    onError: (error) => {
      console.error('Failed to verify:', error);
      toast.error('Failed to verify numbers');
    },
  });

  // Get the totals for a specific season type
  const getTotals = (type: 'preseason' | 'summer'): OfficialTotals | null => {
    return query.data?.find(t => t.season_type === type) || null;
  };

  // Check if user needs to set up official totals
  const needsSetup = (type: 'preseason' | 'summer'): boolean => {
    return !getTotals(type);
  };

  // Check if verification is stale (> 7 days)
  const isStale = (type: 'preseason' | 'summer'): boolean => {
    const totals = getTotals(type);
    if (!totals?.last_verified_at) return true;
    
    const lastVerified = new Date(totals.last_verified_at);
    const daysSinceVerification = (Date.now() - lastVerified.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceVerification > 7;
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    getTotals,
    needsSetup,
    isStale,
    upsertTotals: upsertMutation.mutate,
    upsertTotalsAsync: upsertMutation.mutateAsync,
    verifyTotals: verifyMutation.mutate,
    isUpserting: upsertMutation.isPending,
    isVerifying: verifyMutation.isPending,
  };
};

// Hook for leaders to fetch/update downline official totals
export const useDownlineOfficialTotals = (userIds: string[]) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['downline-official-totals', userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('official_totals')
        .select('*')
        .in('user_id', userIds)
        .eq('season_year', CURRENT_SEASON_YEAR);

      if (error) throw error;
      return (data as OfficialTotals[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const updateForRepMutation = useMutation({
    mutationFn: async (params: UpsertOfficialTotalsParams & { user_id: string }) => {
      const { data, error } = await supabase
        .from('official_totals')
        .upsert({
          user_id: params.user_id,
          season_year: params.season_year,
          season_type: params.season_type,
          fp_plus: params.fp_plus,
          prmr: params.prmr,
          knocking_days: params.knocking_days,
          baseline_spent: params.baseline_spent ?? 0,
          last_verified_at: new Date().toISOString(),
          verified_by: 'leader',
          notes: params.notes,
        }, {
          onConflict: 'user_id,season_year,season_type',
        })
        .select()
        .single();

      if (error) throw error;
      return data as OfficialTotals;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downline-official-totals'] });
      queryClient.invalidateQueries({ queryKey: ['official-totals'] });
      toast.success('Rep totals updated');
    },
    onError: (error) => {
      console.error('Failed to update rep totals:', error);
      toast.error('Failed to update rep totals');
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    updateForRep: updateForRepMutation.mutate,
    isUpdating: updateForRepMutation.isPending,
  };
};
