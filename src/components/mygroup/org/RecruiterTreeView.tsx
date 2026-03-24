import { useState, useMemo, useEffect, useCallback } from "react";
import { SIGNED_PLUS_STAGES, isStageIn } from "@/utils/stageConstants";
import { useQuery } from "@tanstack/react-query";
import { Users, List, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { getCleanName } from "@/utils/nameUtils";
import { canManageTeam } from "@/utils/roleHierarchy";
import { VisualRecruiterTree, type TreeNode } from "./VisualRecruiterTree";
import { ReassignRecruiterDrawer } from "./ReassignRecruiterDrawer";

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

interface RecruiterTreeViewProps {
  searchQuery: string;
  onEditRep?: (rep: OrgRep) => void;
}

export const RecruiterTreeView = ({ searchQuery, onEditRep }: RecruiterTreeViewProps) => {
  const { data: teamAccess, isLoading: accessLoading, isPlaceholderData: isTeamAccessPlaceholder } = useTeamAccess();
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<{
    id: string;
    name: string;
    userId: string | null;
    childCount: number;
    currentRecruiterUserId?: string | null;
  } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentAuthUserId(session?.user?.id || null);
    });
  }, []);

  // Fetch recruits, reps, and org structure data
  const { data: treeData, isLoading } = useQuery({
    queryKey: ["recruiter-tree-data"],
    queryFn: async () => {
      const [recruitsRes, repsRes, teamsRes, mgmtGroupsRes, officesRes, teamMgmtGroupsRes] = await Promise.all([
        supabase.from("recruits").select("id, name, recruiter_user_id, stage, team_id, mgmt_group_id, phone, email, created_at, updated_at").limit(5000),
        supabase.from("reps").select("user_id, name, profile_photo_url").limit(5000),
        supabase.from("teams").select("id, name, lead_user_id").limit(500),
        supabase.from("mgmt_groups").select("id, name, office_id, lead_user_id").limit(500),
        supabase.from("offices").select("id, name").limit(200),
        supabase.from("team_mgmt_groups").select("team_id, mgmt_group_id").limit(2000),
      ]);

      return {
        recruits: recruitsRes.data || [],
        reps: repsRes.data || [],
        teams: teamsRes.data || [],
        mgmtGroups: mgmtGroupsRes.data || [],
        offices: officesRes.data || [],
        teamMgmtGroups: teamMgmtGroupsRes.data || [],
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  // Build tree structure grouped by Office → MGMT Group
  const tree = useMemo(() => {
    if (!treeData || !teamAccess || !currentAuthUserId) return null;

    const recruits = treeData.recruits || [];
    const reps = treeData.reps || [];
    const teams = treeData.teams || [];
    const mgmtGroups = treeData.mgmtGroups || [];
    const offices = treeData.offices || [];
    const teamMgmtGroups = treeData.teamMgmtGroups || [];

    const repMap = new Map(reps.map((r) => [r.user_id, r]));
    const teamMap = new Map(teams.map((t) => [t.id, t.name]));

    // Build team → mgmt_group lookup
    const teamToMgmtGroup = new Map<string, string>();
    teamMgmtGroups.forEach((tmg) => {
      teamToMgmtGroup.set(tmg.team_id, tmg.mgmt_group_id);
    });

    // Build mgmt_group → office lookup
    const mgmtGroupMap = new Map(mgmtGroups.map((mg) => [mg.id, mg]));
    const officeMap = new Map(offices.map((o) => [o.id, o]));

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
      const recruiterRecruits = (recruitsByRecruiter.get(userId) || [])
        .filter((r) => isStageIn(r.stage, [...SIGNED_PLUS_STAGES]));
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
            children: [],
          });
        }
      });

      children.sort((a, b) => b.children.length - a.children.length);

      return {
        id: recruitRecord?.id || userId,
        name: rep?.name || "Unknown",
        userId,
        stage: recruitRecord?.stage || null,
        profilePhotoUrl: rep?.profile_photo_url,
        children,
      };
    };

    // Build team lead → team lookup
    const teamByLeadUserId = new Map(teams.map((t) => [t.lead_user_id, t]));

    // Helper: resolve mgmt_group_id for a recruiter userId
    // Priority: 1) leads a mgmt group, 2) leads a team → team's mgmt group, 3) recruit's mgmt_group_id, 4) recruit's team → mgmt group
    const resolveMgmtGroupId = (userId: string): string | null => {
      // 1. Check if they lead a mgmt group
      const ledGroup = mgmtGroups.find((mg) => mg.lead_user_id === userId);
      if (ledGroup) return ledGroup.id;
      // 2. Check if they lead a team → that team's mgmt group (via team_mgmt_groups)
      const ledTeam = teamByLeadUserId.get(userId);
      if (ledTeam) {
        const mgmtGroupId = teamToMgmtGroup.get(ledTeam.id);
        if (mgmtGroupId) return mgmtGroupId;
      }
      // 3. Check their recruit record
      const recruitByName = new Map(recruits.map((r) => [getCleanName(r.name).toLowerCase(), r]));
      const rep = repMap.get(userId);
      if (rep) {
        const recruit = recruitByName.get(getCleanName(rep.name).toLowerCase());
        // 3a. Try team → mgmt_group first (more accurate than recruit's mgmt_group_id)
        if (recruit?.team_id) {
          const mgmtGroupId = teamToMgmtGroup.get(recruit.team_id);
          if (mgmtGroupId) return mgmtGroupId;
        }
        // 3b. Fall back to recruit's direct mgmt_group_id
        if (recruit?.mgmt_group_id) return recruit.mgmt_group_id;
      }
      return null;
    };

    const rootNodes: TreeNode[] = [];
    const accessLevel = teamAccess.accessLevel;

    // Helper: collect all userIds that appear as descendants in a tree
    const collectChildUserIds = (nodes: TreeNode[], set: Set<string>) => {
      for (const node of nodes) {
        if (node.userId) set.add(node.userId);
        collectChildUserIds(node.children, set);
      }
    };

    if (
      accessLevel === "area_director" ||
      accessLevel === "corporate" ||
      accessLevel === "regional" ||
      accessLevel === "sr_regional" ||
      accessLevel === "partner" ||
      accessLevel === "divisional"
    ) {
      const allRecruiterIds = new Set(
        recruits.map((r) => r.recruiter_user_id).filter(Boolean) as string[]
      );

      // Build all candidate root trees first
      const candidateRoots: TreeNode[] = [];
      allRecruiterIds.forEach((recruiterId) => {
        const node = buildNode(recruiterId);
        if (node && node.children.length > 0) candidateRoots.push(node);
      });

      // Collect every userId that appears as a child in ANY tree
      const allChildUserIds = new Set<string>();
      candidateRoots.forEach((root) => {
        collectChildUserIds(root.children, allChildUserIds);
      });

      // Only keep roots whose userId does NOT appear as someone else's child
      const trueRoots: TreeNode[] = [];
      candidateRoots.forEach((root) => {
        if (!root.userId || !allChildUserIds.has(root.userId)) {
          trueRoots.push(root);
        }
      });

      // Group roots by office → mgmt group
      const officeGroups = new Map<string, Map<string, TreeNode[]>>(); // officeId → mgmtGroupId → nodes
      const ungroupedByMgmt = new Map<string, TreeNode[]>(); // mgmtGroupId → nodes (no office)
      const fullyUngrouped: TreeNode[] = [];

      trueRoots.forEach((root) => {
        const mgmtGroupId = root.userId ? resolveMgmtGroupId(root.userId) : null;
        if (mgmtGroupId) {
          const mgmtGroup = mgmtGroupMap.get(mgmtGroupId);
          const officeId = mgmtGroup?.office_id;
          if (officeId) {
            if (!officeGroups.has(officeId)) officeGroups.set(officeId, new Map());
            const mgmtMap = officeGroups.get(officeId)!;
            if (!mgmtMap.has(mgmtGroupId)) mgmtMap.set(mgmtGroupId, []);
            mgmtMap.get(mgmtGroupId)!.push(root);
          } else {
            if (!ungroupedByMgmt.has(mgmtGroupId)) ungroupedByMgmt.set(mgmtGroupId, []);
            ungroupedByMgmt.get(mgmtGroupId)!.push(root);
          }
        } else {
          fullyUngrouped.push(root);
        }
      });

      // Helper: deduplicate nodes within a group — remove any root that appears as a descendant of another root
      const dedupeGroupNodes = (nodes: TreeNode[]): TreeNode[] => {
        const descendantIds = new Set<string>();
        nodes.forEach((n) => collectChildUserIds(n.children, descendantIds));
        return nodes.filter((n) => !n.userId || !descendantIds.has(n.userId));
      };

      // Build office label nodes → mgmt group label nodes → recruiter chains
      officeGroups.forEach((mgmtMap, officeId) => {
        const office = officeMap.get(officeId);
        const mgmtChildren: TreeNode[] = [];

        mgmtMap.forEach((nodes, mgmtGroupId) => {
          const mg = mgmtGroupMap.get(mgmtGroupId);
          const dedupedNodes = dedupeGroupNodes(nodes);
          mgmtChildren.push({
            id: `mgmt-${mgmtGroupId}`,
            name: mg?.name || "MGMT Group",
            userId: mg?.lead_user_id || null,
            stage: null,
            profilePhotoUrl: mg?.lead_user_id ? repMap.get(mg.lead_user_id)?.profile_photo_url : null,
            isLabelNode: true,
            roleColor: "mgmt_group",
            children: dedupedNodes.sort((a, b) => b.children.length - a.children.length),
          });
        });

        mgmtChildren.sort((a, b) => b.children.length - a.children.length);

        rootNodes.push({
          id: `office-${officeId}`,
          name: office?.name || "Office",
          userId: null,
          stage: null,
          profilePhotoUrl: null,
          isLabelNode: true,
          roleColor: "area_director",
          children: mgmtChildren,
        });
      });

      // MGMT groups without an office
      ungroupedByMgmt.forEach((nodes, mgmtGroupId) => {
        const mg = mgmtGroupMap.get(mgmtGroupId);
        const dedupedNodes = dedupeGroupNodes(nodes);
        rootNodes.push({
          id: `mgmt-${mgmtGroupId}`,
          name: mg?.name || "MGMT Group",
          userId: mg?.lead_user_id || null,
          stage: null,
          profilePhotoUrl: mg?.lead_user_id ? repMap.get(mg.lead_user_id)?.profile_photo_url : null,
          isLabelNode: true,
          roleColor: "mgmt_group",
          children: dedupedNodes.sort((a, b) => b.children.length - a.children.length),
        });
      });

      // Fully ungrouped roots
      rootNodes.push(...fullyUngrouped.sort((a, b) => b.children.length - a.children.length));

    } else if (currentAuthUserId) {
      const node = buildNode(currentAuthUserId);
      if (node && node.children.length > 0) {
        rootNodes.push(...node.children);
      }
    }

    return rootNodes.sort((a, b) => b.children.length - a.children.length);
  }, [treeData, teamAccess, currentAuthUserId]);

  // Filter for search
  const filteredTree = useMemo(() => {
    if (!tree || !searchQuery.trim()) return tree;
    const query = searchQuery.toLowerCase().trim();

    const filterNode = (node: TreeNode): TreeNode | null => {
      const nameMatches = getCleanName(node.name).toLowerCase().includes(query);
      const filteredChildren = node.children
        .map((child) => filterNode(child))
        .filter((n): n is TreeNode => n !== null);
      if (nameMatches || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };

    return tree
      .map((node) => filterNode(node))
      .filter((n): n is TreeNode => n !== null);
  }, [tree, searchQuery]);

  // Eligible recruiters for reassignment (all reps in the tree with accounts)
  const eligibleRecruiters = useMemo(() => {
    if (!treeData) return [];
    return treeData.reps
      .filter((r) => r.user_id)
      .map((r) => ({
        userId: r.user_id!,
        name: r.name,
        profilePhotoUrl: r.profile_photo_url,
        stage: null as string | null,
      }));
  }, [treeData]);

  // Find recruiter_user_id for a node
  const findRecruiterUserId = useCallback(
    (nodeId: string): string | null => {
      if (!treeData) return null;
      const recruit = treeData.recruits.find((r) => r.id === nodeId);
      return recruit?.recruiter_user_id || null;
    },
    [treeData]
  );

  const canReassign =
    teamAccess?.accessLevel && canManageTeam(teamAccess.accessLevel);

  const handleSelectNode = useCallback(
    (node: { id: string; name: string; userId: string | null; childCount: number } | null) => {
      if (!node) {
        setSelectedNodeId(null);
        setSelectedPerson(null);
        return;
      }
      setSelectedNodeId(node.id);

      if (canReassign) {
        setSelectedPerson({
          id: node.id,
          name: node.name,
          userId: node.userId,
          childCount: node.childCount,
          currentRecruiterUserId: findRecruiterUserId(node.id),
        });
        setReassignOpen(true);
      } else if (onEditRep) {
        // For non-leaders, open the edit drawer
        const recruit = treeData?.recruits.find((r) => r.id === node.id);
        if (recruit) {
          const teamName = recruit.team_id
            ? treeData?.teams.find((t) => t.id === recruit.team_id)?.name || null
            : null;
          onEditRep({
            id: recruit.id,
            userId: node.userId,
            name: recruit.name,
            teamId: recruit.team_id,
            teamName,
            recruiterUserId: recruit.recruiter_user_id,
            stage: recruit.stage,
            notionPageId: recruit.id,
            phone: recruit.phone,
            email: recruit.email,
            createdAt: recruit.created_at,
            updatedAt: recruit.updated_at,
          });
        }
      }
    },
    [canReassign, findRecruiterUserId, onEditRep, treeData]
  );

  // Wait for fresh data — don't render with stale placeholder data
  // This prevents flashing incorrect roles before real data arrives
  if (accessLoading || isTeamAccessPlaceholder || isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!filteredTree || filteredTree.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No recruiter hierarchy found</p>
        <p className="text-sm">Recruiting relationships will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {canReassign && (
        <div className="flex items-center gap-2 px-1">
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Tap a person to reassign their recruiter
          </span>
        </div>
      )}

      <VisualRecruiterTree
        roots={filteredTree}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectNode}
      />

      <ReassignRecruiterDrawer
        open={reassignOpen}
        onOpenChange={(open) => {
          setReassignOpen(open);
          if (!open) setSelectedNodeId(null);
        }}
        selectedPerson={selectedPerson}
        eligibleRecruiters={eligibleRecruiters}
      />
    </div>
  );
};
