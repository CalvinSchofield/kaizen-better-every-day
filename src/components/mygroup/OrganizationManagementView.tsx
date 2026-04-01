import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ChevronDown, 
  ChevronRight, 
  Pencil, 
  Plus, 
  Users, 
  Building2,
  AlertTriangle,
  User,
  Search,
  X,
  GitBranch,
  Globe
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { EditMgmtGroupDrawer } from "./org/EditMgmtGroupDrawer";
import { EditTeamDrawer } from "./org/EditTeamDrawer";
import { EditRepOrgDrawer } from "./org/EditRepOrgDrawer";
import { CreateEntityDrawer } from "./org/CreateEntityDrawer";
import { hasMinAccess, type AccessLevel } from "@/utils/roleHierarchy";
import { PendingOrgRequests } from "./org/PendingOrgRequests";
import { getCleanName } from "@/utils/nameUtils";
import { cn } from "@/lib/utils";

interface OrgRep {
  id: string;
  userId: string | null;
  name: string;
  teamId: string | null;
  teamName: string | null;
  recruiterUserId: string | null;
  recruiterName?: string;
  stage?: string | null;
  notionPageId?: string | null;
  phone?: string | null;
  email?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface OrgTeam {
  id: string;
  name: string;
  leadUserId: string | null;
  leadName?: string;
  mgmtGroupId: string | null;
  repCount: number;
}

interface OrgMgmtGroup {
  id: string;
  name: string;
  leadUserId: string | null;
  leadName?: string;
  teamIds: string[];
}

interface RecruiterGroupNode {
  userId: string;
  name: string;
  recruitId: string;
  stage?: string | null;
  children: RecruiterGroupNode[];
  leafRecruits: OrgRep[]; // direct recruits without their own recruits
}

export const OrganizationManagementView = () => {
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedRecruiters, setExpandedRecruiters] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit drawers state
  const [editingGroup, setEditingGroup] = useState<OrgMgmtGroup | null>(null);
  const [editingTeam, setEditingTeam] = useState<OrgTeam | null>(null);
  const [editingRep, setEditingRep] = useState<OrgRep | null>(null);
  const [createMode, setCreateMode] = useState<"team" | "mgmt_group" | null>(null);

  // Fetch full org structure
  const { data: orgData, isLoading: orgLoading } = useQuery({
    queryKey: ["org-structure"],
    queryFn: async () => {
      const [teamsRes, groupsRes, junctionRes, recruitsRes, repsRes, officesRes, officeStaffRes, regionsRes] = await Promise.all([
        supabase.from("teams").select("*"),
        supabase.from("mgmt_groups").select("*"),
        supabase.from("team_mgmt_groups").select("*"),
        supabase.from("recruits").select("id, name, team_id, recruiter_user_id, stage, phone, email, created_at, updated_at, mgmt_group_id"),
        supabase.from("reps").select("user_id, name"),
        supabase.from("offices").select("id, name, region_id"),
        supabase.from("office_staff").select("user_id, office_id, role"),
        supabase.from("regions").select("id, name, lead_user_id"),
      ]);

      return {
        teams: teamsRes.data || [],
        groups: groupsRes.data || [],
        junction: junctionRes.data || [],
        recruits: recruitsRes.data || [],
        reps: repsRes.data || [],
        offices: officesRes.data || [],
        officeStaff: officeStaffRes.data || [],
        regions: regionsRes.data || [],
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  // Determine user capabilities
  const accessLevel = teamAccess?.accessLevel || 'none';
  const canCreateTeam = hasMinAccess(accessLevel, 'mgmt_group_lead');
  const canCreateGroup = hasMinAccess(accessLevel, 'area_director');
  const canEditTeam = hasMinAccess(accessLevel, 'mgmt_group_lead');
  const canEditGroup = hasMinAccess(accessLevel, 'area_director');

  // Build data structures
  const { groups, teams, reps, unassignedTeams, repsByTeam, officeContext, recruiterTreeByTeam } = useMemo(() => {
    if (!orgData) {
      return { groups: [], teams: [], reps: [], unassignedTeams: [], repsByTeam: new Map(), officeContext: null, recruiterTreeByTeam: new Map() };
    }

    const repMap = new Map(orgData.reps.map((r) => [r.user_id, r.name]));
    
    // Filter out quit stages
    const filteredRecruits = orgData.recruits.filter(r => {
      const stage = (r.stage || "").toLowerCase();
      return !stage.includes("signed but not interested") && !stage.includes("not interested");
    });
    
    const recruitsWithRecruiter: OrgRep[] = filteredRecruits.map((r) => ({
      id: r.id,
      userId: null,
      name: r.name,
      teamId: r.team_id,
      teamName: null,
      recruiterUserId: r.recruiter_user_id,
      recruiterName: r.recruiter_user_id ? repMap.get(r.recruiter_user_id) || "Unknown" : undefined,
      stage: r.stage,
      notionPageId: r.id,
      phone: r.phone,
      email: r.email,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    // Check if recruit has a user_id (active app user)
    const recruitRepMap = new Map<string, string>(); // recruitName (cleaned) -> userId
    orgData.reps.forEach(r => {
      if (r.user_id) {
        recruitRepMap.set(getCleanName(r.name).toLowerCase(), r.user_id);
      }
    });

    // Assign userId to recruits who have an app account
    recruitsWithRecruiter.forEach(r => {
      const cleanName = getCleanName(r.name).toLowerCase();
      const userId = recruitRepMap.get(cleanName);
      if (userId) r.userId = userId;
    });

    // Group recruits by team
    const repsByTeam = new Map<string, OrgRep[]>();
    recruitsWithRecruiter.forEach((r) => {
      if (r.teamId) {
        const existing = repsByTeam.get(r.teamId) || [];
        existing.push(r);
        repsByTeam.set(r.teamId, existing);
      }
    });

    // Build recruiter tree for each team
    const recruiterTreeByTeam = new Map<string, RecruiterGroupNode[]>();
    repsByTeam.forEach((teamReps, teamId) => {
      const tree = buildRecruiterTree(teamReps, repMap);
      recruiterTreeByTeam.set(teamId, tree);
    });

    // Build team-to-group map
    const teamToGroup = new Map(orgData.junction.map((j) => [j.team_id, j.mgmt_group_id]));

    const teamsData: OrgTeam[] = orgData.teams.map((t) => ({
      id: t.id,
      name: t.name,
      leadUserId: t.lead_user_id,
      leadName: t.lead_user_id ? repMap.get(t.lead_user_id) : undefined,
      mgmtGroupId: teamToGroup.get(t.id) || null,
      repCount: repsByTeam.get(t.id)?.length || 0,
    }));

    const groupsData: OrgMgmtGroup[] = orgData.groups.map((g) => ({
      id: g.id,
      name: g.name,
      leadUserId: g.lead_user_id,
      leadName: g.lead_user_id ? repMap.get(g.lead_user_id) : undefined,
      teamIds: orgData.junction.filter((j) => j.mgmt_group_id === g.id).map((j) => j.team_id),
    }));

    const unassignedTeams = teamsData.filter((t) => !t.mgmtGroupId);

    // Build rep list with mgmt group info for CreateEntityDrawer
    const repToMgmtGroup = new Map<string, string>();
    // Map reps to their mgmt group via recruit records or accessible reps
    if (teamAccess?.accessibleReps) {
      for (const ar of teamAccess.accessibleReps) {
        if (ar.userId && ar.mgmtGroupId) {
          repToMgmtGroup.set(ar.userId, ar.mgmtGroupId);
        }
      }
    }

    const allReps = orgData.reps.map((r) => ({
      userId: r.user_id,
      name: r.name,
      mgmtGroupId: r.user_id ? repToMgmtGroup.get(r.user_id) || null : null,
    }));

    // Build office context
    let officeContext: { officeName: string; regionName?: string } | null = null;
    if (orgData.offices.length > 0) {
      // Find the user's office
      const userOfficeStaff = teamAccess ? orgData.officeStaff.find(s => 
        orgData.groups.some(g => g.office_id === s.office_id)
      ) : null;
      
      // Just use the first office that has MGMT groups
      const officeWithGroups = orgData.offices.find(o => 
        orgData.groups.some(g => g.office_id === o.id)
      );
      
      if (officeWithGroups) {
        const region = orgData.regions.find(r => r.id === officeWithGroups.region_id);
        officeContext = {
          officeName: officeWithGroups.name,
          regionName: region?.name,
        };
      }
    }

    return {
      groups: groupsData,
      teams: teamsData,
      reps: allReps,
      unassignedTeams,
      repsByTeam,
      officeContext,
      recruiterTreeByTeam,
    };
  }, [orgData, teamAccess]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTeam = (id: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleRecruiter = (id: string) => {
    setExpandedRecruiters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Filter logic
  const lowerQuery = searchQuery.toLowerCase().trim();
  
  const filteredData = useMemo(() => {
    if (!lowerQuery || !groups.length) {
      return { groups, teams, unassignedTeams, repsByTeam };
    }

    const matchingRepTeamIds = new Set<string>();
    const filteredRepsByTeam = new Map<string, OrgRep[]>();
    
    repsByTeam.forEach((teamReps, teamId) => {
      const matchingReps = teamReps.filter(
        (r) => r.name.toLowerCase().includes(lowerQuery) ||
               r.recruiterName?.toLowerCase().includes(lowerQuery)
      );
      if (matchingReps.length > 0) {
        matchingRepTeamIds.add(teamId);
        filteredRepsByTeam.set(teamId, matchingReps);
      }
    });

    const matchingTeams = teams.filter(
      (t) => t.name.toLowerCase().includes(lowerQuery) ||
             t.leadName?.toLowerCase().includes(lowerQuery) ||
             matchingRepTeamIds.has(t.id)
    );
    const matchingTeamIds = new Set(matchingTeams.map((t) => t.id));

    const matchingGroups = groups.filter(
      (g) => g.name.toLowerCase().includes(lowerQuery) ||
             g.leadName?.toLowerCase().includes(lowerQuery) ||
             g.teamIds.some((tid) => matchingTeamIds.has(tid))
    );

    const filteredUnassigned = unassignedTeams.filter(
      (t) => t.name.toLowerCase().includes(lowerQuery) ||
             t.leadName?.toLowerCase().includes(lowerQuery) ||
             matchingRepTeamIds.has(t.id)
    );

    const finalRepsByTeam = new Map<string, OrgRep[]>();
    matchingTeams.forEach((t) => {
      if (t.name.toLowerCase().includes(lowerQuery) || t.leadName?.toLowerCase().includes(lowerQuery)) {
        finalRepsByTeam.set(t.id, repsByTeam.get(t.id) || []);
      } else {
        finalRepsByTeam.set(t.id, filteredRepsByTeam.get(t.id) || []);
      }
    });

    return {
      groups: matchingGroups,
      teams: matchingTeams,
      unassignedTeams: filteredUnassigned,
      repsByTeam: finalRepsByTeam,
    };
  }, [lowerQuery, groups, teams, unassignedTeams, repsByTeam]);

  const displayExpandedGroups = lowerQuery ? new Set(filteredData.groups.map((g) => g.id)) : expandedGroups;
  const displayExpandedTeams = lowerQuery ? new Set(filteredData.teams.map((t) => t.id)) : expandedTeams;

  if (accessLoading || orgLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const allGroups = groups.map((g) => ({ id: g.id, name: g.name }));
  const allTeams = teams.map((t) => ({ id: t.id, name: t.name }));

  // Pending recruits for leader picker (recruits with approval_status = 'pending')
  const pendingRecruitsForLeader = useMemo(() => {
    if (!orgData) return [];
    return orgData.recruits
      .filter(r => (r as any).approval_status === 'pending' && r.name)
      .map(r => ({ id: r.id, name: r.name, email: r.email }));
  }, [orgData]);

  return (
    <div className="space-y-4">
      {/* Office Context Header */}
      {officeContext && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg border border-border/50">
          <Globe className="h-4 w-4 text-primary shrink-0" />
          <div className="text-sm">
            {officeContext.regionName && (
              <span className="text-muted-foreground">{officeContext.regionName} / </span>
            )}
            <span className="font-medium">{officeContext.officeName}</span>
          </div>
        </div>
      )}

      {/* Header with create actions */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Organization Structure</h3>
        {(canCreateTeam || canCreateGroup) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              {canCreateGroup && (
                <DropdownMenuItem onClick={() => setCreateMode("mgmt_group")}>
                  <Building2 className="h-4 w-4 mr-2" />
                  New Management Group
                </DropdownMenuItem>
              )}
              {canCreateTeam && (
                <DropdownMenuItem onClick={() => setCreateMode("team")}>
                  <Users className="h-4 w-4 mr-2" />
                  New Team
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search groups, teams, or reps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Pending Org Change Requests */}
      <PendingOrgRequests mode="both" />

      {/* Management Groups */}
      <div className="space-y-2">
        {filteredData.groups.map((group) => {
          const isExpanded = displayExpandedGroups.has(group.id);
          const groupTeams = filteredData.teams.filter((t) => t.mgmtGroupId === group.id);
          
          return (
            <Collapsible key={group.id} open={isExpanded} onOpenChange={() => toggleGroup(group.id)}>
              <div className="border rounded-lg bg-card">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="font-medium">{group.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {groupTeams.length} teams
                      </Badge>
                      {!group.leadUserId && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          No leader
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {group.leadName && (
                        <span className="text-sm text-muted-foreground">{group.leadName}</span>
                      )}
                      {canEditGroup && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGroup(group);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="border-t px-3 pb-3 space-y-2">
                    {groupTeams.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2 pl-6">No teams in this group</p>
                    ) : (
                      groupTeams.map((team) => (
                        <TeamCard
                          key={team.id}
                          team={team}
                          recruiterTree={recruiterTreeByTeam.get(team.id) || []}
                          reps={filteredData.repsByTeam.get(team.id) || []}
                          isExpanded={displayExpandedTeams.has(team.id)}
                          onToggle={() => toggleTeam(team.id)}
                          onEditTeam={canEditTeam ? () => setEditingTeam(team) : undefined}
                          onEditRep={(rep) => setEditingRep(rep)}
                          expandedRecruiters={expandedRecruiters}
                          onToggleRecruiter={toggleRecruiter}
                        />
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>

      {/* Unassigned Teams */}
      {filteredData.unassignedTeams.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Unassigned Teams
          </h4>
          {filteredData.unassignedTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              recruiterTree={recruiterTreeByTeam.get(team.id) || []}
              reps={filteredData.repsByTeam.get(team.id) || []}
              isExpanded={displayExpandedTeams.has(team.id)}
              onToggle={() => toggleTeam(team.id)}
              onEditTeam={canEditTeam ? () => setEditingTeam(team) : undefined}
              onEditRep={(rep) => setEditingRep(rep)}
              expandedRecruiters={expandedRecruiters}
              onToggleRecruiter={toggleRecruiter}
            />
          ))}
        </div>
      )}

      {/* No results */}
      {lowerQuery && filteredData.groups.length === 0 && filteredData.unassignedTeams.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No results found for "{searchQuery}"</p>
          <p className="text-sm">Try a different search term</p>
        </div>
      )}

      {!lowerQuery && groups.length === 0 && unassignedTeams.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No organization structure yet</p>
          <p className="text-sm">Create your first management group or team to get started</p>
        </div>
      )}

      {/* Drawers */}
      {editingGroup && (
        <EditMgmtGroupDrawer
          open={!!editingGroup}
          onOpenChange={(open) => !open && setEditingGroup(null)}
          group={editingGroup}
          allReps={reps}
          teamCount={teams.filter((t) => t.mgmtGroupId === editingGroup.id).length}
        />
      )}

      {editingTeam && (
        <EditTeamDrawer
          open={!!editingTeam}
          onOpenChange={(open) => !open && setEditingTeam(null)}
          team={editingTeam}
          allReps={reps}
          allGroups={allGroups}
          repCount={repsByTeam.get(editingTeam.id)?.length || 0}
        />
      )}

      {editingRep && (
        <EditRepOrgDrawer
          open={!!editingRep}
          onOpenChange={(open) => !open && setEditingRep(null)}
          rep={editingRep}
          allTeams={allTeams}
          allReps={reps}
        />
      )}

      {createMode && (
        <CreateEntityDrawer
          open={!!createMode}
          onOpenChange={(open) => !open && setCreateMode(null)}
          mode={createMode}
          allReps={reps}
          allGroups={allGroups}
        />
      )}
    </div>
  );
};

// ─── Build Recruiter Tree ──────────────────────────────────
function buildRecruiterTree(teamReps: OrgRep[], repMap: Map<string | null, string>): RecruiterGroupNode[] {
  // Find all unique recruiters for this team's reps
  const recruiterIds = new Set<string>();
  const repsByRecruiter = new Map<string, OrgRep[]>();
  
  teamReps.forEach(rep => {
    const recruiterId = rep.recruiterUserId;
    if (recruiterId) {
      recruiterIds.add(recruiterId);
      const existing = repsByRecruiter.get(recruiterId) || [];
      existing.push(rep);
      repsByRecruiter.set(recruiterId, existing);
    }
  });

  // Identify which recruiters are themselves team members (have a recruit record in this team)
  const teamRepUserIds = new Set(teamReps.filter(r => r.userId).map(r => r.userId!));
  
  // A recruiter is "internal" if they are a team member
  // Root recruiters are those whose recruiter is NOT in this team (they're recruited from outside)
  const rootRecruiters = new Set<string>();
  
  recruiterIds.forEach(recruiterId => {
    // Check if this recruiter's recruiter is also in the team
    const recruiterAsRep = teamReps.find(r => r.userId === recruiterId);
    if (recruiterAsRep && recruiterAsRep.recruiterUserId && teamRepUserIds.has(recruiterAsRep.recruiterUserId)) {
      // This recruiter was recruited by someone in the team - not a root
    } else {
      // This recruiter is a root (recruited from outside or is the top)
      rootRecruiters.add(recruiterId);
    }
  });

  // If no root recruiters found, just use all recruiters as roots
  if (rootRecruiters.size === 0) {
    recruiterIds.forEach(id => rootRecruiters.add(id));
  }

  const buildNode = (recruiterId: string, visited: Set<string>): RecruiterGroupNode | null => {
    if (visited.has(recruiterId)) return null;
    visited.add(recruiterId);

    const directRecruits = repsByRecruiter.get(recruiterId) || [];
    if (directRecruits.length === 0) return null;

    const children: RecruiterGroupNode[] = [];
    const leafRecruits: OrgRep[] = [];

    directRecruits.forEach(rep => {
      // Check if this recruit has their own recruits in the team
      if (rep.userId && repsByRecruiter.has(rep.userId)) {
        const childNode = buildNode(rep.userId, new Set(visited));
        if (childNode) {
          children.push(childNode);
        } else {
          leafRecruits.push(rep);
        }
      } else {
        leafRecruits.push(rep);
      }
    });

    const recruiterName = repMap.get(recruiterId) || "Unknown";
    const recruiterRep = directRecruits.find(r => r.userId === recruiterId);

    return {
      userId: recruiterId,
      name: recruiterName,
      recruitId: recruiterRep?.id || recruiterId,
      stage: recruiterRep?.stage,
      children,
      leafRecruits,
    };
  };

  const roots: RecruiterGroupNode[] = [];
  rootRecruiters.forEach(recruiterId => {
    const node = buildNode(recruiterId, new Set());
    if (node) roots.push(node);
  });

  // Sort by total descendant count
  roots.sort((a, b) => countDescendants(b) - countDescendants(a));
  return roots;
}

function countDescendants(node: RecruiterGroupNode): number {
  let count = node.leafRecruits.length;
  node.children.forEach(c => count += 1 + countDescendants(c));
  return count;
}

// ─── TeamCard Component ────────────────────────────────────
interface TeamCardProps {
  team: OrgTeam;
  recruiterTree: RecruiterGroupNode[];
  reps: OrgRep[];
  isExpanded: boolean;
  onToggle: () => void;
  onEditTeam?: () => void;
  onEditRep: (rep: OrgRep) => void;
  expandedRecruiters: Set<string>;
  onToggleRecruiter: (id: string) => void;
}

const TeamCard = ({ team, recruiterTree, reps, isExpanded, onToggle, onEditTeam, onEditRep, expandedRecruiters, onToggleRecruiter }: TeamCardProps) => {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border rounded-lg ml-4 bg-background">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <Users className="h-3.5 w-3.5 text-blue-500" />
              <span className="font-medium text-sm">{team.name}</span>
              <Badge variant="outline" className="text-xs">
                {reps.length} reps
              </Badge>
              {!team.leadUserId && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  No leader
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {team.leadName && (
                <span className="text-xs text-muted-foreground">{team.leadName}</span>
              )}
              {onEditTeam && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTeam();
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="border-t px-2.5 pb-2 space-y-1">
            {reps.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 pl-5">No reps in this team</p>
            ) : recruiterTree.length > 0 ? (
              // Show nested recruiter groups
              <div className="pt-1">
                {recruiterTree.map((node) => (
                  <RecruiterGroupCard
                    key={node.userId}
                    node={node}
                    depth={0}
                    onEditRep={onEditRep}
                    expanded={expandedRecruiters}
                    onToggle={onToggleRecruiter}
                  />
                ))}
              </div>
            ) : (
              // Fallback: flat list
              reps.map((rep) => (
                <RepRow key={rep.id} rep={rep} onEditRep={onEditRep} depth={0} />
              ))
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// ─── RecruiterGroupCard ────────────────────────────────────
interface RecruiterGroupCardProps {
  node: RecruiterGroupNode;
  depth: number;
  onEditRep: (rep: OrgRep) => void;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}

const RecruiterGroupCard = ({ node, depth, onEditRep, expanded, onToggle }: RecruiterGroupCardProps) => {
  const totalCount = countDescendants(node);
  const isExpanded = expanded.has(node.userId);
  const hasContent = node.children.length > 0 || node.leafRecruits.length > 0;

  return (
    <div className={cn("mt-1", depth > 0 && "ml-3 border-l border-border/50 pl-2")}>
      <button
        onClick={() => hasContent && onToggle(node.userId)}
        className="w-full text-left flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
      >
        {hasContent ? (
          isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <span className="w-3" />
        )}
        <GitBranch className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <span className="text-sm font-medium truncate">{getCleanName(node.name)}'s Group</span>
        <Badge variant="outline" className="text-[10px] shrink-0 h-4 px-1.5">
          {totalCount}
        </Badge>
      </button>
      
      {isExpanded && hasContent && (
        <div className="space-y-0.5">
          {/* Child recruiter groups */}
          {node.children.map((child) => (
            <RecruiterGroupCard
              key={child.userId}
              node={child}
              depth={depth + 1}
              onEditRep={onEditRep}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
          {/* Leaf recruits (no sub-groups) */}
          {node.leafRecruits.map((rep) => (
            <RepRow key={rep.id} rep={rep} onEditRep={onEditRep} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── RepRow ────────────────────────────────────────────────
const RepRow = ({ rep, onEditRep, depth }: { rep: OrgRep; onEditRep: (rep: OrgRep) => void; depth: number }) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-1.5 px-2 hover:bg-muted/50 rounded cursor-pointer",
        depth > 0 && "ml-3 border-l border-border/30 pl-2"
      )}
      onClick={() => onEditRep(rep)}
    >
      <div className="flex items-center gap-2">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm">{rep.name}</span>
        {rep.stage && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {rep.stage}
          </Badge>
        )}
      </div>
      <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
    </div>
  );
};
