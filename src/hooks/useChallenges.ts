import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export type ChallengeType = '1v1' | 'group';
export type ChallengeMetric = 'fp_plus' | 'prmr' | 'transitions' | 'doors_knocked';
export type ChallengeStatus = 'pending' | 'declined' | 'active' | 'completed' | 'voided';
export type ChallengeVisibility = 'public' | 'private';
export type ParticipantRole = 'captain_a' | 'captain_b' | 'member';

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  team: 'a' | 'b' | null;
  role: ParticipantRole;
  accepted: boolean | null;
  final_value: number | null;
  accepted_at: string | null;
  // Joined data
  rep_name?: string;
  profile_photo_url?: string;
}

export interface Challenge {
  id: string;
  type: ChallengeType;
  metric: ChallengeMetric;
  status: ChallengeStatus;
  visibility: ChallengeVisibility;
  created_by: string;
  stakes: string | null;
  start_date: string;
  end_date: string;
  winner_user_id: string | null;
  is_tie: boolean;
  tiebreaker_winner_id: string | null;
  created_at: string;
  completed_at: string | null;
  // Joined data
  creator_name?: string;
  participants?: ChallengeParticipant[];
}

export interface CreateChallengeInput {
  type: ChallengeType;
  metric: ChallengeMetric;
  visibility: ChallengeVisibility;
  stakes?: string;
  start_date: string;
  end_date: string;
  participants: Array<{
    user_id: string;
    team?: 'a' | 'b';
    role: ParticipantRole;
  }>;
}

export const useChallenges = (filter: 'active' | 'pending' | 'history' = 'active') => {
  const queryClient = useQueryClient();

  // Set up realtime subscription for challenges
  useEffect(() => {
    const channel = supabase
      .channel('challenges-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'challenges',
        },
        (payload) => {
          console.log('[Realtime] Challenges table changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['challenges'] });
          queryClient.invalidateQueries({ queryKey: ['my-active-challenges'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'challenge_participants',
        },
        (payload) => {
          console.log('[Realtime] Challenge participants changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['challenges'] });
          queryClient.invalidateQueries({ queryKey: ['my-active-challenges'] });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Challenges subscription:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['challenges', filter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Build status filter based on tab
      let statusFilter: ChallengeStatus[];
      if (filter === 'active') {
        statusFilter = ['active'];
      } else if (filter === 'pending') {
        statusFilter = ['pending'];
      } else {
        statusFilter = ['completed', 'declined', 'voided'];
      }

      // Fetch challenges where user is a participant or it's public
      const { data: challenges, error } = await supabase
        .from('challenges')
        .select(`
          *,
          challenge_participants (
            id,
            user_id,
            team,
            role,
            accepted,
            final_value,
            accepted_at
          )
        `)
        .in('status', statusFilter)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get rep names for all participants
      const userIds = new Set<string>();
      challenges?.forEach(c => {
        userIds.add(c.created_by);
        c.challenge_participants?.forEach((p: any) => userIds.add(p.user_id));
      });

      const { data: reps } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url')
        .in('user_id', Array.from(userIds));

      const repMap = new Map(reps?.map(r => [r.user_id, r]) || []);

      // Enrich challenges with names
      return (challenges || []).map(c => ({
        ...c,
        creator_name: repMap.get(c.created_by)?.name || 'Unknown',
        participants: c.challenge_participants?.map((p: any) => ({
          ...p,
          rep_name: repMap.get(p.user_id)?.name || 'Unknown',
          profile_photo_url: repMap.get(p.user_id)?.profile_photo_url,
        })),
      })) as Challenge[];
    },
    staleTime: 30 * 1000,
  });
};

export const useMyActiveChallenges = () => {
  return useQuery({
    queryKey: ['my-active-challenges'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get challenges where I'm a participant and status is active or pending
      const { data: myParticipations, error: partError } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', user.id);

      if (partError) throw partError;
      if (!myParticipations?.length) return [];

      const challengeIds = myParticipations.map(p => p.challenge_id);

      const { data: challenges, error } = await supabase
        .from('challenges')
        .select(`
          *,
          challenge_participants (
            id,
            user_id,
            team,
            role,
            accepted,
            final_value
          )
        `)
        .in('id', challengeIds)
        .in('status', ['active', 'pending'])
        .order('start_date', { ascending: true });

      if (error) throw error;

      // Get rep names
      const userIds = new Set<string>();
      challenges?.forEach(c => {
        userIds.add(c.created_by);
        c.challenge_participants?.forEach((p: any) => userIds.add(p.user_id));
      });

      const { data: reps } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url')
        .in('user_id', Array.from(userIds));

      const repMap = new Map(reps?.map(r => [r.user_id, r]) || []);

      return (challenges || []).map(c => ({
        ...c,
        creator_name: repMap.get(c.created_by)?.name || 'Unknown',
        participants: c.challenge_participants?.map((p: any) => ({
          ...p,
          rep_name: repMap.get(p.user_id)?.name || 'Unknown',
          profile_photo_url: repMap.get(p.user_id)?.profile_photo_url,
        })),
      })) as Challenge[];
    },
    staleTime: 30 * 1000,
  });
};

export const useCreateChallenge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateChallengeInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Validate start date (no same-day after 8 AM)
      const now = new Date();
      const startDate = new Date(input.start_date);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (startDate.getTime() === today.getTime() && now.getHours() >= 8) {
        throw new Error('Cannot start a same-day challenge after 8 AM. Choose tomorrow or later.');
      }

      // Create challenge
      const { data: challenge, error: challengeError } = await supabase
        .from('challenges')
        .insert({
          type: input.type,
          metric: input.metric,
          visibility: input.visibility,
          stakes: input.stakes || null,
          start_date: input.start_date,
          end_date: input.end_date,
          created_by: user.id,
          status: 'pending',
        })
        .select()
        .single();

      if (challengeError) throw challengeError;

      // Add creator as participant (captain_a for 1v1/group)
      const participants = [
        {
          challenge_id: challenge.id,
          user_id: user.id,
          team: input.type === 'group' ? 'a' : null,
          role: 'captain_a' as ParticipantRole,
          accepted: true,
          accepted_at: new Date().toISOString(),
        },
        ...input.participants.map(p => ({
          challenge_id: challenge.id,
          user_id: p.user_id,
          team: p.team || null,
          role: p.role,
          accepted: null, // Pending acceptance
        })),
      ];

      const { error: partError } = await supabase
        .from('challenge_participants')
        .insert(participants);

      if (partError) throw partError;

      return challenge;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-challenges'] });
    },
  });
};

export const useRespondToChallenge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ challengeId, accept }: { challengeId: string; accept: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update participant acceptance
      const { error: partError } = await supabase
        .from('challenge_participants')
        .update({
          accepted: accept,
          accepted_at: accept ? new Date().toISOString() : null,
        })
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id);

      if (partError) throw partError;

      // Check if all participants have accepted
      const { data: participants } = await supabase
        .from('challenge_participants')
        .select('accepted')
        .eq('challenge_id', challengeId);

      const allAccepted = participants?.every(p => p.accepted === true);
      const anyDeclined = participants?.some(p => p.accepted === false);

      // Update challenge status
      let newStatus: ChallengeStatus = 'pending';
      if (anyDeclined) {
        newStatus = 'declined';
      } else if (allAccepted) {
        newStatus = 'active';
      }

      if (newStatus !== 'pending') {
        const { error } = await supabase
          .from('challenges')
          .update({ status: newStatus })
          .eq('id', challengeId);

        if (error) throw error;
      }

      return { accepted: accept, newStatus };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-challenges'] });
    },
  });
};
