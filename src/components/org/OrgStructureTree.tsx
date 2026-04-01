import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Building2, Users, User, ChevronDown, ChevronRight, UserPlus, Trash2, Plus, ArrowRightLeft, FileEdit, Info, ArrowRight, MoreHorizontal } from "lucide-react";
import { getCleanName } from "@/utils/nameUtils";
import { SIGNED_PLUS_STAGES, isStageIn } from "@/utils/stageConstants";
import { YearBadge } from "@/components/leaderboard/YearBadge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLongPress } from "@/hooks/useLongPress";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { RecruitDetailDrawer } from "@/components/mygroup/RecruitDetailDrawer";
import { CreateDrawer, ConfigureOfficeDrawer, ConfigureRegionDrawer } from "./OrgManagementDrawer";
import { OfficeDetailDrawer } from "./OfficeDetailDrawer";
import { BulkAssignRepsDrawer } from "./BulkAssignRepsDrawer";
import { MoveToTeamDrawer } from "./MoveToTeamDrawer";
import { MoveTeamToMgmtDrawer } from "./MoveTeamToMgmtDrawer";
import { MoveEntityDrawer } from "./MoveEntityDrawer";
import { AssignToOfficeDrawer } from "./AssignToOfficeDrawer";
import type { Recruit } from "@/hooks/useGroupRecruits";
import type { AccessLevel } from "@/utils/roleHierarchy";
import { hasMinAccess, canCreateEntityType } from "@/utils/roleHierarchy";

type OrgNodeType = "division" | "partner" | "sr_region" | "region" | "sr_mgmt_group" | "office" | "mgmt_group" | "team" | "recruiter_group" | "rep";

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
  let count = 0;
  // Count leaders of structural nodes as people
  if (node.leadUserId && (node.type === "team" || node.type === "mgmt_group" || node.type === "sr_mgmt_group")) {
    count += 1;
  }
  for (const child of node.children) {
    if (child.type === "rep") count += 1;
    else if (child.type === "recruiter_group") count += 1 + countTotalDescendants(child); // the recruiter + their recruits
    else count += countTotalDescendants(child);
  }
  return count;
}

// --- Delete Confirmation Drawer with reassignment preview ---
interface DeleteConfirmationDrawerProps {
  deleteTarget: { id: string; name: string; type: string } | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  canDirectManage: boolean;
  orgData: {
    teams: { id: string; name: string; lead_user_id: string | null }[];
    recruits: { id: string; name: string; recruiter_user_id: string | null; stage: string | null; team_id: string | null; mgmt_group_id: string | null }[];
    reps: { user_id: string; name: string; stage: string | null }[];
    mgmtGroups: { id: string; name: string; lead_user_id: string | null }[];
  } | undefined;
}

const DeleteConfirmationDrawer = ({
  deleteTarget, onClose, onConfirm, isDeleting, canDirectManage, orgData,
}: DeleteConfirmationDrawerProps) => {
  const reassignmentInfo = useMemo(() => {
    if (!deleteTarget || !orgData) return null;

    const isTeam = deleteTarget.type === "team";
    const entityLabel = isTeam ? "team" : "group";

    // Find the leader of the entity being deleted
    let leaderUserId: string | null = null;
    let leaderName: string | null = null;
    if (isTeam) {
      const team = orgData.teams.find(t => t.id === deleteTarget.id);
      leaderUserId = team?.lead_user_id || null;
    } else {
      const mg = orgData.mgmtGroups.find(g => g.id === deleteTarget.id);
      leaderUserId = mg?.lead_user_id || null;
    }
    if (leaderUserId) {
      const rep = orgData.reps.find(r => r.user_id === leaderUserId);
      leaderName = rep ? getCleanName(rep.name) : null;
    }

    // Count active recruits in this entity
    const fieldKey = isTeam ? "team_id" : "mgmt_group_id";
    const entityRecruits = orgData.recruits.filter(r => r[fieldKey] === deleteTarget.id);
    const activeRecruits = entityRecruits.filter(r =>
      r.stage && SIGNED_PLUS_STAGES.some(s => s.toLowerCase() === r.stage!.toLowerCase())
    );

    // Find where they'll go — trace the team leader's recruiter to find the parent team
    let destinationTeamName: string | null = null;
    if (isTeam && leaderUserId) {
      // Find leader's recruit record to get their recruiter
      const leaderRep = orgData.reps.find(r => r.user_id === leaderUserId);
      if (leaderRep) {
        const leaderRecruit = orgData.recruits.find(
          r => getCleanName(r.name).toLowerCase() === getCleanName(leaderRep.name).toLowerCase()
        );
        if (leaderRecruit?.recruiter_user_id) {
          // Find the recruiter's team
          const parentTeam = orgData.teams.find(t => t.lead_user_id === leaderRecruit.recruiter_user_id);
          if (parentTeam && parentTeam.id !== deleteTarget.id) {
            const parentLeadRep = orgData.reps.find(r => r.user_id === parentTeam.lead_user_id);
            destinationTeamName = parentLeadRep ? getCleanName(parentLeadRep.name) + "'s team" : parentTeam.name;
          } else {
            // Trace further up
            let traceUserId = leaderRecruit.recruiter_user_id;
            const visited = new Set<string>();
            while (traceUserId && !visited.has(traceUserId)) {
              visited.add(traceUserId);
              const traceTeam = orgData.teams.find(t => t.lead_user_id === traceUserId && t.id !== deleteTarget.id);
              if (traceTeam) {
                const traceRep = orgData.reps.find(r => r.user_id === traceTeam.lead_user_id);
                destinationTeamName = traceRep ? getCleanName(traceRep.name) + "'s team" : traceTeam.name;
                break;
              }
              const traceRep = orgData.reps.find(r => r.user_id === traceUserId);
              if (!traceRep) break;
              const traceRecruit = orgData.recruits.find(
                r => getCleanName(r.name).toLowerCase() === getCleanName(traceRep.name).toLowerCase()
              );
              traceUserId = traceRecruit?.recruiter_user_id || null;
            }
          }
        }
      }
    }

    return {
      entityLabel,
      leaderName,
      activeCount: activeRecruits.length,
      totalCount: entityRecruits.length,
      destinationTeamName,
    };
  }, [deleteTarget, orgData]);

  return (
    <Drawer open={!!deleteTarget} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {canDirectManage ? "Delete" : "Request Deletion of"} {deleteTarget?.type === "team" ? "Team" : deleteTarget?.type === "mgmt_group" ? "MGMT Group" : "Item"}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {canDirectManage
              ? `Are you sure you want to dissolve the "${deleteTarget?.name}" ${reassignmentInfo?.entityLabel || "team"}?`
              : `Submit a request to dissolve the "${deleteTarget?.name}" ${reassignmentInfo?.entityLabel || "team"}? Needs upline approval.`}
          </p>

          {/* Reassignment preview */}
          {reassignmentInfo && (reassignmentInfo.leaderName || reassignmentInfo.activeCount > 0) && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-3 border border-border/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What happens</p>
              
              {reassignmentInfo.leaderName && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>
                    <span className="font-medium">{reassignmentInfo.leaderName}</span>
                    {reassignmentInfo.destinationTeamName ? (
                      <span className="text-muted-foreground">
                        {" "}moves to{" "}
                        <span className="font-medium text-foreground">{reassignmentInfo.destinationTeamName}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground"> loses team lead role</span>
                    )}
                  </span>
                </div>
              )}

              {reassignmentInfo.activeCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>
                    <span className="font-medium">{reassignmentInfo.activeCount} active rep{reassignmentInfo.activeCount !== 1 ? "s" : ""}</span>
                    <span className="text-muted-foreground">
                      {reassignmentInfo.destinationTeamName ? (
                        <> will follow to <span className="font-medium text-foreground">{reassignmentInfo.destinationTeamName}</span></>
                      ) : (
                        <> will be unassigned</>
                      )}
                    </span>
                  </span>
                </div>
              )}

              {reassignmentInfo.destinationTeamName && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span>Recruiter relationships stay intact</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : canDirectManage ? "Delete" : "Submit Request"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

interface OrgStructureTreeProps {
  accessLevel?: AccessLevel;
}

export const OrgStructureTree = ({ accessLevel: propAccessLevel = "none" }: OrgStructureTreeProps) => {
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [derivedAccessLevel, setDerivedAccessLevel] = useState<AccessLevel>("none");
  const [groupByOffice, setGroupByOffice] = useState(false);

  // Use prop if provided, otherwise use self-derived access level
  const accessLevel: AccessLevel = propAccessLevel !== "none" ? propAccessLevel : derivedAccessLevel;
  const canManageOffices = hasMinAccess(accessLevel, "regional");
  const canManageRegions = hasMinAccess(accessLevel, "regional");
  const canManageTeams = hasMinAccess(accessLevel, "mgmt_group_lead");
  const isAD = accessLevel === "area_director";
  // Bootstrap = leader with no active upline; can self-serve until upline onboards
  const canDirectManage = canManageTeams && isBootstrapping;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id || null;
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
      const [regionsRes, officesRes, mgmtGroupsRes, teamsRes, teamMgmtRes, officeStaffRes, repsRes, recruitsRes, srMgmtGroupsRes, srRegionsRes, partnersRes, divisionsRes] = await Promise.all([
        supabase.from("regions").select("*").order("name"),
        supabase.from("offices").select("*").order("name"),
        supabase.from("mgmt_groups").select("*").order("name"),
        supabase.from("teams").select("*").order("name"),
        supabase.from("team_mgmt_groups").select("*"),
        supabase.from("office_staff").select("*"),
        supabase.from("reps").select("user_id, name, year, profile_photo_url, stage, office_id"),
        supabase.from("recruits").select("id, name, recruiter_user_id, stage, year, team_id, mgmt_group_id, phone, email, location, recruitment_source, last_contact, next_action, next_action_due, created_at").limit(5000),
        supabase.from("sr_mgmt_groups").select("*").order("name"),
        supabase.from("sr_regions").select("*").order("name"),
        supabase.from("partners").select("*").order("name"),
        supabase.from("divisions").select("*").order("name"),
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
        srMgmtGroups: srMgmtGroupsRes.data || [],
        srRegions: srRegionsRes.data || [],
        partners: partnersRes.data || [],
        divisions: divisionsRes.data || [],
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

  // New drawer states
  const [moveRepTarget, setMoveRepTarget] = useState<{ id: string; name: string } | null>(null);
  const [bulkAssignTarget, setBulkAssignTarget] = useState<{ id: string; name: string } | null>(null);
  const [moveTeamTarget, setMoveTeamTarget] = useState<{ id: string; name: string; leadUserId: string | null } | null>(null);
  const [moveEntityTarget, setMoveEntityTarget] = useState<{
    entityType: "mgmt_group" | "sr_mgmt_group" | "region" | "sr_region" | "partner";
    id: string;
    name: string;
    leadUserId: string | null;
  } | null>(null);
  const [assignToOfficeTarget, setAssignToOfficeTarget] = useState<{
    id: string;
    name: string;
    type: "sr_mgmt_group" | "mgmt_group" | "team";
  } | null>(null);

  // Management drawers
  const [createDrawer, setCreateDrawer] = useState<{ type: "office" | "region" | "team" | "mgmt_group" | "sr_mgmt_group" | "sr_region" | "partner" | "division"; parentId?: string; parentName?: string; parentType?: string } | null>(null);
  const [officeDetailId, setOfficeDetailId] = useState<string | null>(null);
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
          // Reassign orphaned recruits to their recruiter's team instead of nullifying
          const { data: orphanedRecruits } = await supabase
            .from("recruits")
            .select("id, recruiter_user_id")
            .eq("team_id", deleteTarget.id);

          if (orphanedRecruits && orphanedRecruits.length > 0) {
            // For each orphaned recruit, trace their recruiter chain to find the nearest team
            const recruiterUserIds = [...new Set(
              orphanedRecruits
                .map(r => r.recruiter_user_id)
                .filter((id): id is string => !!id)
            )];

            // Find teams led by the recruiters (or their upline)
            const { data: allRecruits } = await supabase
              .from("recruits")
              .select("id, name, recruiter_user_id, team_id")
              .limit(5000);
            const { data: allTeams } = await supabase
              .from("teams")
              .select("id, lead_user_id");
            const { data: allReps } = await supabase
              .from("reps")
              .select("user_id, name");

            const teamByLeader = new Map<string, string>();
            (allTeams || []).forEach(t => {
              if (t.lead_user_id) teamByLeader.set(t.lead_user_id, t.id);
            });

            const repNameToRep = new Map<string, { user_id: string }>();
            (allReps || []).forEach(r => {
              if (r.user_id) repNameToRep.set(getCleanName(r.name).toLowerCase(), { user_id: r.user_id });
            });

            const recruitByName = new Map<string, typeof allRecruits extends (infer T)[] | null ? T : never>();
            (allRecruits || []).forEach(r => {
              recruitByName.set(getCleanName(r.name).toLowerCase(), r);
            });

            // Trace up recruiter chain to find nearest team lead
            const findParentTeamId = (recruiterUserId: string, visited = new Set<string>()): string | null => {
              if (visited.has(recruiterUserId)) return null;
              visited.add(recruiterUserId);

              // If this recruiter leads a team (that isn't the one being dissolved), use it
              const teamId = teamByLeader.get(recruiterUserId);
              if (teamId && teamId !== deleteTarget.id) return teamId;

              // Otherwise trace up: find this user's recruit record to get their recruiter
              const rep = (allReps || []).find(r => r.user_id === recruiterUserId);
              if (!rep) return null;
              const recruitRecord = recruitByName.get(getCleanName(rep.name).toLowerCase());
              if (!recruitRecord?.recruiter_user_id) return null;

              return findParentTeamId(recruitRecord.recruiter_user_id, visited);
            };

            // Build a map of recruiter -> parent team
            const recruiterToTeam = new Map<string, string | null>();
            recruiterUserIds.forEach(rid => {
              recruiterToTeam.set(rid, findParentTeamId(rid));
            });

            // Reassign each orphan to their recruiter's parent team
            for (const recruit of orphanedRecruits) {
              const parentTeamId = recruit.recruiter_user_id
                ? recruiterToTeam.get(recruit.recruiter_user_id) ?? null
                : null;
              await supabase
                .from("recruits")
                .update({ team_id: parentTeamId })
                .eq("id", recruit.id);
            }
          }

          // Remove team_mgmt_groups linkage
          await supabase.from("team_mgmt_groups").delete().eq("team_id", deleteTarget.id);
          const { error } = await supabase.from("teams").delete().eq("id", deleteTarget.id);
          if (error) throw error;
        } else if (deleteTarget.type === "mgmt_group") {
          // Reassign orphaned recruits to their recruiter's MGMT group
          const { data: orphanedRecruits } = await supabase
            .from("recruits")
            .select("id, recruiter_user_id")
            .eq("mgmt_group_id", deleteTarget.id);

          if (orphanedRecruits && orphanedRecruits.length > 0) {
            const recruiterUserIds = [...new Set(
              orphanedRecruits
                .map(r => r.recruiter_user_id)
                .filter((id): id is string => !!id)
            )];

            const { data: allRecruits } = await supabase
              .from("recruits")
              .select("id, name, recruiter_user_id, mgmt_group_id")
              .limit(5000);
            const { data: allMgmtGroups } = await supabase
              .from("mgmt_groups")
              .select("id, lead_user_id");
            const { data: allReps } = await supabase
              .from("reps")
              .select("user_id, name");

            const mgmtByLeader = new Map<string, string>();
            (allMgmtGroups || []).forEach(mg => {
              if (mg.lead_user_id) mgmtByLeader.set(mg.lead_user_id, mg.id);
            });

            const recruitByName = new Map<string, typeof allRecruits extends (infer T)[] | null ? T : never>();
            (allRecruits || []).forEach(r => {
              recruitByName.set(getCleanName(r.name).toLowerCase(), r);
            });

            const findParentMgmtGroupId = (recruiterUserId: string, visited = new Set<string>()): string | null => {
              if (visited.has(recruiterUserId)) return null;
              visited.add(recruiterUserId);

              const mgmtId = mgmtByLeader.get(recruiterUserId);
              if (mgmtId && mgmtId !== deleteTarget.id) return mgmtId;

              const rep = (allReps || []).find(r => r.user_id === recruiterUserId);
              if (!rep) return null;
              const recruitRecord = recruitByName.get(getCleanName(rep.name).toLowerCase());
              if (!recruitRecord?.recruiter_user_id) return null;

              return findParentMgmtGroupId(recruitRecord.recruiter_user_id, visited);
            };

            const recruiterToMgmt = new Map<string, string | null>();
            recruiterUserIds.forEach(rid => {
              recruiterToMgmt.set(rid, findParentMgmtGroupId(rid));
            });

            for (const recruit of orphanedRecruits) {
              const parentMgmtId = recruit.recruiter_user_id
                ? recruiterToMgmt.get(recruit.recruiter_user_id) ?? null
                : null;
              await supabase
                .from("recruits")
                .update({ mgmt_group_id: parentMgmtId })
                .eq("id", recruit.id);
            }
          }

          const { error } = await supabase.from("mgmt_groups").delete().eq("id", deleteTarget.id);
          if (error) throw error;
        }
        toast.success(`"${deleteTarget.name}" dissolved. Members reassigned to parent team.`);
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
      queryClient.invalidateQueries({ queryKey: ["org-chart-full-tree"] });
      queryClient.invalidateQueries({ queryKey: ["recruiter-tree-data"] });
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

  const canConfigureOffice = useCallback((nodeId: string): boolean => {
    if (canManageOffices) return true;
    // ADs can configure their own offices
    if (isAD && currentUserId && orgData) {
      return orgData.officeStaff.some((s: any) => s.office_id === nodeId && s.user_id === currentUserId);
    }
    return false;
  }, [canManageOffices, isAD, currentUserId, orgData]);

  const handleNodeTap = useCallback((node: OrgNode) => {
    if (node.type === "rep") {
      handleRepTap(node);
    } else if (node.type === "office") {
      // Always show office detail drawer; config is via long-press
      setOfficeDetailId(node.id);
    } else if (node.type === "region" && canManageRegions && node.id !== "unassigned") {
      setConfigRegion(node.id);
    }
  }, [handleRepTap, canManageRegions]);

  const handleLongPress = useCallback((node: OrgNode) => {
    const actionableTypes = ["rep", "team", "mgmt_group", "sr_mgmt_group", "region", "sr_region", "partner", "division", "office"];
    if (actionableTypes.includes(node.type)) {
      if (node.type === "office" && canConfigureOffice(node.id)) {
        setConfigOffice(node.id);
      } else if (node.type === "region" && canManageRegions && node.id !== "unassigned") {
        setConfigRegion(node.id);
      } else {
        setActionTarget({ id: node.id, name: node.name, type: node.type });
      }
    }
  }, [canConfigureOffice, canManageRegions]);

  const tree = useMemo(() => {
    if (!orgData) return [];
    const { regions = [], offices = [], mgmtGroups = [], teams = [], teamMgmt = [], officeStaff = [], reps = [], recruits = [], srMgmtGroups = [], srRegions = [], partners = [], divisions = [] } = orgData;
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

      const directRecruits = (recruitsByRecruiter.get(recruiterId) || [])
        .filter((r) => isStageIn(r.stage, [...SIGNED_PLUS_STAGES]));
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
          leadUserId: t.lead_user_id,
          children: buildTeamMembers(t.lead_user_id, t.name, t.id, mgmtGroupId, mgmtGroupName),
        }));
    };

    // MGMT Groups under a Sr MGMT Group (lineage parent)
    const mgmtNodesForSrMgmt = (srMgmtGroupId: string): OrgNode[] =>
      mgmtGroups.filter((mg) => mg.sr_mgmt_group_id === srMgmtGroupId).map((mg) => {
        const teamChildren = teamNodes(mg.id, mg.name);
        return {
          id: mg.id, name: mg.name, type: "mgmt_group" as const,
          role: mg.lead_user_id ? `Led by ${getRepName(mg.lead_user_id)}` : undefined,
          leadUserId: mg.lead_user_id,
          children: teamChildren,
        };
      });

    // MGMT Groups directly under an Office (no sr_mgmt_group)
    const mgmtNodesForOffice = (officeId: string): OrgNode[] =>
      mgmtGroups.filter((mg) => mg.office_id === officeId && !mg.sr_mgmt_group_id).map((mg) => {
        const teamChildren = teamNodes(mg.id, mg.name);
        return {
          id: mg.id, name: mg.name, type: "mgmt_group" as const,
          role: mg.lead_user_id ? `Led by ${getRepName(mg.lead_user_id)}` : undefined,
          leadUserId: mg.lead_user_id,
          children: teamChildren,
        };
      });

    // Sr MGMT Groups under a Region (lineage)
    const srMgmtGroupNodes = (regionId: string): OrgNode[] =>
      srMgmtGroups.filter((smg: any) => smg.region_id === regionId).map((smg: any) => ({
        id: smg.id, name: smg.name, type: "sr_mgmt_group" as const,
        role: smg.lead_user_id ? `Led by ${getRepName(smg.lead_user_id)}` : undefined,
        leadUserId: smg.lead_user_id,
        children: mgmtNodesForSrMgmt(smg.id),
      }));

    const officeNodes = (regionId: string | null): OrgNode[] =>
      offices.filter((o: any) => (regionId ? o.region_id === regionId : !o.region_id)).map((o) => {
        const staff = officeStaff.filter((s) => s.office_id === o.id);
        const adNames = staff.map((s) => `${getRepName(s.user_id)} (AD)`).join(", ");
        return {
          id: o.id, name: o.name, type: "office" as const,
          role: adNames || undefined,
          location: o.location,
          children: mgmtNodesForOffice(o.id),
        };
      });

    const regionNodes = (srRegionId: string | null): OrgNode[] =>
      regions.filter((r: any) => (srRegionId ? r.sr_region_id === srRegionId : !r.sr_region_id)).map((r) => ({
        id: r.id, name: r.name, type: "region" as const,
        role: r.lead_user_id ? `Led by ${getRepName(r.lead_user_id)}` : undefined,
        leadUserId: r.lead_user_id,
        // Region children: Sr MGMT Groups (lineage) + Offices (non-lineage buckets)
        children: [...srMgmtGroupNodes(r.id), ...officeNodes(r.id)],
      }));

    const srRegionNodes = (partnerId: string | null): OrgNode[] =>
      srRegions.filter((sr: any) => (partnerId ? sr.partner_id === partnerId : !sr.partner_id)).map((sr) => ({
        id: sr.id, name: sr.name, type: "sr_region" as const,
        role: sr.lead_user_id ? `Led by ${getRepName(sr.lead_user_id)}` : undefined,
        leadUserId: sr.lead_user_id,
        children: regionNodes(sr.id),
      }));

    const partnerNodes = (divisionId: string | null): OrgNode[] =>
      partners.filter((p: any) => (divisionId ? p.division_id === divisionId : !p.division_id)).map((p) => ({
        id: p.id, name: p.name, type: "partner" as const,
        role: p.lead_user_id ? `Led by ${getRepName(p.lead_user_id)}` : undefined,
        leadUserId: p.lead_user_id,
        children: srRegionNodes(p.id),
      }));

    const divisionNodes: OrgNode[] = divisions.map((d) => ({
      id: d.id, name: d.name, type: "division" as const,
      role: d.lead_user_id ? `Led by ${getRepName(d.lead_user_id)}` : undefined,
      leadUserId: d.lead_user_id,
      children: partnerNodes(d.id),
    }));

    // ===== GROUP BY OFFICE VIEW =====
    if (groupByOffice) {
      const officeTopNodes: OrgNode[] = [];

      // Resolve effective office_id for each team: team.office_id > mgmt_group.office_id
      const getTeamOfficeId = (team: any): string | null => {
        if (team.office_id) return team.office_id;
        const tmLink = teamMgmt.find(tm => tm.team_id === team.id);
        if (tmLink) {
          const mg = mgmtGroups.find(m => m.id === tmLink.mgmt_group_id);
          if (mg?.office_id) return mg.office_id;
        }
        return null;
      };

      // Build a map: officeId -> { srMgmtGroups, mgmtGroups, teams, reps (directly assigned) }
      const officeEntities = new Map<string, {
        srMgmtGroupIds: Set<string>;
        mgmtGroupIds: Set<string>;
        teamIds: Set<string>;
        repUserIds: Set<string>;
      }>();

      const ensureOffice = (officeId: string) => {
        if (!officeEntities.has(officeId)) {
          officeEntities.set(officeId, { srMgmtGroupIds: new Set(), mgmtGroupIds: new Set(), teamIds: new Set(), repUserIds: new Set() });
        }
        return officeEntities.get(officeId)!;
      };

      // 1. Sr MGMT Groups with office_id
      srMgmtGroups.forEach((smg: any) => {
        if (smg.office_id) ensureOffice(smg.office_id).srMgmtGroupIds.add(smg.id);
      });

      // 2. MGMT Groups with office_id
      mgmtGroups.forEach((mg) => {
        if (mg.office_id) ensureOffice(mg.office_id).mgmtGroupIds.add(mg.id);
      });

      // 3. Teams with office_id (direct or inherited from mgmt group)
      teams.forEach((t: any) => {
        const officeId = getTeamOfficeId(t);
        if (officeId) ensureOffice(officeId).teamIds.add(t.id);
      });

      // 4. Individual reps with office_id
      reps.forEach((r: any) => {
        if (r.office_id) ensureOffice(r.office_id).repUserIds.add(r.user_id);
      });

      // For each office, build a hierarchical tree
      offices.forEach((o: any) => {
        const staff = officeStaff.filter((s) => s.office_id === o.id);
        const adNames = staff.map((s) => `${getRepName(s.user_id)} (AD)`).join(", ");
        const entities = officeEntities.get(o.id);

        const officeChildren: OrgNode[] = [];

        if (entities) {
          // Collect all MGMT groups in this office (directly assigned or via sr_mgmt_group)
          const officeMgmtGroupIds = new Set(entities.mgmtGroupIds);
          
          // Also include MGMT groups under Sr MGMT Groups assigned to this office
          entities.srMgmtGroupIds.forEach(srId => {
            mgmtGroups.filter(mg => mg.sr_mgmt_group_id === srId).forEach(mg => {
              officeMgmtGroupIds.add(mg.id);
            });
          });

          // Flatten: show ALL MGMT groups directly under office (no Sr MGMT nesting)
          officeMgmtGroupIds.forEach(mgId => {
            const mg = mgmtGroups.find(m => m.id === mgId);
            if (!mg) return;
            officeChildren.push({
              id: mg.id, name: mg.name, type: "mgmt_group" as const,
              role: mg.lead_user_id ? `Led by ${getRepName(mg.lead_user_id)}` : undefined,
              leadUserId: mg.lead_user_id,
              children: teamNodes(mg.id, mg.name),
            });
          });

          // Add teams directly assigned to this office but whose MGMT group isn't in this office
          entities.teamIds.forEach(tId => {
            // Check if team is already shown under a MGMT group above
            const tmLink = teamMgmt.find(tm => tm.team_id === tId);
            const alreadyShown = tmLink && officeMgmtGroupIds.has(tmLink.mgmt_group_id);
            if (!alreadyShown) {
              const t = teams.find(team => team.id === tId);
              if (t) {
                const mgLink = tmLink ? mgmtGroups.find(m => m.id === tmLink.mgmt_group_id) : null;
                officeChildren.push({
                  id: t.id, name: t.name, type: "team" as const,
                  role: t.lead_user_id ? `Led by ${getRepName(t.lead_user_id)}` : undefined,
                  leadUserId: t.lead_user_id,
                  children: buildTeamMembers(t.lead_user_id, t.name, t.id, mgLink?.id || null, mgLink?.name || null),
                });
              }
            }
          });

          // Add individual reps directly assigned to this office
          entities.repUserIds.forEach(userId => {
            const rep = repMap.get(userId);
            if (rep) {
              officeChildren.push({
                id: `rep-office-${userId}`, name: getCleanName(rep.name), type: "rep" as const,
                year: rep.year,
                hasAppAccess: true,
                children: [],
              });
            }
          });
        }

        officeTopNodes.push({
          id: o.id, name: o.name, type: "office" as const,
          role: adNames || undefined,
          location: o.location,
          children: officeChildren,
        });
      });

      // Unassigned bucket: MGMT groups, teams, and reps with no office
      const assignedMgmtIds = new Set<string>();
      const assignedTeamIds = new Set<string>();
      const assignedRepIds = new Set<string>();
      officeEntities.forEach(e => {
        e.mgmtGroupIds.forEach(id => assignedMgmtIds.add(id));
        e.srMgmtGroupIds.forEach(srId => {
          mgmtGroups.filter(mg => mg.sr_mgmt_group_id === srId).forEach(mg => assignedMgmtIds.add(mg.id));
        });
        e.teamIds.forEach(id => assignedTeamIds.add(id));
        e.repUserIds.forEach(id => assignedRepIds.add(id));
      });

      const unassignedMgmt = mgmtGroups.filter(mg => !assignedMgmtIds.has(mg.id));
      if (unassignedMgmt.length > 0) {
        officeTopNodes.push({
          id: "no-office", name: "No Office Assigned", type: "office" as const,
          children: unassignedMgmt.map(mg => ({
            id: mg.id, name: mg.name, type: "mgmt_group" as const,
            role: mg.lead_user_id ? `Led by ${getRepName(mg.lead_user_id)}` : undefined,
            leadUserId: mg.lead_user_id,
            children: teamNodes(mg.id, mg.name),
          })),
        });
      }

      return officeTopNodes;
    }

    // ===== DEFAULT HIERARCHY VIEW =====
    // Build the top-level tree
    const topNodes: OrgNode[] = [];

    // Add divisions
    topNodes.push(...divisionNodes);

    // Add unassigned partners (not in a division)
    const unassignedPartners = partnerNodes(null);
    topNodes.push(...unassignedPartners);

    // Add unassigned sr_regions (not in a partner)
    const unassignedSrRegions = srRegionNodes(null);
    topNodes.push(...unassignedSrRegions);

    // Add unassigned regions (not in an sr_region)
    const unassignedRegions = regionNodes(null);
    topNodes.push(...unassignedRegions);

    // Add unassigned sr_mgmt_groups (not in any region)
    const unassignedSrMgmtGroups = srMgmtGroups
      .filter((smg: any) => !smg.region_id)
      .map((smg: any) => ({
        id: smg.id, name: smg.name, type: "sr_mgmt_group" as const,
        role: smg.lead_user_id ? `Led by ${getRepName(smg.lead_user_id)}` : undefined,
        leadUserId: smg.lead_user_id,
        children: mgmtNodesForSrMgmt(smg.id),
      }));
    topNodes.push(...unassignedSrMgmtGroups);

    // Add unassigned offices (not in a region) — show directly as top-level nodes
    const unassignedOffices = officeNodes(null);
    topNodes.push(...unassignedOffices);

    // Add unassigned mgmt_groups (not in any sr_mgmt_group or office)
    const unassignedMgmtGroups = mgmtGroups
      .filter((mg) => !mg.sr_mgmt_group_id && !mg.office_id)
      .map((mg) => ({
        id: mg.id, name: mg.name, type: "mgmt_group" as const,
        role: mg.lead_user_id ? `Led by ${getRepName(mg.lead_user_id)}` : undefined,
        leadUserId: mg.lead_user_id,
        children: teamNodes(mg.id, mg.name),
      }));
    topNodes.push(...unassignedMgmtGroups);

    return topNodes;
  }, [orgData, groupByOffice]);

  // Find data for config drawers
  const configOfficeData = useMemo(() => {
    if (!configOffice || !orgData) return null;
    const office = orgData.offices.find((o) => o.id === configOffice);
    if (!office) return null;
    const staff = orgData.officeStaff.filter((s) => s.office_id === configOffice);
    const groups = orgData.mgmtGroups.filter((mg) => mg.office_id === configOffice);
    return { office, staff, groups };
  }, [configOffice, orgData]);

  const officeDetailData = useMemo(() => {
    if (!officeDetailId || !orgData) return null;
    return orgData.offices.find((o) => o.id === officeDetailId) || null;
  }, [officeDetailId, orgData]);

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
      {/* Single "Create" button with drawer menu showing available entity types */}
      {canManageTeams && (() => {
        type CreateType = "division" | "partner" | "sr_region" | "region" | "office" | "sr_mgmt_group" | "mgmt_group" | "team";
        const createOptions: { type: CreateType; label: string }[] = ([
          { type: "division", label: "Division" },
          { type: "partner", label: "Partnership" },
          { type: "sr_region", label: "Sr Region" },
          { type: "region", label: "Region" },
          { type: "office", label: "Office" },
          { type: "sr_mgmt_group", label: "Sr MGMT Group" },
          { type: "mgmt_group", label: "MGMT Group" },
          { type: "team", label: "Team" },
        ] as { type: CreateType; label: string }[]).filter(opt => canCreateEntityType(accessLevel, opt.type));
        
        if (createOptions.length === 0) return null;
        
        // If only one option, show a direct button
        if (createOptions.length === 1) {
          return (
            <div className="mb-3">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCreateDrawer({ type: createOptions[0].type })}>
                <Plus className="h-3.5 w-3.5" /> Create {createOptions[0].label}
              </Button>
            </div>
          );
        }
        
        return (
          <div className="mb-3">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setActionTarget({ id: "__create__", name: "Create", type: "__create__" })}>
              <Plus className="h-3.5 w-3.5" /> Create
            </Button>
          </div>
        );
      })()}

      {/* Group by Office toggle */}
      <div className="flex items-center gap-2 mb-3">
        <Switch checked={groupByOffice} onCheckedChange={setGroupByOffice} />
        <span className="text-xs text-muted-foreground">Group by Office</span>
      </div>

      {/* Onboarding guidance for new leaders */}
      {canManageTeams && orgData && (() => {
        const hasTeams = orgData.teams.length > 0;
        const hasMgmtGroups = orgData.mgmtGroups.length > 0;
        const hasOffices = orgData.offices.length > 0;
        const showGuide = !hasTeams || !hasMgmtGroups;
        if (!showGuide) return null;
        return (
          <div className="mb-4 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-foreground">Build your org structure</p>
                {hasMinAccess(accessLevel, "area_director") && !hasMgmtGroups && hasOffices && (
                  <p className="text-muted-foreground">1. Tap an office → create MGMT Groups</p>
                )}
                {!hasTeams && hasMgmtGroups && (
                  <p className="text-muted-foreground">{hasMgmtGroups ? "1" : "2"}. Long-press a MGMT Group → Create Team</p>
                )}
                {hasTeams && (
                  <p className="text-muted-foreground">Long-press a team → Assign Reps</p>
                )}
                {!hasTeams && !hasMgmtGroups && (
                  <p className="text-muted-foreground">Long-press a rep → Move to Team</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {(() => {
        // Separate office nodes from hierarchy nodes for visual separation
        const officeNodes = tree.filter(n => n.type === "office");
        const hierarchyNodes = tree.filter(n => n.type !== "office");

        return (
          <div className="space-y-1">
            {hierarchyNodes.map((node) => (
              <OrgNodeCard key={node.id} node={node} depth={0} onLongPressAction={handleLongPress} onTap={handleNodeTap} canManage={canManageTeams} />
            ))}

            {officeNodes.length > 0 && (
              <>
                {hierarchyNodes.length > 0 && (
                  <div className="flex items-center gap-2 py-3 mt-2">
                    <Building2 className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Offices</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                {officeNodes.map((node) => (
                  <OrgNodeCard key={node.id} node={node} depth={0} onLongPressAction={handleLongPress} onTap={handleNodeTap} canManage={canManageTeams} />
                ))}
              </>
            )}
          </div>
        );
      })()}

      {/* Long-press action sheet */}
      <Drawer open={!!actionTarget} onOpenChange={(open) => !open && setActionTarget(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{actionTarget?.name}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-2">
            {/* Create menu — triggered by top-level Create button */}
            {actionTarget?.type === "__create__" && (() => {
              type CreateType = "division" | "partner" | "sr_region" | "region" | "office" | "sr_mgmt_group" | "mgmt_group" | "team";
              const options: { type: CreateType; label: string }[] = ([
                { type: "division", label: "Division" },
                { type: "partner", label: "Partnership" },
                { type: "sr_region", label: "Sr Region" },
                { type: "region", label: "Region" },
                { type: "office", label: "Office" },
                { type: "sr_mgmt_group", label: "Sr MGMT Group" },
                { type: "mgmt_group", label: "MGMT Group" },
                { type: "team", label: "Team" },
              ] as { type: CreateType; label: string }[]).filter(opt => canCreateEntityType(accessLevel, opt.type));
              return options.map(opt => (
                <Button key={opt.type} variant="outline" className="w-full justify-start gap-2" onClick={() => { setCreateDrawer({ type: opt.type }); setActionTarget(null); }}>
                  <Plus className="h-4 w-4" /> {opt.label}
                </Button>
              ));
            })()}

            {/* Rep actions */}
            {actionTarget?.type === "rep" && (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    if (actionTarget) {
                      // Find the node to open detail drawer
                      const findNode = (nodes: OrgNode[]): OrgNode | null => {
                        for (const n of nodes) {
                          if (n.id === actionTarget.id) return n;
                          const found = findNode(n.children);
                          if (found) return found;
                        }
                        return null;
                      };
                      const node = findNode(tree);
                      if (node) handleRepTap(node);
                      setActionTarget(null);
                    }
                  }}
                >
                  <FileEdit className="h-4 w-4" />
                  Edit Details
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    if (actionTarget) {
                      setMoveRepTarget({ id: actionTarget.id, name: actionTarget.name });
                      setActionTarget(null);
                    }
                  }}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Move to Team...
                </Button>
              </>
            )}

            {/* Team actions */}
            {actionTarget?.type === "team" && canManageTeams && (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    if (actionTarget) {
                      setBulkAssignTarget({ id: actionTarget.id, name: actionTarget.name });
                      setActionTarget(null);
                    }
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Assign Reps
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    if (actionTarget) {
                      const team = orgData?.teams.find(t => t.id === actionTarget.id);
                      setMoveTeamTarget({ id: actionTarget.id, name: actionTarget.name, leadUserId: team?.lead_user_id || null });
                      setActionTarget(null);
                    }
                  }}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                   Move to MGMT Group...
                </Button>
                {canManageOffices && orgData && orgData.offices.length > 0 && (
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { setAssignToOfficeTarget({ id: actionTarget.id, name: actionTarget.name, type: "team" }); setActionTarget(null); } }}>
                    <Building2 className="h-4 w-4" /> Assign to Office...
                  </Button>
                )}
              </>
            )}

            {/* MGMT group actions */}
            {actionTarget?.type === "mgmt_group" && canManageTeams && (
              <>
                {canCreateEntityType(accessLevel, "team") && (
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { setCreateDrawer({ type: "team", parentId: actionTarget.id, parentName: actionTarget.name }); setActionTarget(null); } }}>
                    <Plus className="h-4 w-4" /> Create Team
                  </Button>
                )}
                {orgData && orgData.srMgmtGroups.length > 0 && (
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { const mg = orgData.mgmtGroups.find(g => g.id === actionTarget.id); setMoveEntityTarget({ entityType: "mgmt_group", id: actionTarget.id, name: actionTarget.name, leadUserId: mg?.lead_user_id || null }); setActionTarget(null); } }}>
                    <ArrowRightLeft className="h-4 w-4" /> Move to Sr MGMT Group...
                  </Button>
                )}
                {canManageOffices && orgData && orgData.offices.length > 0 && (
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { setAssignToOfficeTarget({ id: actionTarget.id, name: actionTarget.name, type: "mgmt_group" }); setActionTarget(null); } }}>
                    <Building2 className="h-4 w-4" /> Assign to Office...
                  </Button>
                )}
              </>
            )}

            {/* Sr MGMT group actions */}
            {actionTarget?.type === "sr_mgmt_group" && canManageTeams && (
              <>
                {canCreateEntityType(accessLevel, "mgmt_group") && (
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { setCreateDrawer({ type: "mgmt_group", parentId: actionTarget.id, parentName: actionTarget.name, parentType: "sr_mgmt_group" }); setActionTarget(null); } }}>
                    <Plus className="h-4 w-4" /> Create MGMT Group
                  </Button>
                )}
                {canManageOffices && orgData && orgData.offices.length > 0 && (
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { setAssignToOfficeTarget({ id: actionTarget.id, name: actionTarget.name, type: "sr_mgmt_group" }); setActionTarget(null); } }}>
                    <Building2 className="h-4 w-4" /> Assign to Office...
                  </Button>
                )}
              </>
            )}

            {/* Office actions */}
            {actionTarget?.type === "office" && canManageTeams && canCreateEntityType(accessLevel, "mgmt_group") && (
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { setCreateDrawer({ type: "mgmt_group", parentId: actionTarget.id, parentName: actionTarget.name, parentType: "office" }); setActionTarget(null); } }}>
                <Plus className="h-4 w-4" /> Create MGMT Group
              </Button>
            )}

            {/* Region actions */}
            {actionTarget?.type === "region" && (
              <>
                {canCreateEntityType(accessLevel, "sr_mgmt_group") && (
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { setCreateDrawer({ type: "sr_mgmt_group", parentId: actionTarget.id, parentName: actionTarget.name }); setActionTarget(null); } }}>
                    <Plus className="h-4 w-4" /> Create Sr MGMT Group
                  </Button>
                )}
                {canCreateEntityType(accessLevel, "office") && (
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { setCreateDrawer({ type: "office", parentId: actionTarget.id, parentName: actionTarget.name }); setActionTarget(null); } }}>
                    <Plus className="h-4 w-4" /> Create Office
                  </Button>
                )}
                {orgData && orgData.srRegions.length > 0 && (
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { const r = orgData.regions.find(rg => rg.id === actionTarget.id); setMoveEntityTarget({ entityType: "region", id: actionTarget.id, name: actionTarget.name, leadUserId: r?.lead_user_id || null }); setActionTarget(null); } }}>
                    <ArrowRightLeft className="h-4 w-4" /> Move to Sr Region...
                  </Button>
                )}
              </>
            )}

            {/* Sr Region actions */}
            {actionTarget?.type === "sr_region" && canCreateEntityType(accessLevel, "region") && (
              <>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { setCreateDrawer({ type: "region", parentId: actionTarget.id, parentName: actionTarget.name }); setActionTarget(null); } }}>
                  <Plus className="h-4 w-4" /> Create Region
                </Button>
                {orgData && orgData.partners.length > 0 && (
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { const sr = orgData.srRegions.find(s => s.id === actionTarget.id); setMoveEntityTarget({ entityType: "sr_region", id: actionTarget.id, name: actionTarget.name, leadUserId: sr?.lead_user_id || null }); setActionTarget(null); } }}>
                    <ArrowRightLeft className="h-4 w-4" /> Move to Partnership...
                  </Button>
                )}
              </>
            )}

            {/* Partner actions */}
            {actionTarget?.type === "partner" && canCreateEntityType(accessLevel, "sr_region") && (
              <>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { setCreateDrawer({ type: "sr_region", parentId: actionTarget.id, parentName: actionTarget.name }); setActionTarget(null); } }}>
                  <Plus className="h-4 w-4" /> Create Sr Region
                </Button>
                {orgData && orgData.divisions.length > 0 && (
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { const p = orgData.partners.find(pt => pt.id === actionTarget.id); setMoveEntityTarget({ entityType: "partner", id: actionTarget.id, name: actionTarget.name, leadUserId: p?.lead_user_id || null }); setActionTarget(null); } }}>
                    <ArrowRightLeft className="h-4 w-4" /> Move to Division...
                  </Button>
                )}
              </>
            )}

            {/* Division actions */}
            {actionTarget?.type === "division" && canCreateEntityType(accessLevel, "partner") && (
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { if (actionTarget) { setCreateDrawer({ type: "partner", parentId: actionTarget.id, parentName: actionTarget.name }); setActionTarget(null); } }}>
                <Plus className="h-4 w-4" /> Create Partnership
              </Button>
            )}

            {/* Delete for team/mgmt_group */}
            {(actionTarget?.type === "team" || actionTarget?.type === "mgmt_group") && canManageTeams && (
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

      {/* Delete confirmation drawer */}
      <DeleteConfirmationDrawer
        deleteTarget={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteDirect}
        isDeleting={isDeleting}
        canDirectManage={canDirectManage}
        orgData={orgData}
      />

      {/* Create drawer */}
      <CreateDrawer
        open={!!createDrawer}
        onOpenChange={(open) => !open && setCreateDrawer(null)}
        type={createDrawer?.type || "office"}
        parentId={createDrawer?.parentId}
        parentName={createDrawer?.parentName}
        parentType={createDrawer?.parentType}
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
          canFullManage={canManageOffices}
          orgData={orgData}
          currentUserId={currentUserId || undefined}
          accessLevel={accessLevel}
        />
      )}

      {/* Office detail drawer */}
      <OfficeDetailDrawer
        open={!!officeDetailId}
        onOpenChange={(open) => !open && setOfficeDetailId(null)}
        office={officeDetailData ? { id: officeDetailData.id, name: officeDetailData.name, location: officeDetailData.location } : null}
        orgData={orgData ? {
          officeStaff: orgData.officeStaff,
          mgmtGroups: orgData.mgmtGroups,
          srMgmtGroups: orgData.srMgmtGroups,
          teams: orgData.teams,
          teamMgmt: orgData.teamMgmt,
          reps: orgData.reps,
          recruits: orgData.recruits.map(r => ({ ...r, recruiter_user_id: r.recruiter_user_id })),
        } : undefined}
      />

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

      {/* Move rep to team drawer */}
      {moveRepTarget && orgData && (
        <MoveToTeamDrawer
          open={!!moveRepTarget}
          onOpenChange={(open) => !open && setMoveRepTarget(null)}
          repId={moveRepTarget.id}
          repName={moveRepTarget.name}
          teams={orgData.teams.map((t) => {
            const tmg = orgData.teamMgmt.find((tm) => tm.team_id === t.id);
            const mg = tmg ? orgData.mgmtGroups.find((g) => g.id === tmg.mgmt_group_id) : null;
            const leadRep = t.lead_user_id ? orgData.reps.find(r => r.user_id === t.lead_user_id) : null;
            return { id: t.id, name: t.name, mgmtGroupName: mg?.name, leadUserId: t.lead_user_id, leadName: leadRep?.name || null };
          })}
        />
      )}

      {/* Bulk assign reps to team */}
      {bulkAssignTarget && orgData && (
        <BulkAssignRepsDrawer
          open={!!bulkAssignTarget}
          onOpenChange={(open) => !open && setBulkAssignTarget(null)}
          targetTeamId={bulkAssignTarget.id}
          targetTeamName={bulkAssignTarget.name}
          availableReps={orgData.recruits
            .filter((r) => isStageIn(r.stage, [...SIGNED_PLUS_STAGES]) && r.team_id !== bulkAssignTarget.id)
            .map((r) => {
              const currentTeam = r.team_id ? orgData.teams.find((t) => t.id === r.team_id) : null;
              return {
                id: r.id,
                name: getCleanName(r.name),
                currentTeamName: currentTeam?.name || (r.team_id ? "Unknown Team" : null),
                stage: r.stage,
                year: r.year,
              };
            })}
        />
      )}

      {/* Move team to MGMT group */}
      {moveTeamTarget && orgData && (
        <MoveTeamToMgmtDrawer
          open={!!moveTeamTarget}
          onOpenChange={(open) => !open && setMoveTeamTarget(null)}
          teamId={moveTeamTarget.id}
          teamName={moveTeamTarget.name}
          teamLeadUserId={moveTeamTarget.leadUserId}
          mgmtGroups={orgData.mgmtGroups.map((mg) => {
            const leadRep = mg.lead_user_id ? orgData.reps.find(r => r.user_id === mg.lead_user_id) : null;
            return { id: mg.id, name: mg.name, leadUserId: mg.lead_user_id, leadName: leadRep?.name || null };
          })}
        />
      )}

      {/* Move entity to parent group */}
      {moveEntityTarget && orgData && (() => {
        const getTargets = () => {
          const mapWithLead = (items: any[]) => items.map((i: any) => {
            const leadRep = i.lead_user_id ? orgData.reps.find(r => r.user_id === i.lead_user_id) : null;
            return { id: i.id, name: i.name, leadUserId: i.lead_user_id, leadName: leadRep?.name || null };
          });
          switch (moveEntityTarget.entityType) {
            case "mgmt_group": return mapWithLead(orgData.srMgmtGroups);
            case "region": return mapWithLead(orgData.srRegions);
            case "sr_region": return mapWithLead(orgData.partners);
            case "partner": return mapWithLead(orgData.divisions);
            default: return [];
          }
        };
        return (
          <MoveEntityDrawer
            open={!!moveEntityTarget}
            onOpenChange={(open) => !open && setMoveEntityTarget(null)}
            entityType={moveEntityTarget.entityType}
            entityId={moveEntityTarget.id}
            entityName={moveEntityTarget.name}
            entityLeadUserId={moveEntityTarget.leadUserId}
            targets={getTargets()}
          />
        );
      })()}

      {/* Assign to office drawer */}
      {assignToOfficeTarget && orgData && (
        <AssignToOfficeDrawer
          open={!!assignToOfficeTarget}
          onOpenChange={(open) => !open && setAssignToOfficeTarget(null)}
          entity={assignToOfficeTarget}
          offices={orgData.offices.map((o: any) => ({ id: o.id, name: o.name, location: o.location }))}
          orgData={{
            srMgmtGroups: orgData.srMgmtGroups,
            mgmtGroups: orgData.mgmtGroups,
            teams: orgData.teams,
            teamMgmt: orgData.teamMgmt,
            reps: orgData.reps,
            recruits: orgData.recruits,
          }}
        />
      )}
    </>
  );
};

// ==========================================
// NODE CARD
// ==========================================

const typeIcons: Record<OrgNodeType, any> = {
  division: Globe, partner: Globe, sr_region: Globe, sr_mgmt_group: Users,
  region: Globe, office: Building2, mgmt_group: Users,
  team: Users, recruiter_group: UserPlus, rep: User,
};

const typeColors: Record<OrgNodeType, string> = {
  division: "text-purple-500", partner: "text-pink-500", sr_region: "text-red-500", sr_mgmt_group: "text-orange-500",
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
  const managedTypes: OrgNodeType[] = ["division", "partner", "sr_region", "region", "sr_mgmt_group", "office", "mgmt_group", "team"];
  const isInteractive = isRep || (managedTypes.includes(node.type) && canManage);
  const isLongPressable = (managedTypes.includes(node.type) && canManage) || (isRep && canManage);

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

        {isLongPressable && (
          <button
            className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onLongPressAction(node);
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
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
