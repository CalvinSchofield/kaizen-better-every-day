import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/utils/withTimeout";

export type IncentiveMetric = 'fp_plus' | 'prmr' | 'transitions' | 'doors_knocked';
export type IncentiveTargetType = 'first_to' | 'most_by_end' | 'group_total';
export type IncentiveStatus = 'active' | 'completed' | 'cancelled';
export type IncentiveVisibility = 'public' | 'private';

export interface EligibleRep {
  id: string;
  user_id: string;
  rep_name?: string;
  profile_photo_url?: string;
}

export interface Incentive {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  reward: string;
  metric: IncentiveMetric;
  target_type: IncentiveTargetType;
  target_value: number | null;
  visibility: IncentiveVisibility;
  status: IncentiveStatus;
  start_date: string;
  end_date: string;
  winner_user_id: string | null;
  created_at: string;
  completed_at: string | null;
  // Joined data
  creator_name?: string;
  eligible_reps?: EligibleRep[];
  eligible_count?: number;
}

export interface CreateIncentiveInput {
  title: string;
  description?: string;
  reward: string;
  metric: IncentiveMetric;
  target_type: IncentiveTargetType;
  target_value?: number;
  visibility: IncentiveVisibility;
  start_date: string;
  end_date: string;
  creator_timezone?: string;
  eligible_user_ids: string[];
}

export const useIncentives = (filter: 'active' | 'history' = 'active') => {
  return useQuery({
    queryKey: ['incentives', filter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const statusFilter = filter === 'active' ? ['active'] : ['completed', 'cancelled'];

      const { data: incentives, error } = await supabase
        .from('incentives')
        .select(`
          *,
          incentive_eligible_reps (
            id,
            user_id
          )
        `)
        .in('status', statusFilter)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get creator and eligible rep names
      const userIds = new Set<string>();
      incentives?.forEach(i => {
        userIds.add(i.created_by);
        i.incentive_eligible_reps?.forEach((r: any) => userIds.add(r.user_id));
      });

      const { data: reps } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url')
        .in('user_id', Array.from(userIds));

      const repMap = new Map(reps?.map(r => [r.user_id, r]) || []);

      return (incentives || []).map(i => ({
        ...i,
        creator_name: repMap.get(i.created_by)?.name || 'Unknown',
        eligible_count: i.incentive_eligible_reps?.length || 0,
        eligible_reps: i.incentive_eligible_reps?.map((r: any) => ({
          ...r,
          rep_name: repMap.get(r.user_id)?.name || 'Unknown',
          profile_photo_url: repMap.get(r.user_id)?.profile_photo_url,
        })),
      })) as Incentive[];
    },
    staleTime: 30 * 1000,
  });
};

export const useMyActiveIncentives = () => {
  return useQuery({
    queryKey: ['my-active-incentives'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      // If auth isn't ready yet (or user is signed out), treat as "no incentives".
      if (!user) return [];

      // Get incentives where I'm eligible
      const { data: myEligibility, error: eligError } = await supabase
        .from('incentive_eligible_reps')
        .select('incentive_id')
        .eq('user_id', user.id);

      if (eligError) throw eligError;
      if (!myEligibility?.length) return [];

      const incentiveIds = myEligibility.map((e) => e.incentive_id);

      const { data: incentives, error } = await supabase
        .from('incentives')
        .select(`
          *,
          incentive_eligible_reps (
            id,
            user_id
          )
        `)
        .in('id', incentiveIds)
        .eq('status', 'active')
        .order('end_date', { ascending: true });

      if (error) throw error;

      // Get rep names (creator + eligible reps)
      const userIds = new Set<string>();
      incentives?.forEach((i) => {
        userIds.add(i.created_by);
        i.incentive_eligible_reps?.forEach((r: any) => userIds.add(r.user_id));
      });

      const { data: reps } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url')
        .in('user_id', Array.from(userIds));

      const repMap = new Map(reps?.map((r) => [r.user_id, r]) || []);

      return (incentives || []).map((i) => ({
        ...i,
        creator_name: repMap.get(i.created_by)?.name || 'Unknown',
        eligible_count: i.incentive_eligible_reps?.length || 0,
        eligible_reps: i.incentive_eligible_reps?.map((r: any) => ({
          ...r,
          rep_name: repMap.get(r.user_id)?.name || 'Unknown',
          profile_photo_url: repMap.get(r.user_id)?.profile_photo_url,
        })),
      })) as Incentive[];
    },
    staleTime: 30 * 1000,
    retry: 1,
  });
};

export const useCreateIncentive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateIncentiveInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create incentive
      const { data: incentive, error: incentiveError } = await supabase
        .from('incentives')
        .insert({
          created_by: user.id,
          title: input.title,
          description: input.description || null,
          reward: input.reward,
          metric: input.metric,
          target_type: input.target_type,
          target_value: input.target_value || null,
          visibility: input.visibility,
          start_date: input.start_date,
          end_date: input.end_date,
          creator_timezone: input.creator_timezone || null,
          status: 'active',
        })
        .select()
        .single();

      if (incentiveError) throw incentiveError;

      // Add eligible reps
      const eligibleReps = input.eligible_user_ids.map(userId => ({
        incentive_id: incentive.id,
        user_id: userId,
      }));

      const { error: eligError } = await supabase
        .from('incentive_eligible_reps')
        .insert(eligibleReps);

      if (eligError) throw eligError;

      // Send push notifications to eligible participants
      if (input.eligible_user_ids.length > 0) {
        try {
          const { data: creatorRep } = await supabase
            .from('reps')
            .select('name')
            .eq('user_id', user.id)
            .single();
          
          const creatorName = creatorRep?.name || 'A leader';
          
          await supabase.functions.invoke('send-challenge-notification', {
            body: {
              type: 'incentive_created',
              targetUserIds: input.eligible_user_ids,
              title: '🏆 New Incentive!',
              body: `${creatorName} created "${input.title}" - prize: ${input.reward}`,
            },
          });
        } catch (notifError) {
          console.error('[useCreateIncentive] Notification error (non-fatal):', notifError);
        }
      }

      return incentive;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentives'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-incentives'] });
    },
  });
};

export interface UpdateIncentiveInput {
  id: string;
  title?: string;
  description?: string;
  reward?: string;
  target_value?: number;
  end_date?: string;
  eligible_user_ids?: string[];
}

export const useUpdateIncentive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateIncentiveInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify user is the creator
      const { data: incentive, error: fetchError } = await supabase
        .from('incentives')
        .select('created_by')
        .eq('id', input.id)
        .single();

      if (fetchError) throw fetchError;
      if (incentive.created_by !== user.id) {
        throw new Error('Only the creator can edit this incentive');
      }

      // Update incentive fields
      const updateFields: any = {};
      if (input.title !== undefined) updateFields.title = input.title;
      if (input.description !== undefined) updateFields.description = input.description;
      if (input.reward !== undefined) updateFields.reward = input.reward;
      if (input.target_value !== undefined) updateFields.target_value = input.target_value;
      if (input.end_date !== undefined) updateFields.end_date = input.end_date;

      if (Object.keys(updateFields).length > 0) {
        const { error: updateError } = await supabase
          .from('incentives')
          .update(updateFields)
          .eq('id', input.id);

        if (updateError) throw updateError;
      }

      // Update eligible reps if provided
      if (input.eligible_user_ids !== undefined) {
        // Delete existing eligible reps
        await supabase
          .from('incentive_eligible_reps')
          .delete()
          .eq('incentive_id', input.id);

        // Insert new eligible reps
        if (input.eligible_user_ids.length > 0) {
          const eligibleReps = input.eligible_user_ids.map(userId => ({
            incentive_id: input.id,
            user_id: userId,
          }));

          const { error: eligError } = await supabase
            .from('incentive_eligible_reps')
            .insert(eligibleReps);

          if (eligError) throw eligError;
        }
      }

      return { id: input.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentives'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-incentives'] });
    },
  });
};

export const useCancelIncentive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (incentiveId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify user is the creator and incentive hasn't been claimed
      const { data: incentive, error: fetchError } = await supabase
        .from('incentives')
        .select('created_by, status, winner_user_id')
        .eq('id', incentiveId)
        .single();

      if (fetchError) throw fetchError;
      if (incentive.created_by !== user.id) {
        throw new Error('Only the creator can cancel this incentive');
      }
      if (incentive.winner_user_id) {
        throw new Error('Cannot cancel an incentive that has already been claimed');
      }
      if (incentive.status === 'cancelled') {
        throw new Error('Incentive is already cancelled');
      }

      // Cancel the incentive
      const { error: updateError } = await supabase
        .from('incentives')
        .update({ 
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', incentiveId);

      if (updateError) throw updateError;

      return { id: incentiveId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentives'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-incentives'] });
    },
  });
};
