import { useState, useMemo, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  const [leadershipPrompt, setLeadershipPrompt] = useState<{ name: string; role: string; recruitId: string; recruitUserId: string | null } | null>(null);
  const [showReassignPrompt, setShowReassignPrompt] = useState(false);
  const [selectedLeaderGroup, setSelectedLeaderGroup] = useState('');
  const [isAssigningLeader, setIsAssigningLeader] = useState(false);

  // Fetch unled groups when leadership prompt is shown
  const { data: unleadedGroups = [] } = useQuery({
    queryKey: ['unleaded-groups-for-assignment'],
    enabled: !!leadershipPrompt,
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

      const results: { id: string; name: string; type: string }[] = [];
      
      for (const table of ['teams', 'mgmt_groups', 'sr_mgmt_groups'] as const) {
        const res = await fetch(`${supabaseUrl}/rest/v1/${table}?lead_user_id=is.null&select=id,name`, { headers });
        const rows = await res.json();
        const typeLabel = table === 'teams' ? 'Team' : table === 'mgmt_groups' ? 'MGMT Group' : 'Sr MGMT Group';
        for (const row of (rows || [])) {
          results.push({ id: `${table}:${row.id}`, name: row.name, type: typeLabel });
        }
      }
      return results;
    },
  });

  // Fetch pending recruits that this user can approve
  const { data: pendingRecruits = [], isLoading } = useQuery({
    queryKey: ['pending-approvals', userId],
    enabled: !!userId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      if (!userId) return [];

      // Get invite codes created by this user (to find lateral invite signups)
      const [teamIdsResult, inviteCodesResult] = await Promise.all([
        supabase.rpc('get_accessible_team_ids', { _user_id: userId }),
        supabase.from('invite_codes').select('code').eq('inviter_user_id', userId),
      ]);

      const teamIds = teamIdsResult.data || [];
      const myCodes = (inviteCodesResult.data || []).map(c => c.code);

      // Build OR filter parts
      const orParts: string[] = [];
      orParts.push(`recruiter_user_id.eq.${userId}`);
      if (teamIds.length > 0) {
        orParts.push(`team_id.in.(${teamIds.join(',')})`);
      }
      if (myCodes.length > 0) {
        orParts.push(`invite_code_used.in.(${myCodes.join(',')})`);
      }

      const { data } = await supabase
        .from('recruits')
        .select('id, name, email, phone, stage, year, recruiter_user_id, created_at, invite_code_used, team_id, mgmt_group_id, location, recruitment_source')
        .eq('approval_status', 'pending')
        .or(orParts.join(','))
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

      // Auto-assign leadership: check if any team/group has this recruit as pending leader
      const repData = await supabase
        .from('reps')
        .select('user_id')
        .eq('id', recruitId)
        .maybeSingle();
      
      if (repData.data?.user_id) {
        const repUserId = repData.data.user_id;
        // Use raw fetch for pending_lead_recruit_id (column not yet in generated types)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

        const autoAssignedNames: string[] = [];

        for (const table of ['teams', 'mgmt_groups', 'sr_mgmt_groups']) {
          const res = await fetch(`${supabaseUrl}/rest/v1/${table}?pending_lead_recruit_id=eq.${recruitId}&select=id,name`, { headers });
          const rows = await res.json();
          for (const row of (rows || [])) {
            await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${row.id}`, {
              method: 'PATCH',
              headers: { ...headers, 'Prefer': 'return=minimal' },
              body: JSON.stringify({ lead_user_id: repUserId, pending_lead_recruit_id: null }),
            });
            autoAssignedNames.push(row.name);
          }
        }

        if (autoAssignedNames.length > 0) {
          return { autoAssignedLeader: true, groupNames: autoAssignedNames.join(', ') };
        }
      }

      return { autoAssignedLeader: false };
    },
    onSuccess: (result) => {
      hapticSuccess();
      if (result?.autoAssignedLeader) {
        toast.success(`Approved! Auto-assigned as leader of ${result.groupNames}`);
      } else {
        toast.success('Signup approved!');
      }
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['org-structure'] });
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
          isBootstrapApproval={
            // Bootstrap only when the current user is the direct inviter
            // This allows "invite your boss" flow while preventing abuse
            editingRecruit.recruiter_user_id === userId
          }
          onSuccess={async (assignedRole) => {
            queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
            queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
            if (assignedRole && editingRecruit) {
              const { data: repData } = await supabase.from('reps').select('user_id').eq('id', editingRecruit.id).maybeSingle();
              setLeadershipPrompt({
                name: editingRecruit.name,
                role: getRoleLabel(assignedRole as any),
                recruitId: editingRecruit.id,
                recruitUserId: repData?.user_id || null,
              });
              queryClient.invalidateQueries({ queryKey: ['unleaded-groups-for-assignment'] });
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

      {/* Post-approval leadership prompt with optional group assignment */}
      <Drawer open={!!leadershipPrompt} onOpenChange={(open) => { if (!open) { setLeadershipPrompt(null); setSelectedLeaderGroup(''); } }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>🎉 Role Assigned!</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 pb-8 space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>{leadershipPrompt?.name}</strong> has been assigned the <strong>{leadershipPrompt?.role}</strong> role. 
              They can now manage their org structure and send invite links to their downline.
            </p>

            {unleadedGroups.length > 0 && leadershipPrompt?.recruitUserId && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-medium">Assign as leader of...</Label>
                <Select value={selectedLeaderGroup} onValueChange={setSelectedLeaderGroup}>
                  <SelectTrigger>
                    <SelectValue placeholder="Skip — assign later" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Skip — assign later</SelectItem>
                    {unleadedGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({g.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              💡 <strong>Next step:</strong> Let {leadershipPrompt?.name} know they can go to the <strong>Organization</strong> tab to set up their teams, then share their invite link with their people.
            </p>
            <Button
              className="w-full"
              disabled={isAssigningLeader}
              onClick={async () => {
                if (selectedLeaderGroup && selectedLeaderGroup !== '__none__' && leadershipPrompt?.recruitUserId) {
                  setIsAssigningLeader(true);
                  try {
                    const [table, groupId] = selectedLeaderGroup.split(':');
                    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                    await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${groupId}`, {
                      method: 'PATCH',
                      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                      body: JSON.stringify({ lead_user_id: leadershipPrompt.recruitUserId }),
                    });
                    const groupName = unleadedGroups.find(g => g.id === selectedLeaderGroup)?.name;
                    toast.success(`${leadershipPrompt.name} assigned as leader of ${groupName}`);
                    queryClient.invalidateQueries({ queryKey: ['org-structure'] });
                  } catch (e) {
                    toast.error('Failed to assign leader');
                  } finally {
                    setIsAssigningLeader(false);
                  }
                }
                setLeadershipPrompt(null);
                setSelectedLeaderGroup('');
              }}
            >
              {isAssigningLeader ? 'Assigning...' : selectedLeaderGroup && selectedLeaderGroup !== '__none__' ? 'Assign & Done' : 'Got it'}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
      {/* Post-batch approval: recruiter reassignment prompt */}
      <Drawer open={showReassignPrompt} onOpenChange={(open) => !open && setShowReassignPrompt(false)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>📋 Recruiter Reassignment</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 pb-8 space-y-3">
            <p className="text-sm text-muted-foreground">
              You just approved multiple signups. Some of these reps may have different direct recruiters.
            </p>
            <p className="text-sm text-muted-foreground">
              💡 <strong>Next step:</strong> Go to the <strong>Recruiter Tree</strong> in the Organization tab to reassign anyone who has a different direct recruiter than you.
            </p>
            <Button className="w-full" onClick={() => setShowReassignPrompt(false)}>
              Got it
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
