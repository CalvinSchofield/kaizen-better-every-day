import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GitBranch } from "lucide-react";
import { getCleanName } from "@/utils/nameUtils";
import { VisualRecruiterTree, type TreeNode } from "@/components/mygroup/org/VisualRecruiterTree";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrgStructureTree } from "@/components/org/OrgStructureTree";

const OrgChart = () => {
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentAuthUserId(data.user?.id || null);
    });
  }, []);

  const { data: treeData, isLoading } = useQuery({
    queryKey: ["org-chart-full-tree"],
    queryFn: async () => {
      const [recruitsRes, repsRes, teamsRes, mgmtGroupsRes, teamMgmtRes, officeStaffRes] = await Promise.all([
        supabase.from("recruits").select("id, name, recruiter_user_id, stage, team_id, year").limit(5000),
        supabase.from("reps").select("user_id, name, profile_photo_url, year, stage").limit(5000),
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

  // Build role map: userId -> title
  const roleMap = useMemo(() => {
    if (!treeData) return new Map<string, string>();
    const map = new Map<string, string>();

    treeData.teams.forEach((t) => {
      if (t.lead_user_id) map.set(t.lead_user_id, "Team Lead");
    });
    treeData.mgmtGroups.forEach((mg) => {
      if (mg.lead_user_id) map.set(mg.lead_user_id, "MGMT Group Lead");
    });
    treeData.officeStaff.forEach((s) => {
      if (s.role === "area_director") map.set(s.user_id, "Area Director");
    });

    return map;
  }, [treeData]);

  // Build recruiter tree
  const tree = useMemo(() => {
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

      const children: TreeNode[] = [];

      // Children with accounts
      recruiterRecruits.forEach((r) => {
        const recruitRep = reps.find(
          (rep) => getCleanName(rep.name).toLowerCase() === getCleanName(r.name).toLowerCase()
        );
        if (recruitRep?.user_id) {
          const child = buildNode(recruitRep.user_id, new Set(visited));
          if (child) children.push(child);
        }
      });

      // Leaf recruits without accounts
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
            children: [],
          });
        }
      });

      children.sort((a, b) => b.children.length - a.children.length);

      return {
        id: recruitRecord?.id || userId,
        name: rep?.name || "Unknown",
        userId,
        stage: recruitRecord?.stage || rep?.stage || null,
        profilePhotoUrl: rep?.profile_photo_url,
        role: roleMap.get(userId) || null,
        year: rep?.year || recruitRecord?.year || null,
        children,
      };
    };

    const rootNodes: TreeNode[] = [];
    const accessLevel = teamAccess?.accessLevel;

    // For higher-level leaders, find true root nodes
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
        if (recruitRep?.user_id && r.recruiter_user_id) {
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
      // For regular users, show their own tree
      const node = buildNode(currentAuthUserId);
      if (node) {
        if (node.children.length > 0) {
          rootNodes.push(node);
        }
      }
    }

    return rootNodes.sort((a, b) => b.children.length - a.children.length);
  }, [treeData, teamAccess, currentAuthUserId, roleMap]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const handleSelectNode = useCallback(
    (node: { id: string; name: string; userId: string | null; childCount: number } | null) => {
      setSelectedNodeId(node?.id || null);
    },
    []
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

        <TabsContent value="tree" className="mt-3">
          {!tree || tree.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No recruiter tree found</p>
              <p className="text-sm">Recruiting relationships will appear here</p>
            </div>
          ) : (
            <VisualRecruiterTree
              roots={tree}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
            />
          )}
        </TabsContent>

        <TabsContent value="structure" className="mt-3">
          <OrgStructureTree />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrgChart;
