import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Building2, Users, User, ChevronDown, ChevronRight, Trash2, Pencil, UserPlus } from "lucide-react";
import { getCleanName } from "@/utils/nameUtils";
import { YearBadge } from "@/components/leaderboard/YearBadge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type OrgNodeType = "region" | "office" | "mgmt_group" | "team" | "recruiter_group" | "rep";

interface OrgNode {
  id: string;
  name: string;
  type: OrgNodeType;
  role?: string;
  year?: string | null;
  hasAppAccess?: boolean;
  children: OrgNode[];
}

export const OrgStructureTree = () => {
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  const { data: orgData, isLoading } = useQuery({
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
        supabase.from("recruits").select("id, name, recruiter_user_id, stage, year, team_id, mgmt_group_id").limit(5000),
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
  });

  // Delete team confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteTeam = useCallback(async () => {
    if (!deleteTarget || !currentUserId) return;
    setIsDeleting(true);
    try {
      // Create an org change request for deletion
      const { error } = await supabase.from("org_change_requests").insert({
        request_type: `delete_${deleteTarget.type}`,
        requested_by: currentUserId,
        request_data: { 
          target_id: deleteTarget.id, 
          target_name: deleteTarget.name,
          target_type: deleteTarget.type 
        },
        status: "pending",
      });
      if (error) throw error;
      toast.success(`Deletion request submitted for "${deleteTarget.name}". Awaiting approval.`);
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, currentUserId, queryClient]);

  const tree = useMemo(() => {
    if (!orgData) return [];
    const { regions, offices, mgmtGroups, teams, teamMgmt, officeStaff, reps, recruits } = orgData;
    const repMap = new Map(reps.map((r) => [r.user_id, r]));
    const getRepName = (userId: string | null) => {
      if (!userId) return "Unassigned";
      return getCleanName(repMap.get(userId)?.name) || "Unknown";
    };

    // Build recruiter sub-groups within a team
    const buildTeamMembers = (teamId: string, teamLeadUserId: string | null): OrgNode[] => {
      // Find recruits assigned to this team
      const teamRecruits = recruits.filter((r) => r.team_id === teamId);
      if (teamRecruits.length === 0) return [];

      // Group by recruiter_user_id
      const byRecruiter = new Map<string, typeof teamRecruits>();
      const noRecruiter: typeof teamRecruits = [];

      teamRecruits.forEach((r) => {
        if (r.recruiter_user_id && r.recruiter_user_id !== teamLeadUserId) {
          const existing = byRecruiter.get(r.recruiter_user_id) || [];
          existing.push(r);
          byRecruiter.set(r.recruiter_user_id, existing);
        } else {
          noRecruiter.push(r);
        }
      });

      const children: OrgNode[] = [];

      // Recruiter sub-groups
      byRecruiter.forEach((groupRecruits, recruiterId) => {
        const recruiterRep = repMap.get(recruiterId);
        const recruiterName = recruiterRep ? getCleanName(recruiterRep.name) : "Unknown Recruiter";

        children.push({
          id: `recruiter-${recruiterId}`,
          name: `${recruiterName}'s Recruits`,
          type: "recruiter_group",
          role: recruiterRep ? (recruiterRep.year || undefined) : undefined,
          children: groupRecruits.map((r) => {
            const recruitRep = reps.find((rep) => getCleanName(rep.name).toLowerCase() === getCleanName(r.name).toLowerCase());
            return {
              id: r.id,
              name: getCleanName(r.name),
              type: "rep" as OrgNodeType,
              role: r.stage || undefined,
              year: r.year,
              hasAppAccess: !!recruitRep?.user_id,
              children: [],
            };
          }),
        });
      });

      // Direct recruits (recruited by team lead or no recruiter)
      noRecruiter.forEach((r) => {
        const recruitRep = reps.find((rep) => getCleanName(rep.name).toLowerCase() === getCleanName(r.name).toLowerCase());
        children.push({
          id: r.id,
          name: getCleanName(r.name),
          type: "rep",
          role: r.stage || undefined,
          year: r.year,
          hasAppAccess: !!recruitRep?.user_id,
          children: [],
        });
      });

      return children;
    };

    const teamNodes = (mgmtGroupId: string): OrgNode[] => {
      const groupTeamIds = teamMgmt.filter((tm) => tm.mgmt_group_id === mgmtGroupId).map((tm) => tm.team_id);
      return teams
        .filter((t) => groupTeamIds.includes(t.id))
        .map((t) => ({
          id: t.id,
          name: t.name,
          type: "team" as const,
          role: t.lead_user_id ? `Led by ${getRepName(t.lead_user_id)}` : undefined,
          children: buildTeamMembers(t.id, t.lead_user_id),
        }));
    };

    const mgmtNodes = (officeId: string): OrgNode[] =>
      mgmtGroups
        .filter((mg) => mg.office_id === officeId)
        .map((mg) => ({
          id: mg.id,
          name: mg.name,
          type: "mgmt_group" as const,
          role: mg.lead_user_id ? `Led by ${getRepName(mg.lead_user_id)}` : undefined,
          children: teamNodes(mg.id),
        }));

    const officeNodes = (regionId: string | null): OrgNode[] =>
      offices
        .filter((o: any) => (regionId ? o.region_id === regionId : !o.region_id))
        .map((o) => {
          const staff = officeStaff.filter((s) => s.office_id === o.id);
          const adNames = staff.map((s) => `${getRepName(s.user_id)} (AD)`).join(", ");
          return {
            id: o.id,
            name: o.name,
            type: "office" as const,
            role: adNames || undefined,
            children: mgmtNodes(o.id),
          };
        });

    const regionNodes: OrgNode[] = regions.map((r) => ({
      id: r.id,
      name: r.name,
      type: "region" as const,
      role: r.lead_user_id ? `Led by ${getRepName(r.lead_user_id)}` : undefined,
      children: officeNodes(r.id),
    }));

    const unassignedOffices = officeNodes(null);
    if (unassignedOffices.length > 0) {
      regionNodes.push({
        id: "unassigned",
        name: "Unassigned Offices",
        type: "region",
        children: unassignedOffices,
      });
    }

    return regionNodes;
  }, [orgData]);

  if (isLoading) {
    return <div className="animate-pulse space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded-lg" />)}</div>;
  }

  if (tree.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No organizational structure defined yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {tree.map((node) => (
          <OrgNodeCard key={node.id} node={node} depth={0} onDelete={setDeleteTarget} />
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              This will submit a request to delete "{deleteTarget?.name}". The request will need approval from your upline before it takes effect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTeam} disabled={isDeleting}>
              {isDeleting ? "Submitting..." : "Submit Request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const typeIcons: Record<OrgNodeType, any> = {
  region: Globe,
  office: Building2,
  mgmt_group: Users,
  team: Users,
  recruiter_group: UserPlus,
  rep: User,
};

const typeColors: Record<OrgNodeType, string> = {
  region: "text-primary",
  office: "text-amber-500",
  mgmt_group: "text-blue-500",
  team: "text-green-500",
  recruiter_group: "text-purple-500",
  rep: "text-muted-foreground",
};

interface OrgNodeCardProps {
  node: OrgNode;
  depth: number;
  onDelete: (target: { id: string; name: string; type: string }) => void;
}

const OrgNodeCard = ({ node, depth, onDelete }: OrgNodeCardProps) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const Icon = typeIcons[node.type];
  const isEditable = node.type === "team" || node.type === "mgmt_group";

  return (
    <div className={depth > 0 ? "ml-4 border-l border-border pl-3" : ""}>
      <div className="flex items-center group">
        <button
          onClick={() => hasChildren && setExpanded(!expanded)}
          className="flex-1 text-left flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors min-w-0"
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <Icon className={cn("h-4 w-4 shrink-0", typeColors[node.type])} />
          <span className={cn(
            "text-sm font-medium truncate",
            node.type === "rep" && !node.hasAppAccess && "text-muted-foreground italic"
          )}>
            {node.name}
          </span>

          {/* Year badge for reps */}
          {node.type === "rep" && node.year && (
            <YearBadge year={node.year} className="!w-4 !h-4 !text-[8px]" />
          )}

          {/* App access indicator for reps */}
          {node.type === "rep" && (
            <span className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              node.hasAppAccess ? "bg-green-500" : "bg-muted-foreground/30"
            )} />
          )}

          {node.role && <span className="text-xs text-muted-foreground truncate ml-auto">{node.role}</span>}
          {hasChildren && (
            <Badge variant="outline" className="text-xs ml-1 shrink-0">
              {node.children.length}
            </Badge>
          )}
        </button>

        {/* Edit actions for teams and mgmt groups */}
        {isEditable && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 pr-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete({ id: node.id, name: node.name, type: node.type });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <OrgNodeCard key={child.id} node={child} depth={depth + 1} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
};
