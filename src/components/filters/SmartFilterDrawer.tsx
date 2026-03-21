import { useState, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { 
  Search, Check, Users, ChevronRight, Bookmark, 
  Plus, X, Eye, Star, Trash2
} from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────

export interface SmartFilterState {
  scope: 'all' | 'watchlist';
  yearFilters: string[]; // e.g. ['Rookie', 'Sophomore']
  teamFilter: 'all' | { type: 'mgmt_group' | 'team'; id: string; name: string };
}

export interface SavedFilter {
  id: string;
  name: string;
  state: SmartFilterState;
}

interface Team {
  id: string;
  name: string;
}

interface MgmtGroup {
  id: string;
  name: string;
  teamIds: string[];
}

interface SmartFilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterState: SmartFilterState;
  onFilterApply: (state: SmartFilterState) => void;
  teams?: Team[];
  mgmtGroups?: MgmtGroup[];
  accessLevel?: import("@/utils/roleHierarchy").AccessLevel;
  repCount?: number;
  showYearFilters?: boolean;
  showTeamFilters?: boolean;
}

export const DEFAULT_FILTER_STATE: SmartFilterState = {
  scope: 'all',
  yearFilters: [],
  teamFilter: 'all',
};

export const isFilterActive = (state: SmartFilterState): boolean => {
  return state.scope !== 'all' || 
    state.yearFilters.length > 0 || 
    state.teamFilter !== 'all';
};

export const getFilterSummary = (state: SmartFilterState): string | null => {
  const parts: string[] = [];
  if (state.scope === 'watchlist') parts.push('Watchlist');
  if (state.yearFilters.length > 0) parts.push(state.yearFilters.join(', '));
  if (state.teamFilter !== 'all') parts.push(state.teamFilter.name);
  return parts.length > 0 ? parts.join(' · ') : null;
};

// ─── Component ───────────────────────────────────────────────────────────

export const SmartFilterDrawer = ({
  open,
  onOpenChange,
  filterState,
  onFilterApply,
  teams = [],
  mgmtGroups = [],
  accessLevel = 'none',
  repCount,
  showYearFilters = true,
  showTeamFilters = true,
}: SmartFilterDrawerProps) => {
  const [draft, setDraft] = useState<SmartFilterState>(filterState);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const { watchedUserIds } = useWatchlist();
  const [savedFilters, setSavedFilters] = useLocalStorage<SavedFilter[]>('smart-filters-saved', []);

  // Sync draft when opened
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
    setDraft(DEFAULT_FILTER_STATE);
  };

  const handleSaveFilter = () => {
    if (!saveName.trim()) return;
    const newFilter: SavedFilter = {
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

  const handleLoadSaved = (filter: SavedFilter) => {
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

  const isDraftDirty = JSON.stringify(draft) !== JSON.stringify(DEFAULT_FILTER_STATE);
  const hasTeamAccess = accessLevel === 'area_director' || accessLevel === 'corporate' || accessLevel === 'mgmt_group_lead';

  const yearOptions = ['Rookie', 'Sophomore', 'Vet'];

  // Filter teams by search
  const filteredTeams = useMemo(() => {
    if (!searchQuery) return teams;
    const q = searchQuery.toLowerCase();
    return teams.filter(t => t.name.toLowerCase().includes(q));
  }, [teams, searchQuery]);

  const filteredMgmtGroups = useMemo(() => {
    if (!searchQuery) return mgmtGroups;
    const q = searchQuery.toLowerCase();
    return mgmtGroups.filter(g => g.name.toLowerCase().includes(q));
  }, [mgmtGroups, searchQuery]);

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
            {showYearFilters && (
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
            )}
          </section>

          {/* ── Team Hierarchy ────────────────────────────── */}
          {showTeamFilters && hasTeamAccess && (teams.length > 0 || mgmtGroups.length > 0) && (
            <section className="space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
                Teams
              </p>

              {/* Search */}
              {(teams.length + mgmtGroups.length) > 5 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search teams..."
                    className="pl-9 h-9 rounded-xl bg-secondary/30 border-0"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                {/* All */}
                <TeamRow
                  label="All Teams"
                  icon={<Users className="h-4 w-4" />}
                  isSelected={draft.teamFilter === 'all'}
                  badge={repCount !== undefined ? `${repCount}` : undefined}
                  onClick={() => setDraft(prev => ({ ...prev, teamFilter: 'all' }))}
                />

                {/* MGMT Groups */}
                {accessLevel === 'area_director' || accessLevel === 'corporate' && filteredMgmtGroups.map((group) => {
                  const isSelected = draft.teamFilter !== 'all' && 
                    draft.teamFilter.type === 'mgmt_group' && 
                    draft.teamFilter.id === group.id;
                  return (
                    <TeamRow
                      key={group.id}
                      label={group.name}
                      isSelected={isSelected}
                      badge={`${group.teamIds.length} teams`}
                      onClick={() => setDraft(prev => ({
                        ...prev,
                        teamFilter: { type: 'mgmt_group', id: group.id, name: group.name },
                      }))}
                    />
                  );
                })}

                {/* Teams */}
                {filteredTeams.map((team) => {
                  const isSelected = draft.teamFilter !== 'all' &&
                    draft.teamFilter.type === 'team' &&
                    draft.teamFilter.id === team.id;
                  return (
                    <TeamRow
                      key={team.id}
                      label={team.name}
                      isSelected={isSelected}
                      onClick={() => setDraft(prev => ({
                        ...prev,
                        teamFilter: { type: 'team', id: team.id, name: team.name },
                      }))}
                      indented={accessLevel === 'area_director' || accessLevel === 'corporate'}
                    />
                  );
                })}
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
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

// ─── TeamRow sub-component ───────────────────────────────────────────────

const TeamRow = ({
  label,
  icon,
  isSelected,
  badge,
  onClick,
  indented,
}: {
  label: string;
  icon?: React.ReactNode;
  isSelected: boolean;
  badge?: string;
  onClick: () => void;
  indented?: boolean;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center justify-between p-2.5 rounded-xl transition-all",
      indented && "ml-4",
      isSelected
        ? "bg-primary/8 ring-1 ring-primary/30"
        : "hover:bg-muted/40"
    )}
  >
    <div className="flex items-center gap-2.5">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className={cn("text-sm", isSelected ? "font-semibold text-primary" : "font-medium")}>{label}</span>
    </div>
    <div className="flex items-center gap-2">
      {badge && (
        <span className="text-[11px] text-muted-foreground">{badge}</span>
      )}
      {isSelected && <Check className="h-4 w-4 text-primary" />}
    </div>
  </button>
);
