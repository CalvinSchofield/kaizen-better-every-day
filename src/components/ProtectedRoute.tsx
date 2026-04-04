import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppSplashScreen } from "./AppSplashScreen";
import { usePrefetchData } from "@/hooks/usePrefetchData";
import { PushNotificationInitializer } from "./PushNotificationInitializer";
import { useRepData } from "@/hooks/useRepData";
import { isRepActive } from "@/utils/repStatusUtils";
import InactiveAccountScreen from "./InactiveAccountScreen";
import PendingApprovalScreen from "./PendingApprovalScreen";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { DataLoadError } from "./mygroup/DataLoadError";
import { withTimeout } from "@/utils/withTimeout";

/** Routes that require Initial Sync + Goal Setup to access */
const GATED_ROUTES = [
  '/track',
  '/calendar',
  '/insights',
  '/leaderboard',
  '/compete',
  '/team-reports',
  '/reports-v2',
  '/customers',
  '/log-sale',
];

const ACCOUNT_LOAD_RECOVERY_MS = 15000;
const RECRUIT_APPROVAL_TIMEOUT_MS = 6000;

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  // PERF FIX: Use shared useCurrentUserId instead of independent getSession + onAuthStateChange.
  // This eliminates a redundant auth network call and duplicate listener.
  const { userId, authVerified } = useCurrentUserId();

  // Prefetch critical data once authenticated
  usePrefetchData(userId ?? undefined);

  // Check setup status for hard gate
  const { needsSetup, isReady: setupReady, recheckSetup } = useSetupStatus();

  // Update timezone when user is authenticated
  useEffect(() => {
    if (!userId) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    supabase
      .from('reps')
      .update({ timezone })
      .eq('user_id', userId)
      .then(() => {});
  }, [userId]);

  // Get rep data to check stage - only runs when user is authenticated
  const { repData, loading: repLoading, error: repError, refetch: refetchRepData } = useRepData();

  // Check recruit approval_status
  const { data: recruitApproval, isLoading: approvalLoading, refetch: refetchRecruitApproval } = useQuery({
    queryKey: ['recruit-approval-status', repData?.id],
    enabled: !!repData?.id,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    queryFn: async () => {
      if (!repData?.id) return null;

      try {
        const { data, error } = await withTimeout(
          supabase
            .from('recruits')
            .select('approval_status, team_id, mgmt_group_id')
            .eq('id', repData.id)
            .maybeSingle(),
          RECRUIT_APPROVAL_TIMEOUT_MS,
          'Recruit approval request timed out'
        );

        if (error) throw error;
        return data;
      } catch (error) {
        console.warn('[ProtectedRoute] Recruit approval check failed, continuing without it:', error);
        return null;
      }
    },
  });

  const [showLoadRecovery, setShowLoadRecovery] = useState(false);
  const isAccountLoading = repLoading || (repData?.id && approvalLoading) || (repData && !setupReady);

  useEffect(() => {
    if (!isAccountLoading) {
      setShowLoadRecovery(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowLoadRecovery(true);
    }, ACCOUNT_LOAD_RECOVERY_MS);

    return () => window.clearTimeout(timer);
  }, [isAccountLoading, userId]);

  const handleRetryAccountLoad = () => {
    setShowLoadRecovery(false);
    recheckSetup();
    void refetchRepData();
    void refetchRecruitApproval();
  };

  // Check if this rep is in a "direct" MGMT group (Calvin or Quinn's groups)
  const { data: isDirectGroup } = useQuery({
    queryKey: ['is-direct-mgmt-group', recruitApproval?.mgmt_group_id],
    enabled: !!recruitApproval?.mgmt_group_id && recruitApproval?.approval_status === 'pending',
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      if (!recruitApproval?.mgmt_group_id) return false;
      const { data } = await supabase
        .from('mgmt_groups')
        .select('name')
        .eq('id', recruitApproval.mgmt_group_id)
        .maybeSingle();
      
      if (!data?.name) return false;
      const name = data.name.toLowerCase();
      return name.includes('calvin') || name.includes('quinn');
    },
  });

  if (!authVerified) {
    return <AppSplashScreen message="Welcome back!" />;
  }

  if (!userId) {
    return <Navigate to="/auth" replace />;
  }

  if (showLoadRecovery || (repError && !repData)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <DataLoadError
            title="Loading is taking longer than expected"
            message="We hit a snag restoring your account after the app was backgrounded. Try again to refresh your session and account data."
            onRetry={handleRetryAccountLoad}
            isRetrying={repLoading || approvalLoading}
          />
        </div>
      </div>
    );
  }

  // Wait for rep data, approval status, AND setup status to load before making access decisions.
  // This prevents the goals page from flashing the setup wizard before real data arrives.
  if (isAccountLoading) {
    return <AppSplashScreen message="Loading your account…" />;
  }

  // Check if rep is in an inactive stage - block app access
  if (repData && !isRepActive(repData.stage)) {
    return (
      <InactiveAccountScreen
        repName={repData.name}
        teamLeader={repData.team_leader}
        teamLeaderPhone={repData.team_leader_phone}
      />
    );
  }

  // Check if rep is pending approval
  if (repData && recruitApproval?.approval_status === 'pending') {
    return (
      <PendingApprovalScreen
        repName={repData.name}
        teamLeader={repData.team_leader}
        teamLeaderPhone={repData.team_leader_phone}
        showTeamInfoLink={!isDirectGroup}
      />
    );
  }

  // Check if rep was rejected
  if (repData && recruitApproval?.approval_status === 'rejected') {
    return (
      <InactiveAccountScreen
        repName={repData.name}
        teamLeader={repData.team_leader}
        teamLeaderPhone={repData.team_leader_phone}
      />
    );
  }

  // Hard gate: redirect to /goals if user hasn't completed setup and is on a gated route
  if (setupReady && needsSetup && repData) {
    const isGatedRoute = GATED_ROUTES.some(route => location.pathname.startsWith(route));
    if (isGatedRoute) {
      return <Navigate to="/goals" replace state={{ gatedFrom: location.pathname }} />;
    }
  }

  return (
    <>
      <PushNotificationInitializer />
      {children}
    </>
  );
};

export default ProtectedRoute;
