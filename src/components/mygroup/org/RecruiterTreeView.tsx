import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, User, Users, Pencil } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { getCleanName, getInitials } from "@/utils/nameUtils";
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

interface TreeNode {
  id: string;
  name: string;
  userId: string | null;
  stage: string | null;
  profilePhotoUrl?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  recruiterUserId?: string | null;
  recruiterName?: string;
  phone?: string | null;
  email?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  children: TreeNode[];
}

interface RecruiterTreeViewProps {
  searchQuery: string;
  onEditRep?: (rep: OrgRep) => void;
}

export const RecruiterTreeView = ({ searchQuery, onEditRep }: RecruiterTreeViewProps) => {
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);

  // Get actual authenticated user ID (not from accessibleUserIds which excludes self)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentAuthUserId(data.user?.id || null);
    });
  }, []);

  // Fetch recruits and reps data
  const { data: treeData, isLoading } = useQuery({
    queryKey: ["recruiter-tree-data"],
    queryFn: async () => {
      const [recruitsRes, repsRes, teamsRes] = await Promise.all([
        supabase.from("recruits").select("id, name, recruiter_user_id, stage, team_id, phone, email, created_at, updated_at"),
        supabase.from("reps").select("user_id, name, profile_photo_url"),
        supabase.from("teams").select("id, name"),
      ]);

      return {
        recruits: recruitsRes.data || [],
        reps: repsRes.data || [],
        teams: teamsRes.data || [],
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  // Build tree structure
  const tree = useMemo(() => {
    if (!treeData || !teamAccess || !currentAuthUserId) return null;

    const recruits = treeData.recruits || [];
    const reps = treeData.reps || [];
    const teams = treeData.teams || [];
    
    // Create maps for lookups
    const repMap = new Map(reps.map((r) => [r.user_id, r]));
    const teamMap = new Map(teams.map((t) => [t.id, t.name]));
    const recruitByName = new Map(recruits.map((r) => [getCleanName(r.name).toLowerCase(), r]));
    
    // Create a map of user_id -> their recruits
    const recruitsByRecruiter = new Map<string, typeof recruits>();
    recruits.forEach((r) => {
      if (r.recruiter_user_id) {
        const existing = recruitsByRecruiter.get(r.recruiter_user_id) || [];
        existing.push(r);
        recruitsByRecruiter.set(r.recruiter_user_id, existing);
      }
    });

    // Use the actual authenticated user ID (accessibleUserIds excludes self for leaders)
    const currentUserId = currentAuthUserId;
    
    // Get all recruiter IDs that appear in the data
    const allRecruiterIds = new Set(recruits.map(r => r.recruiter_user_id).filter(Boolean) as string[]);
    
    // Find who recruits them (to find top-level)
    const recruiterUserIdSet = new Set<string>();
    recruits.forEach(r => {
      if (r.recruiter_user_id) recruiterUserIdSet.add(r.recruiter_user_id);
    });

    // Recursive function to build tree node
    const buildNode = (userId: string, visited = new Set<string>()): TreeNode | null => {
      if (visited.has(userId)) return null; // Prevent cycles
      visited.add(userId);

      const rep = repMap.get(userId);
      const recruiterRecruits = recruitsByRecruiter.get(userId) || [];
      
      // Find this user's recruit record for additional data
      const repName = rep?.name || "";
      const recruitRecord = recruitByName.get(getCleanName(repName).toLowerCase());
      
      // Get children nodes
      const children: TreeNode[] = recruiterRecruits
        .filter(r => {
          // Check if this recruit has a rep record (meaning they have a user account)
          const recruitRep = reps.find(rep => 
            getCleanName(rep.name).toLowerCase() === getCleanName(r.name).toLowerCase()
          );
          return recruitRep?.user_id;
        })
        .map(r => {
          const recruitRep = reps.find(rep => 
            getCleanName(rep.name).toLowerCase() === getCleanName(r.name).toLowerCase()
          );
          if (recruitRep?.user_id) {
            return buildNode(recruitRep.user_id, new Set(visited));
          }
          return null;
        })
        .filter((n): n is TreeNode => n !== null);

      // Add recruits who don't have rep accounts (leaf nodes)
      const leafRecruits: TreeNode[] = recruiterRecruits
        .filter(r => {
          const recruitRep = reps.find(rep => 
            getCleanName(rep.name).toLowerCase() === getCleanName(r.name).toLowerCase()
          );
          return !recruitRep?.user_id;
        })
        .map(r => ({
          id: r.id,
          name: r.name,
          userId: null,
          stage: r.stage,
          profilePhotoUrl: null,
          teamId: r.team_id,
          teamName: r.team_id ? teamMap.get(r.team_id) || null : null,
          recruiterUserId: r.recruiter_user_id,
          recruiterName: r.recruiter_user_id ? repMap.get(r.recruiter_user_id)?.name : undefined,
          phone: r.phone,
          email: r.email,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          children: [],
        }));

      return {
        id: recruitRecord?.id || userId,
        name: rep?.name || "Unknown",
        userId,
        stage: recruitRecord?.stage || null,
        profilePhotoUrl: rep?.profile_photo_url,
        teamId: recruitRecord?.team_id || null,
        teamName: recruitRecord?.team_id ? teamMap.get(recruitRecord.team_id) || null : null,
        recruiterUserId: recruitRecord?.recruiter_user_id || null,
        recruiterName: recruitRecord?.recruiter_user_id ? repMap.get(recruitRecord.recruiter_user_id)?.name : undefined,
        phone: recruitRecord?.phone || null,
        email: recruitRecord?.email || null,
        createdAt: recruitRecord?.created_at || null,
        updatedAt: recruitRecord?.updated_at || null,
        children: [...children, ...leafRecruits].sort((a, b) => 
          b.children.length - a.children.length // Sort by number of recruits
        ),
      };
    };

    // Find top-level recruiters (those who recruit others but aren't recruited by anyone with data)
    // Start from accessible user IDs based on access level
    const rootNodes: TreeNode[] = [];
    
    if (teamAccess.accessLevel === "area_director") {
      // For AD, find all top-level recruiters
      const recruitedUserIds = new Set<string>();
      recruits.forEach(r => {
        const recruitRep = reps.find(rep => 
          getCleanName(rep.name).toLowerCase() === getCleanName(r.name).toLowerCase()
        );
        if (recruitRep?.user_id && r.recruiter_user_id) {
          recruitedUserIds.add(recruitRep.user_id);
        }
      });

      // Top-level = recruiters who aren't recruited by anyone
      allRecruiterIds.forEach(recruiterId => {
        if (!recruitedUserIds.has(recruiterId)) {
          const node = buildNode(recruiterId);
          if (node && node.children.length > 0) {
            rootNodes.push(node);
          }
        }
      });
    } else if (currentUserId) {
      // For other users (team leads, mgmt leads), show their downline only - NOT themselves
      const node = buildNode(currentUserId);
      if (node && node.children.length > 0) {
        // Push children as root nodes so the leader doesn't see themselves
        rootNodes.push(...node.children);
      }
    }

    return rootNodes.sort((a, b) => b.children.length - a.children.length);
  }, [treeData, teamAccess, currentAuthUserId]);

  // Filter nodes based on search
  const filteredTree = useMemo(() => {
    if (!tree || !searchQuery.trim()) return tree;
    
    const query = searchQuery.toLowerCase().trim();
    
    const filterNode = (node: TreeNode): TreeNode | null => {
      const nameMatches = getCleanName(node.name).toLowerCase().includes(query);
      const filteredChildren = node.children
        .map(child => filterNode(child))
        .filter((n): n is TreeNode => n !== null);
      
      if (nameMatches || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };

    return tree
      .map(node => filterNode(node))
      .filter((n): n is TreeNode => n !== null);
  }, [tree, searchQuery]);

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Auto-expand when searching
  const displayExpandedNodes = searchQuery.trim() 
    ? new Set(getAllNodeIds(filteredTree || [])) 
    : expandedNodes;

  if (accessLoading || isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
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
      {filteredTree.map((node) => (
        <TreeNodeCard
          key={node.id}
          node={node}
          level={0}
          expandedNodes={displayExpandedNodes}
          onToggle={toggleNode}
          onEdit={onEditRep}
        />
      ))}
    </div>
  );
};

// Helper to get all node IDs for auto-expand
function getAllNodeIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  const traverse = (node: TreeNode) => {
    ids.push(node.id);
    node.children.forEach(traverse);
  };
  nodes.forEach(traverse);
  return ids;
}

// Recursive tree node component
interface TreeNodeCardProps {
  node: TreeNode;
  level: number;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  onEdit?: (rep: OrgRep) => void;
}

const TreeNodeCard = ({ node, level, expandedNodes, onToggle, onEdit }: TreeNodeCardProps) => {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children.length > 0;
  const cleanName = getCleanName(node.name);
  const initials = getInitials(cleanName);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit({
        id: node.id,
        userId: node.userId,
        name: node.name,
        teamId: node.teamId || null,
        teamName: node.teamName || null,
        recruiterUserId: node.recruiterUserId || null,
        recruiterName: node.recruiterName,
        stage: node.stage,
        notionPageId: node.id,
        phone: node.phone || null,
        email: node.email || null,
        createdAt: node.createdAt || null,
        updatedAt: node.updatedAt || null,
      });
    }
  };

  const getStageBadge = (stage: string | null) => {
    if (!stage) return null;
    const stageLower = stage.toLowerCase();
    
    if (stageLower.includes("sold 5+")) {
      return <Badge className="text-xs bg-purple-500/20 text-purple-600 border-purple-300">Sold 5+</Badge>;
    }
    if (stageLower.includes("sold")) {
      return <Badge className="text-xs bg-green-500/20 text-green-600 border-green-300">Sold</Badge>;
    }
    if (stageLower.includes("shadow")) {
      return <Badge className="text-xs bg-blue-500/20 text-blue-600 border-blue-300">Shadow</Badge>;
    }
    if (stageLower.includes("signed")) {
      return <Badge className="text-xs bg-amber-500/20 text-amber-600 border-amber-300">Signed</Badge>;
    }
    if (stageLower.includes("evaluating")) {
      return <Badge className="text-xs bg-slate-500/20 text-slate-600 border-slate-300">Evaluating</Badge>;
    }
    return null;
  };

  return (
    <div className={cn("relative", level > 0 && "ml-6")}>
      {/* Connecting line */}
      {level > 0 && (
        <div className="absolute left-[-16px] top-0 bottom-0 w-px bg-border" />
      )}
      {level > 0 && (
        <div className="absolute left-[-16px] top-6 w-4 h-px bg-border" />
      )}

      <Collapsible open={isExpanded && hasChildren} onOpenChange={() => hasChildren && onToggle(node.id)}>
        <div className="border rounded-lg bg-card overflow-hidden">
          <div 
            className={cn(
              "flex items-center justify-between p-3",
              (hasChildren || onEdit) && "cursor-pointer hover:bg-muted/50"
            )}
            onClick={hasChildren ? () => onToggle(node.id) : handleEdit}
          >
            <div className="flex items-center gap-3">
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )
              ) : (
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={node.profilePhotoUrl || undefined} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{cleanName}</span>
                {node.stage && (
                  <span className="text-xs text-muted-foreground">{node.stage}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {getStageBadge(node.stage)}
              {hasChildren && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {node.children.length}
                </Badge>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleEdit}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {hasChildren && (
            <CollapsibleContent>
              <div className="border-t px-3 pb-3 pt-2 space-y-2">
                {node.children.map((child) => (
                  <TreeNodeCard
                    key={child.id}
                    node={child}
                    level={level + 1}
                    expandedNodes={expandedNodes}
                    onToggle={onToggle}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            </CollapsibleContent>
          )}
        </div>
      </Collapsible>
    </div>
  );
};
