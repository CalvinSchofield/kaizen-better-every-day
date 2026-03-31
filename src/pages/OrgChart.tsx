import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GitBranch } from "lucide-react";
import { getCleanName } from "@/utils/nameUtils";
import { VisualRecruiterTree, type TreeNode, type RoleColor } from "@/components/mygroup/org/VisualRecruiterTree";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrgStructureTree } from "@/components/org/OrgStructureTree";
import { RecruitDetailDrawer } from "@/components/mygroup/RecruitDetailDrawer";
import { SIGNED_PLUS_STAGES, STAGES } from "@/utils/stageConstants";
import type { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";


const OrgChart = () => {
  const queryClient = useQueryClient();
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { const data = { user: session?.user ?? null };
      setCurrentAuthUserId(data.user?.id || null);
    });
  }, []);


  const accessLevel = teamAccess?.accessLevel;

  const { data: treeData, isLoading } = useQuery({
    queryKey: ["org-chart-full-tree"],
    queryFn: async () => {
      const [recruitsRes, repsRes, teamsRes, mgmtGroupsRes, teamMgmtRes, officeStaffRes, officesRes] = await Promise.all([
        supabase.from("recruits").select("id, name, recruiter_user_id, stage, team_id, year, phone, email, location, recruitment_source, last_contact, next_action, next_action_due, created_at, mgmt_group_id, ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete, onboarding_complete, trainings_complete, slack_joined, ipad_assigned, blitz_ready, spouse_name, significant_other_name, caution_notes, watch_out_notes").limit(5000),
        supabase.from("reps").select("id, user_id, name, profile_photo_url, year, stage, phone, email").limit(5000),
        supabase.from("teams").select("id, name, lead_user_id").limit(500),
        supabase.from("mgmt_groups").select("id, name, lead_user_id, office_id").limit(500),
        supabase.from("team_mgmt_groups").select("team_id, mgmt_group_id").limit(500),
        supabase.from("office_staff").select("user_id, role, office_id").limit(500),
        supabase.from("offices").select("id, name").limit(500),
      ]);
      return {
        recruits: recruitsRes.data || [],
        reps: repsRes.data || [],
        teams: teamsRes.data || [],
        mgmtGroups: mgmtGroupsRes.data || [],
        teamMgmt: teamMgmtRes.data || [],
        officeStaff: officeStaffRes.data || [],
        offices: officesRes.data || [],
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  // Build role map: userId -> { title, roleColor }
  // Also track area directors separately for the special display treatment
  const { roleMap, areaDirectorSet } = useMemo(() => {
    if (!treeData) return { roleMap: new Map<string, { title: string; color: RoleColor }>(), areaDirectorSet: new Set<string>() };
    const map = new Map<string, { title: string; color: RoleColor }>();
    const adSet = new Set<string>();

    // Lowest priority first — higher roles overwrite
    treeData.teams.forEach((t) => {
      if (t.lead_user_id) map.set(t.lead_user_id, { title: "Team Lead", color: "team_lead" });
    });
    treeData.mgmtGroups.forEach((mg) => {
      if (mg.lead_user_id) map.set(mg.lead_user_id, { title: "MGMT Group Lead", color: "mgmt_group" });
    });
    treeData.officeStaff.forEach((s) => {
      if (s.role === "area_director") {
        adSet.add(s.user_id);
        // Area Director is an office-level role, NOT part of the recruiter tree hierarchy.
        // Don't set any color or title — their recruiter tree role (Team Lead, MGMT Group Lead, etc.) takes precedence.
      }
    });

    return { roleMap: map, areaDirectorSet: adSet };
  }, [treeData]);

  // Build a set of userIds that are team leads (for label node insertion logic)
  const teamLeadUserIds = useMemo(() => {
    if (!treeData) return new Set<string>();
    const s = new Set<string>();
    treeData.teams.forEach((t) => { if (t.lead_user_id) s.add(t.lead_user_id); });
    treeData.mgmtGroups.forEach((mg) => { if (mg.lead_user_id) s.add(mg.lead_user_id); });
    return s;
  }, [treeData]);

  // Map userId -> team name they lead (for label nodes)
  const userTeamNameMap = useMemo(() => {
    if (!treeData) return new Map<string, string>();
    const m = new Map<string, string>();
    treeData.teams.forEach((t) => { if (t.lead_user_id) m.set(t.lead_user_id, t.name); });
    return m;
  }, [treeData]);

  // Build full unfiltered tree first
  const fullTree = useMemo(() => {
    if (!treeData || !currentAuthUserId) return null;

    const { recruits, reps } = treeData;
    const repMap = new Map(reps.map((r) => [r.user_id, r]));
    const recruitsByRecruiter = new Map<string, typeof recruits>();
    // Team leads also see pipeline stages (Reached Out, Evaluating)
    const visibleStages = accessLevel === "team_lead"
      ? [...SIGNED_PLUS_STAGES, STAGES.REACHED_OUT, STAGES.EVALUATING]
      : [...SIGNED_PLUS_STAGES];
    const activeRecruits = recruits.filter(r => 
      r.stage && visibleStages.some(s => s.toLowerCase() === r.stage!.toLowerCase())
    );

    activeRecruits.forEach((r) => {
      if (r.recruiter_user_id) {
        const existing = recruitsByRecruiter.get(r.recruiter_user_id) || [];
        existing.push(r);
        recruitsByRecruiter.set(r.recruiter_user_id, existing);
      }
    });

    const buildNode = (userId: string, visited = new Set<string>()): TreeNode | null => {
      if (visited.has(userId)) return null;
      visited.add(userId);

      const rep = repMap.get(userId);
      const recruiterRecruits = recruitsByRecruiter.get(userId) || [];
      const repName = rep?.name || "";
      const recruitByName = new Map(recruits.map((r) => [getCleanName(r.name).toLowerCase(), r]));
      const recruitRecord = recruitByName.get(getCleanName(repName).toLowerCase());

      let children: TreeNode[] = [];

      recruiterRecruits.forEach((r) => {
        const recruitRep = reps.find(
          (rep) => getCleanName(rep.name).toLowerCase() === getCleanName(r.name).toLowerCase()
        );
        if (recruitRep?.user_id) {
          const child = buildNode(recruitRep.user_id, new Set(visited));
          if (child) children.push(child);
        }
      });

      recruiterRecruits.forEach((r) => {
        const recruitRep = reps.find(
          (rep) => getCleanName(rep.name).toLowerCase() === getCleanName(r.name).toLowerCase()
        );
        if (!recruitRep?.user_id) {
          children.push({
            id: r.id,
            name: r.name,
            userId: null,
            stage: r.stage,
            profilePhotoUrl: null,
            role: null,
            year: r.year,
            isAreaDirector: false,
            roleColor: "none",
            children: [],
          });
        }
      });

      // Insert a label node if this leader has both sub-leaders and non-leader direct recruits
      const roleInfo = roleMap.get(userId);
      const hasRole = !!roleInfo;
      
      if (hasRole && children.length > 1) {
        const leaderChildren: TreeNode[] = [];
        const plainChildren: TreeNode[] = [];
        
        children.forEach((c) => {
          const childIsLeader = c.userId && teamLeadUserIds.has(c.userId);
          if (childIsLeader) {
            leaderChildren.push(c);
          } else {
            plainChildren.push(c);
          }
        });
        
        if (leaderChildren.length > 0 && plainChildren.length > 0) {
          // Get the team name this person leads, or fallback
          const teamName = userTeamNameMap.get(userId);
          const labelName = teamName 
            ? `${teamName} Team` 
            : `${getCleanName(rep?.name || "Unknown")} Team`;
          
          const labelNode: TreeNode = {
            id: `label-${userId}`,
            name: labelName,
            userId: null,
            stage: null,
            profilePhotoUrl: null,
            role: null,
            year: null,
            isAreaDirector: false,
            roleColor: "team_lead",
            isLabelNode: true,
            children: plainChildren,
          };
          
          children = [...leaderChildren, labelNode];
          children.sort((a, b) => b.children.length - a.children.length);
        }
      }

      return {
        id: recruitRecord?.id || userId,
        name: rep?.name || "Unknown",
        userId,
        stage: recruitRecord?.stage || rep?.stage || null,
        profilePhotoUrl: rep?.profile_photo_url,
        role: roleInfo?.title || null,
        year: rep?.year || recruitRecord?.year || null,
        isAreaDirector: areaDirectorSet.has(userId),
        roleColor: roleInfo?.color || "none",
        children,
      };
    };

    const rootNodes: TreeNode[] = [];

    if (
      accessLevel === "corporate" ||
      accessLevel === "regional" ||
      accessLevel === "sr_regional" ||
      accessLevel === "partner" ||
      accessLevel === "divisional"
    ) {
      // Global viewers: show all root recruiters
      const recruitedUserIds = new Set<string>();
      recruits.forEach((r) => {
        const recruitRep = reps.find(
          (rep) => getCleanName(rep.name).toLowerCase() === getCleanName(r.name).toLowerCase()
        );
        if (recruitRep?.user_id && r.recruiter_user_id && r.recruiter_user_id !== recruitRep.user_id) {
          recruitedUserIds.add(recruitRep.user_id);
        }
      });

      const allRecruiterIds = new Set(
        recruits.map((r) => r.recruiter_user_id).filter(Boolean) as string[]
      );
      allRecruiterIds.forEach((recruiterId) => {
        if (!recruitedUserIds.has(recruiterId)) {
          const node = buildNode(recruiterId);
          if (node && node.children.length > 0) rootNodes.push(node);
        }
      });
    } else if (currentAuthUserId) {
      // Personal downline first
      const node = buildNode(currentAuthUserId);
      if (node && node.children.length > 0) {
        rootNodes.push(node);
      }

      // Area Directors: also show office-scoped reps not in their downline
      if (accessLevel === "area_director") {
        // Find offices this AD is assigned to
        const adOfficeIds = new Set(
          treeData.officeStaff
            .filter(s => s.user_id === currentAuthUserId && s.role === "area_director")
            .map(s => s.office_id)
        );

        if (adOfficeIds.size > 0) {
          // Find MGMT groups in those offices
          const officeMgmtGroupIds = new Set(
            treeData.mgmtGroups
              .filter(mg => mg.office_id && adOfficeIds.has(mg.office_id))
              .map(mg => mg.id)
          );

          // Find teams in those MGMT groups
          const officeTeamIds = new Set(
            treeData.teamMgmt
              .filter(tm => officeMgmtGroupIds.has(tm.mgmt_group_id))
              .map(tm => tm.team_id)
          );

          // Collect all user IDs already in the downline tree
          const downlineUserIds = new Set<string>();
          const collectUserIds = (n: TreeNode) => {
            if (n.userId) downlineUserIds.add(n.userId);
            n.children.forEach(collectUserIds);
          };
          rootNodes.forEach(collectUserIds);

          // Find office MGMT group leads not already in downline
          const officeLeaderUserIds = new Set<string>();
          treeData.mgmtGroups.forEach(mg => {
            if (mg.lead_user_id && officeMgmtGroupIds.has(mg.id) && !downlineUserIds.has(mg.lead_user_id)) {
              officeLeaderUserIds.add(mg.lead_user_id);
            }
          });
          // Find office team leads not already in downline
          treeData.teams.forEach(t => {
            if (t.lead_user_id && officeTeamIds.has(t.id) && !downlineUserIds.has(t.lead_user_id)) {
              officeLeaderUserIds.add(t.lead_user_id);
            }
          });

          // Build trees for each office leader not already in downline
          officeLeaderUserIds.forEach(leaderId => {
            if (!downlineUserIds.has(leaderId)) {
              const officeNode = buildNode(leaderId);
              if (officeNode && officeNode.children.length > 0) {
                rootNodes.push(officeNode);
              }
            }
          });
        }
      }
    }

    return rootNodes.sort((a, b) => b.children.length - a.children.length);
  }, [treeData, teamAccess, currentAuthUserId, accessLevel, roleMap, areaDirectorSet, teamLeadUserIds, userTeamNameMap]);


  // Build a lookup for full recruit data — cross-references current org structure
  const recruitLookup = useMemo(() => {
    if (!treeData) return new Map<string, Recruit>();
    const map = new Map<string, Recruit>();
    const { recruits, reps, teams, mgmtGroups, teamMgmt } = treeData;
    const repMap = new Map(reps.map(r => [r.user_id, r]));
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const mgMap = new Map(mgmtGroups.map(mg => [mg.id, mg]));

    // Build reverse lookup: userId -> team they lead
    const userLeadsTeam = new Map<string, typeof teams[0]>();
    teams.forEach(t => { if (t.lead_user_id) userLeadsTeam.set(t.lead_user_id, t); });

    // Build reverse lookup: teamId -> mgmtGroupId
    const teamToMgmt = new Map<string, string>();
    teamMgmt.forEach(tm => teamToMgmt.set(tm.team_id, tm.mgmt_group_id));

    recruits.forEach((r) => {
      const recruitRep = reps.find(
        rep => getCleanName(rep.name).toLowerCase() === getCleanName(r.name).toLowerCase()
      );
      const recruiterRep = r.recruiter_user_id ? repMap.get(r.recruiter_user_id) : null;

      // Cross-reference current org structure for team/MGMT info
      let resolvedTeamName: string | null = null;
      let resolvedTeamId: string | null = r.team_id || null;
      let resolvedMgmtGroupId: string | null = r.mgmt_group_id || null;
      let resolvedMgmtGroupName: string | null = null;

      // If this person is a team lead, use their team's MGMT group context
      if (recruitRep?.user_id) {
        const ledTeam = userLeadsTeam.get(recruitRep.user_id);
        if (ledTeam) {
          resolvedTeamId = ledTeam.id;
          resolvedTeamName = ledTeam.name;
          const mgmtId = teamToMgmt.get(ledTeam.id);
          if (mgmtId) {
            resolvedMgmtGroupId = mgmtId;
            resolvedMgmtGroupName = mgMap.get(mgmtId)?.name || null;
          }
        }
      }

      // Fallback to recruit record's team/mgmt
      if (!resolvedTeamName && resolvedTeamId) {
        resolvedTeamName = teamMap.get(resolvedTeamId)?.name || null;
      }
      if (!resolvedMgmtGroupName && resolvedMgmtGroupId) {
        resolvedMgmtGroupName = mgMap.get(resolvedMgmtGroupId)?.name || null;
      }

      map.set(r.id, {
        id: r.id,
        name: r.name,
        phone: r.phone || recruitRep?.phone || "",
        email: r.email || recruitRep?.email || "",
        stage: r.stage || "",
        recruiterId: null,
        recruiterName: recruiterRep?.name || null,
        recruiterUserId: r.recruiter_user_id || null,
        teamName: resolvedTeamName,
        teamId: resolvedTeamId,
        mgmtGroupId: resolvedMgmtGroupId,
        mgmtGroupName: resolvedMgmtGroupName,
        year: r.year || recruitRep?.year || "",
        location: r.location || null,
        recruitmentSource: r.recruitment_source || null,
        lastContact: r.last_contact || null,
        nextAction: r.next_action || null,
        nextActionDue: r.next_action_due || null,
        createdAt: r.created_at || "",
        phase1Complete: r.ramp_phase_1_complete || false,
        phase2Complete: r.ramp_phase_2_complete || false,
        phase3Complete: r.ramp_phase_3_complete || false,
        phase4Complete: r.ramp_phase_4_complete || false,
        onboardingComplete: r.onboarding_complete || false,
        trainingsComplete: r.trainings_complete || false,
        slackJoined: r.slack_joined || false,
        ipadAssigned: r.ipad_assigned || false,
        blitzReady: r.blitz_ready || false,
        profilePhotoUrl: recruitRep?.profile_photo_url || null,
      });
    });
    return map;
  }, [treeData]);

  // Drawer state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [drawerRecruit, setDrawerRecruit] = useState<Recruit | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSelectNode = useCallback(
    (node: { id: string; name: string; userId: string | null; stage: string | null } | null) => {
      setSelectedNodeId(node?.id || null);
      if (node) {
        const fullRecruit = recruitLookup.get(node.id);
        if (fullRecruit) {
          setDrawerRecruit(fullRecruit);
        } else {
          // Fallback minimal recruit if not found in lookup
          setDrawerRecruit({
            id: node.id,
            name: node.name,
            phone: "",
            email: "",
            stage: node.stage || "",
            recruiterId: null,
            recruiterName: null,
            recruiterUserId: null,
            teamName: null,
            teamId: null,
            mgmtGroupId: null,
            mgmtGroupName: null,
            year: "",
            location: null,
            recruitmentSource: null,
            lastContact: null,
            nextAction: null,
            nextActionDue: null,
            createdAt: "",
          });
        }
        setDrawerOpen(true);
      } else {
        setDrawerOpen(false);
        setDrawerRecruit(null);
      }
    },
    [recruitLookup]
  );



  if (accessLoading || isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <Tabs defaultValue="tree" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="tree" className="flex-1 gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            Recruiter Tree
          </TabsTrigger>
          <TabsTrigger value="structure" className="flex-1 gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Structure
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="mt-3 space-y-3">
          {!fullTree || fullTree.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No recruiter tree found</p>
              <p className="text-sm">Recruiting relationships will appear here</p>
            </div>
          ) : (
            <VisualRecruiterTree
              roots={fullTree}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
            />
          )}
        </TabsContent>

        <TabsContent value="structure" className="mt-3">
          <OrgStructureTree accessLevel={teamAccess?.accessLevel} />
        </TabsContent>
      </Tabs>

      {/* Recruit Detail Drawer */}
      <RecruitDetailDrawer
        recruit={drawerRecruit}
        activities={[]}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setSelectedNodeId(null);
            setDrawerRecruit(null);
            // Refetch tree data to reflect any changes (recruiter reassignment, stage change, etc.)
            queryClient.invalidateQueries({ queryKey: ["org-chart-full-tree"] });
          }
        }}
        initialTab="details"
      />
    </div>
  );
};

export default OrgChart;
