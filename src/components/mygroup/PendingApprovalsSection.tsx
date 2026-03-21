import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Pencil, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess } from "@/utils/haptics";
import { getRoleLabel } from "@/utils/roleHierarchy";
import { getCleanName } from "@/utils/nameUtils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EditRecruitDrawer } from "./recruit-detail/EditRecruitDrawer";
import { Recruit } from "@/hooks/useGroupRecruits";

interface PendingRecruit {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: string | null;
  year: string | null;
  recruiter_user_id: string | null;
  created_at: string | null;
  invite_code_used: string | null;
  team_id: string | null;
  mgmt_group_id: string | null;
  location: string | null;
  recruitment_source: string | null;
}

export const PendingApprovalsSection = () => {
  const { userId } = useCurrentUserId();
  const queryClient = useQueryClient();
  const { data: teamAccess } = useTeamAccess();
  const [editingRecruit, setEditingRecruit] = useState<PendingRecruit | null>(null);
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);
  const [leadershipPrompt, setLeadershipPrompt] = useState<{ name: string; role: string } | null>(null);
  const [showReassignPrompt, setShowReassignPrompt] = useState(false);

  // Fetch pending recruits that this user can approve
  const { data: pendingRecruits = [], isLoading } = useQuery({
    queryKey: ['pending-approvals', userId],
    enabled: !!userId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      if (!userId) return [];

      // Get accessible team IDs for this user
      const { data: teamIds } = await supabase
        .rpc('get_accessible_team_ids', { _user_id: userId });

      if (!teamIds || teamIds.length === 0) {
        // Also check if user is directly the inviter
        const { data: directPending } = await supabase
          .from('recruits')
          .select('id, name, email, phone, stage, year, recruiter_user_id, created_at, invite_code_used, team_id, mgmt_group_id, location, recruitment_source')
          .eq('approval_status', 'pending')
          .eq('recruiter_user_id', userId)
          .order('created_at', { ascending: false });

        return (directPending || []) as PendingRecruit[];
      }

      // Get all pending recruits in accessible teams OR where user is the inviter
      const { data } = await supabase
        .from('recruits')
        .select('id, name, email, phone, stage, year, recruiter_user_id, created_at, invite_code_used, team_id, mgmt_group_id, location, recruitment_source')
        .eq('approval_status', 'pending')
        .or(`team_id.in.(${teamIds.join(',')}),recruiter_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      return (data || []) as PendingRecruit[];
    },
  });

  // Get recruiter names for display
  const recruiterUserIds = useMemo(() => {
    const ids = pendingRecruits
      .map(r => r.recruiter_user_id)
      .filter((id): id is string => !!id);
    return [...new Set(ids)];
  }, [pendingRecruits]);

  const { data: recruiterNames } = useQuery({
    queryKey: ['recruiter-names', recruiterUserIds],
    enabled: recruiterUserIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('reps')
        .select('user_id, name')
        .in('user_id', recruiterUserIds);
      
      const map: Record<string, string> = {};
      data?.forEach(r => { if (r.user_id) map[r.user_id] = r.name; });
      return map;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (recruitId: string) => {
      const { error } = await supabase
        .from('recruits')
        .update({
          approval_status: 'approved',
          approved_by_user_id: userId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', recruitId);
      if (error) throw error;

      // Log activity
      await supabase.from('recruit_activities').insert({
        recruit_id: recruitId,
        activity_type: 'note',
        logged_by_user_id: userId!,
        notes: 'Signup approved ✅',
      });
    },
    onSuccess: () => {
      hapticSuccess();
      toast.success('Signup approved!');
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
    },
    onError: () => toast.error('Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: async (recruitId: string) => {
      const { error } = await supabase
        .from('recruits')
        .update({
          approval_status: 'rejected',
          approved_by_user_id: userId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', recruitId);
      if (error) throw error;

      await supabase.from('recruit_activities').insert({
        recruit_id: recruitId,
        activity_type: 'note',
        logged_by_user_id: userId!,
        notes: 'Signup rejected ❌',
      });
    },
    onSuccess: () => {
      toast.success('Signup rejected');
      setRejectConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    },
    onError: () => toast.error('Failed to reject'),
  });

  const handleApproveAll = async () => {
    for (const recruit of pendingRecruits) {
      await approveMutation.mutateAsync(recruit.id);
    }
    // After batch approval, prompt for recruiter reassignment
    if (pendingRecruits.length > 1) {
      setShowReassignPrompt(true);
    }
  };

  // Convert PendingRecruit to Recruit shape for EditRecruitDrawer
  const toRecruitShape = (pr: PendingRecruit): Recruit => ({
    id: pr.id,
    name: pr.name,
    email: pr.email || '',
    phone: pr.phone || '',
    stage: pr.stage || '',
    year: pr.year || '',
    location: pr.location,
    recruitmentSource: pr.recruitment_source,
    recruiterId: null,
    recruiterName: null,
    recruiterUserId: pr.recruiter_user_id,
    teamId: pr.team_id,
    teamName: null,
    mgmtGroupId: pr.mgmt_group_id,
    mgmtGroupName: null,
    lastContact: null,
    nextAction: null,
    nextActionDue: null,
    createdAt: pr.created_at || '',
    onboardingComplete: false,
    trainingsComplete: false,
    slackJoined: false,
    phase1Complete: false,
    phase2Complete: false,
    phase3Complete: false,
    phase4Complete: false,
    blitzReady: false,
    ipadAssigned: false,
  });

  if (isLoading || pendingRecruits.length === 0) return null;

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Pending Approvals</h3>
              <Badge variant="secondary" className="text-xs">{pendingRecruits.length}</Badge>
            </div>
            {pendingRecruits.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleApproveAll}
                disabled={approveMutation.isPending}
                className="text-xs"
              >
                Approve All
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {pendingRecruits.map((recruit) => (
              <div key={recruit.id} className="bg-background rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{recruit.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {recruit.year && <Badge variant="outline" className="text-[10px]">{recruit.year}</Badge>}
                      {recruit.email && <span className="text-[10px] text-muted-foreground">{recruit.email}</span>}
                    </div>
                    {recruit.recruiter_user_id && recruiterNames && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Invited by {getCleanName(recruiterNames[recruit.recruiter_user_id])}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingRecruit(recruit)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setRejectConfirmId(recruit.id)}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => approveMutation.mutate(recruit.id)}
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Full Edit Drawer — reuses the same EditRecruitDrawer from recruit details */}
      {editingRecruit && (
        <EditRecruitDrawer
          open={!!editingRecruit}
          onOpenChange={(open) => !open && setEditingRecruit(null)}
          recruit={toRecruitShape(editingRecruit)}
          showRoleAssignment={true}
          isBootstrapApproval={true}
          onSuccess={(assignedRole) => {
            queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
            queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
            // Show leadership prompt if a role was assigned
            if (assignedRole && editingRecruit) {
              setLeadershipPrompt({
                name: editingRecruit.name,
                role: getRoleLabel(assignedRole as any),
              });
            }
          }}
        />
      )}

      {/* Reject Confirmation Drawer */}
      <Drawer open={!!rejectConfirmId} onOpenChange={(open) => !open && setRejectConfirmId(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Reject Signup?</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 pb-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              This person won't be able to access the app. You can always approve them later from the recruit detail drawer.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRejectConfirmId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => rejectConfirmId && rejectMutation.mutate(rejectConfirmId)}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Post-approval leadership prompt */}
      <Drawer open={!!leadershipPrompt} onOpenChange={(open) => !open && setLeadershipPrompt(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>🎉 Role Assigned!</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 pb-8 space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>{leadershipPrompt?.name}</strong> has been assigned the <strong>{leadershipPrompt?.role}</strong> role. 
              They can now manage their org structure and send invite links to their downline.
            </p>
            <p className="text-sm text-muted-foreground">
              💡 <strong>Next step:</strong> Let {leadershipPrompt?.name} know they can go to the <strong>Organization</strong> tab to set up their teams, then share their invite link with their people.
            </p>
            <Button className="w-full" onClick={() => setLeadershipPrompt(null)}>
              Got it
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
