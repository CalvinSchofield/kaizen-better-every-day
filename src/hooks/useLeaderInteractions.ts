import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export type InteractionType = 'weekly_training' | 'monthly_review' | 'tough_conversation' | 'praise' | 'check_in' | 'team_training';

export interface LeaderInteraction {
  id: string;
  leader_user_id: string;
  rep_user_id: string;
  rep_notion_page_id: string | null;
  interaction_type: InteractionType;
  notes: string | null;
  created_at: string;
  interaction_date: string;
}

interface UseLeaderInteractionsParams {
  enabled?: boolean;
  repUserIds?: string[];
}

export const useLeaderInteractions = ({ enabled = true, repUserIds }: UseLeaderInteractionsParams = {}) => {
  const queryClient = useQueryClient();

  // Fetch all interactions for the current leader
  const { data: interactions, isLoading } = useQuery({
    queryKey: ['leader-interactions', repUserIds],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('leader_interactions')
        .select('*')
        .eq('leader_user_id', user.id)
        .order('interaction_date', { ascending: false });

      if (repUserIds?.length) {
        query = query.in('rep_user_id', repUserIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LeaderInteraction[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  // Check which reps need monthly reviews
  const repsNeedingMonthlyReview = useMemo(() => {
    if (!interactions || !repUserIds) return [];

    const currentMonth = format(new Date(), 'yyyy-MM');
    const monthlyReviewsThisMonth = new Set(
      interactions
        .filter(i => 
          i.interaction_type === 'monthly_review' && 
          i.interaction_date.startsWith(currentMonth)
        )
        .map(i => i.rep_user_id)
    );

    return repUserIds.filter(id => !monthlyReviewsThisMonth.has(id));
  }, [interactions, repUserIds]);

  // Check which reps need check-ins this week
  const repsNeedingCheckIn = useMemo(() => {
    if (!interactions || !repUserIds) return [];

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = format(oneWeekAgo, 'yyyy-MM-dd');

    const recentCheckIns = new Set(
      interactions
        .filter(i => 
          (i.interaction_type === 'check_in' || i.interaction_type === 'monthly_review') && 
          i.interaction_date >= oneWeekAgoStr
        )
        .map(i => i.rep_user_id)
    );

    return repUserIds.filter(id => !recentCheckIns.has(id));
  }, [interactions, repUserIds]);

  // Log a new interaction
  const logInteractionMutation = useMutation({
    mutationFn: async ({
      repUserId,
      repNotionPageId,
      type,
      notes,
      date,
    }: {
      repUserId: string;
      repNotionPageId?: string;
      type: InteractionType;
      notes?: string;
      date?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('leader_interactions')
        .insert({
          leader_user_id: user.id,
          rep_user_id: repUserId,
          rep_notion_page_id: repNotionPageId || null,
          interaction_type: type,
          notes: notes || null,
          interaction_date: date || format(new Date(), 'yyyy-MM-dd'),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leader-interactions'] });
    },
  });

  // Delete an interaction
  const deleteInteractionMutation = useMutation({
    mutationFn: async (interactionId: string) => {
      const { error } = await supabase
        .from('leader_interactions')
        .delete()
        .eq('id', interactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leader-interactions'] });
    },
  });

  // Get interactions for a specific rep
  const getRepInteractions = (repUserId: string) => {
    return interactions?.filter(i => i.rep_user_id === repUserId) || [];
  };

  // Get last interaction of a specific type for a rep
  const getLastInteraction = (repUserId: string, type?: InteractionType) => {
    const repInteractions = getRepInteractions(repUserId);
    if (type) {
      return repInteractions.find(i => i.interaction_type === type);
    }
    return repInteractions[0];
  };

  // Check if rep has had a monthly review this month
  const hasMonthlyReviewThisMonth = (repUserId: string) => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    return interactions?.some(i => 
      i.rep_user_id === repUserId && 
      i.interaction_type === 'monthly_review' && 
      i.interaction_date.startsWith(currentMonth)
    ) || false;
  };

  return {
    interactions,
    isLoading,
    repsNeedingMonthlyReview,
    repsNeedingCheckIn,
    logInteraction: logInteractionMutation.mutate,
    logInteractionAsync: logInteractionMutation.mutateAsync,
    isLogging: logInteractionMutation.isPending,
    deleteInteraction: deleteInteractionMutation.mutate,
    isDeleting: deleteInteractionMutation.isPending,
    getRepInteractions,
    getLastInteraction,
    hasMonthlyReviewThisMonth,
  };
};
