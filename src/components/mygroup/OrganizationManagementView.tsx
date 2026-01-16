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
  GitBranch
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
import { RecruiterTreeView } from "./org/RecruiterTreeView";
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

type ViewMode = "formal" | "recruiter";

export const OrganizationManagementView = () => {
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  
  const [viewMode, setViewMode] = useState<ViewMode>("formal");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
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
      const [teamsRes, groupsRes, junctionRes, recruitsRes, repsRes] = await Promise.all([
        supabase.from("teams").select("*"),
        supabase.from("mgmt_groups").select("*"),
        supabase.from("team_mgmt_groups").select("*"),
        supabase.from("recruits").select("id, name, team_id, recruiter_user_id, stage, phone, email, created_at, updated_at"),
        supabase.from("reps").select("user_id, name"),
      ]);

      return {
        teams: teamsRes.data || [],
        groups: groupsRes.data || [],
        junction: junctionRes.data || [],
        recruits: recruitsRes.data || [],
        reps: repsRes.data || [],
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  // Build data structures
  const { groups, teams, reps, unassignedTeams, repsByTeam } = useMemo(() => {
    if (!orgData) {
      return { groups: [], teams: [], reps: [], unassignedTeams: [], repsByTeam: new Map() };
    }

    const repMap = new Map(orgData.reps.map((r) => [r.user_id, r.name]));
    
    // Filter out "Signed but Not Interested" recruits and map data
    const filteredRecruits = orgData.recruits.filter(r => {
      const stage = (r.stage || "").toLowerCase();
      return !stage.includes("signed but not interested") && 
             !stage.includes("not interested");
    });
    
    // Map recruiter names
    const recruitsWithRecruiter: OrgRep[] = filteredRecruits.map((r) => ({
      id: r.id,
      userId: null,
      name: r.name,
      teamId: r.team_id,
      teamName: null,
      recruiterUserId: r.recruiter_user_id,
      recruiterName: r.recruiter_user_id ? repMap.get(r.recruiter_user_id) || "Unknown" : undefined,
      stage: r.stage,
      notionPageId: r.id, // Use id as the identifier
      phone: r.phone,
      email: r.email,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    // Group recruits by team
    const repsByTeam = new Map<string, OrgRep[]>();
    recruitsWithRecruiter.forEach((r) => {
      if (r.teamId) {
        const existing = repsByTeam.get(r.teamId) || [];
        existing.push(r);
        repsByTeam.set(r.teamId, existing);
      }
    });

    // Build team-to-group map
    const teamToGroup = new Map(orgData.junction.map((j) => [j.team_id, j.mgmt_group_id]));

    // Build teams
    const teamsData: OrgTeam[] = orgData.teams.map((t) => ({
      id: t.id,
      name: t.name,
      leadUserId: t.lead_user_id,
      leadName: t.lead_user_id ? repMap.get(t.lead_user_id) : undefined,
      mgmtGroupId: teamToGroup.get(t.id) || null,
      repCount: repsByTeam.get(t.id)?.length || 0,
    }));

    // Build groups
    const groupsData: OrgMgmtGroup[] = orgData.groups.map((g) => ({
      id: g.id,
      name: g.name,
      leadUserId: g.lead_user_id,
      leadName: g.lead_user_id ? repMap.get(g.lead_user_id) : undefined,
      teamIds: orgData.junction.filter((j) => j.mgmt_group_id === g.id).map((j) => j.team_id),
    }));

    // Find unassigned teams
    const unassignedTeams = teamsData.filter((t) => !t.mgmtGroupId);

    // All reps for dropdowns
    const allReps = orgData.reps.map((r) => ({
      userId: r.user_id,
      name: r.name,
    }));

    return {
      groups: groupsData,
      teams: teamsData,
      reps: allReps,
      unassignedTeams,
      repsByTeam,
    };
  }, [orgData]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleTeam = (id: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter logic - must be before loading check to maintain hook order
  const lowerQuery = searchQuery.toLowerCase().trim();
  
  const filteredData = useMemo(() => {
    if (!lowerQuery || !groups.length) {
      return { groups, teams, unassignedTeams, repsByTeam };
    }

    // Find matching reps
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

    // Find matching teams (by name or containing matching reps)
    const matchingTeams = teams.filter(
      (t) => t.name.toLowerCase().includes(lowerQuery) ||
             t.leadName?.toLowerCase().includes(lowerQuery) ||
             matchingRepTeamIds.has(t.id)
    );
    const matchingTeamIds = new Set(matchingTeams.map((t) => t.id));

    // Find matching groups (by name or containing matching teams)
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

    // When filtering, show reps from repsByTeam if team matched, or filteredRepsByTeam if only rep matched
    const finalRepsByTeam = new Map<string, OrgRep[]>();
    matchingTeams.forEach((t) => {
      if (t.name.toLowerCase().includes(lowerQuery) || t.leadName?.toLowerCase().includes(lowerQuery)) {
        // Team matched - show all reps
        finalRepsByTeam.set(t.id, repsByTeam.get(t.id) || []);
      } else {
        // Only rep matched - show filtered reps
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

  // Auto-expand when searching
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

  return (
    <div className="space-y-4">
      {/* Header with create actions */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Organization Structure</h3>
        {viewMode === "formal" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={() => setCreateMode("mgmt_group")}>
                <Building2 className="h-4 w-4 mr-2" />
                New Management Group
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreateMode("team")}>
                <Users className="h-4 w-4 mr-2" />
                New Team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* View Mode Toggle */}
      <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
        <button
          onClick={() => setViewMode("formal")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
            viewMode === "formal" 
              ? "bg-background shadow-sm text-foreground" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Building2 className="h-4 w-4" />
          Formal
        </button>
        <button
          onClick={() => setViewMode("recruiter")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
            viewMode === "recruiter" 
              ? "bg-background shadow-sm text-foreground" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <GitBranch className="h-4 w-4" />
          Recruiter Tree
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={viewMode === "formal" ? "Search teams or reps..." : "Search recruiters..."}
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

      {/* Recruiter Tree View */}
      {viewMode === "recruiter" && (
        <RecruiterTreeView searchQuery={searchQuery} />
      )}

      {/* Formal Structure View */}
      {viewMode === "formal" && (
        <>
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
                              reps={filteredData.repsByTeam.get(team.id) || []}
                              isExpanded={displayExpandedTeams.has(team.id)}
                              onToggle={() => toggleTeam(team.id)}
                              onEditTeam={() => setEditingTeam(team)}
                              onEditRep={(rep) => setEditingRep(rep)}
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
                  reps={filteredData.repsByTeam.get(team.id) || []}
                  isExpanded={displayExpandedTeams.has(team.id)}
                  onToggle={() => toggleTeam(team.id)}
                  onEditTeam={() => setEditingTeam(team)}
                  onEditRep={(rep) => setEditingRep(rep)}
                />
              ))}
            </div>
          )}

          {/* No results message */}
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
        </>
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

// TeamCard component
interface TeamCardProps {
  team: OrgTeam;
  reps: OrgRep[];
  isExpanded: boolean;
  onToggle: () => void;
  onEditTeam: () => void;
  onEditRep: (rep: OrgRep) => void;
}

const TeamCard = ({ team, reps, isExpanded, onToggle, onEditTeam, onEditRep }: TeamCardProps) => {
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
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="border-t px-2.5 pb-2 space-y-1">
            {reps.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 pl-5">No reps in this team</p>
            ) : (
              reps.map((rep) => (
                <div
                  key={rep.id}
                  className="flex items-center justify-between py-1.5 px-2 ml-4 hover:bg-muted/50 rounded cursor-pointer"
                  onClick={() => onEditRep(rep)}
                >
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{rep.name}</span>
                    {rep.stage && (
                      <Badge variant="secondary" className="text-xs">
                        {rep.stage}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {rep.recruiterName && (
                      <span className="text-xs text-muted-foreground">
                        📩 {rep.recruiterName}
                      </span>
                    )}
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
