import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionSafe } from "@/utils/authSession";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Sun, AlertCircle, Calendar, ChevronLeft, ChevronRight,
  Bell, Pencil, ChevronDown, ChevronUp, Filter, Palmtree
} from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { getInitials } from "@/utils/nameUtils";
import { stripEmojis } from "./recruit-detail/utils";
import { toast } from "sonner";
import { SIGNED_PLUS_STAGES, isStageIn } from "@/utils/stageConstants";
import { EditSummerDatesDrawer } from "./EditSummerDatesDrawer";
import { hasMinAccess } from "@/utils/roleHierarchy";
import { UnifiedFilterDrawer, UnifiedFilterState, DEFAULT_UNIFIED_FILTER, isUnifiedFilterActive, getUnifiedFilterSummary, resolveFilteredUserIds } from "@/components/filters/UnifiedFilterDrawer";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Default summer dates
const DEFAULT_SUMMER_START = '2026-04-12';
const DEFAULT_SUMMER_END = '2026-09-27';

const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

interface PersonSummerInfo {
  userId: string;
  name: string;
  phone?: string;
  profilePhotoUrl?: string | null;
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
  hasGoals?: boolean;
}

// Generate Mon-Sat dates for a week containing `date`
const getWeekDays = (date: Date): Date[] => {
  // Start from Monday (weekStartsOn: 1)
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  // Mon through Sat = 6 days
  return Array.from({ length: 6 }, (_, i) => addDays(monday, i));
};

export const SummerAvailabilityView = () => {
  const [filterState, setFilterState] = useState<UnifiedFilterState>(DEFAULT_UNIFIED_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedRepId, setExpandedRepId] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<PersonSummerInfo | null>(null);
  const [showNeedsSetup, setShowNeedsSetup] = useState(true);
  const [nudgingUserId, setNudgingUserId] = useState<string | null>(null);

  const { data: teamAccess, isLoading: teamAccessLoading } = useTeamAccess();
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const accessLevel = teamAccess?.accessLevel || 'none';
  const canEditDates = hasMinAccess(accessLevel, 'mgmt_group_lead');

  const summerStartDate = parseLocalDate(DEFAULT_SUMMER_START);
  const summerEndDate = parseLocalDate(DEFAULT_SUMMER_END);

  // Current user data
  const { data: currentUserData } = useQuery({
    queryKey: ['current-user-summer'],
    queryFn: async () => {
      const { user } = await getSessionSafe();
      if (!user) return null;
      const [repResult, configResult, goalsResult] = await Promise.all([
        supabase.from('reps').select('user_id, name, phone, year, stage, profile_photo_url').eq('user_id', user.id).single(),
        supabase.from('season_config').select('personal_summer_start, personal_summer_end, excluded_summer_days').eq('user_id', user.id).single(),
        supabase.from('rep_goals').select('setup_complete').eq('user_id', user.id).maybeSingle(),
      ]);
      return { rep: repResult.data, config: configResult.data, goals: goalsResult.data };
    },
  });

  // Team data
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team-summer-availability', teamAccess?.accessibleUserIds],
    queryFn: async () => {
      if (!teamAccess?.accessibleUserIds?.length) return { reps: [], configs: [], goals: [] };
      const [repsResult, configsResult, goalsResult] = await Promise.all([
        supabase.from('reps').select('user_id, name, phone, year, stage').in('user_id', teamAccess.accessibleUserIds),
        supabase.from('season_config').select('user_id, personal_summer_start, personal_summer_end, excluded_summer_days').in('user_id', teamAccess.accessibleUserIds),
        supabase.from('rep_goals').select('user_id, setup_complete').in('user_id', teamAccess.accessibleUserIds),
      ]);
      return {
        reps: repsResult.data || [],
        configs: configsResult.data || [],
        goals: goalsResult.data || [],
      };
    },
    enabled: !!teamAccess?.accessibleUserIds?.length,
  });

  // Build people list
  const allPeople = useMemo(() => {
    const list: PersonSummerInfo[] = [];
    const configMap = new Map(teamData?.configs?.map(c => [c.user_id, c]) || []);
    const goalsMap = new Map(teamData?.goals?.map((g: any) => [g.user_id, g]) || []);
    const repsMap = new Map(teamData?.reps?.map(r => [r.user_id, r]) || []);

    // Current user
    if (currentUserData?.rep) {
      const stage = currentUserData.rep.stage;
      if (isStageIn(stage, SIGNED_PLUS_STAGES)) {
        const currentUserGoal = currentUserData.goals;
        const teamGoalData = goalsMap.get(currentUserData.rep.user_id);
        const hasGoals = !!(currentUserGoal?.setup_complete || (teamGoalData as any)?.setup_complete);
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
          hasGoals,
        });
      }
    }

    // Team members
    teamAccess?.accessibleReps?.forEach(accessibleRep => {
      if (accessibleRep.userId === currentUserData?.rep?.user_id) return;
      const rep = repsMap.get(accessibleRep.userId);
      const config = configMap.get(accessibleRep.userId);
      const goalData = goalsMap.get(accessibleRep.userId);
      const stage = rep?.stage || accessibleRep.stage;
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
        hasGoals: !!(goalData as any)?.setup_complete,
      });
    });

    return list;
  }, [currentUserData, teamData, teamAccess]);

  // Apply unified filter
  const people = useMemo(() => {
    if (!isUnifiedFilterActive(filterState)) return allPeople;

    const filteredIds = new Set(
      resolveFilteredUserIds(
        filterState,
        teamAccess?.accessibleReps || [],
        teamAccess?.mgmtGroups?.map(g => ({ id: g.id, name: g.name, teamIds: g.teamIds || [] })) || [],
        teamAccess?.accessibleUserIds || [],
        currentUserData?.rep?.user_id || null,
        accessLevel,
      )
    );

    return allPeople.filter(p => filteredIds.has(p.userId));
  }, [allPeople, filterState, teamAccess, currentUserData, accessLevel]);

  // Week days for the calendar grid
  const baseDate = addDays(today, weekOffset * 7);
  const weekDays = getWeekDays(baseDate);
  const weekStartStr = format(weekDays[0], 'MMM d');
  const weekEndStr = format(weekDays[5], 'MMM d');

  // Determine if this is the current week
  const currentWeekDays = getWeekDays(today);
  const isCurrentWeek = format(weekDays[0], 'yyyy-MM-dd') === format(currentWeekDays[0], 'yyyy-MM-dd');

  // Split into setup vs active
  const { readyPeople, needsSetupPeople } = useMemo(() => {
    const ready: PersonSummerInfo[] = [];
    const needs: PersonSummerInfo[] = [];

    people.forEach(p => {
      const missingDates = !p.personalSummerStart || !p.personalSummerEnd;
      const missingGoals = !p.hasGoals;
      if (missingDates || missingGoals) {
        needs.push(p);
      } else {
        ready.push(p);
      }
    });

    // Sort ready by name
    ready.sort((a, b) => {
      if (a.isSelf) return -1;
      if (b.isSelf) return 1;
      return a.name.localeCompare(b.name);
    });

    return { readyPeople: ready, needsSetupPeople: needs };
  }, [people]);

  // Stats - Off this week (count reps who have at least one off/excluded day in the displayed week)
  const offThisWeekCount = useMemo(() => {
    const weekDateStrs = weekDays.map(d => format(d, 'yyyy-MM-dd'));
    return readyPeople.filter(p => {
      return weekDateStrs.some(dayStr => {
        const start = p.personalSummerStart!;
        const end = p.personalSummerEnd!;
        if (dayStr < start || dayStr > end) return true;
        return p.excludedSummerDays.includes(dayStr);
      });
    }).length;
  }, [readyPeople, weekDays]);

  // Check if a rep is off on a given date
  const isRepOff = useCallback((person: PersonSummerInfo, dateStr: string): 'off' | 'excluded' | 'working' | 'not-started' | 'ended' => {
    if (!person.personalSummerStart || !person.personalSummerEnd) return 'off';
    if (dateStr < person.personalSummerStart) return 'not-started';
    if (dateStr > person.personalSummerEnd) return 'ended';
    if (person.excludedSummerDays.includes(dateStr)) return 'excluded';
    return 'working';
  }, []);

  // Nudge handler
  const handleNudge = async (person: PersonSummerInfo) => {
    setNudgingUserId(person.userId);
    try {
      const { session } = await getSessionSafe();
      if (!session) throw new Error('Not authenticated');

      const missingDates = !person.personalSummerStart || !person.personalSummerEnd;
      const nudgeType = missingDates ? 'dates' : 'goals';

      const { error } = await supabase.functions.invoke('send-setup-nudge', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { targetUserId: person.userId, nudgeType },
      });

      if (error) throw error;
      toast.success(`Nudge sent to ${(stripEmojis(person.name) || person.name).split(' ')[0]}`);
    } catch (err: any) {
      console.error('Nudge failed:', err);
      toast.error(err.message || 'Failed to send nudge');
    } finally {
      setNudgingUserId(null);
    }
  };

  const toggleExpand = (userId: string) => {
    setExpandedRepId(prev => prev === userId ? null : userId);
  };

  const getFirstName = (name: string) => (stripEmojis(name) || name).split(' ')[0];

  const isLoading = teamAccessLoading || teamLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-8 w-full rounded-lg" />
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (allPeople.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Palmtree className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">No team members found</p>
      </div>
    );
  }

  const filterSummary = getUnifiedFilterSummary(filterState);

  return (
    <div className="space-y-4">
      {/* Header with season info + filter */}
      <div className="bg-gradient-to-br from-amber-500/15 via-orange-400/10 to-yellow-500/5 border border-amber-500/20 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center shadow-sm">
              <Sun className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Summer 2026</h3>
              <p className="text-xs text-muted-foreground">
                {format(summerStartDate, 'MMM d')} – {format(summerEndDate, 'MMM d')} • {people.length} reps
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setFilterOpen(true)}
          >
            <Filter className="h-3.5 w-3.5" />
            {filterSummary ? 'Filtered' : 'Filter'}
          </Button>
        </div>

        {/* Stat chips */}
        <div className="flex items-center gap-2">
          {needsSetupPeople.length > 0 && (
            <button
              onClick={() => setShowNeedsSetup(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 text-xs font-medium text-destructive hover:bg-destructive/15 transition-colors"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {needsSetupPeople.length} Need Setup
            </button>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 text-xs font-medium text-muted-foreground">
            <Palmtree className="h-3.5 w-3.5" />
            {offThisWeekCount} Off This Week
          </div>
        </div>

        {filterSummary && (
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] font-normal">
              {filterSummary}
            </Badge>
            <button
              onClick={() => setFilterState(DEFAULT_UNIFIED_FILTER)}
              className="text-[10px] text-muted-foreground hover:text-foreground underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">
            {weekStartStr} – {weekEndStr}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {isCurrentWeek ? 'This Week' : format(weekDays[0], 'yyyy')}
          </p>
        </div>
        <button
          onClick={() => setWeekOffset(w => w + 1)}
          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Jump to current week */}
      {!isCurrentWeek && (
        <button
          onClick={() => setWeekOffset(0)}
          className="w-full text-xs text-primary font-medium py-1 hover:underline"
        >
          Jump to this week
        </button>
      )}

      {/* Calendar Grid */}
      <div className="border rounded-xl overflow-hidden bg-background shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-[1fr_repeat(6,36px)] border-b bg-muted/30">
          <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Rep
          </div>
          {weekDays.map((day, i) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const isToday = dayStr === todayStr;
            return (
              <div
                key={i}
                className={cn(
                  "flex flex-col items-center justify-center py-2 text-center",
                  isToday && "bg-primary/10"
                )}
              >
                <span className="text-[9px] font-semibold text-muted-foreground uppercase">
                  {format(day, 'EEE').slice(0, 2)}
                </span>
                <span className={cn(
                  "text-[11px] font-bold leading-tight",
                  isToday ? "text-primary" : "text-foreground"
                )}>
                  {format(day, 'd')}
                </span>
              </div>
            );
          })}
        </div>

        {/* Rep rows */}
        {readyPeople.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No reps with dates set match your filter
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {readyPeople.map((person) => {
              const isExpanded = expandedRepId === person.userId;
              const firstName = getFirstName(person.name);

              return (
                <div key={person.userId}>
                  {/* Main row */}
                  <div
                    className={cn(
                      "grid grid-cols-[1fr_repeat(6,36px)] items-center cursor-pointer transition-colors",
                      isExpanded ? "bg-muted/40" : "hover:bg-muted/20",
                      person.isSelf && "bg-primary/5"
                    )}
                    onClick={() => toggleExpand(person.userId)}
                  >
                    <div className="px-3 py-2.5 flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                        {firstName[0]}
                      </div>
                      <span className="text-xs font-medium text-foreground truncate">
                        {firstName}
                        {person.isSelf && <span className="text-muted-foreground ml-1">(you)</span>}
                      </span>
                    </div>

                    {weekDays.map((day, i) => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const status = isRepOff(person, dayStr);
                      const isToday = dayStr === todayStr;

                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center justify-center h-full py-2.5",
                            isToday && "bg-primary/5"
                          )}
                        >
                          {status === 'excluded' ? (
                            <div className="h-3.5 w-3.5 rounded-full bg-destructive/80 shadow-sm shadow-destructive/20" />
                          ) : status === 'not-started' ? (
                            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                          ) : status === 'ended' ? (
                            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                          ) : status === 'working' ? (
                            <div className="h-2 w-2 rounded-full bg-emerald-500/50" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 py-3 bg-muted/20 border-t border-dashed border-border/50">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-foreground">
                              {stripEmojis(person.name) || person.name}
                            </p>
                            {canEditDates && !person.isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1 px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPerson(person);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                                Edit Dates
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                            <div>
                              <span className="text-muted-foreground">Start:</span>{' '}
                              <span className="font-medium">
                                {person.personalSummerStart
                                  ? format(parseLocalDate(person.personalSummerStart), 'MMM d')
                                  : '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">End:</span>{' '}
                              <span className="font-medium">
                                {person.personalSummerEnd
                                  ? format(parseLocalDate(person.personalSummerEnd), 'MMM d')
                                  : '—'}
                              </span>
                            </div>
                          </div>

                          {person.excludedSummerDays.length > 0 ? (
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                                Off Days ({person.excludedSummerDays.length})
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {person.excludedSummerDays
                                  .sort()
                                  .map(d => (
                                    <span
                                      key={d}
                                      className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-medium",
                                        d === todayStr
                                          ? "bg-destructive/20 text-destructive"
                                          : d > todayStr
                                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                            : "bg-muted text-muted-foreground"
                                      )}
                                    >
                                      {format(parseLocalDate(d), 'MMM d (EEE)')}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              No off days scheduled
                            </p>
                          )}

                          {person.teamName && (
                            <p className="text-[10px] text-muted-foreground mt-2">
                              {person.mgmtGroupName ? `${person.mgmtGroupName} → ` : ''}{person.teamName}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/50" />
          Working
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-destructive/80" />
          Off
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          Not in range
        </div>
      </div>

      {/* Needs Setup Section */}
      {needsSetupPeople.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowNeedsSetup(v => !v)}
            className="w-full flex items-center justify-between px-1"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold text-foreground">
                Needs Setup
              </span>
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                {needsSetupPeople.length}
              </Badge>
            </div>
            {showNeedsSetup ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          <AnimatePresence>
            {showNeedsSetup && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5">
                  {needsSetupPeople.map(person => {
                    const firstName = getFirstName(person.name);
                    const missingDates = !person.personalSummerStart || !person.personalSummerEnd;
                    const missingGoals = !person.hasGoals;
                    const isNudging = nudgingUserId === person.userId;

                    return (
                      <div
                        key={person.userId}
                        className="flex items-center justify-between bg-muted/30 border border-border/50 rounded-xl px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive shrink-0">
                            {firstName[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              {firstName}
                              {person.isSelf && <span className="text-muted-foreground ml-1">(you)</span>}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {missingDates && missingGoals
                                ? 'No dates or goals'
                                : missingDates
                                  ? 'No summer dates'
                                  : 'No goals set'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {canEditDates && !person.isSelf && missingDates && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingPerson(person)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!person.isSelf && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-[10px] px-2"
                              disabled={isNudging}
                              onClick={() => handleNudge(person)}
                            >
                              <Bell className={cn("h-3 w-3", isNudging && "animate-pulse")} />
                              Nudge
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Edit Dates Drawer */}
      {editingPerson && (
        <EditSummerDatesDrawer
          open={!!editingPerson}
          onOpenChange={(open) => {
            if (!open) setEditingPerson(null);
          }}
          person={editingPerson}
        />
      )}

      {/* Unified Filter Drawer */}
      <UnifiedFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filterState={filterState}
        onFilterApply={setFilterState}
        mode="mygroup"
        hierarchy={teamAccess?.hierarchy}
        mgmtGroups={teamAccess?.mgmtGroups?.map(g => ({ id: g.id, name: g.name, teamIds: g.teamIds || [] }))}
        teams={teamAccess?.teams?.map(t => ({ id: t.id, name: t.name }))}
        accessibleReps={teamAccess?.accessibleReps?.map(r => ({ userId: r.userId, teamId: r.teamId, mgmtGroupId: r.mgmtGroupId, year: r.year })) || []}
        accessLevel={accessLevel}
        repCount={people.length}
      />
    </div>
  );
};
