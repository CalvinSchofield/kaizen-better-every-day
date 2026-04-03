import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionSafe } from "@/utils/authSession";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Target, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle2, Calendar, Sun, Filter, ChevronDown, ChevronUp,
  Bell, User
} from "lucide-react";
import { format, parseISO, isAfter, startOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subWeeks } from "date-fns";
import { stripEmojis } from "./recruit-detail/utils";
import { getInitials } from "@/utils/nameUtils";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";
import { EditSummerDatesDrawer } from "./EditSummerDatesDrawer";
import { SIGNED_PLUS_STAGES, isStageIn } from "@/utils/stageConstants";
import { calculateSalesPace, SalesPaceInput } from "@/utils/salesPaceCalculator";
import { UnifiedFilterDrawer, UnifiedFilterState, DEFAULT_UNIFIED_FILTER, isUnifiedFilterActive, resolveFilteredUserIds } from "@/components/filters/UnifiedFilterDrawer";
import { useAvailableTeamReportsPresets, ReportsDatePreset } from "@/hooks/useAvailableDatePresets";
import { CustomDateRangeDrawer } from "@/components/shared/CustomDateRangeDrawer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { GOAL_TIER_CONFIG, SummerTier } from "@/config/goalTiers";

// Season constants
const PRESEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';
const DEFAULT_SUMMER_START = '2026-04-12';
const DEFAULT_SUMMER_END = '2026-09-27';

type PaceStatus = 'ahead' | 'on-track' | 'behind' | 'critical' | 'no-goals';

interface RepGoalInfo {
  userId: string;
  notionPageId: string;
  name: string;
  year: string;
  stage?: string;
  profilePhotoUrl?: string | null;
  efpModeEnabled: boolean;
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
  // Progress (full season) — uses the rep's metric (FP+ or EFP)
  currentProgress: number;
  currentFpPlus: number;
  currentPrmr: number;
  knockingDays: number;
  futurePlannedDays: number;
  // Period-filtered progress
  periodProgress: number;
  periodFpPlus: number;
  periodDoors: number;
  periodKnockingDays: number;
  // Pace
  paceStatus: PaceStatus;
  pacePercentage: number;
  dailyTarget: number;
  expectedAtThisPoint: number;
  variance: number;
  daysRemaining: number;
  isInPreseason: boolean;
  // Team info for filter
  teamId?: string | null;
  teamName?: string | null;
  mgmtGroupId?: string | null;
  mgmtGroupName?: string | null;
}

const STATUS_CONFIG: Record<PaceStatus, { label: string; icon: typeof TrendingUp; color: string; bg: string; border: string }> = {
  ahead: { label: 'Ahead', icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-l-emerald-500' },
  'on-track': { label: 'On Track', icon: CheckCircle2, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', border: 'border-l-blue-500' },
  behind: { label: 'Behind', icon: TrendingDown, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-l-amber-500' },
  critical: { label: 'At Risk', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', border: 'border-l-red-500' },
  'no-goals': { label: 'No Goals', icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted/50', border: 'border-l-muted-foreground/30' },
};

const presetConfig: { key: ReportsDatePreset; label: string; isLive?: boolean }[] = [
  { key: 'today', label: 'Live', isLive: true },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'lastWeek', label: 'Last Week' },
  { key: 'month', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'preseason', label: 'Preseason' },
  { key: 'ytd', label: 'YTD' },
];

interface GoalsTabViewProps {
  onRepClick?: (notionPageId: string) => void;
}

export const GoalsTabView = ({ onRepClick }: GoalsTabViewProps) => {
  // Filter state
  const [filterState, setFilterState] = useState<UnifiedFilterState>(DEFAULT_UNIFIED_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);

  // Date preset state
  const [datePreset, setDatePreset] = useState<ReportsDatePreset | null>(null);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showCustomSheet, setShowCustomSheet] = useState(false);

  // Goal tier selector
  const [activeTier, setActiveTier] = useState<SummerTier>('willDo');

  // UI state
  const [expandedRepId, setExpandedRepId] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<RepGoalInfo | null>(null);
  const [showNoGoals, setShowNoGoals] = useState(true);
  const [nudgingUserId, setNudgingUserId] = useState<string | null>(null);

  const { data: teamAccess, isLoading: teamAccessLoading } = useTeamAccess();
  const accessLevel = teamAccess?.accessLevel || 'none';

  const today = startOfDay(new Date());
  const isGlobalPreseason = !isAfter(today, parseISO(PRESEASON_END));

  // Resolve filtered user IDs
  const filteredUserIds = useMemo(() => {
    if (!teamAccess) return [];
    if (!isUnifiedFilterActive(filterState)) return teamAccess.accessibleUserIds || [];
    return resolveFilteredUserIds(
      filterState,
      teamAccess.accessibleReps || [],
      teamAccess.mgmtGroups?.map(g => ({ id: g.id, name: g.name, teamIds: g.teamIds || [] })) || [],
      teamAccess.accessibleUserIds || [],
      null,
      accessLevel,
    );
  }, [teamAccess, filterState, accessLevel]);

  // Date presets
  const { availablePresets, autoSelectedPreset, isFetching: presetsFetching } = useAvailableTeamReportsPresets(filteredUserIds);
  const effectivePreset = datePreset ?? 'ytd';

  // Calculate date range from preset
  const dateRange = useMemo(() => {
    const now = new Date();
    if (effectivePreset === 'custom' && customStartDate && customEndDate) {
      return { start: format(customStartDate, 'yyyy-MM-dd'), end: format(customEndDate, 'yyyy-MM-dd') };
    }
    switch (effectivePreset) {
      case 'today': return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      case 'yesterday': { const y = subDays(now, 1); return { start: format(y, 'yyyy-MM-dd'), end: format(y, 'yyyy-MM-dd') }; }
      case 'week': return { start: format(startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'), end: format(endOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd') };
      case 'lastWeek': return { start: format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }), 'yyyy-MM-dd'), end: format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }), 'yyyy-MM-dd') };
      case 'month': return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'lastMonth': return { start: format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'), end: format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd') };
      case 'preseason': return { start: PRESEASON_START, end: format(now < parseISO(PRESEASON_END) ? now : parseISO(PRESEASON_END), 'yyyy-MM-dd') };
      case 'ytd':
      default: return { start: PRESEASON_START, end: format(now, 'yyyy-MM-dd') };
    }
  }, [effectivePreset, customStartDate, customEndDate]);

  // Fetch reps data (with profile photos)
  const { data: repsData, isLoading: repsLoading } = useQuery({
    queryKey: ['goals-tab-reps', filteredUserIds],
    queryFn: async () => {
      if (!filteredUserIds.length) return [];
      const { data } = await supabase
        .from('reps')
        .select('id, user_id, name, year, stage, profile_photo_url, efp_mode_enabled')
        .in('user_id', filteredUserIds);
      return data || [];
    },
    enabled: filteredUserIds.length > 0,
  });

  // Fetch goals data
  const { data: goalsData, isLoading: goalsLoading } = useQuery({
    queryKey: ['goals-tab-goals', filteredUserIds],
    queryFn: async () => {
      if (!filteredUserIds.length) return [];
      const { data } = await supabase
        .from('rep_goals')
        .select('user_id, preseason_fp_goal, must_do_fp_goal, will_do_fp_goal, could_do_fp_goal, focus_tier, cancel_rate, setup_complete')
        .in('user_id', filteredUserIds);
      return data || [];
    },
    enabled: filteredUserIds.length > 0,
  });

  // Fetch season config
  const { data: configData } = useQuery({
    queryKey: ['goals-tab-config', filteredUserIds],
    queryFn: async () => {
      if (!filteredUserIds.length) return [];
      const { data } = await supabase
        .from('season_config')
        .select('user_id, personal_summer_start, personal_summer_end')
        .in('user_id', filteredUserIds);
      return data || [];
    },
    enabled: filteredUserIds.length > 0,
  });

  // Fetch all entries (full season for pace, will filter by date range for period stats)
  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['goals-tab-entries', filteredUserIds],
    queryFn: async () => {
      if (!filteredUserIds.length) return [];
      const { data } = await supabase
        .from('daily_entries')
        .select('user_id, entry_date, fp_plus, prmr, doors_knocked, work_start_time, work_end_time, is_finalized, sales_log')
        .in('user_id', filteredUserIds)
        .gte('entry_date', PRESEASON_START);
      return data || [];
    },
    enabled: filteredUserIds.length > 0,
  });

  // Fetch planned work days
  const { data: plannedDaysData, isLoading: plannedLoading } = useQuery({
    queryKey: ['goals-tab-planned', filteredUserIds],
    queryFn: async () => {
      if (!filteredUserIds.length) return [] as Array<{ user_id: string; planned_date: string }>;
      const { session } = await getSessionSafe();
      if (!session) return [];
      const { data, error } = await supabase.functions.invoke('fetch-downline-planned-days', {
        body: { userIds: filteredUserIds, startDate: PRESEASON_START, endDate: DEFAULT_SUMMER_END },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      return (data?.plannedDays || []) as Array<{ user_id: string; planned_date: string }>;
    },
    enabled: filteredUserIds.length > 0,
  });

  // Get goal for a specific tier
  const getGoalForTier = useCallback((goals: any, tier: SummerTier, isPreseason: boolean) => {
    if (isPreseason) return goals?.preseason_fp_goal || 0;
    switch (tier) {
      case 'mustDo': return goals?.must_do_fp_goal || 0;
      case 'couldDo': return goals?.could_do_fp_goal || 0;
      case 'willDo':
      default: return goals?.will_do_fp_goal || 0;
    }
  }, []);

  // Build the rep goal info list
  const repGoals = useMemo((): RepGoalInfo[] => {
    if (!repsData || !goalsData) return [];

    const goalsMap = new Map(goalsData.map(g => [g.user_id, g]));
    const configMap = new Map(configData?.map(c => [c.user_id, c]) || []);
    const entriesMap = new Map<string, typeof entriesData>();
    const plannedMap = new Map<string, typeof plannedDaysData>();

    entriesData?.forEach(e => {
      if (!entriesMap.has(e.user_id)) entriesMap.set(e.user_id, []);
      entriesMap.get(e.user_id)!.push(e);
    });

    plannedDaysData?.forEach(p => {
      if (!plannedMap.has(p.user_id)) plannedMap.set(p.user_id, []);
      plannedMap.get(p.user_id)!.push(p);
    });

    // Get accessible rep metadata for team/mgmt info
    const accessibleRepsMap = new Map(
      (teamAccess?.accessibleReps || []).map(r => [r.userId, r])
    );

    return repsData
      .filter(rep => isStageIn(rep.stage, SIGNED_PLUS_STAGES))
      .map(rep => {
        const goals = goalsMap.get(rep.user_id!);
        const config = configMap.get(rep.user_id!);
        const entries = entriesMap.get(rep.user_id!) || [];
        const plannedDays = plannedMap.get(rep.user_id!) || [];
        const accessibleRep = accessibleRepsMap.get(rep.user_id!);

        const personalSummerStart = config?.personal_summer_start || null;
        const personalSummerEnd = config?.personal_summer_end || null;

        const hasPersonalSummerStarted = personalSummerStart
          ? !isAfter(parseISO(personalSummerStart), today)
          : false;
        const isRepInPreseason = isGlobalPreseason && !hasPersonalSummerStarted;

        // Full season progress
        const seasonStart = isRepInPreseason ? PRESEASON_START : (personalSummerStart || DEFAULT_SUMMER_START);
        const seasonEntries = entries.filter(e => e.entry_date >= seasonStart && e.is_finalized);

        const currentFpPlus = seasonEntries.reduce((sum, e) => {
          const salesLog = (e as any).sales_log as any[] | null;
          if (salesLog && salesLog.length > 0) return sum + calculateFromSalesLog(salesLog).fp;
          return sum + (Number(e.fp_plus) || 0);
        }, 0);
        const currentPrmr = seasonEntries.reduce((sum, e) => {
          const salesLog = (e as any).sales_log as any[] | null;
          if (salesLog && salesLog.length > 0) return sum + calculateFromSalesLog(salesLog).prmr;
          return sum + (Number(e.prmr) || 0);
        }, 0);
        const knockingDays = seasonEntries.filter(e =>
          (e.doors_knocked || 0) >= 4 && e.work_start_time && e.work_end_time
        ).length;

        // Period-filtered progress
        const periodEntries = entries.filter(e =>
          e.entry_date >= dateRange.start && e.entry_date <= dateRange.end && e.is_finalized
        );
        const periodFpPlus = periodEntries.reduce((sum, e) => {
          const salesLog = (e as any).sales_log as any[] | null;
          if (salesLog && salesLog.length > 0) return sum + calculateFromSalesLog(salesLog).fp;
          return sum + (Number(e.fp_plus) || 0);
        }, 0);
        const periodDoors = periodEntries.reduce((sum, e) => sum + (Number(e.doors_knocked) || 0), 0);
        const periodKnockingDays = periodEntries.filter(e =>
          (e.doors_knocked || 0) >= 4 && e.work_start_time && e.work_end_time
        ).length;

        // Determine if this rep uses EFP mode
        const isVet = rep.year === 'Vet';
        const efpModeEnabled = isVet && ((rep as any).efp_mode_enabled || false);
        const calculateEfp = (prmr: number) => prmr / 85;

        // The rep's progress in their own metric
        const currentProgress = efpModeEnabled ? calculateEfp(currentPrmr) : currentFpPlus;

        // Pace calculation using the SELECTED tier (not the rep's focus tier)
        const activeGoal = getGoalForTier(goals, activeTier, isRepInPreseason);

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
          efpModeEnabled,
          calculateEfp,
          personalSummerStart,
          activeTier: isRepInPreseason ? 'preseason' : activeTier,
        };

        const paceResult = calculateSalesPace(paceInput);

        let paceStatus: PaceStatus = 'no-goals';
        let pacePercentage = 0;
        let dailyTarget = 0;
        let expectedAtThisPoint = 0;
        let variance = 0;
        let futurePlannedDays = 0;
        let daysRemaining = 0;

        const hasGoals = goals?.setup_complete && activeGoal > 0;

        if (paceResult) {
          expectedAtThisPoint = paceResult.expectedAtThisPoint;
          variance = paceResult.paceVariance;
          dailyTarget = paceResult.remainingDailyNeeded;
          futurePlannedDays = paceResult.futurePlannedDays;
          daysRemaining = paceResult.futurePlannedDays;
          const goalToUse = paceResult.fundedGoal;
          pacePercentage = goalToUse > 0 ? (currentProgress / goalToUse) * 100 : 0;

          if (variance >= 0) {
            paceStatus = variance > 1 ? 'ahead' : 'on-track';
          } else {
            const behindPercentage = expectedAtThisPoint > 0
              ? (Math.abs(variance) / expectedAtThisPoint) * 100
              : 100;
            paceStatus = behindPercentage > 35 ? 'critical' : 'behind';
          }
        } else if (hasGoals) {
          const todayStr = format(today, 'yyyy-MM-dd');
          const totalFuturePlanned = plannedDays.filter(d => d.planned_date > todayStr).length;
          futurePlannedDays = totalFuturePlanned;
          daysRemaining = totalFuturePlanned;
          if (knockingDays === 0 && currentProgress === 0) {
            paceStatus = totalFuturePlanned > 0 ? 'on-track' : 'behind';
          } else {
            pacePercentage = activeGoal > 0 ? (currentProgress / activeGoal) * 100 : 0;
            paceStatus = 'behind';
          }
          if (daysRemaining > 0 && activeGoal > 0) {
            dailyTarget = Math.max(0, activeGoal - currentProgress) / daysRemaining;
          }
        }

        // Period progress in the rep's metric
        const periodPrmr = periodEntries.reduce((sum, e) => {
          const salesLog = (e as any).sales_log as any[] | null;
          if (salesLog && salesLog.length > 0) return sum + calculateFromSalesLog(salesLog).prmr;
          return sum + (Number(e.prmr) || 0);
        }, 0);
        const periodProgress = efpModeEnabled ? calculateEfp(periodPrmr) : periodFpPlus;

        return {
          userId: rep.user_id!,
          notionPageId: rep.id,
          name: rep.name,
          year: rep.year || 'Rookie',
          stage: rep.stage || undefined,
          profilePhotoUrl: (rep as any).profile_photo_url || null,
          efpModeEnabled,
          preseasonGoal: goals?.preseason_fp_goal || 0,
          mustDoGoal: goals?.must_do_fp_goal || 0,
          willDoGoal: goals?.will_do_fp_goal || 0,
          couldDoGoal: goals?.could_do_fp_goal || 0,
          focusTier: goals?.focus_tier || null,
          cancelRate: goals?.cancel_rate || 0,
          setupComplete: goals?.setup_complete || false,
          personalSummerStart,
          personalSummerEnd,
          currentProgress,
          currentFpPlus,
          currentPrmr,
          knockingDays,
          futurePlannedDays,
          periodProgress,
          periodFpPlus,
          periodDoors,
          periodKnockingDays,
          paceStatus,
          pacePercentage,
          dailyTarget,
          expectedAtThisPoint,
          variance,
          daysRemaining,
          isInPreseason: isRepInPreseason,
          teamId: accessibleRep?.teamId || null,
          teamName: accessibleRep?.teamName || null,
          mgmtGroupId: accessibleRep?.mgmtGroupId || null,
          mgmtGroupName: accessibleRep?.mgmtGroupName || null,
        };
      });
  }, [repsData, goalsData, configData, entriesData, plannedDaysData, isGlobalPreseason, today, activeTier, dateRange, getGoalForTier, teamAccess]);

  // Split into with-goals and no-goals, then sort
  const { withGoals, noGoals } = useMemo(() => {
    const wg: RepGoalInfo[] = [];
    const ng: RepGoalInfo[] = [];
    repGoals.forEach(r => {
      if (r.paceStatus === 'no-goals') ng.push(r);
      else wg.push(r);
    });

    const statusOrder: Record<PaceStatus, number> = { critical: 0, behind: 1, 'on-track': 2, ahead: 3, 'no-goals': 4 };
    wg.sort((a, b) => {
      const sd = statusOrder[a.paceStatus] - statusOrder[b.paceStatus];
      if (sd !== 0) return sd;
      return a.pacePercentage - b.pacePercentage;
    });
    ng.sort((a, b) => a.name.localeCompare(b.name));

    return { withGoals: wg, noGoals: ng };
  }, [repGoals]);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<PaceStatus | 'all'>('all');

  const displayReps = useMemo(() => {
    if (statusFilter === 'all') return withGoals;
    return withGoals.filter(r => r.paceStatus === statusFilter);
  }, [withGoals, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: withGoals.length,
    ahead: withGoals.filter(r => r.paceStatus === 'ahead').length,
    onTrack: withGoals.filter(r => r.paceStatus === 'on-track').length,
    behind: withGoals.filter(r => r.paceStatus === 'behind').length,
    critical: withGoals.filter(r => r.paceStatus === 'critical').length,
  }), [withGoals]);

  // Aggregate stats for selected tier
  const aggregate = useMemo(() => {
    const totalGoal = withGoals.reduce((sum, r) => {
      if (r.isInPreseason) return sum + r.preseasonGoal;
      switch (activeTier) {
        case 'mustDo': return sum + r.mustDoGoal;
        case 'couldDo': return sum + r.couldDoGoal;
        default: return sum + r.willDoGoal;
      }
    }, 0);
    const totalProgress = withGoals.reduce((sum, r) => sum + r.currentProgress, 0);
    const periodProgress = withGoals.reduce((sum, r) => sum + r.periodProgress, 0);
    const progressPercent = totalGoal > 0 ? Math.min(100, (totalProgress / totalGoal) * 100) : 0;
    return { totalGoal, totalProgress, periodProgress, progressPercent };
  }, [withGoals, activeTier]);

  const getPeriodLabel = () => {
    if (effectivePreset === 'custom' && customStartDate && customEndDate) {
      return `${format(customStartDate, 'MMM d')} – ${format(customEndDate, 'MMM d')}`;
    }
    const labels: Record<string, string> = {
      today: 'Today', yesterday: 'Yesterday', week: 'This Week', lastWeek: 'Last Week',
      month: 'This Month', lastMonth: 'Last Month', preseason: 'Preseason', ytd: 'Year to Date',
    };
    return labels[effectivePreset] || 'YTD';
  };

  const handleCustomApply = (start: Date, end: Date) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setDatePreset('custom');
  };

  const handleNudge = async (userId: string, name: string) => {
    setNudgingUserId(userId);
    try {
      const { session } = await getSessionSafe();
      if (!session) return;
      const { error } = await supabase.functions.invoke('send-setup-nudge', {
        body: { targetUserId: userId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      toast.success(`Nudge sent to ${name}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send nudge');
    } finally {
      setNudgingUserId(null);
    }
  };

  const isLoading = teamAccessLoading || repsLoading || goalsLoading || entriesLoading || plannedLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (repGoals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Target className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">No team members to display</p>
      </div>
    );
  }

  const tierLabel = activeTier === 'mustDo' ? 'Must Do' : activeTier === 'couldDo' ? 'Could Do' : 'Will Do';

  return (
    <div className="space-y-3">
      {/* Top row: Filter + tier selector */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isUnifiedFilterActive(filterState) && (
            <Badge variant="secondary" className="text-[10px] truncate max-w-[160px]">
              {filterState.scope === 'watchlist' && '👀 '}
              {filterState.yearFilters.length > 0 && filterState.yearFilters.join(', ')}
              {filterState.selectedNodes.length > 0 && ` · ${filterState.selectedNodes.map(n => n.name).join(', ')}`}
              {' '}({filteredUserIds.length})
            </Badge>
          )}
          {!isGlobalPreseason && (
            <div className="flex rounded-lg border overflow-hidden">
              {(['mustDo', 'willDo', 'couldDo'] as SummerTier[]).map(tier => (
                <button
                  key={tier}
                  onClick={() => setActiveTier(tier)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium transition-colors",
                    activeTier === tier
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {GOAL_TIER_CONFIG[tier].shortLabel}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilterOpen(true)}
          className="relative h-8 px-2 flex-shrink-0"
        >
          <Filter className="h-4 w-4" />
          {isUnifiedFilterActive(filterState) && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </div>

      {/* Date presets row */}
      <div className="flex items-center gap-0">
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 min-w-max">
            {presetConfig
              .filter(p => availablePresets.includes(p.key))
              .map(preset => (
                <Button
                  key={preset.key}
                  variant={effectivePreset === preset.key ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setDatePreset(preset.key)}
                  className="flex-shrink-0 gap-1.5 h-7 text-xs px-2.5"
                >
                  {preset.label}
                  {preset.isLive && effectivePreset === 'today' && (
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      presetsFetching ? "bg-primary-foreground animate-pulse" : "bg-green-500"
                    )} />
                  )}
                </Button>
              ))}
          </div>
        </div>
        <div className="flex-shrink-0 pl-2 border-l border-border/50">
          <Button
            variant={effectivePreset === 'custom' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowCustomSheet(true)}
            className="flex-shrink-0 gap-1 h-7 text-xs px-2.5"
          >
            <Calendar className="h-3 w-3" />
            {effectivePreset === 'custom' && customStartDate && customEndDate
              ? `${format(customStartDate, 'MMM d')} – ${format(customEndDate, 'MMM d')}`
              : 'Custom'
            }
          </Button>
        </div>
      </div>

      {/* Aggregate Summary Card */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {isGlobalPreseason ? 'Preseason' : tierLabel} • {withGoals.length + noGoals.length} reps
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold tabular-nums">{aggregate.totalProgress.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/ {aggregate.totalGoal}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <Progress value={aggregate.progressPercent} className="h-2.5" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{aggregate.progressPercent.toFixed(0)}% of {tierLabel}</span>
            {aggregate.periodProgress > 0 && effectivePreset !== 'ytd' && (
              <span className="text-foreground font-medium">+{aggregate.periodProgress.toFixed(1)} {getPeriodLabel()}</span>
            )}
          </div>
        </div>

        {/* Status breakdown chips */}
        <div className="grid grid-cols-5 gap-1">
          {[
            { key: 'all' as const, count: stats.total, label: 'All', activeClass: 'ring-1 ring-border bg-background' },
            { key: 'ahead' as const, count: stats.ahead, label: 'Ahead', activeClass: 'ring-1 ring-emerald-300 bg-emerald-500/10' },
            { key: 'on-track' as const, count: stats.onTrack, label: 'On Track', activeClass: 'ring-1 ring-blue-300 bg-blue-500/10' },
            { key: 'behind' as const, count: stats.behind, label: 'Behind', activeClass: 'ring-1 ring-amber-300 bg-amber-500/10' },
            { key: 'critical' as const, count: stats.critical, label: 'At Risk', activeClass: 'ring-1 ring-red-300 bg-red-500/10' },
          ].map(chip => (
            <button
              key={chip.key}
              onClick={() => setStatusFilter(chip.key)}
              className={cn(
                "rounded-lg py-1.5 text-center transition-all",
                statusFilter === chip.key ? chip.activeClass : "hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "text-sm font-bold tabular-nums",
                chip.key === 'ahead' && 'text-emerald-600 dark:text-emerald-400',
                chip.key === 'on-track' && 'text-blue-600 dark:text-blue-400',
                chip.key === 'behind' && 'text-amber-600 dark:text-amber-400',
                chip.key === 'critical' && 'text-red-600 dark:text-red-400',
              )}>{chip.count}</div>
              <div className="text-[9px] text-muted-foreground leading-tight">{chip.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Rep rows */}
      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {displayReps.map(rep => {
            const config = STATUS_CONFIG[rep.paceStatus];
            const StatusIcon = config.icon;
            const isExpanded = expandedRepId === rep.userId;
            const cleanName = stripEmojis(rep.name) || rep.name;
            const activeGoal = rep.isInPreseason ? rep.preseasonGoal : (
              activeTier === 'mustDo' ? rep.mustDoGoal :
              activeTier === 'couldDo' ? rep.couldDoGoal :
              rep.willDoGoal
            );
            const metricLabel = rep.efpModeEnabled ? 'EFP' : 'FP+';
            const progressPercent = activeGoal > 0 ? Math.min(100, (rep.currentProgress / activeGoal) * 100) : 0;

            return (
              <motion.div
                key={rep.userId}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  className={cn(
                    "rounded-xl border-l-[3px] bg-card border border-border/50 overflow-hidden transition-shadow",
                    config.border,
                    isExpanded && "shadow-md"
                  )}
                >
                  {/* Compact row — always visible */}
                  <button
                    className="w-full text-left px-3 py-2.5 flex items-center gap-2.5"
                    onClick={() => setExpandedRepId(isExpanded ? null : rep.userId)}
                  >
                    {/* Avatar */}
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      {rep.profilePhotoUrl && (
                        <AvatarImage src={rep.profilePhotoUrl} alt={cleanName} />
                      )}
                      <AvatarFallback className="text-[10px] font-medium bg-muted">
                        {getInitials(cleanName)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Name + stats */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">{cleanName}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                          {rep.year}
                        </Badge>
                        {rep.efpModeEnabled && (
                          <Badge variant="secondary" className="text-[8px] h-3.5 px-1 shrink-0 font-bold">
                            EFP
                          </Badge>
                        )}
                      </div>
                      {/* Mini progress bar inline */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              rep.paceStatus === 'ahead' && 'bg-emerald-500',
                              rep.paceStatus === 'on-track' && 'bg-blue-500',
                              rep.paceStatus === 'behind' && 'bg-amber-500',
                              rep.paceStatus === 'critical' && 'bg-red-500',
                            )}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                          {progressPercent.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Status pill */}
                    <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-full shrink-0", config.bg)}>
                      <StatusIcon className={cn("h-3 w-3", config.color)} />
                      <span className={cn("text-[10px] font-medium", config.color)}>
                        {config.label}
                      </span>
                    </div>
                  </button>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/30">
                          {/* Key metrics */}
                          <div className="grid grid-cols-3 gap-2 pt-2.5">
                            <div className="text-center">
                              <div className="text-xs text-muted-foreground">Progress</div>
                              <div className="text-sm font-semibold tabular-nums">{rep.currentProgress.toFixed(1)}</div>
                              <div className="text-[10px] text-muted-foreground">/ {activeGoal} {metricLabel}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-muted-foreground">Variance</div>
                              <div className={cn(
                                "text-sm font-semibold tabular-nums",
                                rep.variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                              )}>
                                {rep.variance >= 0 ? '+' : ''}{rep.variance.toFixed(1)}
                              </div>
                              <div className="text-[10px] text-muted-foreground">{metricLabel}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-muted-foreground">Need/Day</div>
                              <div className="text-sm font-semibold tabular-nums">{rep.dailyTarget.toFixed(2)}</div>
                              <div className="text-[10px] text-muted-foreground">{rep.daysRemaining} days left</div>
                            </div>
                          </div>

                          {/* Goal tiers */}
                          <div className="flex rounded-lg border overflow-hidden">
                            {[
                              { tier: 'mustDo', label: 'Must Do', value: rep.mustDoGoal },
                              { tier: 'willDo', label: 'Will Do', value: rep.willDoGoal },
                              { tier: 'couldDo', label: 'Could Do', value: rep.couldDoGoal },
                            ].map(({ tier, label, value }) => (
                              <div
                                key={tier}
                                className={cn(
                                  "flex-1 text-center py-1.5 border-r last:border-r-0",
                                  activeTier === tier && !rep.isInPreseason && "bg-primary/10"
                                )}
                              >
                                <div className="text-[10px] text-muted-foreground">{label}</div>
                                <div className={cn(
                                  "text-sm font-semibold tabular-nums",
                                  activeTier === tier && !rep.isInPreseason && "text-primary"
                                )}>{value}</div>
                              </div>
                            ))}
                          </div>

                          {/* Period performance (if not YTD) */}
          {effectivePreset !== 'ytd' && (rep.periodProgress > 0 || rep.periodDoors > 0) && (
                            <div className="bg-muted/30 rounded-lg px-3 py-2">
                              <div className="text-[10px] text-muted-foreground mb-1">{getPeriodLabel()}</div>
                              <div className="flex gap-4 text-xs">
                                <span><span className="font-medium">{rep.periodProgress.toFixed(1)}</span> {metricLabel}</span>
                                <span><span className="font-medium">{rep.periodDoors}</span> doors</span>
                                <span><span className="font-medium">{rep.periodKnockingDays}</span> days</span>
                              </div>
                            </div>
                          )}

                          {/* Summer dates */}
                          {rep.personalSummerStart && (
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <Sun className="h-3 w-3" />
                              <span>
                                {format(parseISO(rep.personalSummerStart), 'MMM d')}
                                {rep.personalSummerEnd && ` – ${format(parseISO(rep.personalSummerEnd), 'MMM d')}`}
                              </span>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRepClick?.(rep.notionPageId);
                              }}
                            >
                              <User className="h-3 w-3 mr-1" />
                              View Profile
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-2.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPerson(rep);
                              }}
                            >
                              <Calendar className="h-3 w-3 mr-1" />
                              Dates
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* No Goals Section */}
      {noGoals.length > 0 && (
        <Collapsible open={showNoGoals} onOpenChange={setShowNoGoals}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              No Goals ({noGoals.length})
              {showNoGoals ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </span>
            <div className="h-px flex-1 bg-border" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1.5">
              {noGoals.map(rep => {
                const cleanName = stripEmojis(rep.name) || rep.name;
                return (
                  <div
                    key={rep.userId}
                    className="rounded-xl border border-border/50 bg-card px-3 py-2 flex items-center gap-2.5"
                  >
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      {rep.profilePhotoUrl && (
                        <AvatarImage src={rep.profilePhotoUrl} alt={cleanName} />
                      )}
                      <AvatarFallback className="text-[9px] font-medium bg-muted">
                        {getInitials(cleanName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onRepClick?.(rep.notionPageId)}
                        className="font-medium text-sm truncate block"
                      >
                        {cleanName}
                      </button>
                      <span className="text-[10px] text-muted-foreground">{rep.year}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 shrink-0"
                      disabled={nudgingUserId === rep.userId}
                      onClick={() => handleNudge(rep.userId, cleanName)}
                    >
                      <Bell className="h-3 w-3 mr-1" />
                      {nudgingUserId === rep.userId ? 'Sending...' : 'Nudge'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Drawers */}
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
        repCount={filteredUserIds.length}
      />

      <CustomDateRangeDrawer
        open={showCustomSheet}
        onOpenChange={setShowCustomSheet}
        startDate={customStartDate || undefined}
        endDate={customEndDate || undefined}
        onApply={handleCustomApply}
      />
    </div>
  );
};
