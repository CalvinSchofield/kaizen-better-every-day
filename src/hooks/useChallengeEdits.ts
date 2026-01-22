import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { ChallengeVisibility } from "./useChallenges";

export interface ChallengeEditProposal {
  id: string;
  challenge_id: string;
  proposed_by: string;
  proposed_at: string;
  proposed_changes: {
    stakes?: string;
    end_date?: string;
    visibility?: ChallengeVisibility;
  };
  status: 'pending' | 'approved' | 'rejected';
  resolved_at: string | null;
  proposer_name?: string;
}

export interface ChallengeEditApproval {
  id: string;
  proposal_id: string;
  user_id: string;
  approved: boolean | null;
  responded_at: string | null;
  rep_name?: string;
}

// Fetch pending proposals for a challenge
export const useChallengeEditProposals = (challengeId: string | null) => {
  const queryClient = useQueryClient();

  // Set up realtime subscription
  useEffect(() => {
    if (!challengeId) return;

    const channel = supabase
      .channel(`challenge-edits-${challengeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'challenge_edit_proposals',
          filter: `challenge_id=eq.${challengeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['challenge-edit-proposals', challengeId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'challenge_edit_approvals',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['challenge-edit-proposals', challengeId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [challengeId, queryClient]);

  return useQuery({
    queryKey: ['challenge-edit-proposals', challengeId],
    queryFn: async () => {
      if (!challengeId) return [];

      const { data: proposals, error } = await supabase
        .from('challenge_edit_proposals')
        .select('*')
        .eq('challenge_id', challengeId)
        .eq('status', 'pending')
        .order('proposed_at', { ascending: false });

      if (error) throw error;
      if (!proposals?.length) return [];

      // Get proposer names and approvals
      const proposerIds = proposals.map(p => p.proposed_by);
      const proposalIds = proposals.map(p => p.id);

      const [repsResult, approvalsResult] = await Promise.all([
        supabase.from('reps').select('user_id, name').in('user_id', proposerIds),
        supabase.from('challenge_edit_approvals').select('*').in('proposal_id', proposalIds),
      ]);

      const repMap = new Map(repsResult.data?.map(r => [r.user_id, r.name]) || []);

      return proposals.map(p => ({
        ...p,
        proposed_changes: p.proposed_changes as ChallengeEditProposal['proposed_changes'],
        proposer_name: repMap.get(p.proposed_by) || 'Unknown',
        approvals: approvalsResult.data?.filter(a => a.proposal_id === p.id) || [],
      })) as (ChallengeEditProposal & { approvals: ChallengeEditApproval[] })[];
    },
    enabled: !!challengeId,
    staleTime: 30 * 1000,
  });
};

// Propose an edit to a challenge
export const useProposeEdit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      challengeId,
      changes,
    }: {
      challengeId: string;
      changes: { stakes?: string; end_date?: string; visibility?: ChallengeVisibility };
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get all participants for this challenge
      const { data: participants } = await supabase
        .from('challenge_participants')
        .select('user_id')
        .eq('challenge_id', challengeId);

      if (!participants?.length) throw new Error('No participants found');

      // Create the proposal
      const { data: proposal, error: proposalError } = await supabase
        .from('challenge_edit_proposals')
        .insert({
          challenge_id: challengeId,
          proposed_by: user.id,
          proposed_changes: changes,
        })
        .select()
        .single();

      if (proposalError) throw proposalError;

      // Create approval records for all participants (proposer auto-approves)
      const approvals = participants.map(p => ({
        proposal_id: proposal.id,
        user_id: p.user_id,
        approved: p.user_id === user.id ? true : null,
        responded_at: p.user_id === user.id ? new Date().toISOString() : null,
      }));

      const { error: approvalError } = await supabase
        .from('challenge_edit_approvals')
        .insert(approvals);

      if (approvalError) throw approvalError;

      // Send notifications to other participants
      const otherParticipants = participants.filter(p => p.user_id !== user.id);
      if (otherParticipants.length > 0) {
        try {
          const { data: proposerRep } = await supabase
            .from('reps')
            .select('name')
            .eq('user_id', user.id)
            .single();

          await supabase.functions.invoke('send-challenge-notification', {
            body: {
              type: 'challenge_edit_proposed',
              targetUserIds: otherParticipants.map(p => p.user_id),
              title: '✏️ Challenge Edit Proposed',
              body: `${proposerRep?.name || 'Someone'} proposed changes to your challenge. Approval needed!`,
            },
          });
        } catch (e) {
          console.error('[useProposeEdit] Notification error:', e);
        }
      }

      return proposal;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['challenge-edit-proposals', variables.challengeId] });
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
    },
  });
};

// Respond to an edit proposal
export const useRespondToEditProposal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      proposalId,
      approve,
    }: {
      proposalId: string;
      approve: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update approval
      const { error: approvalError } = await supabase
        .from('challenge_edit_approvals')
        .update({
          approved: approve,
          responded_at: new Date().toISOString(),
        })
        .eq('proposal_id', proposalId)
        .eq('user_id', user.id);

      if (approvalError) throw approvalError;

      // Get proposal and all approvals
      const { data: proposal } = await supabase
        .from('challenge_edit_proposals')
        .select('*, challenge_id')
        .eq('id', proposalId)
        .single();

      if (!proposal) throw new Error('Proposal not found');

      const { data: approvals } = await supabase
        .from('challenge_edit_approvals')
        .select('approved')
        .eq('proposal_id', proposalId);

      // Check if all have responded
      const allResponded = approvals?.every(a => a.approved !== null);
      const allApproved = approvals?.every(a => a.approved === true);
      const anyRejected = approvals?.some(a => a.approved === false);

      if (anyRejected) {
        // Reject the proposal
        await supabase
          .from('challenge_edit_proposals')
          .update({ status: 'rejected', resolved_at: new Date().toISOString() })
          .eq('id', proposalId);

        return { status: 'rejected', challengeId: proposal.challenge_id };
      }

      if (allResponded && allApproved) {
        // Apply the changes to the challenge
        const changes = proposal.proposed_changes as { stakes?: string; end_date?: string; visibility?: ChallengeVisibility };
        const updateData: Record<string, string> = {};
        if (changes.stakes !== undefined) updateData.stakes = changes.stakes;
        if (changes.end_date !== undefined) updateData.end_date = changes.end_date;
        if (changes.visibility !== undefined) updateData.visibility = changes.visibility;

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('challenges')
            .update(updateData)
            .eq('id', proposal.challenge_id);
        }

        // Mark proposal as approved
        await supabase
          .from('challenge_edit_proposals')
          .update({ status: 'approved', resolved_at: new Date().toISOString() })
          .eq('id', proposalId);

        return { status: 'approved', challengeId: proposal.challenge_id };
      }

      return { status: 'pending', challengeId: proposal.challenge_id };
    },
    onSuccess: (result) => {
      if (result?.challengeId) {
        queryClient.invalidateQueries({ queryKey: ['challenge-edit-proposals', result.challengeId] });
        queryClient.invalidateQueries({ queryKey: ['challenges'] });
        queryClient.invalidateQueries({ queryKey: ['my-active-challenges'] });
      }
    },
  });
};
