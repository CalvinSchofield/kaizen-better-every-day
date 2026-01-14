import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { withTimeout } from "@/utils/withTimeout";

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
  creator_timezone?: string;
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

      // First, auto-expire any pending challenges that have passed their end date
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('challenges')
        .update({ status: 'voided' })
        .eq('status', 'pending')
        .lt('end_date', today);

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

      // If auth isn't ready yet (or user is signed out), treat as "no challenges".
      if (!user) return [];

      // Get challenges where I'm a participant and status is active or pending
      // Filter out challenges where I've explicitly declined (accepted = false)
      const { data: myParticipations, error: partError } = await supabase
        .from('challenge_participants')
        .select('challenge_id, accepted')
        .eq('user_id', user.id)
        .neq('accepted', false);

      if (partError) throw partError;
      if (!myParticipations?.length) return [];

      const challengeIds = myParticipations.map((p) => p.challenge_id);

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
      challenges?.forEach((c) => {
        userIds.add(c.created_by);
        c.challenge_participants?.forEach((p: any) => userIds.add(p.user_id));
      });

      const { data: reps } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url')
        .in('user_id', Array.from(userIds));

      const repMap = new Map(reps?.map((r) => [r.user_id, r]) || []);

      return (challenges || []).map((c) => ({
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
    retry: 1,
  });
};

export const useCreateChallenge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateChallengeInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Validation: Prevent self-challenges
      const selfChallenge = input.participants.some(p => p.user_id === user.id);
      if (selfChallenge) {
        throw new Error("You can't challenge yourself!");
      }

      // Validation: Ensure all participants have valid user IDs
      const invalidParticipants = input.participants.filter(p => !p.user_id);
      if (invalidParticipants.length > 0) {
        throw new Error('All participants must have valid accounts');
      }

      // Validation: Check for duplicate active/pending challenges with same opponent
      if (input.type === '1v1' && input.participants.length === 1) {
        const opponentId = input.participants[0].user_id;
        
        const { data: existingChallenges } = await supabase
          .from('challenges')
          .select(`
            id,
            challenge_participants!inner (user_id)
          `)
          .in('status', ['pending', 'active'])
          .gte('end_date', input.start_date)
          .lte('start_date', input.end_date);
        
        // Check if any existing challenge has both the current user and the opponent
        const duplicateChallenge = existingChallenges?.find(c => {
          const participantIds = c.challenge_participants.map((p: any) => p.user_id);
          return participantIds.includes(user.id) && participantIds.includes(opponentId);
        });
        
        if (duplicateChallenge) {
          throw new Error('You already have an active or pending challenge with this opponent for overlapping dates');
        }
      }

      // Allow same-day starts - no time restriction

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
          creator_timezone: input.creator_timezone || null,
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
          accepted: null, // Initially pending
        })),
      ];

      const { error: partError } = await supabase
        .from('challenge_participants')
        .insert(participants);

      if (partError) throw partError;

      // Check if all participants are in creator's downline - if so, auto-start
      let shouldAutoStart = false;
      try {
        const { data: accessData } = await supabase.functions.invoke('fetch-team-access');
        const downlineUserIds = new Set<string>(accessData?.accessibleUserIds || []);
        
        // Only auto-start if creator has leadership access and ALL invited participants are in their downline
        if (accessData?.accessLevel && accessData.accessLevel !== 'none') {
          const allInDownline = input.participants.every(p => downlineUserIds.has(p.user_id));
          if (allInDownline) {
            shouldAutoStart = true;
            console.log('[useCreateChallenge] All participants in downline, auto-starting challenge');
          }
        }
      } catch (accessError) {
        console.warn('[useCreateChallenge] Could not check team access for auto-start:', accessError);
      }

      if (shouldAutoStart) {
        // Auto-accept all participants and set challenge to active
        const { error: participantError } = await supabase
          .from('challenge_participants')
          .update({ accepted: true, accepted_at: new Date().toISOString() })
          .eq('challenge_id', challenge.id);
        
        if (participantError) {
          console.error('[useCreateChallenge] Failed to auto-accept participants:', participantError);
        }
        
        const { error: statusError } = await supabase
          .from('challenges')
          .update({ status: 'active' })
          .eq('id', challenge.id);
        
        if (statusError) {
          console.error('[useCreateChallenge] Failed to set challenge to active:', statusError);
        } else {
          console.log('[useCreateChallenge] Challenge auto-started successfully');
        }
      } else {
        // Send push notifications to invited participants
        const targetUserIds = input.participants.map(p => p.user_id);
        if (targetUserIds.length > 0) {
          try {
            const { data: creatorRep } = await supabase
              .from('reps')
              .select('name')
              .eq('user_id', user.id)
              .single();
            
            const creatorName = creatorRep?.name || 'Someone';
            
            await supabase.functions.invoke('send-challenge-notification', {
              body: {
                type: 'challenge_invite',
                targetUserIds,
                title: '🎯 Challenge Invite!',
                body: `${creatorName} challenged you to a ${input.type === '1v1' ? '1v1' : 'team'} battle on ${input.metric.replace('_', ' ').toUpperCase()}!`,
              },
            });
          } catch (notifError) {
            console.error('[useCreateChallenge] Notification error (non-fatal):', notifError);
          }
        }
      }

      return { challenge, autoStarted: shouldAutoStart };
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

      // Get current user's participant record
      const { data: myParticipant } = await supabase
        .from('challenge_participants')
        .select('role')
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id)
        .single();

      const isCaptain = myParticipant?.role === 'captain_b';

      // Update participant acceptance and get back the updated record
      const { data: updatedParticipant, error: partError } = await supabase
        .from('challenge_participants')
        .update({
          accepted: accept,
          accepted_at: accept ? new Date().toISOString() : null,
        })
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (partError) throw partError;

      // Get all participants to check status - use fresh query
      const { data: participants, error: fetchError } = await supabase
        .from('challenge_participants')
        .select('accepted, role, user_id')
        .eq('challenge_id', challengeId);

      if (fetchError) throw fetchError;

      console.log('[useRespondToChallenge] Participants after update:', participants);

      // Get challenge type to determine decline behavior
      const { data: challengeData } = await supabase
        .from('challenges')
        .select('type')
        .eq('id', challengeId)
        .single();
      
      const isOneOnOne = challengeData?.type === '1v1';
      
      // Determine new status based on acceptance logic:
      // - For 1v1 (head_to_head): If ANYONE declines → whole challenge declined
      // - For team battles: If captain_b declines → whole challenge declined
      // - If a regular member declines → remove them, challenge continues
      // - If all remaining participants accepted → challenge is active
      
      const captainB = participants?.find(p => p.role === 'captain_b');
      const captainBDeclined = captainB?.accepted === false;
      const anyDeclined = participants?.some(p => p.accepted === false);
      
      let newStatus: ChallengeStatus = 'pending';
      
      if (isOneOnOne && anyDeclined) {
        // 1v1 challenge - if anyone declines, it's over
        newStatus = 'declined';
      } else if (captainBDeclined) {
        // Captain B declined - whole challenge is declined
        newStatus = 'declined';
      } else {
        // Check if all participants (excluding declined members) have accepted
        const activeParticipants = participants?.filter(p => p.accepted !== false);
        const allActiveAccepted = activeParticipants?.every(p => p.accepted === true);
        
        console.log('[useRespondToChallenge] Active participants:', activeParticipants);
        console.log('[useRespondToChallenge] All accepted:', allActiveAccepted);
        
        if (allActiveAccepted && activeParticipants && activeParticipants.length >= 2) {
          newStatus = 'active';
        }
      }

      // For team battles (group), keep the participant but mark as declined so they can change their mind
      // For 1v1, the challenge is already declined at this point
      if (!accept && !isCaptain && !isOneOnOne) {
        // Team battle: Keep the participant record with accepted=false
        // They can change their response later via the "Change Response" button
        console.log('[useRespondToChallenge] Team member declined - keeping record for potential change');
        
        // Re-check if challenge can still proceed with remaining accepting participants
        const { data: remainingParticipants } = await supabase
          .from('challenge_participants')
          .select('accepted, role')
          .eq('challenge_id', challengeId)
          .neq('accepted', false); // Only count those who haven't declined
        
        const allAccepted = remainingParticipants?.every(p => p.accepted === true);
        if (allAccepted && remainingParticipants && remainingParticipants.length >= 2) {
          newStatus = 'active';
        }
      }

      console.log('[useRespondToChallenge] New status:', newStatus);

      // Always update the challenge status (even if still pending, to ensure consistency)
      const { error } = await supabase
        .from('challenges')
        .update({ status: newStatus })
        .eq('id', challengeId);

      if (error) throw error;

      // Send notification to challenge creator about acceptance/decline
      try {
        const { data: challenge } = await supabase
          .from('challenges')
          .select('created_by')
          .eq('id', challengeId)
          .single();
        
        if (challenge && challenge.created_by !== user.id) {
          const { data: responderRep } = await supabase
            .from('reps')
            .select('name')
            .eq('user_id', user.id)
            .single();
          
          const responderName = responderRep?.name || 'Someone';
          
          await supabase.functions.invoke('send-challenge-notification', {
            body: {
              type: accept ? 'challenge_accepted' : 'challenge_declined',
              targetUserIds: [challenge.created_by],
              title: accept ? '✅ Challenge Accepted!' : '❌ Challenge Declined',
              body: `${responderName} ${accept ? 'accepted' : 'declined'} your challenge!`,
            },
          });
        }
      } catch (notifError) {
        console.error('[useRespondToChallenge] Notification error (non-fatal):', notifError);
      }

      return { accepted: accept, newStatus };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-challenges'] });
    },
  });
};

// Hook for voiding/deleting a challenge (creator only)
export const useVoidChallenge = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify the user is the creator
      const { data: challenge, error: fetchError } = await supabase
        .from('challenges')
        .select('created_by, status')
        .eq('id', challengeId)
        .single();

      if (fetchError) throw fetchError;
      if (challenge.created_by !== user.id) {
        throw new Error('Only the creator can void this challenge');
      }
      if (challenge.status === 'completed') {
        throw new Error('Cannot void a completed challenge');
      }

      // Update challenge to voided status
      const { error: updateError } = await supabase
        .from('challenges')
        .update({ status: 'voided' })
        .eq('id', challengeId);

      if (updateError) throw updateError;

      return { challengeId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['my-active-challenges'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['challenge-progress'], refetchType: 'all' });
    },
  });
};
