import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GitBranch, Filter } from "lucide-react";
import { getCleanName } from "@/utils/nameUtils";
import { VisualRecruiterTree, type TreeNode, type RoleColor } from "@/components/mygroup/org/VisualRecruiterTree";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrgStructureTree } from "@/components/org/OrgStructureTree";
import { RecruitDetailDrawer } from "@/components/mygroup/RecruitDetailDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { STAGES, SIGNED_PLUS_STAGES, PRIMARY_STAGES, EXIT_STAGES } from "@/utils/stageConstants";
import type { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";

// Default active stages for the tree
const DEFAULT_STAGE_FILTERS = new Set(
  SIGNED_PLUS_STAGES.map(s => s.toLowerCase())
);

const ALL_FILTER_STAGES = [...PRIMARY_STAGES, ...EXIT_STAGES];

const OrgChart = () => {
  const queryClient = useQueryClient();
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentAuthUserId(data.user?.id || null);
    });
  }, []);

  // Filter state
  const [stageFilters, setStageFilters] = useState<Set<string>>(DEFAULT_STAGE_FILTERS);
  const [showWithAppAccess, setShowWithAppAccess] = useState<boolean | null>(null); // null = show all

  const { data: treeData, isLoading } = useQuery({
    queryKey: ["org-chart-full-tree"],
    queryFn: async () => {
      const [recruitsRes, repsRes, teamsRes, mgmtGroupsRes, teamMgmtRes, officeStaffRes] = await Promise.all([
        supabase.from("recruits").select("id, name, recruiter_user_id, stage, team_id, year, phone, email, location, recruitment_source, last_contact, next_action, next_action_due, created_at, mgmt_group_id, ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete, onboarding_complete, trainings_complete, slack_joined, ipad_assigned, blitz_ready, spouse_name, significant_other_name, caution_notes, watch_out_notes").limit(5000),
        supabase.from("reps").select("user_id, name, profile_photo_url, year, stage, phone, email").limit(5000),
        supabase.from("teams").select("id, name, lead_user_id").limit(500),
        supabase.from("mgmt_groups").select("id, name, lead_user_id").limit(500),
        supabase.from("team_mgmt_groups").select("team_id, mgmt_group_id").limit(500),
        supabase.from("office_staff").select("user_id, role").limit(500),
      ]);
      return {
        recruits: recruitsRes.data || [],
        reps: repsRes.data || [],
        teams: teamsRes.data || [],
        mgmtGroups: mgmtGroupsRes.data || [],
        teamMgmt: teamMgmtRes.data || [],
        officeStaff: officeStaffRes.data || [],
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
        // If they don't already have a higher org title, set area_director color
        if (!map.has(s.user_id)) {
          map.set(s.user_id, { title: "Area Director", color: "area_director" });
        } else {
          // Keep their org title but upgrade color to area_director
          const existing = map.get(s.user_id)!;
          map.set(s.user_id, { title: existing.title, color: "area_director" });
        }
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
    recruits.forEach((r) => {
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
            ? `${teamName}` 
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
            roleColor: roleInfo.color,
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
    const accessLevel = teamAccess?.accessLevel;

    if (
      accessLevel === "area_director" ||
      accessLevel === "corporate" ||
      accessLevel === "regional" ||
      accessLevel === "sr_regional" ||
      accessLevel === "partner" ||
      accessLevel === "divisional"
    ) {
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
      const node = buildNode(currentAuthUserId);
      if (node) {
        if (node.children.length > 0) {
          rootNodes.push(node);
        }
      }
    }

    return rootNodes.sort((a, b) => b.children.length - a.children.length);
  }, [treeData, teamAccess, currentAuthUserId, roleMap, areaDirectorSet, teamLeadUserIds, userTeamNameMap]);

  // Filter tree based on stage filters
  const filteredTree = useMemo(() => {
    if (!fullTree) return null;

    const filterNode = (node: TreeNode): TreeNode | null => {
      // Recursively filter children
      const filteredChildren = node.children
        .map(filterNode)
        .filter(Boolean) as TreeNode[];

      // Check if this node passes the filter
      const stageMatch = node.stage
        ? stageFilters.has(node.stage.toLowerCase())
        : false;
      
      const appAccessMatch = showWithAppAccess === null
        ? true
        : showWithAppAccess
          ? !!node.userId
          : !node.userId;

      // Keep node if it passes filters OR has children that pass
      const nodePassesFilter = stageMatch && appAccessMatch;
      
      if (nodePassesFilter || filteredChildren.length > 0) {
        // If node itself doesn't pass but children do, still show it as a connector
        return { ...node, children: filteredChildren };
      }

      return null;
    };

    return fullTree
      .map(filterNode)
      .filter(Boolean) as TreeNode[];
  }, [fullTree, stageFilters, showWithAppAccess]);

  // Build a lookup for full recruit data
  const recruitLookup = useMemo(() => {
    if (!treeData) return new Map<string, Recruit>();
    const map = new Map<string, Recruit>();
    const { recruits, reps, teams, mgmtGroups } = treeData;
    const repMap = new Map(reps.map(r => [r.user_id, r]));
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const mgMap = new Map(mgmtGroups.map(mg => [mg.id, mg]));

    recruits.forEach((r) => {
      const recruitRep = reps.find(
        rep => getCleanName(rep.name).toLowerCase() === getCleanName(r.name).toLowerCase()
      );
      const recruiterRep = r.recruiter_user_id ? repMap.get(r.recruiter_user_id) : null;
      const team = r.team_id ? teamMap.get(r.team_id) : null;
      const mg = r.mgmt_group_id ? mgMap.get(r.mgmt_group_id) : null;

      map.set(r.id, {
        id: r.id,
        name: r.name,
        phone: r.phone || recruitRep?.phone || "",
        email: r.email || recruitRep?.email || "",
        stage: r.stage || "",
        recruiterId: null,
        recruiterName: recruiterRep?.name || null,
        recruiterUserId: r.recruiter_user_id || null,
        teamName: team?.name || null,
        teamId: r.team_id || null,
        mgmtGroupId: r.mgmt_group_id || null,
        mgmtGroupName: mg?.name || null,
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

  const toggleStageFilter = (stage: string) => {
    setStageFilters(prev => {
      const next = new Set(prev);
      const key = stage.toLowerCase();
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const activeFilterCount = stageFilters.size + (showWithAppAccess !== null ? 1 : 0);

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
      <div>
        <h1 className="text-2xl font-bold">Org Chart</h1>
        <p className="text-sm text-muted-foreground">Organization hierarchy & recruiter tree</p>
      </div>

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
          {/* Filter bar */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-3 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Stages</p>
                  <div className="space-y-1.5">
                    {ALL_FILTER_STAGES.map((stage) => (
                      <div key={stage} className="flex items-center gap-2">
                        <Checkbox
                          id={`stage-${stage}`}
                          checked={stageFilters.has(stage.toLowerCase())}
                          onCheckedChange={() => toggleStageFilter(stage)}
                        />
                        <Label htmlFor={`stage-${stage}`} className="text-xs cursor-pointer">
                          {stage}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">App Access</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="access-all"
                        checked={showWithAppAccess === null}
                        onCheckedChange={() => setShowWithAppAccess(null)}
                      />
                      <Label htmlFor="access-all" className="text-xs cursor-pointer">All</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="access-yes"
                        checked={showWithAppAccess === true}
                        onCheckedChange={() => setShowWithAppAccess(showWithAppAccess === true ? null : true)}
                      />
                      <Label htmlFor="access-yes" className="text-xs cursor-pointer">Has app account</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="access-no"
                        checked={showWithAppAccess === false}
                        onCheckedChange={() => setShowWithAppAccess(showWithAppAccess === false ? null : false)}
                      />
                      <Label htmlFor="access-no" className="text-xs cursor-pointer">No app account</Label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs h-7"
                    onClick={() => {
                      setStageFilters(new Set(ALL_FILTER_STAGES.map(s => s.toLowerCase())));
                      setShowWithAppAccess(null);
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs h-7"
                    onClick={() => {
                      setStageFilters(DEFAULT_STAGE_FILTERS);
                      setShowWithAppAccess(null);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Active filter chips */}
            <div className="flex flex-wrap gap-1 overflow-hidden">
              {stageFilters.size > 0 && stageFilters.size <= 4 && (
                Array.from(stageFilters).map((s) => {
                  const stage = ALL_FILTER_STAGES.find(st => st.toLowerCase() === s);
                  return stage ? (
                    <Badge key={s} variant="outline" className="text-[10px] h-5 px-1.5">
                      {stage}
                    </Badge>
                  ) : null;
                })
              )}
              {stageFilters.size > 4 && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                  {stageFilters.size} stages
                </Badge>
              )}
            </div>
          </div>

          {!filteredTree || filteredTree.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No recruiter tree found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <VisualRecruiterTree
              roots={filteredTree}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
            />
          )}
        </TabsContent>

        <TabsContent value="structure" className="mt-3">
          <OrgStructureTree />
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
