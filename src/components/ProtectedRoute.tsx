import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { usePrefetchData } from "@/hooks/usePrefetchData";
import { PushNotificationInitializer } from "./PushNotificationInitializer";
import { useRepData } from "@/hooks/useRepData";
import { isRepActive } from "@/utils/repStatusUtils";
import InactiveAccountScreen from "./InactiveAccountScreen";
import PendingApprovalScreen from "./PendingApprovalScreen";
import { useQuery } from "@tanstack/react-query";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Prefetch critical data once authenticated
  usePrefetchData(user?.id);

  useEffect(() => {
    const updateTimezone = async (userId: string) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await supabase
        .from('reps')
        .update({ timezone })
        .eq('user_id', userId);
    };

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        updateTimezone(session.user.id);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        updateTimezone(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Get rep data to check stage - only runs when user is authenticated
  const { repData, loading: repLoading } = useRepData();

  // Check recruit approval_status
  const { data: recruitApproval } = useQuery({
    queryKey: ['recruit-approval-status', repData?.id],
    enabled: !!repData?.id,
    staleTime: 30 * 1000, // Check every 30s
    refetchInterval: 30 * 1000,
    queryFn: async () => {
      if (!repData?.id) return null;
      const { data } = await supabase
        .from('recruits')
        .select('approval_status, team_id, mgmt_group_id')
        .eq('id', repData.id)
        .maybeSingle();
      return data;
    },
  });

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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm animate-fade-in">Welcome back! Loading your data...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
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

  return (
    <>
      <PushNotificationInitializer />
      {children}
    </>
  );
};

export default ProtectedRoute;
