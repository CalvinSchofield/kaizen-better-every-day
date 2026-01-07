import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      if (!user) throw new Error('Not authenticated');

      // Get incentives where I'm eligible
      const { data: myEligibility, error: eligError } = await supabase
        .from('incentive_eligible_reps')
        .select('incentive_id')
        .eq('user_id', user.id);

      if (eligError) throw eligError;
      if (!myEligibility?.length) return [];

      const incentiveIds = myEligibility.map(e => e.incentive_id);

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

      // Get rep names
      const userIds = new Set<string>();
      incentives?.forEach(i => {
        userIds.add(i.created_by);
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
      })) as Incentive[];
    },
    staleTime: 30 * 1000,
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

      return incentive;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentives'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-incentives'] });
    },
  });
};
