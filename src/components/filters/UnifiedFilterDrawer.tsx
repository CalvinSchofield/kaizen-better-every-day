import { useState, useMemo, useCallback } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Search, Check, Eye, Plus, X, Bookmark,
  ChevronDown, Globe, Building2, Users
} from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { motion, AnimatePresence } from "framer-motion";
import { HierarchyNode, type HierarchyTreeNode } from "./HierarchyNode";
import type { OrgHierarchy, SrMgmtGroupInfo } from "@/hooks/useTeamAccess";
import type { AccessLevel } from "@/utils/roleHierarchy";

// ─── Types ───────────────────────────────────────────────────────────────

export interface FilterNode {
  type: 'office' | 'sr_mgmt_group' | 'mgmt_group' | 'team';
  id: string;
  name: string;
}

export interface UnifiedFilterState {
  scope: 'all' | 'watchlist';
  yearFilters: string[];
  selectedNodes: FilterNode[];
  isOrgWide: boolean;
}

export interface SavedUnifiedFilter {
  id: string;
  name: string;
  state: UnifiedFilterState;
}

export const DEFAULT_UNIFIED_FILTER: UnifiedFilterState = {
  scope: 'all',
  yearFilters: [],
  selectedNodes: [],
  isOrgWide: false,
};

export const isUnifiedFilterActive = (state: UnifiedFilterState): boolean => {
  return state.scope !== 'all' ||
    state.yearFilters.length > 0 ||
    state.selectedNodes.length > 0 ||
    state.isOrgWide;
};

export const getUnifiedFilterSummary = (state: UnifiedFilterState): string | null => {
  const parts: string[] = [];
  if (state.scope === 'watchlist') parts.push('Watchlist');
  if (state.yearFilters.length > 0) parts.push(state.yearFilters.join(', '));
  if (state.isOrgWide) parts.push('Entire Org');
  else if (state.selectedNodes.length > 0) {
    parts.push(state.selectedNodes.map(n => n.name).join(', '));
  }
  return parts.length > 0 ? parts.join(' · ') : null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Resolve which user IDs pass a unified filter */
export const resolveFilteredUserIds = (
  filterState: UnifiedFilterState,
  accessibleReps: Array<{ userId: string | null; teamId?: string | null; mgmtGroupId?: string | null }>,
  mgmtGroups: Array<{ id: string; teamIds: string[] }>,
  allUserIds: string[],
  currentUserId: string | null,
  accessLevel: AccessLevel,
): string[] => {
  let ids: string[];

  if (filterState.selectedNodes.length === 0) {
    ids = [...allUserIds];
  } else {
    const selectedTeamIds = new Set<string>();
    const selectedMgmtGroupIds = new Set<string>();
    const selectedOfficeTeamIds = new Set<string>();
    const selectedOfficeMgmtGroupIds = new Set<string>();

    for (const node of filterState.selectedNodes) {
      if (node.type === 'team') {
        selectedTeamIds.add(node.id);
      } else if (node.type === 'mgmt_group') {
        selectedMgmtGroupIds.add(node.id);
        const group = mgmtGroups.find(g => g.id === node.id);
        if (group) group.teamIds.forEach(tid => selectedTeamIds.add(tid));
      } else if (node.type === 'sr_mgmt_group') {
        // Find all mgmt groups under this sr mgmt group
        const childMgs = mgmtGroups.filter(g => {
          const rep = accessibleReps.find(r => r.mgmtGroupId === g.id);
          return rep !== undefined;
        });
        // Actually just use selectedMgmtGroupIds — will be resolved below
        selectedMgmtGroupIds.add(node.id); // marker
      }
    }

    ids = accessibleReps
      .filter(r => {
        if (!r.userId) return false;
        if (r.teamId && selectedTeamIds.has(r.teamId)) return true;
        if (r.mgmtGroupId && selectedMgmtGroupIds.has(r.mgmtGroupId)) return true;
        return false;
      })
      .map(r => r.userId!)
      .filter((id): id is string => !!id);
  }

  // Include leader only if they belong to the selected scope
  if (currentUserId && accessLevel !== 'none' && !ids.includes(currentUserId)) {
    if (filterState.selectedNodes.length === 0) {
      ids = [currentUserId, ...ids];
    } else {
      const leaderRep = accessibleReps.find(r => r.userId === currentUserId);
      if (leaderRep) {
        const belongsToSelection = filterState.selectedNodes.some(node => {
          if (node.type === 'team') return leaderRep.teamId === node.id;
          if (node.type === 'mgmt_group') {
            const group = mgmtGroups.find(g => g.id === node.id);
            return leaderRep.teamId && (group?.teamIds || []).includes(leaderRep.teamId);
          }
          return false;
        });
        if (belongsToSelection) ids = [currentUserId, ...ids];
      }
    }
  }

  // Apply year filters
  if (filterState.yearFilters.length > 0) {
    const allowedYears = new Set(filterState.yearFilters);
    const repsInYear = new Set(
      (accessibleReps as Array<{ userId: string | null; year?: string | null }>)
        .filter(r => r.userId && allowedYears.has((r as any).year || ''))
        .map(r => r.userId!)
    );
    ids = ids.filter(id => repsInYear.has(id));
  }

  return [...new Set(ids)];
};

// ─── Build hierarchy tree ────────────────────────────────────────────────

const buildHierarchyTree = (
  hierarchy: OrgHierarchy | undefined,
  mgmtGroups: Array<{ id: string; name: string; teamIds: string[] }>,
  teams: Array<{ id: string; name: string }>,
  accessibleReps: Array<{ userId: string | null; teamId?: string | null; mgmtGroupId?: string | null }>,
): HierarchyTreeNode[] => {
  if (!hierarchy) return [];

  const countRepsForTeam = (teamId: string) =>
    accessibleReps.filter(r => r.teamId === teamId && r.userId).length;

  const countRepsForMgmtGroup = (mgmtGroupId: string) => {
    const group = mgmtGroups.find(g => g.id === mgmtGroupId);
    if (!group) return accessibleReps.filter(r => r.mgmtGroupId === mgmtGroupId && r.userId).length;
    return group.teamIds.reduce((sum, tid) => sum + countRepsForTeam(tid), 0) +
      accessibleReps.filter(r => r.mgmtGroupId === mgmtGroupId && !r.teamId && r.userId).length;
  };

  const nodes: HierarchyTreeNode[] = [];

  for (const office of hierarchy.offices) {
    const officeChildren: HierarchyTreeNode[] = [];

    // Sr MGMT Groups
    for (const srMg of office.srMgmtGroups) {
      const srChildren: HierarchyTreeNode[] = [];
      for (const mg of srMg.mgmtGroups) {
        const mgChildren: HierarchyTreeNode[] = mg.teams.map(t => ({
          type: 'team' as const, id: t.id, name: t.name, repCount: countRepsForTeam(t.id), children: [],
        }));
        srChildren.push({
          type: 'mgmt_group', id: mg.id, name: mg.name,
          repCount: countRepsForMgmtGroup(mg.id), children: mgChildren,
        });
      }
      officeChildren.push({
        type: 'sr_mgmt_group', id: srMg.id, name: srMg.name,
        repCount: srChildren.reduce((s, c) => s + c.repCount, 0), children: srChildren,
      });
    }

    // Direct MGMT Groups
    for (const mg of office.mgmtGroups) {
      const mgChildren: HierarchyTreeNode[] = mg.teams.map(t => ({
        type: 'team' as const, id: t.id, name: t.name, repCount: countRepsForTeam(t.id), children: [],
      }));
      officeChildren.push({
        type: 'mgmt_group', id: mg.id, name: mg.name,
        repCount: countRepsForMgmtGroup(mg.id), children: mgChildren,
      });
    }

    // Direct Teams
    for (const t of office.teams) {
      officeChildren.push({
        type: 'team', id: t.id, name: t.name, repCount: countRepsForTeam(t.id), children: [],
      });
    }

    const totalReps = officeChildren.reduce((s, c) => s + c.repCount, 0);
    if (totalReps > 0 || officeChildren.length > 0) {
      nodes.push({
        type: 'office', id: office.id, name: office.name,
        repCount: totalReps, children: officeChildren,
      });
    }
  }

  return nodes;
};

// ─── Component ───────────────────────────────────────────────────────────

interface UnifiedFilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterState: UnifiedFilterState;
  onFilterApply: (state: UnifiedFilterState) => void;
  mode: 'leaderboard' | 'reports';
  hierarchy?: OrgHierarchy;
  mgmtGroups?: Array<{ id: string; name: string; teamIds: string[] }>;
  teams?: Array<{ id: string; name: string }>;
  accessibleReps?: Array<{ userId: string | null; teamId?: string | null; mgmtGroupId?: string | null; year?: string | null }>;
  accessLevel?: AccessLevel;
  repCount?: number;
}

export const UnifiedFilterDrawer = ({
  open,
  onOpenChange,
  filterState,
  onFilterApply,
  mode,
  hierarchy,
  mgmtGroups = [],
  teams = [],
  accessibleReps = [],
  accessLevel = 'none',
  repCount,
}: UnifiedFilterDrawerProps) => {
  const storageKey = `unified-filters-saved:${mode}`;
  const [draft, setDraft] = useState<UnifiedFilterState>(filterState);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const { watchedUserIds } = useWatchlist();
  const [savedFilters, setSavedFilters] = useLocalStorage<SavedUnifiedFilter[]>(storageKey, []);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setDraft(filterState);
      setSearchQuery('');
      setShowSaveInput(false);
    }
    onOpenChange(isOpen);
  };

  const handleApply = () => {
    onFilterApply(draft);
    onOpenChange(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_UNIFIED_FILTER);
  };

  const handleSaveFilter = () => {
    if (!saveName.trim()) return;
    const newFilter: SavedUnifiedFilter = {
      id: crypto.randomUUID(),
      name: saveName.trim(),
      state: { ...draft },
    };
    setSavedFilters([...savedFilters, newFilter]);
    setSaveName('');
    setShowSaveInput(false);
  };

  const handleDeleteSaved = (id: string) => {
    setSavedFilters(savedFilters.filter(f => f.id !== id));
  };

  const handleLoadSaved = (filter: SavedUnifiedFilter) => {
    setDraft(filter.state);
  };

  const toggleYear = (year: string) => {
    setDraft(prev => ({
      ...prev,
      yearFilters: prev.yearFilters.includes(year)
        ? prev.yearFilters.filter(y => y !== year)
        : [...prev.yearFilters, year],
    }));
  };

  const toggleNode = useCallback((node: FilterNode) => {
    setDraft(prev => {
      const exists = prev.selectedNodes.some(n => n.type === node.type && n.id === node.id);
      return {
        ...prev,
        selectedNodes: exists
          ? prev.selectedNodes.filter(n => !(n.type === node.type && n.id === node.id))
          : [...prev.selectedNodes, node],
      };
    });
  }, []);

  const isDraftDirty = JSON.stringify(draft) !== JSON.stringify(DEFAULT_UNIFIED_FILTER);
  const yearOptions = ['Rookie', 'Sophomore', 'Vet'];

  // Build hierarchy tree
  const treeNodes = useMemo(() =>
    buildHierarchyTree(hierarchy, mgmtGroups, teams, accessibleReps),
    [hierarchy, mgmtGroups, teams, accessibleReps]
  );

  // Filter tree by search
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return treeNodes;
    const q = searchQuery.toLowerCase();
    const filterTree = (nodes: HierarchyTreeNode[]): HierarchyTreeNode[] => {
      return nodes.reduce<HierarchyTreeNode[]>((acc, node) => {
        if (node.name.toLowerCase().includes(q)) {
          acc.push(node);
        } else {
          const filteredChildren = filterTree(node.children);
          if (filteredChildren.length > 0) {
            acc.push({ ...node, children: filteredChildren });
          }
        }
        return acc;
      }, []);
    };
    return filterTree(treeNodes);
  }, [treeNodes, searchQuery]);

  // Count total nodes for search display
  const totalNodes = useMemo(() => {
    const count = (nodes: HierarchyTreeNode[]): number =>
      nodes.reduce((s, n) => s + 1 + count(n.children), 0);
    return count(treeNodes);
  }, [treeNodes]);

  // Computed rep count for current draft
  const draftRepCount = useMemo(() => {
    const ids = resolveFilteredUserIds(
      draft, accessibleReps, mgmtGroups,
      accessibleReps.filter(r => r.userId).map(r => r.userId!),
      null, accessLevel || 'none',
    );
    return ids.length;
  }, [draft, accessibleReps, mgmtGroups, accessLevel]);

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg">Filters</DrawerTitle>
            {isDraftDirty && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs text-muted-foreground">
                Reset
              </Button>
            )}
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-4 space-y-5">
          {/* ── Saved Filters ─────────────────────────────── */}
          {savedFilters.length > 0 && (
            <section>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-0.5">
                Saved Filters
              </p>
              <div className="flex flex-wrap gap-2">
                {savedFilters.map((sf) => (
                  <div key={sf.id} className="group relative">
                    <button
                      onClick={() => handleLoadSaved(sf)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        JSON.stringify(draft) === JSON.stringify(sf.state)
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-secondary/40 border-transparent text-secondary-foreground hover:bg-secondary"
                      )}
                    >
                      <Bookmark className="h-3 w-3" />
                      {sf.name}
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(sf.id)}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Quick Filters ─────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
              Quick Filters
            </p>

            {/* Watchlist Toggle */}
            <button
              onClick={() => setDraft(prev => ({
                ...prev,
                scope: prev.scope === 'watchlist' ? 'all' : 'watchlist',
              }))}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
                draft.scope === 'watchlist'
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center",
                  draft.scope === 'watchlist' ? "bg-primary/15" : "bg-muted"
                )}>
                  <Eye className={cn("h-4 w-4", draft.scope === 'watchlist' ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Watchlist Only</p>
                  <p className="text-[11px] text-muted-foreground">{watchedUserIds.length} people watched</p>
                </div>
              </div>
              <Switch checked={draft.scope === 'watchlist'} />
            </button>

            {/* Year Filters */}
            <div className="flex gap-2">
              {yearOptions.map((year) => (
                <button
                  key={year}
                  onClick={() => toggleYear(year)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all",
                    draft.yearFilters.includes(year)
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-secondary/30 border-transparent text-secondary-foreground hover:bg-secondary/60"
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          </section>

          {/* ── Org-Wide Toggle (Leaderboard only) ──────── */}
          {mode === 'leaderboard' && (
            <section>
              <button
                onClick={() => setDraft(prev => ({ ...prev, isOrgWide: !prev.isOrgWide, selectedNodes: [] }))}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
                  draft.isOrgWide
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center",
                    draft.isOrgWide ? "bg-primary/15" : "bg-muted"
                  )}>
                    <Globe className={cn("h-4 w-4", draft.isOrgWide ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Entire Organization</p>
                    <p className="text-[11px] text-muted-foreground">See everyone across all offices</p>
                  </div>
                </div>
                <Switch checked={draft.isOrgWide} />
              </button>
            </section>
          )}

          {/* ── Hierarchy Tree ────────────────────────────── */}
          {filteredNodes.length > 0 && !draft.isOrgWide && (
            <section className="space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
                Organization
              </p>

              {totalNodes > 5 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search teams, groups..."
                    className="pl-9 h-9 rounded-xl bg-secondary/30 border-0"
                  />
                </div>
              )}

              <div className="space-y-1">
                {filteredNodes.map((node) => (
                  <HierarchyNode
                    key={`${node.type}-${node.id}`}
                    node={node}
                    selectedNodes={draft.selectedNodes}
                    onToggle={toggleNode}
                    depth={0}
                    defaultExpanded={filteredNodes.length <= 3}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Save Filter ──────────────────────────────── */}
          {isDraftDirty && (
            <section>
              <AnimatePresence>
                {showSaveInput ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-2">
                      <Input
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder="Filter name..."
                        className="h-9 rounded-xl"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveFilter()}
                        autoFocus
                      />
                      <Button size="sm" onClick={handleSaveFilter} disabled={!saveName.trim()} className="rounded-xl">
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowSaveInput(false)} className="rounded-xl px-2">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setShowSaveInput(true)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Save current filter
                  </motion.button>
                )}
              </AnimatePresence>
            </section>
          )}
        </div>

        {/* ── Apply Button ──────────────────────────────── */}
        <div className="p-4 pt-2 border-t">
          <Button onClick={handleApply} className="w-full rounded-xl h-11 font-semibold">
            Apply Filters
            {draftRepCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {draftRepCount} reps
              </Badge>
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
