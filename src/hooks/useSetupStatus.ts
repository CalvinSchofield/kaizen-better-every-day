import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "./useCurrentUserId";

interface SetupStatus {
  hasOfficialTotals: boolean;
  setupComplete: boolean;
  /** True if leader explicitly opted out of knocking (exempt from gate) */
  isNonKnockingLeader: boolean;
  isReady: boolean;
  /** Legacy compat */
  needsSetup: boolean;
  clearSetup: () => void;
  recheckSetup: () => void;
}

/**
 * Lightweight check for whether the user has completed the required setup:
 * 1. Official totals synced (initial baseline)
 * 2. Goals set up (setup_complete = true)
 *
 * Leaders who opted out of knocking (knocking_mode_enabled = false) are exempt.
 */
export const useSetupStatus = (): SetupStatus => {
  const { userId } = useCurrentUserId();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['setup-status', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return null;

      const [totalsRes, goalsRes, configRes] = await Promise.all([
        supabase
          .from('official_totals')
          .select('id')
          .eq('user_id', userId)
          .limit(1),
        supabase
          .from('rep_goals')
          .select('setup_complete')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('season_config')
          .select('knocking_mode_enabled')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      return {
        hasOfficialTotals: (totalsRes.data?.length ?? 0) > 0,
        setupComplete: goalsRes.data?.setup_complete === true,
        knockingModeEnabled: configRes.data?.knocking_mode_enabled,
      };
    },
  });

  const hasOfficialTotals = data?.hasOfficialTotals ?? false;
  const setupComplete = data?.setupComplete ?? false;
  const isNonKnockingLeader = data?.knockingModeEnabled === false;
  const needsProductionSetup = !isNonKnockingLeader && (!hasOfficialTotals || !setupComplete);

  return {
    hasOfficialTotals,
    setupComplete,
    isNonKnockingLeader,
    isReady: !isLoading && !!data,
    needsSetup: needsProductionSetup,
    clearSetup: () => {
      localStorage.removeItem('kaizen-setup-complete');
      localStorage.removeItem('kaizen-setup-timestamp');
    },
    recheckSetup: () => { refetch(); },
  };
};
