import { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, ChevronDown, ChevronRight, Users, User, ArrowRight, Check } from "lucide-react";
import { getCleanName } from "@/utils/nameUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type EntityType = "sr_mgmt_group" | "mgmt_group" | "team" | "rep";

interface DownlineNode {
  id: string;
  name: string;
  type: EntityType;
  children: DownlineNode[];
}

interface AssignToOfficeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The entity being assigned */
  entity: {
    id: string;
    name: string;
    type: EntityType;
  };
  /** Available offices to pick from */
  offices: { id: string; name: string; location?: string | null }[];
  /** Org data needed to build the downline tree */
  orgData: {
    srMgmtGroups: any[];
    mgmtGroups: any[];
    teams: any[];
    teamMgmt: any[];
    reps: any[];
    recruits: any[];
  };
}

type Step = "select_office" | "confirm_tree" | "excluded_prompt";

export const AssignToOfficeDrawer = ({
  open, onOpenChange, entity, offices, orgData,
}: AssignToOfficeDrawerProps) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("select_office");
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const selectedOffice = offices.find(o => o.id === selectedOfficeId);

  // Build the downline tree from the entity
  const downlineTree = useMemo((): DownlineNode | null => {
    if (!orgData) return null;

    const buildTeamNode = (teamId: string): DownlineNode | null => {
      const team = orgData.teams.find((t: any) => t.id === teamId);
      if (!team) return null;
      return { id: team.id, name: team.name, type: "team", children: [] };
    };

    const buildMgmtNode = (mgId: string): DownlineNode | null => {
      const mg = orgData.mgmtGroups.find((m: any) => m.id === mgId);
      if (!mg) return null;
      const teamIds = orgData.teamMgmt
        .filter((tm: any) => tm.mgmt_group_id === mgId)
        .map((tm: any) => tm.team_id);
      const children = teamIds
        .map((tId: string) => buildTeamNode(tId))
        .filter(Boolean) as DownlineNode[];
      return { id: mg.id, name: mg.name, type: "mgmt_group", children };
    };

    const buildSrMgmtNode = (srId: string): DownlineNode | null => {
      const smg = orgData.srMgmtGroups.find((s: any) => s.id === srId);
      if (!smg) return null;
      const children = orgData.mgmtGroups
        .filter((mg: any) => mg.sr_mgmt_group_id === srId)
        .map((mg: any) => buildMgmtNode(mg.id))
        .filter(Boolean) as DownlineNode[];
      return { id: smg.id, name: smg.name, type: "sr_mgmt_group", children };
    };

    switch (entity.type) {
      case "sr_mgmt_group":
        return buildSrMgmtNode(entity.id);
      case "mgmt_group":
        return buildMgmtNode(entity.id);
      case "team":
        return buildTeamNode(entity.id);
      default:
        return { id: entity.id, name: entity.name, type: entity.type, children: [] };
    }
  }, [entity, orgData]);

  // Collect all IDs in the tree (for batch updates)
  const collectIds = useCallback((node: DownlineNode, excluded: Set<string>): {
    srMgmtGroupIds: string[];
    mgmtGroupIds: string[];
    teamIds: string[];
  } => {
    const result = { srMgmtGroupIds: [] as string[], mgmtGroupIds: [] as string[], teamIds: [] as string[] };
    
    if (excluded.has(node.id)) return result;

    if (node.type === "sr_mgmt_group") result.srMgmtGroupIds.push(node.id);
    else if (node.type === "mgmt_group") result.mgmtGroupIds.push(node.id);
    else if (node.type === "team") result.teamIds.push(node.id);

    node.children.forEach(child => {
      const childResult = collectIds(child, excluded);
      result.srMgmtGroupIds.push(...childResult.srMgmtGroupIds);
      result.mgmtGroupIds.push(...childResult.mgmtGroupIds);
      result.teamIds.push(...childResult.teamIds);
    });

    return result;
  }, []);

  // Collect excluded branch IDs
  const excludedBranches = useMemo(() => {
    if (!downlineTree) return [];
    const branches: { id: string; name: string; type: EntityType }[] = [];
    const walk = (node: DownlineNode) => {
      if (excludedIds.has(node.id) && node.id !== downlineTree.id) {
        branches.push({ id: node.id, name: node.name, type: node.type });
        return; // Don't walk excluded children
      }
      node.children.forEach(walk);
    };
    walk(downlineTree);
    return branches;
  }, [downlineTree, excludedIds]);

  const handleToggleExclude = (nodeId: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleConfirmAssign = async () => {
    if (!selectedOfficeId || !downlineTree) return;
    setIsSaving(true);

    try {
      const ids = collectIds(downlineTree, excludedIds);

      // Batch update all included entities
      const updates: Promise<any>[] = [];

      if (ids.srMgmtGroupIds.length > 0) {
        updates.push(
          supabase.from("sr_mgmt_groups")
            .update({ office_id: selectedOfficeId })
            .in("id", ids.srMgmtGroupIds)
            .select()
        );
      }
      if (ids.mgmtGroupIds.length > 0) {
        updates.push(
          supabase.from("mgmt_groups")
            .update({ office_id: selectedOfficeId })
            .in("id", ids.mgmtGroupIds)
            .select()
        );
      }
      if (ids.teamIds.length > 0) {
        updates.push(
          supabase.from("teams")
            .update({ office_id: selectedOfficeId } as any)
            .in("id", ids.teamIds)
            .select()
        );
      }

      await Promise.all(updates);
      
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      toast.success(`Assigned to ${selectedOffice?.name}`);

      // Check if there are excluded branches to prompt about
      if (excludedBranches.length > 0) {
        setStep("excluded_prompt");
      } else {
        handleClose();
      }
    } catch (error) {
      toast.error("Failed to assign to office");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setStep("select_office");
      setSelectedOfficeId(null);
      setExcludedIds(new Set());
    }, 300);
  };

  const handleAssignExcludedToOffice = async (officeId: string) => {
    setIsSaving(true);
    try {
      const updates: Promise<any>[] = [];
      const srIds: string[] = [];
      const mgIds: string[] = [];
      const tIds: string[] = [];

      // Collect all IDs from excluded branches (and their full downlines)
      excludedBranches.forEach(branch => {
        if (!downlineTree) return;
        const findNode = (node: DownlineNode): DownlineNode | null => {
          if (node.id === branch.id) return node;
          for (const c of node.children) {
            const found = findNode(c);
            if (found) return found;
          }
          return null;
        };
        const branchNode = findNode(downlineTree);
        if (branchNode) {
          const branchIds = collectIds(branchNode, new Set());
          srIds.push(...branchIds.srMgmtGroupIds);
          mgIds.push(...branchIds.mgmtGroupIds);
          tIds.push(...branchIds.teamIds);
        }
      });

      if (srIds.length > 0) {
        updates.push(supabase.from("sr_mgmt_groups").update({ office_id: officeId }).in("id", srIds));
      }
      if (mgIds.length > 0) {
        updates.push(supabase.from("mgmt_groups").update({ office_id: officeId }).in("id", mgIds));
      }
      if (tIds.length > 0) {
        updates.push(supabase.from("teams").update({ office_id: officeId } as any).in("id", tIds));
      }

      await Promise.all(updates);
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });

      const office = offices.find(o => o.id === officeId);
      toast.success(`Excluded branches assigned to ${office?.name}`);
      handleClose();
    } catch {
      toast.error("Failed to assign excluded branches");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && handleClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {step === "select_office" && "Assign to Office"}
            {step === "confirm_tree" && `Assign to ${selectedOffice?.name}`}
            {step === "excluded_prompt" && "Excluded Branches"}
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Step 1: Select office */}
          {step === "select_office" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Choose an office for <span className="font-medium text-foreground">{entity.name}</span>
              </p>
              {offices.map(office => (
                <button
                  key={office.id}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                    selectedOfficeId === office.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:bg-accent/30"
                  )}
                  onClick={() => setSelectedOfficeId(office.id)}
                >
                  <Building2 className={cn(
                    "h-5 w-5 shrink-0",
                    selectedOfficeId === office.id ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{office.name}</p>
                    {office.location && (
                      <p className="text-xs text-muted-foreground truncate">{office.location}</p>
                    )}
                  </div>
                  {selectedOfficeId === office.id && (
                    <Check className="h-4 w-4 text-primary ml-auto shrink-0" />
                  )}
                </button>
              ))}
              <Button
                className="w-full mt-3"
                disabled={!selectedOfficeId}
                onClick={() => setStep("confirm_tree")}
              >
                Next
              </Button>
            </div>
          )}

          {/* Step 2: Confirm tree with exclude toggles */}
          {step === "confirm_tree" && downlineTree && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-3 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Assigning to</p>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{selectedOffice?.name}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Included in assignment
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Uncheck branches to exclude them from this office
                </p>
                <TreeCheckNode
                  node={downlineTree}
                  excludedIds={excludedIds}
                  onToggle={handleToggleExclude}
                  isRoot
                  depth={0}
                />
              </div>

              {excludedBranches.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                    {excludedBranches.length} branch{excludedBranches.length !== 1 ? "es" : ""} excluded
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {excludedBranches.map(b => b.name).join(", ")} will keep their current office assignment
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep("select_office")}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handleConfirmAssign} disabled={isSaving}>
                  {isSaving ? "Assigning..." : "Confirm"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Prompt for excluded branches */}
          {step === "excluded_prompt" && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 border border-border/50">
                <p className="text-sm text-muted-foreground">
                  The following branches were excluded from <span className="font-medium text-foreground">{selectedOffice?.name}</span>:
                </p>
                {excludedBranches.map(branch => (
                  <div key={branch.id} className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{branch.name}</span>
                  </div>
                ))}
              </div>

              <p className="text-sm text-muted-foreground">
                Would you like to assign them to a different office?
              </p>

              <div className="space-y-2">
                {offices
                  .filter(o => o.id !== selectedOfficeId)
                  .map(office => (
                    <button
                      key={office.id}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-accent/30 transition-all text-left"
                      onClick={() => handleAssignExcludedToOffice(office.id)}
                      disabled={isSaving}
                    >
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{office.name}</p>
                        {office.location && (
                          <p className="text-xs text-muted-foreground truncate">{office.location}</p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                    </button>
                  ))}
              </div>

              <Button variant="outline" className="w-full" onClick={handleClose}>
                Skip — Assign Later
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

// ==========================================
// TREE NODE WITH CHECKBOX
// ==========================================

const typeIcons: Record<string, any> = {
  sr_mgmt_group: Users,
  mgmt_group: Users,
  team: Users,
  rep: User,
};

interface TreeCheckNodeProps {
  node: DownlineNode;
  excludedIds: Set<string>;
  onToggle: (id: string) => void;
  isRoot?: boolean;
  depth: number;
}

const TreeCheckNode = ({ node, excludedIds, onToggle, isRoot, depth }: TreeCheckNodeProps) => {
  const [expanded, setExpanded] = useState(depth < 4);
  const isExcluded = excludedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const Icon = typeIcons[node.type] || Users;

  // Count descendants
  const descendantCount = useMemo(() => {
    let count = 0;
    const walk = (n: DownlineNode) => {
      n.children.forEach(c => { count++; walk(c); });
    };
    walk(node);
    return count;
  }, [node]);

  return (
    <div className={cn(depth > 0 && "ml-4 border-l border-border pl-3")}>
      <div className={cn(
        "flex items-center gap-2 p-2 rounded-lg transition-colors",
        isExcluded && "opacity-40"
      )}>
        {/* Expand/collapse */}
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="shrink-0">
            {expanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Checkbox (not on root — root is always included) */}
        {!isRoot && (
          <Checkbox
            checked={!isExcluded}
            onCheckedChange={() => onToggle(node.id)}
            className="shrink-0"
          />
        )}

        <Icon className={cn(
          "h-4 w-4 shrink-0",
          node.type === "sr_mgmt_group" ? "text-orange-500" :
          node.type === "mgmt_group" ? "text-blue-500" :
          node.type === "team" ? "text-green-500" :
          "text-muted-foreground"
        )} />

        <span className={cn(
          "text-sm font-medium truncate",
          isExcluded && "line-through"
        )}>
          {node.name}
        </span>

        {descendantCount > 0 && (
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {descendantCount}
          </span>
        )}
      </div>

      {/* Children — hidden when parent is excluded */}
      {expanded && hasChildren && !isExcluded && (
        <div className="space-y-0.5">
          {node.children.map(child => (
            <TreeCheckNode
              key={child.id}
              node={child}
              excludedIds={excludedIds}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
