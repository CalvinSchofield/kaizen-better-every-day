import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Target, TrendingUp, TrendingDown, Minus, AlertTriangle, 
  CheckCircle2, Calendar, Sun, ArrowUpDown
} from "lucide-react";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { stripEmojis } from "./recruit-detail/utils";
import { EditSummerDatesDrawer } from "./EditSummerDatesDrawer";
import { SIGNED_PLUS_STAGES, isStageIn } from "@/utils/stageConstants";
import { calculateSalesPace, SalesPaceInput } from "@/utils/salesPaceCalculator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Season constants
const PRESEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';
const DEFAULT_SUMMER_START = '2026-04-12';
const DEFAULT_SUMMER_END = '2026-09-27';

type PaceStatus = 'ahead' | 'on-track' | 'behind' | 'critical' | 'no-goals';
type SortOption = 'at-risk' | 'alphabetical' | 'by-year';

interface RepGoalInfo {
  userId: string;
  notionPageId: string;
  name: string;
  year: string;
  stage?: string;
  // Goals
  preseasonGoal: number;
  mustDoGoal: number;
  willDoGoal: number;
  couldDoGoal: number;
  focusTier: string | null;
  cancelRate: number;
  setupComplete: boolean;
  // Dates
  personalSummerStart: string | null;
  personalSummerEnd: string | null;
  // Progress
  currentFpPlus: number;
  currentPrmr: number;
  knockingDays: number;
  futurePlannedDays: number;
  // Pace
  paceStatus: PaceStatus;
  pacePercentage: number;
  dailyTarget: number;
  expectedAtThisPoint: number;
  variance: number;
  daysRemaining: number;
  isInPreseason: boolean;
}

const STATUS_CONFIG: Record<PaceStatus, { label: string; icon: typeof TrendingUp; color: string; bg: string }> = {
  ahead: { label: 'Ahead', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  'on-track': { label: 'On Track', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-100' },
  behind: { label: 'Behind', icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-100' },
  critical: { label: 'At Risk', icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
  'no-goals': { label: 'No Goals', icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted' },
};

interface GoalsTabViewProps {
  onRepClick?: (notionPageId: string) => void;
}

export const GoalsTabView = ({ onRepClick }: GoalsTabViewProps) => {
  const [statusFilter, setStatusFilter] = useState<PaceStatus | 'all'>('all');
  const [sortOption, setSortOption] = useState<SortOption>('at-risk');
  const [editingPerson, setEditingPerson] = useState<RepGoalInfo | null>(null);
  const { data: teamAccess, isLoading: teamAccessLoading } = useTeamAccess();
  
  const today = startOfDay(new Date());
  
  // Check if we're in preseason globally
  const isGlobalPreseason = !isAfter(today, parseISO(PRESEASON_END));

  // Fetch reps data
  const { data: repsData, isLoading: repsLoading } = useQuery({
    queryKey: ['goals-tab-reps', teamAccess?.accessibleUserIds],
    queryFn: async () => {
      if (!teamAccess?.accessibleUserIds?.length) return [];
      const { data } = await supabase
        .from('reps')
        .select('id, user_id, name, year, stage')
        .in('user_id', teamAccess.accessibleUserIds);
      return data || [];
    },
    enabled: !!teamAccess?.accessibleUserIds?.length,
  });

  // Fetch goals data
  const { data: goalsData, isLoading: goalsLoading } = useQuery({
    queryKey: ['goals-tab-goals', teamAccess?.accessibleUserIds],
    queryFn: async () => {
      if (!teamAccess?.accessibleUserIds?.length) return [];
      const { data } = await supabase
        .from('rep_goals')
        .select('user_id, preseason_fp_goal, must_do_fp_goal, will_do_fp_goal, could_do_fp_goal, focus_tier, cancel_rate, setup_complete')
        .in('user_id', teamAccess.accessibleUserIds);
      return data || [];
    },
    enabled: !!teamAccess?.accessibleUserIds?.length,
  });

  // Fetch season config
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['goals-tab-config', teamAccess?.accessibleUserIds],
    queryFn: async () => {
      if (!teamAccess?.accessibleUserIds?.length) return [];
      const { data } = await supabase
        .from('season_config')
        .select('user_id, personal_summer_start, personal_summer_end')
        .in('user_id', teamAccess.accessibleUserIds);
      return data || [];
    },
    enabled: !!teamAccess?.accessibleUserIds?.length,
  });

  // Fetch daily entries for progress
  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['goals-tab-entries', teamAccess?.accessibleUserIds],
    queryFn: async () => {
      if (!teamAccess?.accessibleUserIds?.length) return [];
      const { data } = await supabase
        .from('daily_entries')
        .select('user_id, entry_date, fp_plus, prmr, doors_knocked, work_start_time, work_end_time, is_finalized')
        .in('user_id', teamAccess.accessibleUserIds)
        .gte('entry_date', PRESEASON_START);
      return data || [];
    },
    enabled: !!teamAccess?.accessibleUserIds?.length,
  });

  // Fetch planned work days (via backend function so leaders can see downline)
  const { data: plannedDaysData, isLoading: plannedLoading } = useQuery({
    queryKey: ['goals-tab-planned', teamAccess?.accessibleUserIds],
    queryFn: async () => {
      if (!teamAccess?.accessibleUserIds?.length) return [] as Array<{ user_id: string; planned_date: string }>;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data, error } = await supabase.functions.invoke('fetch-downline-planned-days', {
        body: {
          userIds: teamAccess.accessibleUserIds,
          startDate: PRESEASON_START,
          endDate: DEFAULT_SUMMER_END,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return (data?.plannedDays || []) as Array<{ user_id: string; planned_date: string }>;
    },
    enabled: !!teamAccess?.accessibleUserIds?.length,
  });

  // Build the rep goal info list
  const repGoals = useMemo((): RepGoalInfo[] => {
    if (!repsData || !goalsData) return [];

    const goalsMap = new Map(goalsData.map(g => [g.user_id, g]));
    const configMap = new Map(configData?.map(c => [c.user_id, c]) || []);
    const entriesMap = new Map<string, typeof entriesData>();
    const plannedMap = new Map<string, typeof plannedDaysData>();

    // Group entries by user
    entriesData?.forEach(e => {
      if (!entriesMap.has(e.user_id)) entriesMap.set(e.user_id, []);
      entriesMap.get(e.user_id)!.push(e);
    });

    // Group planned days by user
    plannedDaysData?.forEach(p => {
      if (!plannedMap.has(p.user_id)) plannedMap.set(p.user_id, []);
      plannedMap.get(p.user_id)!.push(p);
    });

    return repsData
      .filter(rep => {
        // Only show SIGNED_PLUS_STAGES
        return isStageIn(rep.stage, SIGNED_PLUS_STAGES);
      })
      .map(rep => {
        const goals = goalsMap.get(rep.user_id!);
        const config = configMap.get(rep.user_id!);
        const entries = entriesMap.get(rep.user_id!) || [];
        const plannedDays = plannedMap.get(rep.user_id!) || [];

        const personalSummerStart = config?.personal_summer_start || null;
        const personalSummerEnd = config?.personal_summer_end || null;

        // Determine if this rep is in their preseason
        const hasPersonalSummerStarted = personalSummerStart 
          ? !isAfter(parseISO(personalSummerStart), today) 
          : false;
        const isRepInPreseason = isGlobalPreseason && !hasPersonalSummerStarted;

        // Calculate progress from entries
        const seasonStart = isRepInPreseason ? PRESEASON_START : (personalSummerStart || DEFAULT_SUMMER_START);
        const seasonEntries = entries.filter(e => e.entry_date >= seasonStart && e.is_finalized);
        
        const currentFpPlus = seasonEntries.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
        const currentPrmr = seasonEntries.reduce((sum, e) => sum + (Number(e.prmr) || 0), 0);
        const knockingDays = seasonEntries.filter(e => 
          (e.doors_knocked || 0) >= 4 && e.work_start_time && e.work_end_time
        ).length;

        // Calculate pace using the shared utility
        const paceInput: SalesPaceInput = {
          goals: goals ? {
            preseason_fp_goal: goals.preseason_fp_goal,
            must_do_fp_goal: goals.must_do_fp_goal,
            will_do_fp_goal: goals.will_do_fp_goal,
            could_do_fp_goal: goals.could_do_fp_goal,
            cancel_rate: goals.cancel_rate,
            setup_complete: goals.setup_complete,
          } : null,
          plannedDays,
          knockingDays,
          currentFpPlus,
          currentPrmr,
          efpModeEnabled: false, // Use FP+ for leader view
          calculateEfp: (prmr) => prmr / 85,
          personalSummerStart,
        };

        const paceResult = calculateSalesPace(paceInput);

        let paceStatus: PaceStatus = 'no-goals';
        let pacePercentage = 0;
        let dailyTarget = 0;
        let expectedAtThisPoint = 0;
        let variance = 0;
        let futurePlannedDays = 0;
        let daysRemaining = 0;

        // Determine the active goal for this rep
        const activeGoal = isRepInPreseason 
          ? (goals?.preseason_fp_goal || 0)
          : (goals?.will_do_fp_goal || goals?.must_do_fp_goal || 0);
        const hasGoals = goals?.setup_complete && activeGoal > 0;

        if (paceResult) {
          expectedAtThisPoint = paceResult.expectedAtThisPoint;
          variance = paceResult.paceVariance;
          dailyTarget = paceResult.remainingDailyNeeded;
          futurePlannedDays = paceResult.futurePlannedDays;
          daysRemaining = paceResult.futurePlannedDays;
          
          // Calculate pace percentage based on progress vs goal (simpler, more accurate)
          const goalToUse = paceResult.fundedGoal;
          pacePercentage = goalToUse > 0 ? (currentFpPlus / goalToUse) * 100 : 0;

          // Determine status based on variance (ahead/behind expected pace)
          if (variance >= 0) {
            paceStatus = variance > 1 ? 'ahead' : 'on-track';
          } else {
            // Behind - check severity based on how far behind
            const behindPercentage = expectedAtThisPoint > 0 
              ? (Math.abs(variance) / expectedAtThisPoint) * 100 
              : 100;
            paceStatus = behindPercentage > 35 ? 'critical' : 'behind';
          }
        } else if (hasGoals) {
          // Has goals but no pace result (likely 0 planned days in current season)
          // Count total future planned days (all seasons) to show meaningful data
          const todayStr = format(today, 'yyyy-MM-dd');
          const totalFuturePlanned = plannedDays.filter(d => d.planned_date > todayStr).length;
          futurePlannedDays = totalFuturePlanned;
          daysRemaining = totalFuturePlanned;
          
          if (knockingDays === 0 && currentFpPlus === 0) {
            // Haven't started yet - show as needing to plan/start
            paceStatus = totalFuturePlanned > 0 ? 'on-track' : 'behind';
            pacePercentage = 0;
          } else {
            // Have worked but no future days planned
            pacePercentage = activeGoal > 0 ? (currentFpPlus / activeGoal) * 100 : 0;
            paceStatus = 'behind'; // No future days is concerning
          }
          
          // Calculate simple daily target
          if (daysRemaining > 0 && activeGoal > 0) {
            dailyTarget = Math.max(0, activeGoal - currentFpPlus) / daysRemaining;
          }
        }

        return {
          userId: rep.user_id!,
          notionPageId: rep.id,
          name: rep.name,
          year: rep.year || 'Rookie',
          stage: rep.stage || undefined,
          preseasonGoal: goals?.preseason_fp_goal || 0,
          mustDoGoal: goals?.must_do_fp_goal || 0,
          willDoGoal: goals?.will_do_fp_goal || 0,
          couldDoGoal: goals?.could_do_fp_goal || 0,
          focusTier: goals?.focus_tier || null,
          cancelRate: goals?.cancel_rate || 0,
          setupComplete: goals?.setup_complete || false,
          personalSummerStart,
          personalSummerEnd,
          currentFpPlus,
          currentPrmr,
          knockingDays,
          futurePlannedDays,
          paceStatus,
          pacePercentage,
          dailyTarget,
          expectedAtThisPoint,
          variance,
          daysRemaining,
          isInPreseason: isRepInPreseason,
        };
      })
      .sort((a, b) => {
        const statusOrder: Record<PaceStatus, number> = {
          critical: 0,
          behind: 1,
          'on-track': 2,
          ahead: 3,
          'no-goals': 4,
        };

        if (sortOption === 'alphabetical') {
          return a.name.localeCompare(b.name);
        }
        
        if (sortOption === 'by-year') {
          const yearOrder: Record<string, number> = { 'Rookie': 0, 'Sophomore': 1, 'Vet': 2 };
          const yearDiff = (yearOrder[a.year] || 3) - (yearOrder[b.year] || 3);
          if (yearDiff !== 0) return yearDiff;
          // Within same year, sort by status
          const statusDiff = statusOrder[a.paceStatus] - statusOrder[b.paceStatus];
          if (statusDiff !== 0) return statusDiff;
          return a.pacePercentage - b.pacePercentage;
        }
        
        // Default: at-risk first (by status priority, then by pace percentage)
        const statusDiff = statusOrder[a.paceStatus] - statusOrder[b.paceStatus];
        if (statusDiff !== 0) return statusDiff;
        return a.pacePercentage - b.pacePercentage;
      });
  }, [repsData, goalsData, configData, entriesData, plannedDaysData, isGlobalPreseason, today, sortOption]);

  // Filter by status
  const filteredReps = useMemo(() => {
    if (statusFilter === 'all') return repGoals;
    return repGoals.filter(r => r.paceStatus === statusFilter);
  }, [repGoals, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: repGoals.length,
    ahead: repGoals.filter(r => r.paceStatus === 'ahead').length,
    onTrack: repGoals.filter(r => r.paceStatus === 'on-track').length,
    behind: repGoals.filter(r => r.paceStatus === 'behind').length,
    critical: repGoals.filter(r => r.paceStatus === 'critical').length,
    noGoals: repGoals.filter(r => r.paceStatus === 'no-goals').length,
  }), [repGoals]);

  const isLoading = teamAccessLoading || repsLoading || goalsLoading || configLoading || entriesLoading || plannedLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (repGoals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Target className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">No team members with goals to display</p>
      </div>
    );
  }

  const getActiveGoal = (rep: RepGoalInfo) => {
    if (rep.isInPreseason) return rep.preseasonGoal;
    const tier = rep.focusTier || 'willDo';
    if (tier === 'mustDo') return rep.mustDoGoal;
    if (tier === 'couldDo') return rep.couldDoGoal;
    return rep.willDoGoal;
  };

  const getTierLabel = (rep: RepGoalInfo) => {
    if (rep.isInPreseason) return 'Preseason';
    const tier = rep.focusTier || 'willDo';
    if (tier === 'mustDo') return 'Must Do';
    if (tier === 'couldDo') return 'Could Do';
    return 'Will Do';
  };

  const formatVariance = (variance: number) => {
    const sign = variance >= 0 ? '+' : '';
    return `${sign}${variance.toFixed(1)}`;
  };

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Team Goals</h3>
              <p className="text-xs text-muted-foreground">
                {isGlobalPreseason ? 'Preseason' : 'Summer'} • {stats.total} reps tracked
              </p>
            </div>
          </div>
          
          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ArrowUpDown className="h-4 w-4 mr-1" />
                <span className="text-xs">
                  {sortOption === 'at-risk' ? 'At Risk' : sortOption === 'alphabetical' ? 'A-Z' : 'Year'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortOption('at-risk')}>
                At Risk First
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption('alphabetical')}>
                Alphabetical
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption('by-year')}>
                By Year
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status filter buttons */}
        <div className="grid grid-cols-5 gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-lg py-2 px-1 text-center transition-all ${
              statusFilter === 'all'
                ? 'bg-background shadow-sm ring-1 ring-border'
                : 'bg-background/50 hover:bg-background/80'
            }`}
          >
            <div className="text-sm font-bold">{stats.total}</div>
            <div className="text-[9px] text-muted-foreground">All</div>
          </button>
          <button
            onClick={() => setStatusFilter('ahead')}
            className={`rounded-lg py-2 px-1 text-center transition-all ${
              statusFilter === 'ahead'
                ? 'bg-emerald-100 shadow-sm ring-1 ring-emerald-200'
                : 'bg-background/50 hover:bg-background/80'
            }`}
          >
            <div className="text-sm font-bold text-emerald-600">{stats.ahead}</div>
            <div className="text-[9px] text-muted-foreground">Ahead</div>
          </button>
          <button
            onClick={() => setStatusFilter('on-track')}
            className={`rounded-lg py-2 px-1 text-center transition-all ${
              statusFilter === 'on-track'
                ? 'bg-blue-100 shadow-sm ring-1 ring-blue-200'
                : 'bg-background/50 hover:bg-background/80'
            }`}
          >
            <div className="text-sm font-bold text-blue-600">{stats.onTrack}</div>
            <div className="text-[9px] text-muted-foreground">On Track</div>
          </button>
          <button
            onClick={() => setStatusFilter('behind')}
            className={`rounded-lg py-2 px-1 text-center transition-all ${
              statusFilter === 'behind'
                ? 'bg-amber-100 shadow-sm ring-1 ring-amber-200'
                : 'bg-background/50 hover:bg-background/80'
            }`}
          >
            <div className="text-sm font-bold text-amber-600">{stats.behind}</div>
            <div className="text-[9px] text-muted-foreground">Behind</div>
          </button>
          <button
            onClick={() => setStatusFilter('critical')}
            className={`rounded-lg py-2 px-1 text-center transition-all ${
              statusFilter === 'critical'
                ? 'bg-destructive/10 shadow-sm ring-1 ring-destructive/20'
                : 'bg-background/50 hover:bg-background/80'
            }`}
          >
            <div className="text-sm font-bold text-destructive">{stats.critical}</div>
            <div className="text-[9px] text-muted-foreground">At Risk</div>
          </button>
        </div>
      </div>

      {/* No goals warning */}
      {stats.noGoals > 0 && statusFilter === 'all' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          <span>{stats.noGoals} rep{stats.noGoals > 1 ? 's' : ''} without goals set up</span>
        </div>
      )}

      {/* Rep cards */}
      <div className="space-y-3">
        {filteredReps.map(rep => {
          const StatusIcon = STATUS_CONFIG[rep.paceStatus].icon;
          const activeGoal = getActiveGoal(rep);
          const progressPercent = activeGoal > 0 ? Math.min(100, (rep.currentFpPlus / activeGoal) * 100) : 0;
          const cleanName = stripEmojis(rep.name) || rep.name;

          return (
            <div
              key={rep.userId}
              className="bg-card border rounded-xl p-3 space-y-2.5"
            >
              {/* Header row */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => onRepClick?.(rep.notionPageId)}
                  className="flex items-center gap-2 min-w-0 flex-1"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{cleanName}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {rep.year}
                    </Badge>
                  </div>
                </button>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${STATUS_CONFIG[rep.paceStatus].bg}`}>
                  <StatusIcon className={`h-3 w-3 ${STATUS_CONFIG[rep.paceStatus].color}`} />
                  <span className={`text-xs font-medium ${STATUS_CONFIG[rep.paceStatus].color}`}>
                    {STATUS_CONFIG[rep.paceStatus].label}
                  </span>
                </div>
              </div>

              {rep.paceStatus === 'no-goals' ? (
                <p className="text-sm text-muted-foreground">Goals not set up yet</p>
              ) : (
                <>
                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {rep.currentFpPlus.toFixed(1)} / {activeGoal} FP+
                      </span>
                      <span className="font-medium">{progressPercent.toFixed(0)}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                  </div>

                  {/* Pace info row */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className={rep.variance >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                        {formatVariance(rep.variance)} FP+
                      </span>
                      <span className="text-muted-foreground">
                        {rep.daysRemaining} days left
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      Need {rep.dailyTarget.toFixed(2)}/day
                    </span>
                  </div>

                  {/* Goal tiers row */}
                  <div className="flex items-center justify-between pt-1 border-t text-xs">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={rep.isInPreseason ? 'default' : 'secondary'} 
                        className="text-[10px] h-5"
                      >
                        {getTierLabel(rep)}
                      </Badge>
                      {!rep.isInPreseason && (
                        <span className="text-muted-foreground">
                          M:{rep.mustDoGoal} • W:{rep.willDoGoal} • C:{rep.couldDoGoal}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPerson(rep);
                      }}
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Dates
                    </Button>
                  </div>

                  {/* Summer dates info */}
                  {rep.personalSummerStart && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Sun className="h-3 w-3" />
                      <span>
                        {format(parseISO(rep.personalSummerStart), 'MMM d')}
                        {rep.personalSummerEnd && ` – ${format(parseISO(rep.personalSummerEnd), 'MMM d')}`}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit dates drawer */}
      {editingPerson && (
        <EditSummerDatesDrawer
          open={!!editingPerson}
          onOpenChange={(open) => !open && setEditingPerson(null)}
          person={{
            userId: editingPerson.userId,
            name: editingPerson.name,
            personalSummerStart: editingPerson.personalSummerStart,
            personalSummerEnd: editingPerson.personalSummerEnd,
          }}
        />
      )}
    </div>
  );
};
