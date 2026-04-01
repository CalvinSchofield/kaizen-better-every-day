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
import { VisualRecruiterTree, type TreeNode, type RoleColor } from "./VisualRecruiterTree";
import { ReassignRecruiterDrawer } from "./ReassignRecruiterDrawer";

const OFFICE_GROUPED_ACCESS_LEVELS = new Set([
  "area_director",
  "corporate",
  "regional",
  "sr_regional",
  "partner",
  "divisional",
  "mgmt_group_lead",
  "senior_manager",
]);

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
  const [groupByOffice, setGroupByOffice] = useState(true);
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
      const [recruitsRes, repsRes, teamsRes, mgmtGroupsRes, officesRes, teamMgmtGroupsRes, srMgmtGroupsRes] = await Promise.all([
        supabase.from("recruits").select("id, name, recruiter_user_id, stage, team_id, mgmt_group_id, phone, email, created_at, updated_at").limit(5000),
        supabase.from("reps").select("id, user_id, name, profile_photo_url").limit(5000),
        supabase.from("teams").select("id, name, lead_user_id").limit(500),
        supabase.from("mgmt_groups").select("id, name, office_id, lead_user_id, sr_mgmt_group_id").limit(500),
        supabase.from("offices").select("id, name").limit(200),
        supabase.from("team_mgmt_groups").select("team_id, mgmt_group_id").limit(2000),
        supabase.from("sr_mgmt_groups").select("id, name, lead_user_id, office_id").limit(500),
      ]);

      return {
        recruits: recruitsRes.data || [],
        reps: repsRes.data || [],
        teams: teamsRes.data || [],
        mgmtGroups: mgmtGroupsRes.data || [],
        offices: officesRes.data || [],
        teamMgmtGroups: teamMgmtGroupsRes.data || [],
        srMgmtGroups: srMgmtGroupsRes.data || [],
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
    const srMgmtGroups = treeData.srMgmtGroups || [];

    const repMap = new Map<string, (typeof reps)[number]>();
    reps.forEach((rep) => {
      if (rep.user_id) repMap.set(rep.user_id, rep);
    });

    // Id-based lookup: rep.id often equals recruit.id
    const repByRecruitId = new Map<string, (typeof reps)[number]>();
    reps.forEach((rep) => {
      if (rep.id) repByRecruitId.set(rep.id, rep);
    });

    const repByCleanName = new Map<string, (typeof reps)[number]>();
    reps.forEach((rep) => {
      const cleanName = getCleanName(rep.name).toLowerCase();
      if (cleanName && !repByCleanName.has(cleanName)) {
        repByCleanName.set(cleanName, rep);
      }
    });

    const recruitById = new Map(recruits.map((recruit) => [recruit.id, recruit]));
    const recruitByCleanName = new Map<string, (typeof recruits)[number]>();
    recruits.forEach((recruit) => {
      const cleanName = getCleanName(recruit.name).toLowerCase();
      if (cleanName && !recruitByCleanName.has(cleanName)) {
        recruitByCleanName.set(cleanName, recruit);
      }
    });

    // Build team → mgmt_group lookup
    const teamToMgmtGroup = new Map<string, string>();
    teamMgmtGroups.forEach((tmg) => {
      teamToMgmtGroup.set(tmg.team_id, tmg.mgmt_group_id);
    });

    // Build mgmt_group → office lookup
    const mgmtGroupMap = new Map(mgmtGroups.map((mg) => [mg.id, mg]));
    const officeMap = new Map(offices.map((o) => [o.id, o]));
    const srMgmtGroupMap = new Map(srMgmtGroups.map((smg) => [smg.id, smg]));

    const recruitsByRecruiter = new Map<string, typeof recruits>();
    recruits.forEach((recruit) => {
      if (!recruit.recruiter_user_id) return;
      const existing = recruitsByRecruiter.get(recruit.recruiter_user_id) || [];
      existing.push(recruit);
      recruitsByRecruiter.set(recruit.recruiter_user_id, existing);
    });

    const getRecruitForRep = (rep: (typeof reps)[number] | undefined) => {
      if (!rep) return undefined;
      return recruitById.get(rep.id) || recruitByCleanName.get(getCleanName(rep.name).toLowerCase());
    };

    /** Count total descendants (recursive) for sorting by downline size */
    const countDescendants = (node: TreeNode): number => {
      let count = node.children.length;
      for (const child of node.children) {
        count += countDescendants(child);
      }
      return count;
    };

    const sortByDownlineSize = (nodes: TreeNode[]): TreeNode[] => {
      return [...nodes].sort((a, b) => countDescendants(b) - countDescendants(a));
    };

    const buildNode = (userId: string, visited = new Set<string>()): TreeNode | null => {
      if (visited.has(userId)) return null;
      visited.add(userId);

      const rep = repMap.get(userId);
      const recruiterRecruits = (recruitsByRecruiter.get(userId) || [])
        .filter((recruit) => isStageIn(recruit.stage, [...SIGNED_PLUS_STAGES]));
      const recruitRecord = getRecruitForRep(rep);

      const children: TreeNode[] = [];

      // Children with app accounts
      recruiterRecruits.forEach((recruit) => {
        const recruitRep = repByRecruitId.get(recruit.id) || repByCleanName.get(getCleanName(recruit.name).toLowerCase());
        if (recruitRep?.user_id) {
          const child = buildNode(recruitRep.user_id, new Set(visited));
          if (child) children.push(child);
        }
      });

      // Leaf recruits without app accounts
      recruiterRecruits.forEach((recruit) => {
        const recruitRep = repByRecruitId.get(recruit.id) || repByCleanName.get(getCleanName(recruit.name).toLowerCase());
        if (!recruitRep?.user_id) {
          children.push({
            id: recruit.id,
            name: recruit.name,
            userId: null,
            stage: recruit.stage,
            profilePhotoUrl: null,
            children: [],
          });
        }
      });

      children = sortByDownlineSize(children);

      // Determine role/color for this person
      const ledMgmtGroup = mgmtGroups.find((g) => g.lead_user_id === userId);
      const ledTeam = teams.find((t) => t.lead_user_id === userId);
      const ledSrMgmtGroup = srMgmtGroups.find((smg) => smg.lead_user_id === userId);

      let role: string | null = null;
      let roleColor: RoleColor | undefined = undefined;

      if (ledSrMgmtGroup) {
        role = "Sr MGMT Group Leader";
        roleColor = "sr_mgmt_group";
      } else if (ledMgmtGroup) {
        role = "MGMT Group Leader";
        roleColor = "mgmt_group";
      } else if (ledTeam) {
        role = "Team Leader";
        roleColor = "team_lead";
      }

      return {
        id: recruitRecord?.id || userId,
        name: rep?.name || "Unknown",
        userId,
        stage: recruitRecord?.stage || null,
        profilePhotoUrl: rep?.profile_photo_url,
        role,
        roleColor,
        children,
      };
    };

    // Build team lead → team lookup
    const teamByLeadUserId = new Map<string, (typeof teams)[number]>();
    teams.forEach((team) => {
      if (team.lead_user_id) teamByLeadUserId.set(team.lead_user_id, team);
    });

    // Helper: resolve mgmt_group_id for a recruiter userId
    // Priority: 1) leads a mgmt group, 2) leads a team → team's mgmt group,
    // 3) recruit's team → mgmt group, 4) recruit's direct mgmt_group_id
    const resolveMgmtGroupId = (userId: string): string | null => {
      const ledGroup = mgmtGroups.find((group) => group.lead_user_id === userId);
      if (ledGroup) return ledGroup.id;

      const ledTeam = teamByLeadUserId.get(userId);
      if (ledTeam) {
        const mgmtGroupId = teamToMgmtGroup.get(ledTeam.id);
        if (mgmtGroupId) return mgmtGroupId;
      }

      const rep = repMap.get(userId);
      const recruit = getRecruitForRep(rep);
      if (recruit?.team_id) {
        const mgmtGroupId = teamToMgmtGroup.get(recruit.team_id);
        if (mgmtGroupId) return mgmtGroupId;
      }
      if (recruit?.mgmt_group_id) return recruit.mgmt_group_id;

      return null;
    };

    // Helper: check if a user leads a Sr MGMT Group (returns the sr_mgmt_group_id)
    const resolveSrMgmtGroupId = (userId: string): string | null => {
      const ledSrGroup = srMgmtGroups.find((smg) => smg.lead_user_id === userId);
      return ledSrGroup?.id || null;
    };

    const hasUpstreamRecruiter = (userId: string) => {
      const rep = repMap.get(userId);
      const recruit = getRecruitForRep(rep);
      return Boolean(recruit?.recruiter_user_id);
    };

    /**
     * Creates a MGMT Group container node.
     * If the leader has an account and appears as one of the children,
     * promote that child to BE the container (person node with roleColor).
     * Otherwise, create a lightweight label pill.
     */
    const createMgmtLabelNode = (mgmtGroupId: string, children: TreeNode[] = []): TreeNode => {
      const mgmtGroup = mgmtGroupMap.get(mgmtGroupId);
      const leadUserId = mgmtGroup?.lead_user_id || null;

      // Try to find the leader among the children
      if (leadUserId) {
        const leaderIdx = children.findIndex((c) => c.userId === leadUserId);
        if (leaderIdx !== -1) {
          // Promote leader: take their node, apply MGMT styling, absorb siblings
          const leaderNode = children[leaderIdx];
          const siblings = children.filter((_, i) => i !== leaderIdx);
          return {
            ...leaderNode,
            id: `mgmt-${mgmtGroupId}`, // keep stable id for orphan injection
            roleColor: "mgmt_group",
            role: "MGMT Group Leader",
            // Leader's own recruiter children + sibling roots from this group
            children: sortByDownlineSize([...leaderNode.children, ...siblings]),
          };
        }
      }

      // Fallback: lightweight label pill (leader has no account or isn't in children)
      return {
        id: `mgmt-${mgmtGroupId}`,
        name: mgmtGroup?.name || "MGMT Group",
        userId: leadUserId,
        stage: null,
        profilePhotoUrl: leadUserId
          ? repMap.get(leadUserId)?.profile_photo_url
          : null,
        isLabelNode: true,
        roleColor: "mgmt_group",
        children: sortByDownlineSize([...children]),
      };
    };

    /**
     * Creates a Sr MGMT Group container node. Same promotion logic as MGMT.
     */
    const createSrMgmtLabelNode = (srMgmtGroupId: string, children: TreeNode[] = []): TreeNode => {
      const srMgmtGroup = srMgmtGroupMap.get(srMgmtGroupId);
      const leadUserId = srMgmtGroup?.lead_user_id || null;

      // Try to find the leader among the direct (non-label) children
      if (leadUserId) {
        const leaderIdx = children.findIndex((c) => c.userId === leadUserId && !c.isLabelNode);
        if (leaderIdx !== -1) {
          const leaderNode = children[leaderIdx];
          const siblings = children.filter((_, i) => i !== leaderIdx);
          return {
            ...leaderNode,
            id: `sr-mgmt-${srMgmtGroupId}`,
            roleColor: "sr_mgmt_group",
            role: "Sr MGMT Group Leader",
            children: sortByDownlineSize([...leaderNode.children, ...siblings]),
          };
        }
      }

      return {
        id: `sr-mgmt-${srMgmtGroupId}`,
        name: srMgmtGroup?.name || "Sr MGMT Group",
        userId: leadUserId,
        stage: null,
        profilePhotoUrl: leadUserId
          ? repMap.get(leadUserId)?.profile_photo_url
          : null,
        isLabelNode: true,
        roleColor: "sr_mgmt_group",
        children: sortByDownlineSize([...children]),
      };
    };

    const createOfficeLabelNode = (officeId: string, children: TreeNode[]): TreeNode => {
      const office = officeMap.get(officeId);
      return {
        id: `office-${officeId}`,
        name: office?.name || "Office",
        userId: null,
        stage: null,
        profilePhotoUrl: null,
        isLabelNode: true,
        roleColor: "area_director",
        children: sortByDownlineSize([...children]),
      };
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


    if (OFFICE_GROUPED_ACCESS_LEVELS.has(accessLevel) && groupByOffice) {
      const allRecruiterIds = new Set(
        recruits.map((recruit) => recruit.recruiter_user_id).filter(Boolean) as string[]
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

      // Collect MGMT/Sr MGMT leaders — they must always be roots for promotion
      const mgmtLeadUserIds = new Set(
        mgmtGroups.map((g) => g.lead_user_id).filter(Boolean) as string[]
      );
      const srMgmtLeadUserIds = new Set(
        srMgmtGroups.map((g) => g.lead_user_id).filter(Boolean) as string[]
      );

      // Keep roots only if they are not a child anywhere and don't have an upstream recruiter
      // Exception: MGMT/Sr MGMT leaders are always kept for promotion
      const trueRoots: TreeNode[] = [];
      candidateRoots.forEach((root) => {
        if (!root.userId) {
          trueRoots.push(root);
          return;
        }

        // Always keep group leaders as roots so promotion works
        if (mgmtLeadUserIds.has(root.userId) || srMgmtLeadUserIds.has(root.userId)) {
          trueRoots.push(root);
          return;
        }

        if (allChildUserIds.has(root.userId)) return;
        if (hasUpstreamRecruiter(root.userId)) return;
        trueRoots.push(root);
      });

      const isOfficeScopedToUser = accessLevel === "mgmt_group_lead";
      const scopedOfficeIds = new Set<string>();

      if (isOfficeScopedToUser) {
        mgmtGroups
          .filter((group) => group.lead_user_id === currentAuthUserId && group.office_id)
          .forEach((group) => scopedOfficeIds.add(group.office_id!));

        if (scopedOfficeIds.size === 0) {
          const currentUserMgmtGroupId = resolveMgmtGroupId(currentAuthUserId);
          const fallbackOfficeId = currentUserMgmtGroupId
            ? mgmtGroupMap.get(currentUserMgmtGroupId)?.office_id
            : null;
          if (fallbackOfficeId) scopedOfficeIds.add(fallbackOfficeId);
        }
      }

      // Helper to resolve the office for a mgmt group (check sr_mgmt_group.office_id too)
      const resolveOfficeId = (mgmtGroup: typeof mgmtGroups[number] | undefined): string | null => {
        if (!mgmtGroup) return null;
        if (mgmtGroup.office_id) return mgmtGroup.office_id;
        if (mgmtGroup.sr_mgmt_group_id) {
          const srMgmt = srMgmtGroupMap.get(mgmtGroup.sr_mgmt_group_id);
          if (srMgmt?.office_id) return srMgmt.office_id;
        }
        return null;
      };

      // Group roots by office → mgmt_group (FLAT — no Sr MGMT Group nesting)
      // Collect all MGMT groups per office (including those under Sr MGMT Groups)
      const officeMgmtGroupIds = new Map<string, Set<string>>(); // officeId → Set<mgmtGroupId>

      mgmtGroups.forEach((mg) => {
        const officeId = resolveOfficeId(mg);
        if (!officeId) return;
        if (isOfficeScopedToUser && !scopedOfficeIds.has(officeId)) return;
        if (!officeMgmtGroupIds.has(officeId)) officeMgmtGroupIds.set(officeId, new Set());
        officeMgmtGroupIds.get(officeId)!.add(mg.id);
      });

      // Also collect MGMT groups from Sr MGMT Groups that have office_id
      srMgmtGroups.forEach((smg) => {
        if (!smg.office_id) return;
        if (isOfficeScopedToUser && !scopedOfficeIds.has(smg.office_id)) return;
        if (!officeMgmtGroupIds.has(smg.office_id)) officeMgmtGroupIds.set(smg.office_id, new Set());
        mgmtGroups
          .filter((mg) => mg.sr_mgmt_group_id === smg.id)
          .forEach((mg) => officeMgmtGroupIds.get(smg.office_id!)!.add(mg.id));
      });

      // Group roots: officeId → mgmtGroupId → roots[]
      const officeGroups = new Map<string, Map<string, TreeNode[]>>();
      const ungroupedByMgmt = new Map<string, TreeNode[]>();
      const fullyUngrouped: TreeNode[] = [];

      trueRoots.forEach((root) => {
        if (!root.userId) {
          if (!isOfficeScopedToUser) fullyUngrouped.push(root);
          return;
        }

        // Check if this person leads a Sr MGMT Group — resolve them to a MGMT group instead
        const srMgmtId = resolveSrMgmtGroupId(root.userId);
        let mgmtGroupId = resolveMgmtGroupId(root.userId);

        // If they lead a Sr MGMT Group but have no direct MGMT group, they still need placement
        // They'll go under the first MGMT group in their Sr MGMT Group, or be placed as ungrouped
        if (!mgmtGroupId && srMgmtId) {
          const childMgmtGroups = mgmtGroups.filter((mg) => mg.sr_mgmt_group_id === srMgmtId);
          if (childMgmtGroups.length > 0) {
            // Place under the first child MGMT group (they'll appear as a root in it)
            mgmtGroupId = childMgmtGroups[0].id;
          }
        }

        if (!mgmtGroupId) {
          if (!isOfficeScopedToUser) fullyUngrouped.push(root);
          return;
        }

        const mgmtGroup = mgmtGroupMap.get(mgmtGroupId);
        const officeId = resolveOfficeId(mgmtGroup);

        if (isOfficeScopedToUser && (!officeId || !scopedOfficeIds.has(officeId))) {
          return;
        }

        if (officeId) {
          if (!officeGroups.has(officeId)) officeGroups.set(officeId, new Map());
          const mgmtMap = officeGroups.get(officeId)!;
          if (!mgmtMap.has(mgmtGroupId)) mgmtMap.set(mgmtGroupId, []);
          mgmtMap.get(mgmtGroupId)!.push(root);
          return;
        }

        if (!isOfficeScopedToUser) {
          if (!ungroupedByMgmt.has(mgmtGroupId)) ungroupedByMgmt.set(mgmtGroupId, []);
          ungroupedByMgmt.get(mgmtGroupId)!.push(root);
        }
      });

      // Helper: dedupe roots within a group
      const dedupeGroupNodes = (nodes: TreeNode[]): TreeNode[] => {
        const descendantIds = new Set<string>();
        nodes.forEach((node) => collectChildUserIds(node.children, descendantIds));
        return nodes.filter((node) => !node.userId || !descendantIds.has(node.userId));
      };

      // Global cross-group dedupe
      const globalDescendantIds = new Set<string>();
      trueRoots.forEach((root) => {
        collectChildUserIds(root.children, globalDescendantIds);
      });

      // Build office nodes with MGMT groups directly (no Sr MGMT layer)
      officeGroups.forEach((mgmtMap, officeId) => {
        const officeChildren: TreeNode[] = [];

        mgmtMap.forEach((nodes, mgmtGroupId) => {
          const mgLeader = mgmtGroupMap.get(mgmtGroupId)?.lead_user_id;
          const dedupedNodes = dedupeGroupNodes(nodes)
            .filter((node) => !node.userId || !globalDescendantIds.has(node.userId) || node.userId === mgLeader);
          officeChildren.push(createMgmtLabelNode(mgmtGroupId, dedupedNodes));
        });

        // Add MGMT groups in this office that have no roots yet
        const existingMgmtIds = new Set(mgmtMap.keys());
        const allMgmtIdsForOffice = officeMgmtGroupIds.get(officeId) || new Set();
        allMgmtIdsForOffice.forEach((mgId) => {
          if (!existingMgmtIds.has(mgId)) {
            officeChildren.push(createMgmtLabelNode(mgId));
          }
        });

        rootNodes.push(createOfficeLabelNode(officeId, officeChildren));
      });

      // Ensure offices with groups still render even if they had zero roots
      const existingOfficeIds = new Set(
        rootNodes
          .map((node) => node.id)
          .filter((id) => id.startsWith("office-"))
          .map((id) => id.replace("office-", ""))
      );

      officeMgmtGroupIds.forEach((mgmtIds, officeId) => {
        if (existingOfficeIds.has(officeId)) return;

        const officeChildren: TreeNode[] = [];
        mgmtIds.forEach((mgId) => {
          officeChildren.push(createMgmtLabelNode(mgId));
        });

        rootNodes.push(createOfficeLabelNode(officeId, officeChildren));
      });

      // MGMT groups without an office
      if (!isOfficeScopedToUser) {
        ungroupedByMgmt.forEach((nodes, mgmtGroupId) => {
          const mgLeader = mgmtGroupMap.get(mgmtGroupId)?.lead_user_id;
          const dedupedNodes = dedupeGroupNodes(nodes)
            .filter((node) => !node.userId || !globalDescendantIds.has(node.userId) || node.userId === mgLeader);
          rootNodes.push(createMgmtLabelNode(mgmtGroupId, dedupedNodes));
        });

        const dedupedUngrouped = fullyUngrouped
          .filter((node) => !node.userId || !globalDescendantIds.has(node.userId))
          PLACEHOLDER_SORT;
        rootNodes.push(...dedupedUngrouped);
      }

      // --- Inject orphaned reps (assigned to a group but missing from recruiter chains) ---
      const allTreeUserIds = new Set<string>();
      const collectAllTreeUserIds = (nodes: TreeNode[]) => {
        for (const n of nodes) {
          if (n.userId) allTreeUserIds.add(n.userId);
          collectAllTreeUserIds(n.children);
        }
      };
      collectAllTreeUserIds(rootNodes);

      reps.forEach((rep) => {
        if (!rep.user_id || allTreeUserIds.has(rep.user_id)) return;
        if (globalDescendantIds.has(rep.user_id)) return;
        const recruit = recruitById.get(rep.id);
        if (!recruit) return;
        if (!isStageIn(recruit.stage, [...SIGNED_PLUS_STAGES])) return;

        const mgmtGroupId =
          recruit.mgmt_group_id ||
          (recruit.team_id ? teamToMgmtGroup.get(recruit.team_id) : null);
        if (!mgmtGroupId) return;

        if (isOfficeScopedToUser) {
          const mg = mgmtGroupMap.get(mgmtGroupId);
          if (!mg?.office_id || !scopedOfficeIds.has(mg.office_id)) return;
        }

        const leaf: TreeNode = {
          id: recruit.id,
          name: rep.name,
          userId: rep.user_id,
          stage: recruit.stage,
          profilePhotoUrl: rep.profile_photo_url,
          children: [],
        };

        // Inject into the matching MGMT label node
        const injectInto = (nodes: TreeNode[]): boolean => {
          for (const node of nodes) {
            if (node.isLabelNode && node.id === `mgmt-${mgmtGroupId}`) {
              node.children.push(leaf);
              return true;
            }
            if (injectInto(node.children)) return true;
          }
          return false;
        };
        injectInto(rootNodes);
      });

      // --- Convert team-lead children to team label nodes when the person is already shown above ---
      // Collect userIds that are promoted as container nodes (MGMT/Sr MGMT leaders)
      const promotedUserIds = new Set<string>();
      const collectPromoted = (nodes: TreeNode[]) => {
        for (const n of nodes) {
          // A promoted node is a non-label node that was created by label node creation
          // (has roleColor mgmt_group or sr_mgmt_group and is NOT a label node)
          if (!n.isLabelNode && n.userId && (n.roleColor === 'mgmt_group' || n.roleColor === 'sr_mgmt_group')) {
            promotedUserIds.add(n.userId);
          }
          collectPromoted(n.children);
        }
      };
      collectPromoted(rootNodes);

      // For promoted users who also lead a team, replace their person-node child
      // appearance with a team label node
      const convertTeamLeadChildren = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map((node) => {
          const newChildren = convertTeamLeadChildren(node.children);

          // Check if this node should become a team label
          // (it's a person node whose userId is already promoted above AND leads a team)
          if (!node.isLabelNode && node.userId && promotedUserIds.has(node.userId)) {
            const ledTeam = teamByLeadUserId.get(node.userId);
            if (ledTeam) {
              // Convert to team label node, keeping only this person's children
              return {
                ...node,
                id: `team-${ledTeam.id}`,
                name: ledTeam.name || node.name + " Team",
                isLabelNode: true,
                roleColor: "team_lead" as const,
                profilePhotoUrl: null,
                children: newChildren,
              };
            }
          }

          return { ...node, children: newChildren };
        });
      };

      // Apply to all root nodes
      for (let i = 0; i < rootNodes.length; i++) {
        rootNodes[i] = {
          ...rootNodes[i],
          children: convertTeamLeadChildren(rootNodes[i].children),
        };
      }

      // --- Final dedup: remove person-nodes that appear as children of another person ---
      const descendantUserIds = new Set<string>();
      const collectPersonDescendants = (nodes: TreeNode[], parentIsPerson: boolean) => {
        for (const n of nodes) {
          if (parentIsPerson && n.userId) descendantUserIds.add(n.userId);
          collectPersonDescendants(n.children, !n.isLabelNode);
        }
      };
      rootNodes.forEach((r) => collectPersonDescendants(r.children, !r.isLabelNode));

      const pruneDuplicates = (nodes: TreeNode[]): TreeNode[] =>
        nodes
          .map((n) =>
            n.isLabelNode
              ? { ...n, children: pruneDuplicates(n.children) }
              : n
          )
          .filter(
            (n) =>
              n.isLabelNode || !n.userId || !descendantUserIds.has(n.userId)
          );

      const pruned = pruneDuplicates(rootNodes);
      rootNodes.length = 0;
      rootNodes.push(...pruned);
    } else if (OFFICE_GROUPED_ACCESS_LEVELS.has(accessLevel) && !groupByOffice) {
      // Pure lineage view — no office/mgmt grouping
      const allRecruiterIds = new Set(
        recruits.map((r) => r.recruiter_user_id).filter(Boolean) as string[]
      );
      const candidateRoots: TreeNode[] = [];
      allRecruiterIds.forEach((recruiterId) => {
        const node = buildNode(recruiterId);
        if (node && node.children.length > 0) candidateRoots.push(node);
      });
      const allChildUserIds = new Set<string>();
      candidateRoots.forEach((root) => collectChildUserIds(root.children, allChildUserIds));
      candidateRoots.forEach((root) => {
        if (!root.userId || (!allChildUserIds.has(root.userId) && !hasUpstreamRecruiter(root.userId))) {
          rootNodes.push(root);
        }
      });
    } else if (currentAuthUserId) {
      const node = buildNode(currentAuthUserId);
      if (node && node.children.length > 0) {
        rootNodes.push(...node.children);
      }
    }

    return rootNodesPLACEHOLDER_SORT;
  }, [treeData, teamAccess, currentAuthUserId, groupByOffice]);

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
        groupByOffice={groupByOffice}
        onGroupByOfficeChange={setGroupByOffice}
        showGroupByOfficeToggle={OFFICE_GROUPED_ACCESS_LEVELS.has(teamAccess?.accessLevel || '')}
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
