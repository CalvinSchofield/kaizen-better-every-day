import { useState, useMemo, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, X, Search, Pencil, Check, Users, Car, CalendarCheck, Building2, User } from "lucide-react";
import { getInitials } from "@/utils/nameUtils";
import { YearBadge } from "@/components/leaderboard/YearBadge";
import { ParticipantRep, ScopeFilter, YearFilter, filterAndSortReps } from "@/hooks/useParticipantPool";

// Team colors for visual distinction (up to 25)
const TEAM_COLORS = [
  'bg-red-500/15 border-red-500/40 text-red-600',
  'bg-blue-500/15 border-blue-500/40 text-blue-600',
  'bg-green-500/15 border-green-500/40 text-green-600',
  'bg-yellow-500/15 border-yellow-500/40 text-yellow-700',
  'bg-purple-500/15 border-purple-500/40 text-purple-600',
  'bg-orange-500/15 border-orange-500/40 text-orange-600',
  'bg-pink-500/15 border-pink-500/40 text-pink-600',
  'bg-cyan-500/15 border-cyan-500/40 text-cyan-600',
  'bg-emerald-500/15 border-emerald-500/40 text-emerald-600',
  'bg-indigo-500/15 border-indigo-500/40 text-indigo-600',
  'bg-rose-500/15 border-rose-500/40 text-rose-600',
  'bg-teal-500/15 border-teal-500/40 text-teal-600',
  'bg-amber-500/15 border-amber-500/40 text-amber-600',
  'bg-violet-500/15 border-violet-500/40 text-violet-600',
  'bg-lime-500/15 border-lime-500/40 text-lime-600',
  'bg-sky-500/15 border-sky-500/40 text-sky-600',
  'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-600',
  'bg-stone-500/15 border-stone-500/40 text-stone-600',
  'bg-red-400/15 border-red-400/40 text-red-500',
  'bg-blue-400/15 border-blue-400/40 text-blue-500',
  'bg-green-400/15 border-green-400/40 text-green-500',
  'bg-purple-400/15 border-purple-400/40 text-purple-500',
  'bg-orange-400/15 border-orange-400/40 text-orange-500',
  'bg-pink-400/15 border-pink-400/40 text-pink-500',
  'bg-cyan-400/15 border-cyan-400/40 text-cyan-500',
];

const TEAM_DOT_COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500',
  'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-indigo-500',
  'bg-rose-500', 'bg-teal-500', 'bg-amber-500', 'bg-violet-500', 'bg-lime-500',
  'bg-sky-500', 'bg-fuchsia-500', 'bg-stone-500', 'bg-red-400', 'bg-blue-400',
  'bg-green-400', 'bg-purple-400', 'bg-orange-400', 'bg-pink-400', 'bg-cyan-400',
];

export interface CarWarsTeam {
  key: string;
  label: string;
  members: string[]; // user_ids
}

interface CarWarsTeamBuilderProps {
  allReps: ParticipantRep[];
  currentUserId: string | null;
  teams: CarWarsTeam[];
  onTeamsChange: (teams: CarWarsTeam[]) => void;
  availableScopes: ScopeFilter[];
  workingUserIds: Set<string>;
  isLoading: boolean;
}

export const CarWarsTeamBuilder = ({
  allReps,
  currentUserId,
  teams,
  onTeamsChange,
  availableScopes,
  workingUserIds,
  isLoading,
}: CarWarsTeamBuilderProps) => {
  const [activeTeamKey, setActiveTeamKey] = useState<string>(teams[0]?.key || '1');
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('my_recruits');
  const [yearFilters, setYearFilters] = useState<Set<YearFilter>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to end when adding a team
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [teams.length]);

  // All assigned user IDs
  const assignedUserIds = useMemo(() => {
    const set = new Set<string>();
    teams.forEach(t => t.members.forEach(m => set.add(m)));
    return set;
  }, [teams]);

  // Filter reps (exclude current user since they're organizer for car_wars)
  const repsWithoutSelf = useMemo(() => 
    allReps.filter(r => r.userId !== currentUserId),
    [allReps, currentUserId]
  );

  const { grouped, total } = useMemo(() => {
    return filterAndSortReps(repsWithoutSelf, {
      scope,
      yearFilters,
      workingOnly: false,
      searchQuery,
      currentUserId,
    });
  }, [repsWithoutSelf, scope, yearFilters, searchQuery, currentUserId]);

  const addTeam = () => {
    if (teams.length >= 25) return;
    const newKey = String(teams.length + 1);
    const newTeams = [...teams, { key: newKey, label: `Car ${newKey}`, members: [] }];
    onTeamsChange(newTeams);
    setActiveTeamKey(newKey);
  };

  const removeTeam = (key: string) => {
    if (teams.length <= 2) return;
    const newTeams = teams.filter(t => t.key !== key);
    onTeamsChange(newTeams);
    if (activeTeamKey === key) {
      setActiveTeamKey(newTeams[0]?.key || '1');
    }
  };

  const toggleRepInTeam = (userId: string) => {
    const currentTeam = teams.find(t => t.members.includes(userId));
    
    if (currentTeam) {
      // Remove from current team
      const newTeams = teams.map(t => 
        t.key === currentTeam.key 
          ? { ...t, members: t.members.filter(m => m !== userId) }
          : t
      );
      onTeamsChange(newTeams);
    } else {
      // Add to active team
      const newTeams = teams.map(t =>
        t.key === activeTeamKey
          ? { ...t, members: [...t.members, userId] }
          : t
      );
      onTeamsChange(newTeams);
    }
  };

  const getRepTeam = (userId: string): CarWarsTeam | null => {
    return teams.find(t => t.members.includes(userId)) || null;
  };

  const getTeamIndex = (key: string) => teams.findIndex(t => t.key === key);

  const startEditLabel = (key: string, currentLabel: string) => {
    setEditingLabel(key);
    setEditLabelValue(currentLabel);
  };

  const saveLabel = () => {
    if (!editingLabel) return;
    const newTeams = teams.map(t =>
      t.key === editingLabel ? { ...t, label: editLabelValue || t.label } : t
    );
    onTeamsChange(newTeams);
    setEditingLabel(null);
  };

  const toggleYearFilter = (year: YearFilter) => {
    setYearFilters(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const scopeLabels: Record<ScopeFilter, { label: string; icon: typeof User }> = {
    my_recruits: { label: 'My Recruits', icon: User },
    my_team: { label: 'My Team', icon: Users },
    my_mgmt: { label: 'My MGMT', icon: Building2 },
    all_office: { label: 'All Office', icon: Users },
  };

  const yearLabels: Record<YearFilter, string> = {
    rookie: 'Rookies',
    sophomore: 'Sophs',
    vet: 'Vets',
  };

  const activeTeam = teams.find(t => t.key === activeTeamKey);
  const activeTeamIdx = getTeamIndex(activeTeamKey);
  const totalAssigned = assignedUserIds.size;

  return (
    <div className="space-y-3">
      {/* Team Cards - Horizontal Scroll */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Teams ({teams.length})</p>
          <p className="text-xs text-muted-foreground">{totalAssigned} assigned</p>
        </div>
        
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
          {teams.map((team, idx) => {
            const isActive = team.key === activeTeamKey;
            const colorClass = TEAM_COLORS[idx % TEAM_COLORS.length];
            
            return (
              <button
                key={team.key}
                onClick={() => setActiveTeamKey(team.key)}
                className={cn(
                  "relative flex-shrink-0 w-24 p-2.5 rounded-xl border-2 transition-all text-center",
                  "active:scale-[0.97]",
                  isActive 
                    ? `${colorClass} border-current ring-1 ring-current/20` 
                    : "bg-muted/40 border-border hover:border-border/80"
                )}
              >
                {teams.length > 2 && isActive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeTeam(team.key); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                
                {editingLabel === team.key ? (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Input
                      value={editLabelValue}
                      onChange={e => setEditLabelValue(e.target.value)}
                      className="h-6 text-xs px-1 text-center"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') saveLabel(); }}
                      onBlur={saveLabel}
                    />
                  </div>
                ) : (
                  <div 
                    className="flex items-center justify-center gap-1"
                    onDoubleClick={() => startEditLabel(team.key, team.label)}
                  >
                    <Car className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold truncate">{team.label}</span>
                  </div>
                )}
                
                <div className="flex items-center justify-center gap-0.5 mt-1.5">
                  {team.members.length === 0 ? (
                    <span className="text-[10px] text-muted-foreground">Empty</span>
                  ) : (
                    <>
                      {/* Mini avatar stack */}
                      <div className="flex -space-x-1.5">
                        {team.members.slice(0, 3).map(uid => {
                          const rep = allReps.find(r => r.userId === uid);
                          return (
                            <Avatar key={uid} className="h-5 w-5 border border-background">
                              <AvatarFallback className="text-[8px]">{getInitials(rep?.name)}</AvatarFallback>
                            </Avatar>
                          );
                        })}
                      </div>
                      {team.members.length > 3 && (
                        <span className="text-[10px] text-muted-foreground ml-1">+{team.members.length - 3}</span>
                      )}
                    </>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{team.members.length} {team.members.length === 1 ? 'rep' : 'reps'}</p>
              </button>
            );
          })}

          {/* Add Team button */}
          {teams.length < 25 && (
            <button
              onClick={addTeam}
              className="flex-shrink-0 w-20 p-2.5 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-1"
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Add Team</span>
            </button>
          )}
        </div>
      </div>

      {/* Active team header */}
      {activeTeam && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border",
          TEAM_COLORS[activeTeamIdx % TEAM_COLORS.length]
        )}>
          <Car className="h-4 w-4" />
          <span className="text-sm font-semibold flex-1">{activeTeam.label}</span>
          <button
            onClick={() => startEditLabel(activeTeam.key, activeTeam.label)}
            className="p-1 rounded hover:bg-background/50"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <span className="text-xs">{activeTeam.members.length} reps</span>
        </div>
      )}

      {/* Scope filters */}
      {availableScopes.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {availableScopes.map(s => {
            const { label, icon: Icon } = scopeLabels[s];
            const isActive = scope === s;
            return (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  "active:scale-[0.97]",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9 pr-9 h-10"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Year filters */}
      <div className="flex gap-1.5 flex-wrap">
        {(Object.entries(yearLabels) as [YearFilter, string][]).map(([year, label]) => (
          <button
            key={year}
            onClick={() => toggleYearFilter(year)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.97]",
              yearFilters.has(year)
                ? "bg-secondary text-secondary-foreground"
                : "bg-muted/60 hover:bg-muted text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Rep list */}
      <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-xl border border-border p-2">
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            Loading...
          </div>
        )}
        
        {!isLoading && total === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            {searchQuery ? `No reps match "${searchQuery}"` : 'No eligible reps found'}
          </div>
        )}

        {!isLoading && total > 0 && Array.from(grouped.entries()).map(([groupName, reps]) => (
          <div key={groupName} className="space-y-0.5">
            <div className="text-xs font-semibold text-muted-foreground px-2 pt-2 pb-1 sticky top-0 bg-background/95 backdrop-blur-sm">
              {groupName} ({reps.length})
            </div>
            {reps.map(rep => {
              const repTeam = getRepTeam(rep.userId!);
              const repTeamIdx = repTeam ? getTeamIndex(repTeam.key) : -1;
              const isOnActiveTeam = repTeam?.key === activeTeamKey;
              const isOnOtherTeam = repTeam && !isOnActiveTeam;
              
              return (
                <button
                  key={rep.userId}
                  onClick={() => toggleRepInTeam(rep.userId!)}
                  className={cn(
                    "w-full flex items-center gap-2.5 p-2 rounded-xl transition-colors text-left",
                    "active:scale-[0.98]",
                    isOnActiveTeam && "bg-primary/10",
                    isOnOtherTeam && "opacity-60",
                    !repTeam && "hover:bg-muted/50"
                  )}
                >
                  {/* Team color dot */}
                  {repTeam && (
                    <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", TEAM_DOT_COLORS[repTeamIdx % TEAM_DOT_COLORS.length])} />
                  )}
                  
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px]">{getInitials(rep.name)}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{rep.name}</span>
                      <YearBadge year={rep.year} />
                    </div>
                    {rep.teamName && (
                      <span className="text-xs text-muted-foreground truncate block">{rep.teamName}</span>
                    )}
                  </div>
                  
                  {repTeam ? (
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-medium",
                      TEAM_COLORS[repTeamIdx % TEAM_COLORS.length]
                    )}>
                      {repTeam.label}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Tap to add</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
