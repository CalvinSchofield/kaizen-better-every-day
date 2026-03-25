import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "./useCurrentUserId";
import { useRepData } from "./useRepData";
import { useRookieUnlockStatus } from "./useRookieUnlockStatus";

/**
 * Onboarding segment types:
 * 
 * - 'in-org-rookie-preseason': Rookie in our office, summer hasn't started
 * - 'in-org-rookie-summer': Rookie in our office, summer has started
 * - 'in-org-vet': Soph/Vet in our office
 * - 'outside-org': Any user from a different office/group
 */
export type OnboardingSegment = 
  | 'in-org-rookie-preseason'
  | 'in-org-rookie-summer'
  | 'in-org-vet'
  | 'outside-org';

/**
 * Determines which onboarding flow a user should see based on:
 * 1. Whether they're "in our org" (invite code creator belongs to primary office)
 * 2. Their year (Rookie vs Soph/Vet)
 * 3. Whether summer has started
 * 
 * "In our org" = the user's mgmt_group belongs to the primary office,
 * OR the invite code creator belongs to the primary office.
 */
export const useOnboardingSegment = () => {
  const { userId, isReady } = useCurrentUserId();
  const { repData } = useRepData();
  const { hasSummerStarted } = useRookieUnlockStatus(repData);

  const { data: segment, isLoading } = useQuery({
    queryKey: ['onboarding-segment', userId],
    enabled: isReady && !!userId,
    staleTime: 30 * 60 * 1000, // Cache for 30 min — this doesn't change
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<{ isInOrg: boolean }> => {
      if (!userId) return { isInOrg: false };

      // Strategy 1: Check if the user's own recruit record has an mgmt_group
      // that belongs to the primary office
      const { data: recruit } = await supabase
        .from('recruits')
        .select('mgmt_group_id, invite_code_used')
        .eq('id', userId)  // recruits.id matches reps.id which is the recruit UUID
        .maybeSingle();

      // Also try matching by looking up the rep record to find the recruit
      let mgmtGroupId = recruit?.mgmt_group_id;
      let inviteCodeUsed = recruit?.invite_code_used;

      // If no direct match, try finding recruit by email
      if (!mgmtGroupId) {
        const { data: repRecord } = await supabase
          .from('reps')
          .select('email, invite_code_used')
          .eq('user_id', userId)
          .maybeSingle();

        if (repRecord?.invite_code_used) {
          inviteCodeUsed = repRecord.invite_code_used;
        }

        if (repRecord?.email) {
          const { data: recruitByEmail } = await supabase
            .from('recruits')
            .select('mgmt_group_id')
            .ilike('email', repRecord.email)
            .maybeSingle();
          
          mgmtGroupId = recruitByEmail?.mgmt_group_id || null;
        }
      }

      // Check if mgmt_group belongs to primary office
      if (mgmtGroupId) {
        const { data: mgmtGroup } = await supabase
          .from('mgmt_groups')
          .select('office_id')
          .eq('id', mgmtGroupId)
          .maybeSingle();

        if (mgmtGroup?.office_id) {
          return { isInOrg: true };
        }
      }

      // Strategy 2: Check via invite code creator
      if (inviteCodeUsed) {
        const { data: inviteCode } = await supabase
          .from('invite_codes')
          .select('inviter_user_id')
          .eq('code', inviteCodeUsed)
          .maybeSingle();

        if (inviteCode?.inviter_user_id) {
          // Check if inviter leads an mgmt_group with an office
          const { data: inviterMgmt } = await supabase
            .from('mgmt_groups')
            .select('office_id')
            .eq('lead_user_id', inviteCode.inviter_user_id)
            .not('office_id', 'is', null)
            .maybeSingle();

          if (inviterMgmt?.office_id) {
            return { isInOrg: true };
          }

          // Check if inviter is in office_staff
          const { count } = await supabase
            .from('office_staff')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', inviteCode.inviter_user_id);

          if ((count ?? 0) > 0) {
            return { isInOrg: true };
          }

          // Check if inviter is on a team under an mgmt_group with an office
          const { data: inviterRep } = await supabase
            .from('reps')
            .select('id')
            .eq('user_id', inviteCode.inviter_user_id)
            .maybeSingle();

          if (inviterRep?.id) {
            const { data: inviterRecruit } = await supabase
              .from('recruits')
              .select('mgmt_group_id')
              .eq('id', inviterRep.id)
              .maybeSingle();

            if (inviterRecruit?.mgmt_group_id) {
              const { data: inviterMgmtGroup } = await supabase
                .from('mgmt_groups')
                .select('office_id')
                .eq('id', inviterRecruit.mgmt_group_id)
                .maybeSingle();

              if (inviterMgmtGroup?.office_id) {
                return { isInOrg: true };
              }
            }
          }
        }
      }

      return { isInOrg: false };
    },
  });

  const isInOrg = segment?.isInOrg ?? true; // Default to in-org to avoid showing wrong flow
  const isRookie = repData?.year === 'Rookie';
  const isVetOrSoph = repData?.year === 'Vet' || repData?.year === 'Sophomore';

  // Determine segment
  let onboardingSegment: OnboardingSegment;
  if (!isInOrg) {
    onboardingSegment = 'outside-org';
  } else if (isRookie) {
    onboardingSegment = hasSummerStarted ? 'in-org-rookie-summer' : 'in-org-rookie-preseason';
  } else {
    onboardingSegment = 'in-org-vet';
  }

  return {
    segment: onboardingSegment,
    isInOrg,
    isLoading: isLoading || !repData,
    isRookie,
    isVetOrSoph,
    hasSummerStarted,
  };
};
