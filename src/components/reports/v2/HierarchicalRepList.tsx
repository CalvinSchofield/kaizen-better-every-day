import { useState, useMemo } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Clock, ChevronDown, ChevronRight, Search, Users, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFirstName } from "@/components/mygroup/recruit-detail/utils";
import { getInitials } from "@/utils/nameUtils";

interface RepData {
  userId: string;
  name: string;
  year?: string;
  teamName?: string | null;
  teamId?: string | null;
  mgmtGroupId?: string | null;
  mgmtGroupName?: string | null;
  recruiterName?: string | null;
  workStartTime?: string;
  workEndTime?: string;
  avgStartTime?: string;
  avgEndTime?: string;
  timezone?: string;
  hoursWorked: number;
  doors: number;
  transitions: number;
  presentations: number;
  fp: number;
  prmr: number;
  pendingFp?: number;
  pendingPrmr?: number;
  isWorking?: boolean;
}

interface HierarchicalRepListProps {
  reps: RepData[];
  periodLabel: string;
  isLiveView?: boolean;
  onRepClick?: (userId: string) => void;
}

const formatHours = (hours: number): string => {
  if (hours <= 0) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export const HierarchicalRepList = ({
  reps,
  periodLabel,
  isLiveView,
  onRepClick,
}: HierarchicalRepListProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  
  // Filter reps by search AND only show reps with activity
  const filteredReps = useMemo(() => {
    const activeReps = reps.filter(rep => {
      const hasActivity = rep.doors > 0 || rep.transitions > 0 || 
                          rep.presentations > 0 || rep.fp > 0;
      const isCurrentlyWorking = !!rep.workStartTime && !rep.workEndTime;
      return hasActivity || isCurrentlyWorking;
    });
    
    if (!searchQuery.trim()) return activeReps;
    const query = searchQuery.toLowerCase();
    return activeReps.filter(rep => 
      rep.name.toLowerCase().includes(query) ||
      rep.teamName?.toLowerCase().includes(query) ||
      rep.mgmtGroupName?.toLowerCase().includes(query)
    );
  }, [reps, searchQuery]);
  
  // Check if we have multi-level org data (MGMT groups)
  const hasMgmtGroups = useMemo(() => {
    const mgmtIds = new Set(filteredReps.map(r => r.mgmtGroupId).filter(Boolean));
    return mgmtIds.size > 1;
  }, [filteredReps]);

  // Group reps by org hierarchy: MGMT Group > Team
  const groupedReps = useMemo(() => {
    type TeamBucket = { name: string; id: string | null; reps: RepData[] };
    type MgmtBucket = { name: string; id: string | null; teams: Map<string, TeamBucket>; ungrouped: RepData[] };

    const mgmtMap = new Map<string, MgmtBucket>();
    const ungroupedReps: RepData[] = [];

    filteredReps.forEach(rep => {
      if (hasMgmtGroups && rep.mgmtGroupId) {
        const mgmtKey = rep.mgmtGroupId;
        if (!mgmtMap.has(mgmtKey)) {
          mgmtMap.set(mgmtKey, { name: rep.mgmtGroupName || 'Unknown Group', id: mgmtKey, teams: new Map(), ungrouped: [] });
        }
        const mgmt = mgmtMap.get(mgmtKey)!;
        if (rep.teamId) {
          if (!mgmt.teams.has(rep.teamId)) {
            mgmt.teams.set(rep.teamId, { name: rep.teamName || 'No Team', id: rep.teamId, reps: [] });
          }
          mgmt.teams.get(rep.teamId)!.reps.push(rep);
        } else {
          mgmt.ungrouped.push(rep);
        }
      } else if (rep.teamId) {
        // Flat team grouping (single mgmt group or no mgmt groups)
        const key = `team_${rep.teamId}`;
        if (!mgmtMap.has(key)) {
          mgmtMap.set(key, { name: rep.teamName || 'No Team', id: null, teams: new Map(), ungrouped: [] });
        }
        mgmtMap.get(key)!.ungrouped.push(rep);
      } else {
        ungroupedReps.push(rep);
      }
    });

    // Convert to sorted array
    const groups = Array.from(mgmtMap.entries()).map(([key, mgmt]) => {
      const allReps = [...mgmt.ungrouped, ...Array.from(mgmt.teams.values()).flatMap(t => t.reps)];
      const totalFP = allReps.reduce((s, r) => s + r.fp, 0);
      return { key, ...mgmt, allReps, totalFP };
    }).sort((a, b) => b.totalFP - a.totalFP);

    return { groups, ungroupedReps };
  }, [filteredReps, hasMgmtGroups]);
  
  // Expand all by default if searching or only one group
  const effectiveExpanded = useMemo(() => {
    const totalGroups = groupedReps.groups.length + (groupedReps.ungroupedReps.length > 0 ? 1 : 0);
    if (searchQuery.trim() || totalGroups <= 2) {
      const all = new Set<string>();
      groupedReps.groups.forEach(g => {
        all.add(g.key);
        g.teams.forEach((_, tKey) => all.add(`${g.key}:${tKey}`));
      });
      if (groupedReps.ungroupedReps.length > 0) all.add('__ungrouped__');
      return all;
    }
    return expandedTeams;
  }, [searchQuery, groupedReps, expandedTeams]);
  
  const toggleTeam = (teamKey: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      next.has(teamKey) ? next.delete(teamKey) : next.add(teamKey);
      return next;
    });
  };

  const RepRow = ({ rep }: { rep: RepData }) => {
    const formatInRepTz = (isoStr: string) => {
      if (rep.timezone) {
        try { return formatInTimeZone(new Date(isoStr), rep.timezone, 'h:mm a'); } catch {}
      }
      return new Date(isoStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };
    const displayTime = isLiveView 
      ? (rep.workStartTime ? formatInRepTz(rep.workStartTime) : '—')
      : (rep.avgStartTime || '—');
    const displayEndTime = isLiveView
      ? (rep.workEndTime ? formatInRepTz(rep.workEndTime) : null)
      : (rep.avgEndTime || null);
    
    return (
      <div 
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg bg-muted/30 cursor-pointer",
          "hover:bg-muted/50 active:scale-[0.98] transition-all"
        )}
        onClick={() => onRepClick?.(rep.userId)}
      >
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {getInitials(rep.name)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{getFirstName(rep.name)}</span>
            {rep.year && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {rep.year}
              </Badge>
            )}
            {rep.isWorking && (
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {displayTime}
              {displayEndTime && <> – {displayEndTime}</>}
            </span>
            <span className="flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {formatHours(rep.hoursWorked)}
            </span>
          </div>
        </div>
      
        <div className="text-right">
          {rep.fp > 0 ? (
            <div className="flex flex-col items-end">
              <span className="font-bold text-green-600 dark:text-green-400">
                {rep.fp.toFixed(1)} FP+
                {rep.pendingFp != null && rep.pendingFp > 0 && (
                  <span className="text-warning text-[10px] ml-0.5">⏳</span>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground">
                ${rep.prmr.toLocaleString()}
              </span>
            </div>
          ) : rep.presentations > 0 ? (
            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
              {rep.presentations} pres
            </Badge>
          ) : rep.doors > 0 ? (
            <span className="text-xs text-muted-foreground">
              {rep.doors} doors
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">—</span>
          )}
        </div>
        
        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
      </div>
    );
  };

  // Sort reps within a group
  const sortReps = (list: RepData[]) =>
    [...list].sort((a, b) => {
      if (a.isWorking !== b.isWorking) return a.isWorking ? -1 : 1;
      if (a.fp !== b.fp) return b.fp - a.fp;
      if (a.presentations !== b.presentations) return b.presentations - a.presentations;
      return b.doors - a.doors;
    });

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search reps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      
      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>{filteredReps.length} reps</span>
        <span>{periodLabel}</span>
      </div>
      
      {/* Grouped list */}
      <div className="space-y-2">
        {groupedReps.groups.map(group => {
          const isExpanded = effectiveExpanded.has(group.key);
          const workingCount = group.allReps.filter(r => r.isWorking).length;
          const hasNestedTeams = group.teams.size > 0 && hasMgmtGroups;
          
          return (
            <Collapsible
              key={group.key}
              open={isExpanded}
              onOpenChange={() => toggleTeam(group.key)}
            >
              <CollapsibleTrigger className="w-full">
                <div className={cn(
                  "flex items-center justify-between p-3 rounded-lg",
                  "bg-muted/50 hover:bg-muted/70 transition-colors"
                )}>
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{group.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {group.allReps.length}
                    </Badge>
                    {workingCount > 0 && isLiveView && (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] text-green-600">{workingCount}</span>
                      </div>
                    )}
                  </div>
                  {group.totalFP > 0 && (
                    <span className="font-semibold text-green-600 dark:text-green-400 text-sm">
                      {group.totalFP.toFixed(1)} FP+
                    </span>
                  )}
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="space-y-1.5 mt-1.5 ml-3">
                  {hasNestedTeams ? (
                    <>
                      {Array.from(group.teams.values())
                        .sort((a, b) => {
                          const aFP = a.reps.reduce((s, r) => s + r.fp, 0);
                          const bFP = b.reps.reduce((s, r) => s + r.fp, 0);
                          return bFP - aFP;
                        })
                        .map(team => {
                          const tKey = `${group.key}:${team.id}`;
                          const tExp = effectiveExpanded.has(tKey);
                          const teamFP = team.reps.reduce((s, r) => s + r.fp, 0);
                          const teamWC = team.reps.filter(r => r.isWorking).length;

                          return (
                            <Collapsible key={tKey} open={tExp} onOpenChange={() => toggleTeam(tKey)}>
                              <CollapsibleTrigger className="w-full">
                                <div className={cn(
                                  "flex items-center justify-between p-2.5 rounded-lg",
                                  "bg-muted/40 hover:bg-muted/60 transition-colors"
                                )}>
                                  <div className="flex items-center gap-2">
                                    {tExp ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    <span className="font-medium text-sm">{team.name}</span>
                                    <Badge variant="secondary" className="text-[10px] px-1.5">{team.reps.length}</Badge>
                                    {teamWC > 0 && isLiveView && (
                                      <div className="flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-[10px] text-green-600">{teamWC}</span>
                                      </div>
                                    )}
                                  </div>
                                  {teamFP > 0 && (
                                    <span className="font-semibold text-green-600 dark:text-green-400 text-sm">
                                      {teamFP.toFixed(1)} FP+
                                    </span>
                                  )}
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="space-y-1.5 mt-1.5 ml-4">
                                  {sortReps(team.reps).map(rep => (
                                    <RepRow key={rep.userId} rep={rep} />
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      {group.ungrouped.length > 0 && (
                        <div className="space-y-1.5 ml-4">
                          {sortReps(group.ungrouped).map(rep => (
                            <RepRow key={rep.userId} rep={rep} />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-1.5 ml-4">
                      {sortReps([...group.ungrouped, ...Array.from(group.teams.values()).flatMap(t => t.reps)]).map(rep => (
                        <RepRow key={rep.userId} rep={rep} />
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {/* Ungrouped reps */}
        {groupedReps.ungroupedReps.length > 0 && (
          <Collapsible open={effectiveExpanded.has('__ungrouped__')} onOpenChange={() => toggleTeam('__ungrouped__')}>
            <CollapsibleTrigger className="w-full">
              <div className={cn(
                "flex items-center justify-between p-3 rounded-lg",
                "bg-muted/50 hover:bg-muted/70 transition-colors"
              )}>
                <div className="flex items-center gap-2">
                  {effectiveExpanded.has('__ungrouped__') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Ungrouped</span>
                  <Badge variant="secondary" className="text-xs">{groupedReps.ungroupedReps.length}</Badge>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1.5 mt-1.5 ml-4">
                {sortReps(groupedReps.ungroupedReps).map(rep => (
                  <RepRow key={rep.userId} rep={rep} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
      
      {/* Empty state */}
      {filteredReps.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>{searchQuery ? 'No reps match your search' : 'No activity data'}</p>
        </div>
      )}
    </div>
  );
};
