import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "./useCurrentUserId";
import { getSessionSafe } from "@/utils/authSession";

const SETUP_CACHE_KEY_PREFIX = 'setup-status-cache:';
const SETUP_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

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

interface CachedSetupData {
  hasOfficialTotals: boolean;
  setupComplete: boolean;
  knockingModeEnabled: boolean | null;
}

const getCachedSetup = (userId: string): CachedSetupData | null => {
  try {
    const raw = localStorage.getItem(`${SETUP_CACHE_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > SETUP_CACHE_TTL) return null;
    return data as CachedSetupData;
  } catch {
    return null;
  }
};

const setCachedSetup = (userId: string, data: CachedSetupData) => {
  try {
    localStorage.setItem(`${SETUP_CACHE_KEY_PREFIX}${userId}`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch { /* ignore */ }
};

/**
 * Lightweight check for whether the user has completed the required setup:
 * 1. Official totals synced (initial baseline)
 * 2. Goals set up (setup_complete = true)
 *
 * Leaders who opted out of knocking (knocking_mode_enabled = false) are exempt.
 * 
 * Results are cached in localStorage for 30 minutes to prevent redundant
 * DB queries on every route change (critical for TestFlight/native perf).
 */
export const useSetupStatus = (): SetupStatus => {
  const { userId } = useCurrentUserId();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['setup-status', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
    placeholderData: () => {
      if (!userId) return undefined;
      const cached = getCachedSetup(userId);
      if (!cached) return undefined;
      return cached;
    },
    queryFn: async () => {
      if (!userId) return null;
      const cached = getCachedSetup(userId);

      const { session } = await getSessionSafe();
      if (!session?.user || session.user.id !== userId) {
        if (cached) return cached;
        throw new Error('Auth session unavailable for setup check');
      }

      // ALWAYS hit DB — placeholderData handles instant display from cache.
      // Previously this returned cached data from queryFn, which meant stale
      // "needsSetup=true" values persisted for 30 minutes even after setup was complete,
      // locking users out of gated routes (Track, Reports, Leaderboard, etc.).
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

      if (totalsRes.error) throw totalsRes.error;
      if (goalsRes.error) throw goalsRes.error;
      if (configRes.error) throw configRes.error;

      const result: CachedSetupData = {
        hasOfficialTotals: (totalsRes.data?.length ?? 0) > 0,
        setupComplete: goalsRes.data?.setup_complete === true,
        knockingModeEnabled: configRes.data?.knocking_mode_enabled ?? null,
      };

      setCachedSetup(userId, result);
      return result;
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
      if (userId) localStorage.removeItem(`${SETUP_CACHE_KEY_PREFIX}${userId}`);
    },
    recheckSetup: () => {
      // Clear cache so next query hits DB
      if (userId) localStorage.removeItem(`${SETUP_CACHE_KEY_PREFIX}${userId}`);
      refetch();
    },
  };
};
