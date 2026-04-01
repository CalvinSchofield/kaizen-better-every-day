import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionSafe } from "@/utils/authSession";
import { useCurrentUserId } from "./useCurrentUserId";

import type { AccessLevel } from "@/utils/roleHierarchy";

interface HierarchyTeam {
  id: string;
  name: string;
  leadUserId: string | null;
}

interface HierarchyMgmtGroup {
  id: string;
  name: string;
  leadUserId: string | null;
  teams: HierarchyTeam[];
}

interface HierarchySrMgmtGroup {
  id: string;
  name: string;
  leadUserId: string | null;
  mgmtGroups: HierarchyMgmtGroup[];
}

interface HierarchyOffice {
  id: string;
  name: string;
  location: string | null;
  srMgmtGroups: HierarchySrMgmtGroup[];
  mgmtGroups: HierarchyMgmtGroup[];
  teams: HierarchyTeam[];
}

export interface OrgHierarchy {
  offices: HierarchyOffice[];
}

export interface SrMgmtGroupInfo {
  id: string;
  name: string;
  leadUserId: string | null;
  officeId: string | null;
  regionId: string | null;
  mgmtGroupIds: string[];
}

interface TeamAccessResponse {
  accessLevel: AccessLevel;
  mgmtGroups: Array<{
    id: string;
    name: string;
    teamIds: string[];
    groupLeadId: string;
  }>;
  teams: Array<{
    id: string;
    name: string;
    groupLeadId: string;
  }>;
  accessibleUserIds: string[];
  accessibleReps: Array<{
    id: string;
    userId: string | null;
    name: string;
    phone?: string | null;
    year?: string | null;
    stage?: string | null;
    teamId?: string | null;
    teamName?: string | null;
    mgmtGroupId?: string | null;
    mgmtGroupName?: string | null;
    isGhostRep?: boolean;
    rampPhase1Complete?: boolean;
    recruiterName?: string | null;
  }>;
  isAreaDirector: boolean;
  userOfficeIds: string[];
  srMgmtGroups: SrMgmtGroupInfo[];
  hierarchy: OrgHierarchy;
}

const getCachedData = (userId: string | null): TeamAccessResponse | undefined => {
  if (!userId) return undefined;

  try {
    const cached = localStorage.getItem(`team-access-cache:v4:${userId}`);
    if (!cached) return undefined;

    const { data } = JSON.parse(cached);
    return data as TeamAccessResponse;
  } catch {
    return undefined;
  }
};

export const useTeamAccess = () => {
  const { userId, authVerified } = useCurrentUserId();
  const cachedData = getCachedData(userId);

  const query = useQuery({
    queryKey: ["team-access", userId],
    enabled: authVerified && !!userId,
    queryFn: async () => {
      if (!userId) {
        throw new Error("Not authenticated");
      }

      const CACHE_KEY = `team-access-cache:v4:${userId}`;
      const cachedRaw = localStorage.getItem(CACHE_KEY);
      let cachedResult: TeamAccessResponse | null = cachedData ?? null;

      if (cachedRaw) {
        try {
          const { data, timestamp } = JSON.parse(cachedRaw);
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            return data as TeamAccessResponse;
          }
          cachedResult = data as TeamAccessResponse;
        } catch (e) {
          console.error("Failed to parse team access cache:", e);
        }
      }

      const { session } = await getSessionSafe();
      if (!session) {
        if (cachedResult) {
          console.log("[useTeamAccess] No fresh session yet, returning cached team access");
          return cachedResult;
        }
        throw new Error("Not authenticated");
      }

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), 8000);
        });

        const fetchPromise = supabase.functions.invoke("fetch-team-access", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

        if (error) {
          console.error("[useTeamAccess] Edge function error:", error);
          if (cachedResult) {
            console.log("[useTeamAccess] Returning stale cache due to error");
            return cachedResult;
          }
          throw error;
        }

        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              data,
              timestamp: Date.now(),
            })
          );
        } catch (cacheError) {
          console.warn("[useTeamAccess] Failed to cache result (storage full?):", cacheError);
        }

        return data as TeamAccessResponse;
      } catch (fetchError: any) {
        console.error("[useTeamAccess] Fetch failed:", fetchError?.message || fetchError);
        if (cachedResult) {
          console.log("[useTeamAccess] Returning stale cache due to fetch failure");
          return cachedResult;
        }
        throw fetchError;
      }
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: (failureCount, error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "Not authenticated") return false;
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  return {
    ...query,
    data: query.data ?? cachedData,
    isLoading: !authVerified || query.isLoading,
    wasLeader: !!cachedData?.accessLevel && cachedData.accessLevel !== "none",
  };
};