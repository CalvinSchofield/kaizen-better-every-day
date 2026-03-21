import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Globe, Building2, Users, User, ChevronDown, ChevronRight } from "lucide-react";
import { getRoleLabel, type AccessLevel } from "@/utils/roleHierarchy";
import { useState } from "react";
import { getCleanName } from "@/utils/nameUtils";

interface OrgNode {
  id: string;
  name: string;
  type: 'region' | 'office' | 'mgmt_group' | 'team' | 'person';
  role?: string;
  children: OrgNode[];
  memberCount?: number;
}

const OrgChart = () => {
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();

  const { data: orgData, isLoading } = useQuery({
    queryKey: ['org-chart-data'],
    queryFn: async () => {
      const [regionsRes, officesRes, mgmtGroupsRes, teamsRes, teamMgmtRes, officeStaffRes, repsRes] = await Promise.all([
        supabase.from('regions').select('*').order('name'),
        supabase.from('offices').select('*').order('name'),
        supabase.from('mgmt_groups').select('*').order('name'),
        supabase.from('teams').select('*').order('name'),
        supabase.from('team_mgmt_groups').select('*'),
        supabase.from('office_staff').select('*'),
        supabase.from('reps').select('id, user_id, name, profile_photo_url'),
      ]);
      return {
        regions: regionsRes.data || [],
        offices: officesRes.data || [],
        mgmtGroups: mgmtGroupsRes.data || [],
        teams: teamsRes.data || [],
        teamMgmt: teamMgmtRes.data || [],
        officeStaff: officeStaffRes.data || [],
        reps: repsRes.data || [],
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const tree = useMemo(() => {
    if (!orgData) return [];
    const { regions, offices, mgmtGroups, teams, teamMgmt, officeStaff, reps } = orgData;
    const repMap = new Map(reps.map(r => [r.user_id, r]));
    const getRepName = (userId: string | null) => {
      if (!userId) return 'Unassigned';
      return repMap.get(userId)?.name || 'Unknown';
    };

    // Build teams → mgmt_groups → offices → regions
    const teamNodes = (mgmtGroupId: string): OrgNode[] => {
      const groupTeamIds = teamMgmt.filter(tm => tm.mgmt_group_id === mgmtGroupId).map(tm => tm.team_id);
      return teams
        .filter(t => groupTeamIds.includes(t.id))
        .map(t => ({
          id: t.id,
          name: t.name,
          type: 'team' as const,
          role: t.lead_user_id ? `Led by ${getRepName(t.lead_user_id)}` : undefined,
          children: [],
        }));
    };

    const mgmtNodes = (officeId: string): OrgNode[] => {
      return mgmtGroups
        .filter(mg => mg.office_id === officeId)
        .map(mg => ({
          id: mg.id,
          name: mg.name,
          type: 'mgmt_group' as const,
          role: mg.lead_user_id ? `Led by ${getRepName(mg.lead_user_id)}` : undefined,
          children: teamNodes(mg.id),
        }));
    };

    const officeNodes = (regionId: string | null): OrgNode[] => {
      return offices
        .filter((o: any) => regionId ? o.region_id === regionId : !o.region_id)
        .map(o => {
          const staff = officeStaff.filter(s => s.office_id === o.id);
          const adNames = staff.map(s => getRepName(s.user_id)).join(', ');
          return {
            id: o.id,
            name: o.name,
            type: 'office' as const,
            role: adNames || undefined,
            children: mgmtNodes(o.id),
          };
        });
    };

    const regionNodes: OrgNode[] = regions.map(r => ({
      id: r.id,
      name: r.name,
      type: 'region' as const,
      role: r.lead_user_id ? `Led by ${getRepName(r.lead_user_id)}` : undefined,
      children: officeNodes(r.id),
    }));

    // Add unassigned offices as top-level
    const unassignedOffices = officeNodes(null);
    if (unassignedOffices.length > 0) {
      regionNodes.push({
        id: 'unassigned',
        name: 'Unassigned Offices',
        type: 'region',
        children: unassignedOffices,
      });
    }

    return regionNodes;
  }, [orgData]);

  if (accessLoading || isLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 space-y-4 pb-24">
        <div>
          <h1 className="text-2xl font-bold">Org Chart</h1>
          <p className="text-sm text-muted-foreground">Organization hierarchy overview</p>
        </div>

        {tree.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No organizational structure defined yet</p>
            <p className="text-sm">Create regions and offices in the admin panel</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tree.map(node => (
              <OrgNodeCard key={node.id} node={node} depth={0} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

const typeIcons = {
  region: Globe,
  office: Building2,
  mgmt_group: Users,
  team: Users,
  person: User,
};

const typeColors: Record<string, string> = {
  region: 'text-primary',
  office: 'text-amber-500',
  mgmt_group: 'text-blue-500',
  team: 'text-green-500',
  person: 'text-muted-foreground',
};

const OrgNodeCard = ({ node, depth }: { node: OrgNode; depth: number }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const Icon = typeIcons[node.type];

  return (
    <div className={depth > 0 ? 'ml-4 border-l border-border pl-3' : ''}>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className="w-full text-left flex items-center gap-2 p-2.5 rounded-lg hover:bg-accent/50 transition-colors group"
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <span className="w-4" />
        )}
        <Icon className={`h-4 w-4 shrink-0 ${typeColors[node.type]}`} />
        <span className="text-sm font-medium truncate">{node.name}</span>
        {node.role && (
          <span className="text-xs text-muted-foreground truncate ml-auto">{node.role}</span>
        )}
        {hasChildren && (
          <Badge variant="outline" className="text-xs ml-1 shrink-0">
            {node.children.length}
          </Badge>
        )}
      </button>
      {expanded && hasChildren && (
        <div className="space-y-0.5">
          {node.children.map(child => (
            <OrgNodeCard key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default OrgChart;
