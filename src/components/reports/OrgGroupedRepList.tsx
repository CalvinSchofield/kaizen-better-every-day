import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Search, Users, Star, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/utils/nameUtils";
import { AccessLevel, hasMinAccess } from "@/utils/roleHierarchy";

export interface OrgRepData {
  userId: string;
  name: string;
  year?: string;
  teamId?: string | null;
  teamName?: string | null;
  mgmtGroupId?: string | null;
  mgmtGroupName?: string | null;
  recruiterName?: string | null;
  fp: number;
  prmr: number;
  doors: number;
  presentations: number;
  transitions: number;
  pitches: number;
  hoursWorked?: number;
  daysWorked?: number;
  isWorking?: boolean;
  /** Performance category: outstanding | attention */
  perfCategory?: 'outstanding' | 'attention' | null;
}

interface OrgGroupedRepListProps {
  reps: OrgRepData[];
  accessLevel: AccessLevel;
  isLoading?: boolean;
  onRepClick?: (userId: string) => void;
  emptyMessage?: string;
}

// ── helpers ──────────────────────────────────────────────────────

const getFirstName = (name: string) => {
  const stripped = name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();
  return stripped.split(' ')[0] || stripped;
};

const statLine = (rep: OrgRepData) => {
  if (rep.fp > 0) return `${rep.fp.toFixed(1)} FP+`;
  if (rep.presentations > 0) return `${rep.presentations} pres`;
  if (rep.doors > 0) return `${rep.doors} doors`;
  return '—';
};

// ── tiny sub-components ──────────────────────────────────────────

const PerfIndicator = ({ cat }: { cat?: 'outstanding' | 'attention' | null }) => {
  if (!cat) return null;
  if (cat === 'outstanding') return <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />;
  return <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />;
};

const RepRow = ({ rep, onClick }: { rep: OrgRepData; onClick?: () => void }) => (
  <div
    className={cn(
      "flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 cursor-pointer",
      "hover:bg-muted/50 active:scale-[0.98] transition-all"
    )}
    onClick={onClick}
  >
    <Avatar className="h-8 w-8">
      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
        {getInitials(rep.name)}
      </AvatarFallback>
    </Avatar>

    <div className="flex-1 min-w-0 flex items-center gap-1.5">
      <PerfIndicator cat={rep.perfCategory} />
      <span className="font-medium truncate text-sm">{getFirstName(rep.name)}</span>
      {rep.year && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
          {rep.year}
        </Badge>
      )}
      {rep.isWorking && (
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
      )}
    </div>

    <span className={cn(
      "text-sm font-semibold whitespace-nowrap",
      rep.fp > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
    )}>
      {statLine(rep)}
    </span>

    <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
  </div>
);

// ── group header ────────────────────────────────────────────────

interface GroupHeaderProps {
  label: string;
  repCount: number;
  totalFP: number;
  workingCount: number;
  isLive: boolean;
  isExpanded: boolean;
  depth: number; // 0 = mgmt group, 1 = team, 2 = recruiter group
}

const GroupHeader = ({ label, repCount, totalFP, workingCount, isLive, isExpanded, depth }: GroupHeaderProps) => (
  <div className={cn(
    "flex items-center justify-between p-2.5 rounded-lg",
    "bg-muted/50 hover:bg-muted/70 transition-colors",
    depth === 0 && "bg-muted/60"
  )}>
    <div className="flex items-center gap-2 min-w-0">
      {isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
      {depth === 0 && <Users className="w-4 h-4 text-muted-foreground shrink-0" />}
      <span className={cn("font-medium truncate", depth === 0 ? "text-sm" : "text-sm")}>{label}</span>
      <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">{repCount}</Badge>
      {workingCount > 0 && isLive && (
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-green-600">{workingCount}</span>
        </div>
      )}
    </div>
    {totalFP > 0 && (
      <span className="font-semibold text-green-600 dark:text-green-400 text-sm shrink-0">
        {totalFP.toFixed(1)} FP+
      </span>
    )}
  </div>
);

// ── recruiter sub-grouping helper ───────────────────────────────

type RecruiterBucket = { name: string; reps: OrgRepData[] };

const groupByRecruiter = (reps: OrgRepData[]): { groups: RecruiterBucket[]; solo: OrgRepData[] } => {
  const recruiterMap = new Map<string, OrgRepData[]>();
  const noRecruiter: OrgRepData[] = [];
  
  reps.forEach(rep => {
    const rName = rep.recruiterName?.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();
    if (rName) {
      if (!recruiterMap.has(rName)) recruiterMap.set(rName, []);
      recruiterMap.get(rName)!.push(rep);
    } else {
      noRecruiter.push(rep);
    }
  });
  
  // Only create recruiter groups if there are 2+ reps under that recruiter
  // Otherwise fold them into the solo list
  const groups: RecruiterBucket[] = [];
  const solo = [...noRecruiter];
  
  recruiterMap.forEach((members, name) => {
    if (members.length >= 2) {
      groups.push({ name, reps: members });
    } else {
      solo.push(...members);
    }
  });
  
  // Sort groups by FP desc
  groups.sort((a, b) => {
    const aFP = a.reps.reduce((s, r) => s + r.fp, 0);
    const bFP = b.reps.reduce((s, r) => s + r.fp, 0);
    return bFP - aFP;
  });
  
  return { groups, solo };
};

// ── main component ──────────────────────────────────────────────

export const OrgGroupedRepList = ({
  reps,
  accessLevel,
  isLoading,
  onRepClick,
  emptyMessage = "No activity data",
}: OrgGroupedRepListProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Determine grouping depth based on access level
  // team_lead or below → no org grouping (flat list)
  // mgmt_group_lead / manager → group by Team
  // senior_manager+ / area_director → MGMT Group > Team
  const showMgmtGrouping = hasMinAccess(accessLevel, 'senior_manager') || accessLevel === 'area_director';
  const showTeamGrouping = hasMinAccess(accessLevel, 'mgmt_group_lead') || accessLevel === 'manager' || showMgmtGrouping;

  const filteredReps = useMemo(() => {
    if (!searchQuery.trim()) return reps;
    const q = searchQuery.toLowerCase();
    return reps.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.teamName?.toLowerCase().includes(q) ||
      r.mgmtGroupName?.toLowerCase().includes(q)
    );
  }, [reps, searchQuery]);

  // Sort reps within a group: working first → FP desc → presentations → doors
  const sortReps = (list: OrgRepData[]) =>
    [...list].sort((a, b) => {
      if ((a.isWorking ? 1 : 0) !== (b.isWorking ? 1 : 0)) return a.isWorking ? -1 : 1;
      if (a.fp !== b.fp) return b.fp - a.fp;
      if (a.presentations !== b.presentations) return b.presentations - a.presentations;
      return b.doors - a.doors;
    });

  // Build nested structure: MGMT Group → Team → Reps
  const tree = useMemo(() => {
    if (!showTeamGrouping) {
      // Flat list for team leads
      return null;
    }

    type TeamBucket = { id: string; name: string; reps: OrgRepData[] };
    type MgmtBucket = { id: string; name: string; teams: Map<string, TeamBucket>; ungrouped: OrgRepData[] };

    const mgmtMap = new Map<string, MgmtBucket>();
    const ungroupedReps: OrgRepData[] = [];

    filteredReps.forEach(rep => {
      const mgmtKey = rep.mgmtGroupId || '__none__';
      const mgmtName = rep.mgmtGroupName || 'Ungrouped';
      const teamKey = rep.teamId || '__no_team__';
      const teamName = rep.teamName || 'No Team';

      if (!showMgmtGrouping) {
        // Only team grouping
        if (!mgmtMap.has('__flat__')) {
          mgmtMap.set('__flat__', { id: '__flat__', name: '', teams: new Map(), ungrouped: [] });
        }
        const flat = mgmtMap.get('__flat__')!;
        if (rep.teamId) {
          if (!flat.teams.has(teamKey)) {
            flat.teams.set(teamKey, { id: teamKey, name: teamName, reps: [] });
          }
          flat.teams.get(teamKey)!.reps.push(rep);
        } else {
          flat.ungrouped.push(rep);
        }
        return;
      }

      // Full MGMT > Team grouping
      if (rep.mgmtGroupId) {
        if (!mgmtMap.has(mgmtKey)) {
          mgmtMap.set(mgmtKey, { id: mgmtKey, name: mgmtName, teams: new Map(), ungrouped: [] });
        }
        const bucket = mgmtMap.get(mgmtKey)!;
        if (rep.teamId) {
          if (!bucket.teams.has(teamKey)) {
            bucket.teams.set(teamKey, { id: teamKey, name: teamName, reps: [] });
          }
          bucket.teams.get(teamKey)!.reps.push(rep);
        } else {
          bucket.ungrouped.push(rep);
        }
      } else {
        ungroupedReps.push(rep);
      }
    });

    return { mgmtMap, ungroupedReps };
  }, [filteredReps, showTeamGrouping, showMgmtGrouping]);

  const isLive = reps.some(r => r.isWorking);

  // Auto-expand when searching or only one group
  const effectiveExpanded = useMemo(() => {
    if (searchQuery.trim()) {
      const all = new Set<string>();
      tree?.mgmtMap.forEach((mgmt, mgmtKey) => {
        all.add(mgmtKey);
        mgmt.teams.forEach((_, tKey) => all.add(`${mgmtKey}:${tKey}`));
      });
      return all;
    }
    if (tree && tree.mgmtMap.size === 1) {
      const all = new Set<string>();
      tree.mgmtMap.forEach((mgmt, mgmtKey) => {
        all.add(mgmtKey);
        mgmt.teams.forEach((_, tKey) => all.add(`${mgmtKey}:${tKey}`));
      });
      return all;
    }
    return expandedGroups;
  }, [searchQuery, tree, expandedGroups]);

  const toggle = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-muted/40 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // ─── Flat list for team leads ───
  if (!showTeamGrouping || !tree) {
    const sorted = sortReps(filteredReps);
    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search reps..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="text-xs text-muted-foreground px-1">{sorted.length} reps</div>
        <div className="space-y-1.5">
          {sorted.map(rep => (
            <RepRow key={rep.userId} rep={rep} onClick={() => onRepClick?.(rep.userId)} />
          ))}
        </div>
        {sorted.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>{searchQuery ? 'No reps match your search' : emptyMessage}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── MGMT Group lead: team grouping only ───
  if (!showMgmtGrouping) {
    const flat = tree.mgmtMap.get('__flat__');
    const teams = flat ? Array.from(flat.teams.values()) : [];
    const ungrouped = flat?.ungrouped || [];

    // Sort teams by FP desc
    teams.sort((a, b) => {
      const aFP = a.reps.reduce((s, r) => s + r.fp, 0);
      const bFP = b.reps.reduce((s, r) => s + r.fp, 0);
      return bFP - aFP;
    });

    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search reps..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="text-xs text-muted-foreground px-1">{filteredReps.length} reps</div>
        <div className="space-y-2">
          {teams.map(team => {
            const tKey = `__flat__:${team.id}`;
            const isExp = effectiveExpanded.has(tKey);
            const sorted = sortReps(team.reps);
            const totalFP = team.reps.reduce((s, r) => s + r.fp, 0);
            const wc = team.reps.filter(r => r.isWorking).length;

            return (
              <Collapsible key={tKey} open={isExp} onOpenChange={() => toggle(tKey)}>
                <CollapsibleTrigger className="w-full">
                  <GroupHeader label={team.name} repCount={team.reps.length} totalFP={totalFP} workingCount={wc} isLive={isLive} isExpanded={isExp} depth={1} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1.5 mt-1.5 ml-4">
                    {sorted.map(rep => <RepRow key={rep.userId} rep={rep} onClick={() => onRepClick?.(rep.userId)} />)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
          {ungrouped.length > 0 && (
            <Collapsible open={effectiveExpanded.has('__flat__:__no_team__')} onOpenChange={() => toggle('__flat__:__no_team__')}>
              <CollapsibleTrigger className="w-full">
                <GroupHeader label="Ungrouped" repCount={ungrouped.length} totalFP={ungrouped.reduce((s, r) => s + r.fp, 0)} workingCount={ungrouped.filter(r => r.isWorking).length} isLive={isLive} isExpanded={effectiveExpanded.has('__flat__:__no_team__')} depth={1} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1.5 mt-1.5 ml-4">
                  {sortReps(ungrouped).map(rep => <RepRow key={rep.userId} rep={rep} onClick={() => onRepClick?.(rep.userId)} />)}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
        {filteredReps.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>{searchQuery ? 'No reps match your search' : emptyMessage}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Sr Manager+ / AD: MGMT Group > Team ───
  const mgmtGroups = Array.from(tree.mgmtMap.entries())
    .map(([key, mgmt]) => ({
      key,
      ...mgmt,
      totalFP: [...mgmt.teams.values()].reduce((s, t) => s + t.reps.reduce((s2, r) => s2 + r.fp, 0), 0) + mgmt.ungrouped.reduce((s, r) => s + r.fp, 0),
      totalReps: [...mgmt.teams.values()].reduce((s, t) => s + t.reps.length, 0) + mgmt.ungrouped.length,
      workingCount: [...mgmt.teams.values()].reduce((s, t) => s + t.reps.filter(r => r.isWorking).length, 0) + mgmt.ungrouped.filter(r => r.isWorking).length,
    }))
    .sort((a, b) => b.totalFP - a.totalFP);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search reps..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
      </div>
      <div className="text-xs text-muted-foreground px-1">{filteredReps.length} reps</div>
      <div className="space-y-2">
        {mgmtGroups.map(mgmt => {
          const mgmtExp = effectiveExpanded.has(mgmt.key);
          const teams = Array.from(mgmt.teams.values()).sort((a, b) => {
            const aFP = a.reps.reduce((s, r) => s + r.fp, 0);
            const bFP = b.reps.reduce((s, r) => s + r.fp, 0);
            return bFP - aFP;
          });

          return (
            <Collapsible key={mgmt.key} open={mgmtExp} onOpenChange={() => toggle(mgmt.key)}>
              <CollapsibleTrigger className="w-full">
                <GroupHeader label={mgmt.name} repCount={mgmt.totalReps} totalFP={mgmt.totalFP} workingCount={mgmt.workingCount} isLive={isLive} isExpanded={mgmtExp} depth={0} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1.5 mt-1.5 ml-3">
                  {teams.map(team => {
                    const tKey = `${mgmt.key}:${team.id}`;
                    const tExp = effectiveExpanded.has(tKey);
                    const teamFP = team.reps.reduce((s, r) => s + r.fp, 0);
                    const teamWC = team.reps.filter(r => r.isWorking).length;

                    return (
                      <Collapsible key={tKey} open={tExp} onOpenChange={() => toggle(tKey)}>
                        <CollapsibleTrigger className="w-full">
                          <GroupHeader label={team.name} repCount={team.reps.length} totalFP={teamFP} workingCount={teamWC} isLive={isLive} isExpanded={tExp} depth={1} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="space-y-1.5 mt-1.5 ml-4">
                            {sortReps(team.reps).map(rep => <RepRow key={rep.userId} rep={rep} onClick={() => onRepClick?.(rep.userId)} />)}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                  {mgmt.ungrouped.length > 0 && (
                    <div className="space-y-1.5 ml-4">
                      {sortReps(mgmt.ungrouped).map(rep => <RepRow key={rep.userId} rep={rep} onClick={() => onRepClick?.(rep.userId)} />)}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {/* Ungrouped reps (no mgmt group) */}
        {tree.ungroupedReps.length > 0 && (
          <Collapsible open={effectiveExpanded.has('__ungrouped__')} onOpenChange={() => toggle('__ungrouped__')}>
            <CollapsibleTrigger className="w-full">
              <GroupHeader label="Ungrouped" repCount={tree.ungroupedReps.length} totalFP={tree.ungroupedReps.reduce((s, r) => s + r.fp, 0)} workingCount={tree.ungroupedReps.filter(r => r.isWorking).length} isLive={isLive} isExpanded={effectiveExpanded.has('__ungrouped__')} depth={0} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1.5 mt-1.5 ml-4">
                {sortReps(tree.ungroupedReps).map(rep => <RepRow key={rep.userId} rep={rep} onClick={() => onRepClick?.(rep.userId)} />)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
      {filteredReps.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>{searchQuery ? 'No reps match your search' : emptyMessage}</p>
        </div>
      )}
    </div>
  );
};
