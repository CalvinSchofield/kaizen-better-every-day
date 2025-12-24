import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Sun, AlertCircle, Calendar, MessageSquare, CalendarOff, 
  Users, Clock, LayoutList, GanttChart, ChevronDown, ChevronRight, Rocket, CheckCircle2, Pencil, Filter
} from "lucide-react";
import { format, differenceInDays, isAfter, isBefore, addDays, startOfWeek, endOfWeek } from "date-fns";
import { stripEmojis } from "./recruit-detail/utils";
import { toast } from "sonner";
import { SIGNED_PLUS_STAGES, isStageIn } from "@/utils/stageConstants";
import { EditSummerDatesDrawer } from "./EditSummerDatesDrawer";

// Default summer dates
const DEFAULT_SUMMER_START = '2026-04-12';
const DEFAULT_SUMMER_END = '2026-09-27';

// Parse date string as local date
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Get week range (Sunday to Saturday)
const getWeekRange = (date: Date): { start: Date; end: Date; startStr: string; endStr: string } => {
  const start = startOfWeek(date, { weekStartsOn: 0 }); // Sunday
  const end = endOfWeek(date, { weekStartsOn: 0 }); // Saturday
  return { 
    start, 
    end,
    startStr: format(start, 'yyyy-MM-dd'),
    endStr: format(end, 'yyyy-MM-dd'),
  };
};

type ViewFilter = 'all' | 'missing' | 'ready' | 'off' | 'arriving-soon' | 'leaving-soon' | 'off-today';
type ViewMode = 'list' | 'timeline';
type TeamFilter = 'all' | string; // 'all' or team/group ID

interface PersonSummerInfo {
  userId: string;
  name: string;
  phone?: string;
  personalSummerStart: string | null;
  personalSummerEnd: string | null;
  excludedSummerDays: string[];
  isSelf?: boolean;
  year?: string;
  stage?: string;
  teamId?: string | null;
  teamName?: string | null;
  mgmtGroupId?: string | null;
  mgmtGroupName?: string | null;
}

interface WeekOffDayInfo {
  weekLabel: string;
  weekRange: string;
  people: { name: string; days: string[] }[];
}

export const SummerAvailabilityView = () => {
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [weekPreviewOpen, setWeekPreviewOpen] = useState(true);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');
  const [editingPerson, setEditingPerson] = useState<PersonSummerInfo | null>(null);
  const { data: teamAccess, isLoading: teamAccessLoading } = useTeamAccess();
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Check if user is a leader (can edit others)
  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';
  
  // Check if we're in summer season
  const summerStartDate = parseLocalDate(DEFAULT_SUMMER_START);
  const summerEndDate = parseLocalDate(DEFAULT_SUMMER_END);
  const isSummerActive = isAfter(today, summerStartDate) && isBefore(today, summerEndDate);

  // Get current user's data
  const { data: currentUserData } = useQuery({
    queryKey: ['current-user-summer'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const [repResult, configResult] = await Promise.all([
        supabase.from('reps').select('user_id, name, phone, year, stage').eq('user_id', user.id).single(),
        supabase.from('season_config').select('personal_summer_start, personal_summer_end, excluded_summer_days').eq('user_id', user.id).single(),
      ]);
      
      return {
        rep: repResult.data,
        config: configResult.data,
      };
    },
  });

  // Get all accessible users' summer configs
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team-summer-availability', teamAccess?.accessibleUserIds],
    queryFn: async () => {
      if (!teamAccess?.accessibleUserIds?.length) return { reps: [], configs: [] };
      
      const [repsResult, configsResult] = await Promise.all([
        supabase.from('reps').select('user_id, name, phone, year, stage').in('user_id', teamAccess.accessibleUserIds),
        supabase.from('season_config').select('user_id, personal_summer_start, personal_summer_end, excluded_summer_days').in('user_id', teamAccess.accessibleUserIds),
      ]);
      
      return {
        reps: repsResult.data || [],
        configs: configsResult.data || [],
      };
    },
    enabled: !!teamAccess?.accessibleUserIds?.length,
  });

  // Build filter options for teams/groups
  const filterOptions = useMemo(() => {
    const options: { value: string; label: string; type: 'team' | 'group' }[] = [];
    
    // Add management groups (for area directors and mgmt group leads)
    if (teamAccess?.accessLevel === 'area_director' || teamAccess?.accessLevel === 'mgmt_group_lead') {
      teamAccess?.mgmtGroups?.forEach(group => {
        options.push({ value: `group-${group.id}`, label: group.name, type: 'group' });
      });
    }
    
    // Add teams
    teamAccess?.teams?.forEach(team => {
      options.push({ value: `team-${team.id}`, label: team.name, type: 'team' });
    });
    
    return options;
  }, [teamAccess]);

  // Build combined list (only show SIGNED_PLUS_STAGES)
  const people = useMemo(() => {
    const list: PersonSummerInfo[] = [];
    const configMap = new Map(teamData?.configs?.map(c => [c.user_id, c]) || []);
    const repsMap = new Map(teamData?.reps?.map(r => [r.user_id, r]) || []);

    // Add current user first (only if in SIGNED_PLUS_STAGES)
    if (currentUserData?.rep) {
      const stage = currentUserData.rep.stage;
      if (isStageIn(stage, SIGNED_PLUS_STAGES)) {
        list.push({
          userId: currentUserData.rep.user_id,
          name: currentUserData.rep.name,
          phone: currentUserData.rep.phone || undefined,
          personalSummerStart: currentUserData.config?.personal_summer_start || null,
          personalSummerEnd: currentUserData.config?.personal_summer_end || null,
          excludedSummerDays: currentUserData.config?.excluded_summer_days || [],
          isSelf: true,
          year: currentUserData.rep.year || undefined,
          stage: stage || undefined,
        });
      }
    }

    // Add team members (only SIGNED_PLUS_STAGES)
    teamAccess?.accessibleReps?.forEach(accessibleRep => {
      if (accessibleRep.userId === currentUserData?.rep?.user_id) return; // Skip self
      
      const rep = repsMap.get(accessibleRep.userId);
      const config = configMap.get(accessibleRep.userId);
      const stage = rep?.stage || accessibleRep.stage;
      
      // Only include SIGNED_PLUS_STAGES (Signed, Shadow ✅, Sold 💲, Sold (5+) 💰)
      if (!isStageIn(stage, SIGNED_PLUS_STAGES)) return;
      
      list.push({
        userId: accessibleRep.userId,
        name: rep?.name || accessibleRep.name,
        phone: rep?.phone || accessibleRep.phone || undefined,
        personalSummerStart: config?.personal_summer_start || null,
        personalSummerEnd: config?.personal_summer_end || null,
        excludedSummerDays: config?.excluded_summer_days || [],
        isSelf: false,
        year: rep?.year || accessibleRep.year || undefined,
        stage: stage || undefined,
        teamId: accessibleRep.teamId || undefined,
        teamName: accessibleRep.teamName || undefined,
        mgmtGroupId: accessibleRep.mgmtGroupId || undefined,
        mgmtGroupName: accessibleRep.mgmtGroupName || undefined,
      });
    });

    return list;
  }, [currentUserData, teamData, teamAccess]);

  // Apply team/group filter
  const filteredByTeam = useMemo(() => {
    if (teamFilter === 'all') return people;
    
    const [filterType, filterId] = teamFilter.split('-');
    
    return people.filter(p => {
      if (p.isSelf) return true; // Always show self
      if (filterType === 'team') return p.teamId === filterId;
      if (filterType === 'group') return p.mgmtGroupId === filterId;
      return true;
    });
  }, [people, teamFilter]);

  // Calculate week-by-week off days preview (Sunday-Saturday)
  const weeklyOffDays = useMemo((): WeekOffDayInfo[] => {
    if (!isSummerActive) return [];
    
    const hasDatesPeople = filteredByTeam.filter(p => p.personalSummerStart && p.personalSummerEnd);
    const weeks: WeekOffDayInfo[] = [];
    
    // Current week
    const currentWeek = getWeekRange(today);
    const currentWeekPeople = hasDatesPeople
      .map(p => {
        const daysOff = p.excludedSummerDays.filter(d => d >= currentWeek.startStr && d <= currentWeek.endStr);
        if (daysOff.length === 0) return null;
        return {
          name: (stripEmojis(p.name) || p.name).split(' ')[0],
          days: daysOff.map(d => format(parseLocalDate(d), 'EEE')), // Mon, Tue, etc.
        };
      })
      .filter(Boolean) as { name: string; days: string[] }[];
    
    weeks.push({
      weekLabel: 'This Week',
      weekRange: `${format(currentWeek.start, 'MMM d')} – ${format(currentWeek.end, 'MMM d')}`,
      people: currentWeekPeople,
    });
    
    // Next week
    const nextWeek = getWeekRange(addDays(today, 7));
    const nextWeekPeople = hasDatesPeople
      .map(p => {
        const daysOff = p.excludedSummerDays.filter(d => d >= nextWeek.startStr && d <= nextWeek.endStr);
        if (daysOff.length === 0) return null;
        return {
          name: (stripEmojis(p.name) || p.name).split(' ')[0],
          days: daysOff.map(d => format(parseLocalDate(d), 'EEE')),
        };
      })
      .filter(Boolean) as { name: string; days: string[] }[];
    
    weeks.push({
      weekLabel: 'Next Week',
      weekRange: `${format(nextWeek.start, 'MMM d')} – ${format(nextWeek.end, 'MMM d')}`,
      people: nextWeekPeople,
    });
    
    // Week after next
    const weekAfterNext = getWeekRange(addDays(today, 14));
    const weekAfterNextPeople = hasDatesPeople
      .map(p => {
        const daysOff = p.excludedSummerDays.filter(d => d >= weekAfterNext.startStr && d <= weekAfterNext.endStr);
        if (daysOff.length === 0) return null;
        return {
          name: (stripEmojis(p.name) || p.name).split(' ')[0],
          days: daysOff.map(d => format(parseLocalDate(d), 'EEE')),
        };
      })
      .filter(Boolean) as { name: string; days: string[] }[];
    
    if (weekAfterNextPeople.length > 0) {
      weeks.push({
        weekLabel: format(weekAfterNext.start, 'MMM d'),
        weekRange: `${format(weekAfterNext.start, 'MMM d')} – ${format(weekAfterNext.end, 'MMM d')}`,
        people: weekAfterNextPeople,
      });
    }
    
    return weeks;
  }, [filteredByTeam, isSummerActive, today]);

  // Calculate stats
  const stats = useMemo(() => {
    const missingDates = filteredByTeam.filter(p => !p.personalSummerStart || !p.personalSummerEnd);
    const hasDatesPeople = filteredByTeam.filter(p => p.personalSummerStart && p.personalSummerEnd);
    const earlyStarters = hasDatesPeople.filter(p => p.personalSummerStart! < DEFAULT_SUMMER_START);
    
    // People off today (during summer)
    const offToday = hasDatesPeople.filter(p => {
      // Check if today is within their summer range
      const start = p.personalSummerStart!;
      const end = p.personalSummerEnd!;
      if (todayStr < start || todayStr > end) return true; // Outside their summer = off
      return p.excludedSummerDays.includes(todayStr);
    });

    // Upcoming off days in next 7 days (only count if summer is active)
    const upcomingOffDays = isSummerActive 
      ? hasDatesPeople.reduce((acc, p) => {
          const upcoming = p.excludedSummerDays.filter(d => {
            const dayDate = parseLocalDate(d);
            return isAfter(dayDate, today) && isBefore(dayDate, addDays(today, 7));
          });
          return acc + upcoming.length;
        }, 0)
      : 0;

    // Calculate current week range for "arriving this week"
    const currentWeek = getWeekRange(today);

    // Arriving this week (Sunday-Saturday)
    const arrivingSoon = hasDatesPeople.filter(p => {
      const start = p.personalSummerStart!;
      return start >= currentWeek.startStr && start <= currentWeek.endStr && start > todayStr;
    });

    // Leaving within 14 days
    const leavingSoon = hasDatesPeople.filter(p => {
      const end = parseLocalDate(p.personalSummerEnd!);
      const daysUntil = differenceInDays(end, today);
      return daysUntil >= 0 && daysUntil <= 14 && todayStr >= p.personalSummerStart!;
    });

    return {
      total: filteredByTeam.length,
      missing: missingDates.length,
      ready: hasDatesPeople.length,
      earlyStarters: earlyStarters.length,
      offToday: offToday.length,
      upcomingOffDays,
      arrivingSoon: arrivingSoon.length,
      leavingSoon: leavingSoon.length,
    };
  }, [filteredByTeam, todayStr, today, isSummerActive]);

  // Filter people
  const filteredPeople = useMemo(() => {
    let filtered = [...filteredByTeam];
    const currentWeek = getWeekRange(today);
    
    switch (filter) {
      case 'missing':
        filtered = filtered.filter(p => !p.personalSummerStart || !p.personalSummerEnd);
        break;
      case 'ready':
        filtered = filtered.filter(p => p.personalSummerStart && p.personalSummerEnd);
        break;
      case 'off':
        filtered = filtered.filter(p => {
          if (!p.personalSummerStart || !p.personalSummerEnd) return false;
          // Off today or has off days scheduled
          if (todayStr < p.personalSummerStart || todayStr > p.personalSummerEnd) return true;
          return p.excludedSummerDays.length > 0;
        });
        break;
      case 'arriving-soon':
        filtered = filtered.filter(p => {
          if (!p.personalSummerStart) return false;
          return p.personalSummerStart >= currentWeek.startStr && 
                 p.personalSummerStart <= currentWeek.endStr && 
                 p.personalSummerStart > todayStr;
        });
        break;
      case 'leaving-soon':
        filtered = filtered.filter(p => {
          if (!p.personalSummerEnd || !p.personalSummerStart) return false;
          const end = parseLocalDate(p.personalSummerEnd);
          const daysUntil = differenceInDays(end, today);
          return daysUntil >= 0 && daysUntil <= 14 && todayStr >= p.personalSummerStart;
        });
        break;
      case 'off-today':
        filtered = filtered.filter(p => {
          if (!p.personalSummerStart || !p.personalSummerEnd) return false;
          if (todayStr < p.personalSummerStart || todayStr > p.personalSummerEnd) return true;
          return p.excludedSummerDays.includes(todayStr);
        });
        break;
    }

    // Sort: missing dates first, then by start date (earliest first)
    return filtered.sort((a, b) => {
      const aMissing = !a.personalSummerStart || !a.personalSummerEnd;
      const bMissing = !b.personalSummerStart || !b.personalSummerEnd;
      if (aMissing && !bMissing) return -1;
      if (!aMissing && bMissing) return 1;
      return (a.personalSummerStart || '9999').localeCompare(b.personalSummerStart || '9999');
    });
  }, [filteredByTeam, filter, todayStr, today]);

  const isLoading = teamAccessLoading || teamLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No team members found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero summary */}
      <div className="bg-gradient-to-br from-warning/20 to-warning/5 border border-warning/20 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center">
            <Sun className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Summer 2026</h3>
            <p className="text-xs text-muted-foreground">
              {format(summerStartDate, 'MMM d')} – {format(summerEndDate, 'MMM d')}
              {isSummerActive && (
                <span className="ml-2 text-success font-medium">• In Progress</span>
              )}
            </p>
          </div>
        </div>
        
        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-xl p-2.5 text-center transition-all ${
              filter === 'all' 
                ? 'bg-background shadow-sm ring-1 ring-border' 
                : 'bg-background/50 hover:bg-background/80'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-lg font-bold text-foreground">{stats.total}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Team</div>
          </button>
          
          <button
            onClick={() => setFilter('missing')}
            className={`rounded-xl p-2.5 text-center transition-all ${
              filter === 'missing'
                ? 'bg-destructive/10 shadow-sm ring-1 ring-destructive/30'
                : stats.missing > 0 
                  ? 'bg-destructive/5 hover:bg-destructive/10' 
                  : 'bg-background/50'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <AlertCircle className={`h-3.5 w-3.5 ${stats.missing > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <span className={`text-lg font-bold ${stats.missing > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {stats.missing}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">No Dates</div>
          </button>
          
          <button
            onClick={() => setFilter('off')}
            className={`rounded-xl p-2.5 text-center transition-all ${
              filter === 'off'
                ? 'bg-primary/10 shadow-sm ring-1 ring-primary/30'
                : 'bg-background/50 hover:bg-background/80'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <CalendarOff className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-lg font-bold text-foreground">
                {isSummerActive ? stats.upcomingOffDays : stats.ready}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {isSummerActive ? 'Off Days' : 'Ready'}
            </div>
          </button>
        </div>
      </div>

      {/* Week-by-Week Off Days Preview (only when summer is active) */}
      {isSummerActive && weeklyOffDays.some(w => w.people.length > 0) && (
        <Collapsible open={weekPreviewOpen} onOpenChange={setWeekPreviewOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between bg-muted/30 hover:bg-muted/50 rounded-xl p-3 transition-all">
              <div className="flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-warning" />
                <span className="font-medium text-sm">Upcoming Off Days</span>
              </div>
              {weekPreviewOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2">
              {weeklyOffDays.map((week, idx) => (
                <div key={idx} className="bg-background border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-foreground">{week.weekLabel}</span>
                    <span className="text-[10px] text-muted-foreground">{week.weekRange}</span>
                  </div>
                  {week.people.length > 0 ? (
                    <div className="space-y-1">
                      {week.people.map((p, pIdx) => (
                        <div key={pIdx} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{p.name}</span>
                          <span className="text-warning font-medium">{p.days.join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No off days scheduled</p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Team/Group Filter for leaders */}
      {isLeader && filterOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {filterOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.type === 'group' ? '📁 ' : ''}{opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* View mode toggle and quick filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'timeline'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GanttChart className="h-3.5 w-3.5" />
              Timeline
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              List
            </button>
          </div>
          
          {(filter !== 'all' || teamFilter !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-xs px-2"
              onClick={() => {
                setFilter('all');
                setTeamFilter('all');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Quick filter chips */}
        <ScrollArea className="w-full">
          <div className="flex items-center gap-1.5 pb-1">
            {stats.arrivingSoon > 0 && (
              <button
                onClick={() => setFilter(filter === 'arriving-soon' ? 'all' : 'arriving-soon')}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                  filter === 'arriving-soon'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                🚀 Arriving this week ({stats.arrivingSoon})
              </button>
            )}
            {stats.leavingSoon > 0 && (
              <button
                onClick={() => setFilter(filter === 'leaving-soon' ? 'all' : 'leaving-soon')}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                  filter === 'leaving-soon'
                    ? 'bg-warning text-warning-foreground'
                    : 'bg-warning/10 text-warning hover:bg-warning/20'
                }`}
              >
                ✈️ Leaving soon ({stats.leavingSoon})
              </button>
            )}
            {isSummerActive && stats.offToday > 0 && (
              <button
                onClick={() => setFilter(filter === 'off-today' ? 'all' : 'off-today')}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                  filter === 'off-today'
                    ? 'bg-muted-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                🏖️ Off today ({stats.offToday})
              </button>
            )}
            {stats.missing > 0 && (
              <button
                onClick={() => setFilter(filter === 'missing' ? 'all' : 'missing')}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                  filter === 'missing'
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                }`}
              >
                ⚠️ No dates ({stats.missing})
              </button>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Filter indicator */}
      {filter !== 'all' && (
        <div className="text-xs text-muted-foreground px-1">
          Showing {filteredPeople.length} {filter === 'missing' ? 'without dates' : filter === 'off' ? 'with time off' : 'ready'}
        </div>
      )}

      {/* Timeline view */}
      {viewMode === 'timeline' && (
        <SummerTimeline 
          people={filteredPeople} 
          summerStart={DEFAULT_SUMMER_START} 
          summerEnd={DEFAULT_SUMMER_END}
          todayStr={todayStr}
          isSummerActive={isSummerActive}
        />
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {filteredPeople.map(person => (
            <PersonSummerCard 
              key={person.userId} 
              person={person} 
              todayStr={todayStr} 
              isSummerActive={isSummerActive}
              canEdit={!!isLeader && !person.isSelf}
              onEdit={() => setEditingPerson(person)}
            />
          ))}
        </div>
      )}

      {filteredPeople.length === 0 && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          No one matches this filter
        </div>
      )}

      {/* Edit Summer Dates Drawer */}
      {editingPerson && (
        <EditSummerDatesDrawer
          open={!!editingPerson}
          onOpenChange={(open) => !open && setEditingPerson(null)}
          person={editingPerson}
        />
      )}
    </div>
  );
};

// Timeline visualization component
interface SummerTimelineProps {
  people: PersonSummerInfo[];
  summerStart: string;
  summerEnd: string;
  todayStr: string;
  isSummerActive: boolean;
}

const SummerTimeline = ({ people, summerStart, summerEnd, todayStr, isSummerActive }: SummerTimelineProps) => {
  const summerStartDate = parseLocalDate(summerStart);
  const summerEndDate = parseLocalDate(summerEnd);
  const totalSeasonDays = differenceInDays(summerEndDate, summerStartDate) + 1;
  const today = parseLocalDate(todayStr);
  
  // Generate month markers
  const months = useMemo(() => {
    const markers: { label: string; position: number }[] = [];
    const current = new Date(summerStartDate);
    
    while (current <= summerEndDate) {
      const daysSinceStart = differenceInDays(current, summerStartDate);
      const position = (daysSinceStart / totalSeasonDays) * 100;
      markers.push({
        label: format(current, 'MMM'),
        position,
      });
      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }
    
    return markers;
  }, [summerStartDate, summerEndDate, totalSeasonDays]);

  // Today marker position
  const todayPosition = useMemo(() => {
    if (isBefore(today, summerStartDate) || isAfter(today, summerEndDate)) return null;
    return (differenceInDays(today, summerStartDate) / totalSeasonDays) * 100;
  }, [today, summerStartDate, summerEndDate, totalSeasonDays]);

  // Current week for grouping
  const currentWeek = getWeekRange(today);

  // Group people by status: Arriving This Week, Currently Active, Starting Later, Missing
  const { arrivingThisWeek, currentlyActive, startingLater, missingPeople } = useMemo(() => {
    const arriving: PersonSummerInfo[] = [];
    const active: PersonSummerInfo[] = [];
    const later: PersonSummerInfo[] = [];
    const missing: PersonSummerInfo[] = [];

    people.forEach(p => {
      if (!p.personalSummerStart || !p.personalSummerEnd) {
        missing.push(p);
        return;
      }

      const startStr = p.personalSummerStart;
      const endStr = p.personalSummerEnd;

      // Check if arriving this week (starts within current Sun-Sat and hasn't started yet)
      if (startStr >= currentWeek.startStr && startStr <= currentWeek.endStr && startStr > todayStr) {
        arriving.push(p);
      }
      // Check if currently active
      else if (todayStr >= startStr && todayStr <= endStr) {
        active.push(p);
      }
      // Starting later (after this week)
      else if (startStr > currentWeek.endStr) {
        later.push(p);
      }
      // Already started (before today but still valid dates)
      else if (todayStr < startStr) {
        later.push(p);
      }
      // Summer ended - don't show them
    });

    // Sort each group by start date
    arriving.sort((a, b) => (a.personalSummerStart || '').localeCompare(b.personalSummerStart || ''));
    active.sort((a, b) => (a.personalSummerStart || '').localeCompare(b.personalSummerStart || ''));
    later.sort((a, b) => (a.personalSummerStart || '').localeCompare(b.personalSummerStart || ''));

    return { arrivingThisWeek: arriving, currentlyActive: active, startingLater: later, missingPeople: missing };
  }, [people, currentWeek, todayStr]);

  const getBarPosition = (start: string, end: string) => {
    const startDate = parseLocalDate(start);
    const endDate = parseLocalDate(end);
    
    const startPos = Math.max(0, (differenceInDays(startDate, summerStartDate) / totalSeasonDays) * 100);
    const endPos = Math.min(100, ((differenceInDays(endDate, summerStartDate) + 1) / totalSeasonDays) * 100);
    
    return { left: startPos, width: endPos - startPos };
  };

  const renderPersonBar = (person: PersonSummerInfo, showOffDays: boolean = true) => {
    const { left, width } = getBarPosition(person.personalSummerStart!, person.personalSummerEnd!);
    const isActive = todayStr >= person.personalSummerStart! && todayStr <= person.personalSummerEnd!;
    const hasOffDays = person.excludedSummerDays.length > 0;
    
    return (
      <div key={person.userId} className="flex items-center gap-2 h-8">
        {/* Name */}
        <div className="w-24 shrink-0 truncate text-xs font-medium text-foreground">
          {(stripEmojis(person.name) || person.name).split(' ')[0]}
          {person.isSelf && <span className="text-muted-foreground ml-1">(You)</span>}
        </div>
        
        {/* Timeline bar */}
        <div className="flex-1 relative h-6 bg-muted/20 rounded-md overflow-hidden">
          {/* Person's summer range */}
          <div
            className={`absolute h-full rounded-md transition-all ${
              isActive 
                ? 'bg-success/40 border border-success/50' 
                : 'bg-primary/30 border border-primary/40'
            }`}
            style={{ 
              left: `${left}%`, 
              width: `${width}%`,
            }}
          >
            {/* Off days markers - only show if summer is active */}
            {showOffDays && isSummerActive && hasOffDays && person.excludedSummerDays.map(offDay => {
              if (offDay < person.personalSummerStart! || offDay > person.personalSummerEnd!) return null;
              const offDayPos = ((differenceInDays(parseLocalDate(offDay), summerStartDate) - differenceInDays(parseLocalDate(person.personalSummerStart!), summerStartDate)) / (differenceInDays(parseLocalDate(person.personalSummerEnd!), parseLocalDate(person.personalSummerStart!)) + 1)) * 100;
              return (
                <div
                  key={offDay}
                  className="absolute top-0 h-full w-1 bg-warning/90"
                  style={{ left: `${offDayPos}%` }}
                  title={`Off: ${format(parseLocalDate(offDay), 'MMM d')}`}
                />
              );
            })}
          </div>
          
          {/* Today marker on individual bar */}
          {todayPosition !== null && (
            <div
              className="absolute top-0 h-full w-px bg-primary/50"
              style={{ left: `${todayPosition}%` }}
            />
          )}
        </div>
        
        {/* Quick info - only show off days count if summer is active */}
        <div className="w-12 shrink-0 text-[10px] text-muted-foreground text-right">
          {isSummerActive && hasOffDays && (
            <span className="text-warning">{person.excludedSummerDays.length} off</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Timeline header with month markers */}
      <div className="relative h-6 bg-muted/30 rounded-lg overflow-hidden">
        {months.map((month, i) => (
          <div
            key={i}
            className="absolute top-0 h-full flex items-center"
            style={{ left: `${month.position}%` }}
          >
            <div className="h-full w-px bg-border/50" />
            <span className="text-[10px] text-muted-foreground ml-1">{month.label}</span>
          </div>
        ))}
        
        {/* Today marker */}
        {todayPosition !== null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-primary z-10"
            style={{ left: `${todayPosition}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[8px] px-1 rounded">
              Today
            </div>
          </div>
        )}
      </div>

      {/* People timeline bars - grouped by status */}
      <ScrollArea className="h-[320px]">
        <div className="space-y-1.5 pr-4">
          {/* Arriving This Week Section */}
          {arrivingThisWeek.length > 0 && (
            <>
              <div className="flex items-center gap-2 py-1.5 border-b border-border/30">
                <Rocket className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold text-primary">
                  Arriving This Week ({arrivingThisWeek.length})
                </span>
              </div>
              {arrivingThisWeek.map(person => renderPersonBar(person))}
            </>
          )}

          {/* Currently Active Section */}
          {currentlyActive.length > 0 && (
            <>
              <div className={`flex items-center gap-2 py-1.5 border-b border-border/30 ${arrivingThisWeek.length > 0 ? 'mt-3' : ''}`}>
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span className="text-[11px] font-semibold text-success">
                  Currently Active ({currentlyActive.length})
                </span>
              </div>
              {currentlyActive.map(person => renderPersonBar(person))}
            </>
          )}

          {/* Starting Later Section */}
          {startingLater.length > 0 && (
            <>
              <div className={`flex items-center gap-2 py-1.5 border-b border-border/30 ${(arrivingThisWeek.length > 0 || currentlyActive.length > 0) ? 'mt-3' : ''}`}>
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Starting Later ({startingLater.length})
                </span>
              </div>
              {startingLater.map(person => renderPersonBar(person, false))}
            </>
          )}

          {/* Missing dates section */}
          {missingPeople.length > 0 && (
            <div className="pt-3 mt-2 border-t border-border/50">
              <div className="text-[10px] text-destructive font-medium mb-2 flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" />
                No dates set ({missingPeople.length})
              </div>
              {missingPeople.map(person => (
                <div key={person.userId} className="flex items-center gap-2 h-7">
                  <div className="w-24 shrink-0 truncate text-xs text-muted-foreground">
                    {(stripEmojis(person.name) || person.name).split(' ')[0]}
                    {person.isSelf && <span className="ml-1">(You)</span>}
                  </div>
                  <div className="flex-1 h-5 bg-destructive/10 rounded-md border border-dashed border-destructive/30 flex items-center justify-center">
                    <span className="text-[10px] text-destructive">Needs dates</span>
                  </div>
                  <div className="w-12 shrink-0">
                    {person.phone && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          window.open(`sms:${person.phone}?body=${encodeURIComponent("Hey! Can you set your summer dates in the app when you get a chance?")}`, '_blank');
                        }}
                      >
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
};

interface PersonSummerCardProps {
  person: PersonSummerInfo;
  todayStr: string;
  isSummerActive: boolean;
  canEdit?: boolean;
  onEdit?: () => void;
}

const PersonSummerCard = ({ person, todayStr, isSummerActive, canEdit, onEdit }: PersonSummerCardProps) => {
  const hasDates = person.personalSummerStart && person.personalSummerEnd;
  const offDaysCount = person.excludedSummerDays.length;

  // Get current week for "off this week" badge
  const today = parseLocalDate(todayStr);
  const currentWeek = getWeekRange(today);
  const offDaysThisWeek = person.excludedSummerDays.filter(
    d => d >= currentWeek.startStr && d <= currentWeek.endStr
  );

  // Calculate working days and status
  const { workingDays, status, daysUntilStart, isOffToday, nextOffDay } = useMemo(() => {
    if (!hasDates) {
      return { workingDays: null, status: 'missing', daysUntilStart: null, isOffToday: false, nextOffDay: null };
    }
    
    const start = parseLocalDate(person.personalSummerStart!);
    const end = parseLocalDate(person.personalSummerEnd!);
    const totalDays = differenceInDays(end, start) + 1;
    // Rough estimate excluding Sundays (1/7 of days)
    const workDays = Math.round(totalDays * (6/7)) - offDaysCount;
    
    // Days until they start
    const daysUntil = differenceInDays(start, today);
    
    // Check if off today
    const offToday = todayStr < person.personalSummerStart! || 
                     todayStr > person.personalSummerEnd! ||
                     person.excludedSummerDays.includes(todayStr);
    
    // Find next off day
    const sortedOffDays = [...person.excludedSummerDays].sort();
    const nextOff = sortedOffDays.find(d => d > todayStr);
    
    let statusVal: 'not-started' | 'active' | 'ended' | 'missing' = 'not-started';
    if (todayStr >= person.personalSummerStart! && todayStr <= person.personalSummerEnd!) {
      statusVal = 'active';
    } else if (todayStr > person.personalSummerEnd!) {
      statusVal = 'ended';
    }
    
    return { 
      workingDays: Math.max(0, workDays), 
      status: statusVal, 
      daysUntilStart: daysUntil,
      isOffToday: offToday,
      nextOffDay: nextOff,
    };
  }, [person, hasDates, offDaysCount, todayStr, today]);

  const handleText = () => {
    if (person.phone) {
      const message = !hasDates 
        ? "Hey! Can you set your summer dates in the app when you get a chance?"
        : "";
      window.open(`sms:${person.phone}${message ? `?body=${encodeURIComponent(message)}` : ''}`, '_blank');
    } else {
      toast.error('No phone number available');
    }
  };

  // Format the date range display
  const getDateDisplay = () => {
    if (!hasDates) return null;
    
    const startFormatted = format(parseLocalDate(person.personalSummerStart!), 'MMM d');
    const endFormatted = format(parseLocalDate(person.personalSummerEnd!), 'MMM d');
    
    return `${startFormatted} – ${endFormatted}`;
  };

  // Get status badge
  const getStatusBadge = () => {
    if (!hasDates) {
      return (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
          Needs dates
        </Badge>
      );
    }
    
    if (isOffToday && status === 'active' && isSummerActive) {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning text-warning">
          Off today
        </Badge>
      );
    }
    
    if (daysUntilStart !== null && daysUntilStart > 0) {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          Starts in {daysUntilStart}d
        </Badge>
      );
    }
    
    if (status === 'active') {
      return (
        <Badge className="text-[10px] px-1.5 py-0 bg-success/20 text-success border-0">
          Active
        </Badge>
      );
    }
    
    return null;
  };

  // Format off days as list
  const getOffDaysList = () => {
    if (offDaysCount === 0) return null;
    const sortedDays = [...person.excludedSummerDays].sort();
    // Show up to 5, then "..." 
    const displayDays = sortedDays.slice(0, 5);
    const formatted = displayDays.map(d => format(parseLocalDate(d), 'MMM d'));
    if (sortedDays.length > 5) {
      formatted.push(`+${sortedDays.length - 5} more`);
    }
    return formatted.join(', ');
  };

  return (
    <div className={`bg-card border rounded-xl p-3 transition-all ${
      !hasDates 
        ? 'border-destructive/30 bg-destructive/5' 
        : isOffToday && isSummerActive
          ? 'border-warning/30 bg-warning/5'
          : 'border-border'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Name row with badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-medium text-sm truncate">{stripEmojis(person.name) || person.name}</span>
            {person.isSelf && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">You</Badge>
            )}
            {person.year && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{person.year}</Badge>
            )}
            {getStatusBadge()}
            {/* Off this week badge - only show if summer is active */}
            {isSummerActive && offDaysThisWeek.length > 0 && status === 'active' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning/50 text-warning bg-warning/10">
                {offDaysThisWeek.length} off this week
              </Badge>
            )}
          </div>

          {/* Dates and details row */}
          {hasDates ? (
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{getDateDisplay()}</span>
              </div>
              
              {/* Only show off days info if summer is active */}
              {isSummerActive && offDaysCount > 0 && (
                <div className="flex items-center gap-1 text-warning">
                  <CalendarOff className="h-3 w-3" />
                  <span>{offDaysCount} day{offDaysCount !== 1 ? 's' : ''} off</span>
                </div>
              )}
              
              {workingDays !== null && (
                <span className="text-muted-foreground/70">
                  ~{workingDays} work days
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              No summer dates set yet
            </p>
          )}

          {/* Off days list - only show if summer is active */}
          {isSummerActive && hasDates && offDaysCount > 0 && (
            <div className="mt-2 text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-2 py-1.5">
              <span className="text-warning font-medium">Off:</span>{' '}
              {getOffDaysList()}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {!person.isSelf && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleText}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
