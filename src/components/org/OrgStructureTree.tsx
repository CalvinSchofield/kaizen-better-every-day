import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Building2, Users, User, ChevronDown, ChevronRight, UserPlus, Trash2, Plus } from "lucide-react";
import { getCleanName } from "@/utils/nameUtils";
import { YearBadge } from "@/components/leaderboard/YearBadge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLongPress } from "@/hooks/useLongPress";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RecruitDetailDrawer } from "@/components/mygroup/RecruitDetailDrawer";
import { CreateDrawer, ConfigureOfficeDrawer, ConfigureRegionDrawer } from "./OrgManagementDrawer";
import type { Recruit } from "@/hooks/useGroupRecruits";
import type { AccessLevel } from "@/utils/roleHierarchy";
import { hasMinAccess } from "@/utils/roleHierarchy";

type OrgNodeType = "region" | "office" | "mgmt_group" | "team" | "recruiter_group" | "rep";

interface OrgNode {
  id: string;
  name: string;
  type: OrgNodeType;
  role?: string;
  year?: string | null;
  hasAppAccess?: boolean;
  children: OrgNode[];
  recruitData?: Partial<Recruit>;
  // For management
  leadUserId?: string | null;
  location?: string | null;
}

function countTotalDescendants(node: OrgNode): number {
  if (node.children.length === 0) return 0;
  let count = 0;
  for (const child of node.children) {
    if (child.type === "rep") count += 1;
    else count += countTotalDescendants(child);
  }
  return count;
}

interface OrgStructureTreeProps {
  accessLevel?: AccessLevel;
}

export const OrgStructureTree = ({ accessLevel: propAccessLevel = "none" }: OrgStructureTreeProps) => {
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [derivedAccessLevel, setDerivedAccessLevel] = useState<AccessLevel>("none");

  // Use prop if provided, otherwise use self-derived access level
  const accessLevel: AccessLevel = propAccessLevel !== "none" ? propAccessLevel : derivedAccessLevel;
  const canManageOffices = hasMinAccess(accessLevel, "regional");
  const canManageRegions = hasMinAccess(accessLevel, "regional");
  const canManageTeams = hasMinAccess(accessLevel, "mgmt_group_lead");
  // Bootstrap = leader with no active upline; can self-serve until upline onboards
  const canDirectManage = canManageTeams && isBootstrapping;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || null;
      setCurrentUserId(uid);
      if (uid) {
        // Derive access level from DB directly as fallback
        Promise.all([
          supabase.from("area_directors").select("id").eq("user_id", uid).maybeSingle(),
          supabase.from("mgmt_groups").select("id").eq("lead_user_id", uid).maybeSingle(),
          supabase.from("teams").select("id").eq("lead_user_id", uid).maybeSingle(),
          supabase.from("office_staff").select("role").eq("user_id", uid).maybeSingle(),
        ]).then(([adRes, mgmtRes, teamRes, staffRes]) => {
          if (staffRes.data?.role === "corporate") setDerivedAccessLevel("corporate");
          else if (adRes.data) setDerivedAccessLevel("area_director");
          else if (mgmtRes.data) setDerivedAccessLevel("mgmt_group_lead");
          else if (teamRes.data) setDerivedAccessLevel("team_lead");
        });

        // Check if user's upline has onboarded — if not, they're bootstrapping
        supabase.rpc("has_active_upline", { _user_id: uid }).then(({ data: hasUpline }) => {
          setIsBootstrapping(!hasUpline);
        });
      }
    });
  }, []);

  const { data: orgData, isLoading, isError } = useQuery({
    queryKey: ["org-structure-data"],
    queryFn: async () => {
      const [regionsRes, officesRes, mgmtGroupsRes, teamsRes, teamMgmtRes, officeStaffRes, repsRes, recruitsRes] = await Promise.all([
        supabase.from("regions").select("*").order("name"),
        supabase.from("offices").select("*").order("name"),
        supabase.from("mgmt_groups").select("*").order("name"),
        supabase.from("teams").select("*").order("name"),
        supabase.from("team_mgmt_groups").select("*"),
        supabase.from("office_staff").select("*"),
        supabase.from("reps").select("user_id, name, year, profile_photo_url, stage"),
        supabase.from("recruits").select("id, name, recruiter_user_id, stage, year, team_id, mgmt_group_id, phone, email, location, recruitment_source, last_contact, next_action, next_action_due, created_at").limit(5000),
      ]);
      return {
        regions: regionsRes.data || [],
        offices: officesRes.data || [],
        mgmtGroups: mgmtGroupsRes.data || [],
        teams: teamsRes.data || [],
        teamMgmt: teamMgmtRes.data || [],
        officeStaff: officeStaffRes.data || [],
        reps: repsRes.data || [],
        recruits: recruitsRes.data || [],
      };
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  // Action states
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionTarget, setActionTarget] = useState<{ id: string; name: string; type: string } | null>(null);
  const [selectedRecruit, setSelectedRecruit] = useState<Recruit | null>(null);

  // Management drawers
  const [createDrawer, setCreateDrawer] = useState<{ type: "office" | "region" | "team"; parentId?: string; parentName?: string } | null>(null);
  const [configOffice, setConfigOffice] = useState<string | null>(null);
  const [configRegion, setConfigRegion] = useState<string | null>(null);

  const handleDeleteDirect = useCallback(async () => {
    if (!deleteTarget || !currentUserId) return;
    setIsDeleting(true);
    try {
      const canDirect = canManageTeams && isBootstrapping;
      if (canDirect) {
        // Direct delete — area director+ has RLS permission
        if (deleteTarget.type === "team") {
          // Unassign recruits from this team first to avoid FK violation
          await supabase.from("recruits").update({ team_id: null }).eq("team_id", deleteTarget.id);
          // Remove team_mgmt_groups linkage
          await supabase.from("team_mgmt_groups").delete().eq("team_id", deleteTarget.id);
          const { error } = await supabase.from("teams").delete().eq("id", deleteTarget.id);
          if (error) throw error;
        } else if (deleteTarget.type === "mgmt_group") {
          // Unassign recruits from this mgmt group first
          await supabase.from("recruits").update({ mgmt_group_id: null }).eq("mgmt_group_id", deleteTarget.id);
          const { error } = await supabase.from("mgmt_groups").delete().eq("id", deleteTarget.id);
          if (error) throw error;
        }
        toast.success(`"${deleteTarget.name}" ${deleteTarget.type === "team" ? "team" : "group"} dissolved. Members are now unassigned.`);
      } else {
        // Submit approval request
        const { error } = await supabase.from("org_change_requests").insert({
          request_type: `delete_${deleteTarget.type}`,
          requested_by: currentUserId,
          request_data: { target_id: deleteTarget.id, target_name: deleteTarget.name, target_type: deleteTarget.type },
          status: "pending",
        });
        if (error) throw error;
        toast.success(`Deletion request submitted for "${deleteTarget.name}".`);
      }
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, currentUserId, queryClient, accessLevel]);

  const handleRepTap = useCallback((node: OrgNode) => {
    if (!node.recruitData) return;
    const r = node.recruitData;
    setSelectedRecruit({
      id: r.id || node.id,
      name: node.name,
      phone: r.phone || "",
      email: r.email || "",
      stage: r.stage || "",
      recruiterId: null,
      recruiterName: r.recruiterName || null,
      recruiterUserId: r.recruiterUserId || null,
      teamName: r.teamName || null,
      teamId: r.teamId || null,
      mgmtGroupId: r.mgmtGroupId || null,
      mgmtGroupName: r.mgmtGroupName || null,
      year: r.year || "",
      location: r.location || null,
      recruitmentSource: r.recruitmentSource || null,
      lastContact: r.lastContact || null,
      nextAction: r.nextAction || null,
      nextActionDue: r.nextActionDue || null,
      createdAt: r.createdAt || "",
    } as Recruit);
  }, []);

  const handleNodeTap = useCallback((node: OrgNode) => {
    if (node.type === "rep") {
      handleRepTap(node);
    } else if (node.type === "office" && canManageOffices) {
      setConfigOffice(node.id);
    } else if (node.type === "region" && canManageRegions && node.id !== "unassigned") {
      setConfigRegion(node.id);
    }
  }, [handleRepTap, canManageOffices, canManageRegions]);

  const handleLongPress = useCallback((node: OrgNode) => {
    if (node.type === "team" || node.type === "mgmt_group") {
      setActionTarget({ id: node.id, name: node.name, type: node.type });
    } else if (node.type === "office" && canManageOffices) {
      setConfigOffice(node.id);
    } else if (node.type === "region" && canManageRegions && node.id !== "unassigned") {
      setConfigRegion(node.id);
    }
  }, [canManageOffices, canManageRegions]);

  const tree = useMemo(() => {
    if (!orgData) return [];
    const { regions = [], offices = [], mgmtGroups = [], teams = [], teamMgmt = [], officeStaff = [], reps = [], recruits = [] } = orgData;
    const repMap = new Map(reps.map((r) => [r.user_id, r]));
    const getRepName = (userId: string | null) => {
      if (!userId) return "Unassigned";
      return getCleanName(repMap.get(userId)?.name) || "Unknown";
    };

    // Build recruiter-to-recruits map
    const recruitsByRecruiter = new Map<string, typeof recruits>();
    recruits.forEach((r) => {
      if (r.recruiter_user_id) {
        const existing = recruitsByRecruiter.get(r.recruiter_user_id) || [];
        existing.push(r);
        recruitsByRecruiter.set(r.recruiter_user_id, existing);
      }
    });

    // Map recruit name -> rep (for app access detection)
    const recruitNameToRep = new Map<string, typeof reps[0]>();
    reps.forEach((rep) => {
      recruitNameToRep.set(getCleanName(rep.name).toLowerCase(), rep);
    });

    // Set of all team lead user IDs (to know where to stop recursion)
    const allTeamLeadIds = new Set<string>();
    teams.forEach((t) => { if (t.lead_user_id) allTeamLeadIds.add(t.lead_user_id); });
    const allMgmtLeadIds = new Set<string>();
    mgmtGroups.forEach((mg) => { if (mg.lead_user_id) allMgmtLeadIds.add(mg.lead_user_id); });

    const makeRepNode = (r: typeof recruits[0], teamName: string, teamId: string, mgmtGroupId: string | null, mgmtGroupName: string | null): OrgNode => {
      const recruitRep = recruitNameToRep.get(getCleanName(r.name).toLowerCase());
      return {
        id: r.id,
        name: getCleanName(r.name),
        type: "rep",
        role: r.stage || undefined,
        year: r.year,
        hasAppAccess: !!recruitRep?.user_id,
        children: [],
        recruitData: {
          id: r.id, phone: r.phone || "", email: r.email || "", stage: r.stage || "",
          year: r.year || "", location: r.location || null, recruitmentSource: r.recruitment_source || null,
          lastContact: r.last_contact || null, nextAction: r.next_action || null,
          nextActionDue: r.next_action_due || null, createdAt: r.created_at || "",
          recruiterUserId: r.recruiter_user_id || null,
          recruiterName: r.recruiter_user_id ? getRepName(r.recruiter_user_id) : null,
          teamName, teamId, mgmtGroupId, mgmtGroupName,
        } as Partial<Recruit>,
      };
    };

    // Recursively build tree under a recruiter, stopping at other team/mgmt lead boundaries
    const buildRecruiterSubtree = (recruiterId: string, teamName: string, teamId: string, mgmtGroupId: string | null, mgmtGroupName: string | null, stopAtLeads: Set<string>, visited: Set<string>): OrgNode[] => {
      if (visited.has(recruiterId)) return [];
      visited.add(recruiterId);

      const directRecruits = recruitsByRecruiter.get(recruiterId) || [];
      if (directRecruits.length === 0) return [];

      const bySubRecruiter = new Map<string, { recruit: typeof recruits[0]; subChildren: OrgNode[] }>();
      const leafRecruits: OrgNode[] = [];

      directRecruits.forEach((r) => {
        const recruitRep = recruitNameToRep.get(getCleanName(r.name).toLowerCase());
        const recruitUserId = recruitRep?.user_id;

        // If this recruit is a lead of another team/mgmt group, skip (they belong to that group)
        if (recruitUserId && stopAtLeads.has(recruitUserId) && recruitUserId !== recruiterId) {
          return;
        }

        // Check if this recruit has their own recruits (is a sub-recruiter)
        if (recruitUserId && recruitsByRecruiter.has(recruitUserId)) {
          const subChildren = buildRecruiterSubtree(recruitUserId, teamName, teamId, mgmtGroupId, mgmtGroupName, stopAtLeads, new Set(visited));
          if (subChildren.length > 0) {
            bySubRecruiter.set(recruitUserId, { recruit: r, subChildren });
          } else {
            leafRecruits.push(makeRepNode(r, teamName, teamId, mgmtGroupId, mgmtGroupName));
          }
        } else {
          leafRecruits.push(makeRepNode(r, teamName, teamId, mgmtGroupId, mgmtGroupName));
        }
      });

      const children: OrgNode[] = [];

      // Add recruiter group nodes for sub-recruiters
      bySubRecruiter.forEach(({ recruit, subChildren }, subRecruiterId) => {
        const recruiterRep = repMap.get(subRecruiterId);
        const recruiterName = recruiterRep ? getCleanName(recruiterRep.name) : getCleanName(recruit.name);
        children.push({
          id: `recruiter-${subRecruiterId}`,
          name: `${recruiterName}'s Recruits`,
          type: "recruiter_group",
          role: recruiterRep?.year || recruit.year || undefined,
          children: subChildren,
        });
      });

      // Add leaf recruits
      children.push(...leafRecruits);

      return children;
    };

    const buildTeamMembers = (teamLeadUserId: string | null, teamName: string, teamId: string, mgmtGroupId: string | null, mgmtGroupName: string | null): OrgNode[] => {
      if (!teamLeadUserId) return [];
      const stopLeads = new Set([...allTeamLeadIds, ...allMgmtLeadIds]);
      stopLeads.delete(teamLeadUserId);
      return buildRecruiterSubtree(teamLeadUserId, teamName, teamId, mgmtGroupId, mgmtGroupName, stopLeads, new Set());
    };

    const teamNodes = (mgmtGroupId: string, mgmtGroupName: string): OrgNode[] => {
      const groupTeamIds = teamMgmt.filter((tm) => tm.mgmt_group_id === mgmtGroupId).map((tm) => tm.team_id);
      return teams
        .filter((t) => groupTeamIds.includes(t.id))
        .map((t) => ({
          id: t.id, name: t.name, type: "team" as const,
          role: t.lead_user_id ? `Led by ${getRepName(t.lead_user_id)}` : undefined,
          children: buildTeamMembers(t.lead_user_id, t.name, t.id, mgmtGroupId, mgmtGroupName),
        }));
    };

    const mgmtNodes = (officeId: string): OrgNode[] =>
      mgmtGroups.filter((mg) => mg.office_id === officeId).map((mg) => {
        const teamChildren = teamNodes(mg.id, mg.name);
        return {
          id: mg.id, name: mg.name, type: "mgmt_group" as const,
          role: mg.lead_user_id ? `Led by ${getRepName(mg.lead_user_id)}` : undefined,
          leadUserId: mg.lead_user_id,
          children: teamChildren,
        };
      });

    const officeNodes = (regionId: string | null): OrgNode[] =>
      offices.filter((o: any) => (regionId ? o.region_id === regionId : !o.region_id)).map((o) => {
        const staff = officeStaff.filter((s) => s.office_id === o.id);
        const adNames = staff.map((s) => `${getRepName(s.user_id)} (AD)`).join(", ");
        return {
          id: o.id, name: o.name, type: "office" as const,
          role: adNames || undefined,
          location: o.location,
          children: mgmtNodes(o.id),
        };
      });

    const regionNodes: OrgNode[] = regions.map((r) => ({
      id: r.id, name: r.name, type: "region" as const,
      role: r.lead_user_id ? `Led by ${getRepName(r.lead_user_id)}` : undefined,
      leadUserId: r.lead_user_id,
      children: officeNodes(r.id),
    }));

    const unassignedOffices = officeNodes(null);
    if (unassignedOffices.length > 0) {
      regionNodes.push({
        id: "unassigned", name: "Unassigned Offices", type: "region",
        children: unassignedOffices,
      });
    }

    return regionNodes;
  }, [orgData]);

  // Find data for config drawers
  const configOfficeData = useMemo(() => {
    if (!configOffice || !orgData) return null;
    const office = orgData.offices.find((o) => o.id === configOffice);
    if (!office) return null;
    const staff = orgData.officeStaff.filter((s) => s.office_id === configOffice);
    const groups = orgData.mgmtGroups.filter((mg) => mg.office_id === configOffice);
    return { office, staff, groups };
  }, [configOffice, orgData]);

  const configRegionData = useMemo(() => {
    if (!configRegion || !orgData) return null;
    const region = orgData.regions.find((r) => r.id === configRegion);
    if (!region) return null;
    const offices = orgData.offices.filter((o: any) => o.region_id === configRegion);
    return { region, offices };
  }, [configRegion, orgData]);

  if (isLoading) {
    return <div className="animate-pulse space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded-lg" />)}</div>;
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Failed to load org structure</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => queryClient.invalidateQueries({ queryKey: ["org-structure-data"] })}>
          Retry
        </Button>
      </div>
    );
  }

  if (tree.length === 0 && !canManageRegions) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No organizational structure defined yet</p>
      </div>
    );
  }

  return (
    <>
      {/* Create buttons for Regional+ */}
      {canManageRegions && (
        <div className="flex gap-2 mb-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setCreateDrawer({ type: "region" })}
          >
            <Plus className="h-3.5 w-3.5" />
            Region
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setCreateDrawer({ type: "office" })}
          >
            <Plus className="h-3.5 w-3.5" />
            Office
          </Button>
        </div>
      )}

      <div className="space-y-1">
        {tree.map((node) => (
          <OrgNodeCard
            key={node.id}
            node={node}
            depth={0}
            onLongPressAction={handleLongPress}
            onTap={handleNodeTap}
            canManage={canManageOffices}
          />
        ))}
      </div>

      {/* Long-press action sheet for teams/mgmt_groups */}
      <Drawer open={!!actionTarget} onOpenChange={(open) => !open && setActionTarget(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{actionTarget?.name}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-2">
            {/* Add team under mgmt group */}
            {actionTarget?.type === "mgmt_group" && canManageTeams && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  if (actionTarget) {
                    setCreateDrawer({ type: "team", parentId: actionTarget.id, parentName: actionTarget.name });
                    setActionTarget(null);
                  }
                }}
              >
                <Plus className="h-4 w-4" />
                Create Team
              </Button>
            )}
            {canManageTeams && (
              <Button
                variant="destructive"
                className="w-full justify-start gap-2"
                onClick={() => {
                  if (actionTarget) {
                    setDeleteTarget(actionTarget);
                    setActionTarget(null);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                {canDirectManage ? "Delete" : "Request Deletion"}
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {canDirectManage ? "Delete" : "Request Deletion of"} {deleteTarget?.type === "team" ? "Team" : deleteTarget?.type === "mgmt_group" ? "MGMT Group" : "Item"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {canDirectManage
                ? `Are you sure you want to dissolve the "${deleteTarget?.name}" ${deleteTarget?.type === "team" ? "team" : "group"}? All reps and recruits will be unassigned and can be reassigned to another ${deleteTarget?.type === "team" ? "team" : "group"}.`
                : `Submit a request to dissolve the "${deleteTarget?.name}" ${deleteTarget?.type === "team" ? "team" : "group"}? Needs upline approval. Members will be unassigned.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDirect} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : canDirectManage ? "Delete" : "Submit Request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create drawer */}
      <CreateDrawer
        open={!!createDrawer}
        onOpenChange={(open) => !open && setCreateDrawer(null)}
        type={createDrawer?.type || "office"}
        parentId={createDrawer?.parentId}
        parentName={createDrawer?.parentName}
      />

      {/* Configure office drawer */}
      {configOfficeData && (
        <ConfigureOfficeDrawer
          open={!!configOffice}
          onOpenChange={(open) => !open && setConfigOffice(null)}
          officeId={configOfficeData.office.id}
          officeName={configOfficeData.office.name}
          officeLocation={configOfficeData.office.location}
          currentStaff={configOfficeData.staff}
          currentMgmtGroups={configOfficeData.groups}
          allMgmtGroups={orgData?.mgmtGroups || []}
          allReps={orgData?.reps?.map((r) => ({ user_id: r.user_id, name: r.name })) || []}
        />
      )}

      {/* Configure region drawer */}
      {configRegionData && (
        <ConfigureRegionDrawer
          open={!!configRegion}
          onOpenChange={(open) => !open && setConfigRegion(null)}
          regionId={configRegionData.region.id}
          regionName={configRegionData.region.name}
          leadUserId={configRegionData.region.lead_user_id}
          currentOffices={configRegionData.offices}
          allOffices={orgData?.offices || []}
          allReps={orgData?.reps?.map((r) => ({ user_id: r.user_id, name: r.name })) || []}
        />
      )}

      {/* Recruit detail drawer */}
      <RecruitDetailDrawer
        recruit={selectedRecruit}
        activities={[]}
        open={!!selectedRecruit}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRecruit(null);
            queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
          }
        }}
        initialTab="details"
      />
    </>
  );
};

// ==========================================
// NODE CARD
// ==========================================

const typeIcons: Record<OrgNodeType, any> = {
  region: Globe, office: Building2, mgmt_group: Users,
  team: Users, recruiter_group: UserPlus, rep: User,
};

const typeColors: Record<OrgNodeType, string> = {
  region: "text-primary", office: "text-amber-500", mgmt_group: "text-blue-500",
  team: "text-green-500", recruiter_group: "text-purple-500", rep: "text-muted-foreground",
};

interface OrgNodeCardProps {
  node: OrgNode;
  depth: number;
  onLongPressAction: (node: OrgNode) => void;
  onTap: (node: OrgNode) => void;
  canManage: boolean;
}

const OrgNodeCard = ({ node, depth, onLongPressAction, onTap, canManage }: OrgNodeCardProps) => {
  const [expanded, setExpanded] = useState(depth < 6);
  const hasChildren = node.children.length > 0;
  const Icon = typeIcons[node.type];
  const isRep = node.type === "rep";
  const isInteractive = isRep || ((node.type === "office" || node.type === "region") && canManage);
  const isLongPressable = node.type === "team" || node.type === "mgmt_group" || ((node.type === "office" || node.type === "region") && canManage);

  const totalReps = useMemo(() => {
    if (isRep) return 0;
    return countTotalDescendants(node);
  }, [node, isRep]);

  const longPressHandlers = useLongPress({
    delay: 400,
    onLongPress: isLongPressable ? () => onLongPressAction(node) : undefined,
    onTap: () => {
      if (isInteractive) {
        onTap(node);
      } else if (hasChildren) {
        setExpanded(!expanded);
      }
    },
  });

  return (
    <div className={depth > 0 ? "ml-4 border-l border-border pl-3" : ""}>
      <div
        className="flex items-center gap-2 p-2 rounded-lg active:bg-accent/50 transition-colors min-w-0 select-none touch-manipulation"
        {...longPressHandlers}
      >
        {hasChildren ? (
          expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" onClick={(e) => { e.stopPropagation(); setExpanded(false); }} />
            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" onClick={(e) => { e.stopPropagation(); setExpanded(true); }} />
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <Icon className={cn("h-4 w-4 shrink-0", typeColors[node.type])} />
        <span className={cn(
          "text-sm font-medium truncate",
          isRep && !node.hasAppAccess && "text-muted-foreground italic",
          isInteractive && "underline decoration-dotted underline-offset-2"
        )}>
          {node.name}
        </span>

        {isRep && node.year && <YearBadge year={node.year} className="!w-4 !h-4 !text-[8px]" />}
        {isRep && (
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", node.hasAppAccess ? "bg-green-500" : "bg-muted-foreground/30")} />
        )}

        {node.role && <span className="text-xs text-muted-foreground truncate ml-auto">{node.role}</span>}

        {!isRep && totalReps > 0 && (
          <Badge variant="outline" className="text-xs ml-auto shrink-0">
            {totalReps} {totalReps === 1 ? "rep" : "reps"}
          </Badge>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <OrgNodeCard key={child.id} node={child} depth={depth + 1} onLongPressAction={onLongPressAction} onTap={onTap} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
};
