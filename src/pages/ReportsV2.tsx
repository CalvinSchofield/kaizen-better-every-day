import { useState, useMemo, useEffect } from "react";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useReportsV2Data } from "@/hooks/useReportsV2Data";
import { useAvailableTeamReportsPresets, ReportsDatePreset } from "@/hooks/useAvailableDatePresets";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  RepDrillDownDrawer,
  PulseHero,
  SalesFunnel,
  EffortSkillDiagnosis,
  TopPerformers,
  AlertsHighlights,
  RepArchetypes,
  AutoInsights,
  ProductionTrendChart,
  HourlyActivityChart,
} from "@/components/reports/v2";
import { RecordDetailsDrawer } from "@/components/reports/v2/RecordDetailsDrawer";
import { ReportsDateRangeSheet } from "@/components/reports/v2/ReportsDateRangeSheet";
import { TeamFilter } from "@/components/reports/v2/ReportsTeamFilter";
import { WorkingRepsDrawer } from "@/components/reports/v2/WorkingRepsDrawer";
import { GoalPaceDrawer } from "@/components/reports/v2/GoalPaceDrawer";
import { GoalPaceSection } from "@/components/reports/v2/GoalPaceSection";
import { GoalAttentionAlerts } from "@/components/reports/v2/GoalAttentionAlerts";
import { RepTimesDrawer } from "@/components/reports/v2/RepTimesDrawer";
import { DealAnalyticsDrawer } from "@/components/reports/v2/DealAnalyticsDrawer";
import { SmartFilterDrawer, SmartFilterState, DEFAULT_FILTER_STATE, isFilterActive } from "@/components/filters/SmartFilterDrawer";
import { useHeader } from "@/contexts/HeaderContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, RefreshCw, AlertCircle, Filter } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

// Preseason dates
const PRESEASON_START = new Date(2025, 8, 28); // Sept 28, 2025
const PRESEASON_END = new Date(2026, 3, 12); // April 12, 2026

export const ReportsV2Page = () => {
  const [datePreset, setDatePreset] = useState<ReportsDatePreset | 'custom' | null>(null);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [showCustomSheet, setShowCustomSheet] = useState(false);
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');
  const [smartFilter, setSmartFilter] = useState<SmartFilterState>(DEFAULT_FILTER_STATE);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showWorkingDrawer, setShowWorkingDrawer] = useState(false);
  const [showGoalPaceDrawer, setShowGoalPaceDrawer] = useState(false);
  const [showTimeDrawer, setShowTimeDrawer] = useState(false);
  const [showDealDrawer, setShowDealDrawer] = useState(false);
  const { setCustomRightContent } = useHeader();
  
  // Get team access
  const { data: teamAccess, isLoading: accessLoading, error: teamAccessError, refetch: refetchTeamAccess, wasLeader } = useTeamAccess();
  
  // Get current user's ID
  const { data: currentUserId } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
  });
  
  const allUserIds = useMemo(() => {
    const ids = teamAccess?.accessibleUserIds || [];
    if (currentUserId && teamAccess?.accessLevel !== 'none' && !ids.includes(currentUserId)) {
      return [currentUserId, ...ids];
    }
    return ids;
  }, [teamAccess?.accessibleUserIds, teamAccess?.accessLevel, currentUserId]);
  
  const { availablePresets, autoSelectedPreset, isLoading: presetsLoading, isFetching } = useAvailableTeamReportsPresets(allUserIds);

  const effectivePreset = datePreset ?? autoSelectedPreset;

  const filteredUserIds = useMemo(() => {
    if (!teamAccess) return [];
    let ids: string[] = [];

    if (teamFilter === 'all') {
      ids = allUserIds;
    } else if (teamFilter.type === 'team') {
      ids = teamAccess.accessibleReps
        ?.filter(r => r.teamId === teamFilter.id)
        .map(r => r.userId)
        .filter((id): id is string => !!id) || [];
    } else if (teamFilter.type === 'mgmt_group') {
      const group = teamAccess.mgmtGroups?.find(g => g.id === teamFilter.id);
      const teamIds = group?.teamIds || [];
      ids = teamAccess.accessibleReps
        ?.filter(r => r.teamId && teamIds.includes(r.teamId))
        .map(r => r.userId)
        .filter((id): id is string => !!id) || [];
    } else {
      ids = allUserIds;
    }

    if (currentUserId && teamAccess.accessLevel !== 'none' && !ids.includes(currentUserId)) {
      ids = [currentUserId, ...ids];
    }
    return ids;
  }, [teamAccess, teamFilter, allUserIds, currentUserId]);

  // Sync smart filter → team filter (must be before early returns)
  useEffect(() => {
    setTeamFilter(smartFilter.teamFilter);
  }, [smartFilter.teamFilter]);

  // Inject filter icon into header (must be before early returns)
  useEffect(() => {
    const active = isFilterActive(smartFilter);
    setCustomRightContent(
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowFilterDrawer(true)}
        className="relative h-10 w-10"
      >
        <Filter className="h-5 w-5" />
        {active && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
        )}
      </Button>
    );
    return () => setCustomRightContent(null);
  }, [setCustomRightContent, smartFilter]);

  // Calculate date range
  const getDateRange = () => {
    const today = new Date();
    if (effectivePreset === 'custom' && customStartDate && customEndDate) {
      return { start: format(customStartDate, 'yyyy-MM-dd'), end: format(customEndDate, 'yyyy-MM-dd') };
    }
    switch (effectivePreset) {
      case 'today': return { start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
      case 'yesterday': { const y = subDays(today, 1); return { start: format(y, 'yyyy-MM-dd'), end: format(y, 'yyyy-MM-dd') }; }
      case 'week': return { start: format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'), end: format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd') };
      case 'lastWeek': return { start: format(startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 }), 'yyyy-MM-dd'), end: format(endOfWeek(subWeeks(today, 1), { weekStartsOn: 0 }), 'yyyy-MM-dd') };
      case 'month': return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(endOfMonth(today), 'yyyy-MM-dd') };
      case 'lastMonth': return { start: format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd'), end: format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd') };
      case 'preseason': return { start: format(PRESEASON_START, 'yyyy-MM-dd'), end: format(today < PRESEASON_END ? today : PRESEASON_END, 'yyyy-MM-dd') };
      case 'ytd': return { start: format(PRESEASON_START, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
      default: return { start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    }
  };

  const dateRange = getDateRange();

  const {
    isLoading,
    totalFP, totalPRMR,
    activeReps, workingCount, workingNames,
    constraint, actions,
    effortSummary, skillBottleneck, impactPotential,
    teamGoalStatus, teamGoalStatusDetails,
    enhancedGoalPace,
    teamBaseline,
    repsWithEffort, funnelData,
    dailyTrend, hourlyActivity,
    getRepById,
  } = useReportsV2Data({
    userIds: filteredUserIds,
    dateRange,
    isLiveView: effectivePreset === 'today',
  });

  const getPeriodLabel = () => {
    if (effectivePreset === 'custom' && customStartDate && customEndDate) {
      return `${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d')}`;
    }
    const labels: Record<string, string> = {
      today: 'Today', yesterday: 'Yesterday', week: 'This Week', lastWeek: 'Last Week',
      month: 'This Month', lastMonth: 'Last Month', preseason: 'Preseason', ytd: 'Year to Date',
    };
    return labels[effectivePreset] || 'Today';
  };

  const handleCustomApply = (start: Date, end: Date) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setDatePreset('custom');
  };

  const handleRepClick = (userId: string) => setSelectedRepId(userId);

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

  // Parse "h:mm AM/PM" formatted time string to minutes from midnight
  const parseFormattedTime = (t: string): number | null => {
    const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const pm = match[3].toUpperCase() === 'PM';
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return h * 60 + m;
  };

  // Compute avg start time from reps (must be before early returns)
  const avgStartTime = useMemo(() => {
    const starts = repsWithEffort
      .filter(r => r.workStartTime || r.avgStartTime)
      .map(r => {
        // workStartTime is ISO, avgStartTime is "h:mm AM/PM"
        if (r.workStartTime) {
          try {
            const d = new Date(r.workStartTime);
            if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
          } catch {}
        }
        if (r.avgStartTime) return parseFormattedTime(r.avgStartTime);
        return null;
      })
      .filter((m): m is number => m !== null);
    
    if (starts.length === 0) return undefined;
    const avg = starts.reduce((a, b) => a + b, 0) / starts.length;
    const h = Math.floor(avg / 60);
    const m = Math.round(avg % 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }, [repsWithEffort]);

  // Compute rep time data for the times drawer
  const repTimeData = useMemo(() => {
    return repsWithEffort.map(r => {
      let startMins: number | null = null;
      let endMins: number | null = null;
      if (r.workStartTime) {
        try {
          const d = new Date(r.workStartTime);
          if (!isNaN(d.getTime())) startMins = d.getHours() * 60 + d.getMinutes();
        } catch {}
      }
      if (!startMins && r.avgStartTime) startMins = parseFormattedTime(r.avgStartTime);
      if (r.workEndTime) {
        try {
          const d = new Date(r.workEndTime);
          if (!isNaN(d.getTime())) endMins = d.getHours() * 60 + d.getMinutes();
        } catch {}
      }
      if (!endMins && r.avgEndTime) endMins = parseFormattedTime(r.avgEndTime);
      return {
        userId: r.userId,
        name: r.name,
        avgStartMinutes: startMins,
        avgEndMinutes: endMins,
        hoursWorked: r.hoursWorked,
      };
    });
  }, [repsWithEffort]);

  const teamAvgStartMinutes = useMemo(() => {
    const valid = repTimeData.filter(r => r.avgStartMinutes !== null);
    if (valid.length === 0) return undefined;
    return Math.round(valid.reduce((s, r) => s + r.avgStartMinutes!, 0) / valid.length);
  }, [repTimeData]);

  const teamAvgEndMinutes = useMemo(() => {
    const valid = repTimeData.filter(r => r.avgEndMinutes !== null);
    if (valid.length === 0) return undefined;
    return Math.round(valid.reduce((s, r) => s + r.avgEndMinutes!, 0) / valid.length);
  }, [repTimeData]);

  // Total hours (must be before early returns)
  const totalHours = useMemo(() => repsWithEffort.reduce((sum, r) => sum + r.hoursWorked, 0), [repsWithEffort]);

  // Loading state
  if (accessLoading || presetsLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const showLeaderRecoveryUI = (teamAccessError || !teamAccess) && wasLeader;

  const handleRetry = async () => {
    setIsRetrying(true);
    try { await refetchTeamAccess(); } finally { setIsRetrying(false); }
  };

  if (showLeaderRecoveryUI) {
    return (
      <div className="p-4">
        <Card className="p-8 text-center border-destructive/50 bg-destructive/5">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Couldn't load reports</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
            There was a problem connecting to the server.
          </p>
          <Button onClick={handleRetry} disabled={isRetrying} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </Button>
        </Card>
      </div>
    );
  }

  if (!teamAccess || teamAccess.accessLevel === 'none') {
    return (
      <div className="p-4">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">You don't have access to team reports.</p>
        </Card>
      </div>
    );
  }

  const selectedRep = selectedRepId ? getRepById(selectedRepId) : null;

  return (
    <div className="p-4 space-y-5 pb-20">
      {/* Active filter badge */}
      {isFilterActive(smartFilter) && (
        <Badge variant="secondary" className="text-xs">
          {smartFilter.scope === 'watchlist' && '👀 Watchlist'}
          {smartFilter.yearFilters.length > 0 && ` · ${smartFilter.yearFilters.join(', ')}`}
          {smartFilter.teamFilter !== 'all' && ` · ${smartFilter.teamFilter.name}`}
          {' '}({filteredUserIds.length} reps)
        </Badge>
      )}

      {/* Smart Filter Drawer */}
      <SmartFilterDrawer
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        filterState={smartFilter}
        onFilterApply={setSmartFilter}
        teams={teamAccess.teams || []}
        mgmtGroups={teamAccess.mgmtGroups || []}
        accessLevel={teamAccess.accessLevel}
        repCount={filteredUserIds.length}
        showTeamFilters={teamAccess.accessLevel === 'area_director' || teamAccess.accessLevel === 'mgmt_group_lead'}
      />

      {/* Date presets */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {presetConfig
          .filter(p => availablePresets.includes(p.key))
          .map((preset) => (
              <Button
                key={preset.key}
                variant={effectivePreset === preset.key ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDatePreset(preset.key)}
                className="flex-shrink-0 gap-1.5"
              >
                {preset.label}
                {preset.isLive && effectivePreset === 'today' && (
                  <span className={cn(
                    "h-2 w-2 rounded-full",
                    isFetching ? "bg-primary-foreground animate-pulse" : "bg-green-500"
                  )} />
                )}
              </Button>
            ))}
          <Button
            variant={effectivePreset === 'custom' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowCustomSheet(true)}
            className="flex-shrink-0 gap-1"
          >
            <Calendar className="h-3.5 w-3.5" />
            {effectivePreset === 'custom' && customStartDate && customEndDate
              ? `${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d')}`
              : 'Custom'
            }
          </Button>
        </div>

      {/* Layer 1: Pulse Hero */}
      <PulseHero
        doors={funnelData.doors}
        dms={funnelData.decisionMakers}
        pitches={funnelData.pitches}
        presentations={funnelData.presentations}
        closes={funnelData.closes}
        fp={totalFP}
        prmr={totalPRMR}
        avgStartTime={avgStartTime}
        activeHours={totalHours}
        activeReps={activeReps}
        workingCount={workingCount}
        isLiveView={effectivePreset === 'today'}
        teamBaseline={teamBaseline}
        periodLabel={getPeriodLabel()}
        isLoading={isLoading}
        onWorkingClick={() => setShowWorkingDrawer(true)}
        onAvgStartClick={() => setShowTimeDrawer(true)}
        onFpClick={() => setShowDealDrawer(true)}
      />

      {/* Goal Pace Section */}
      <GoalPaceSection
        enhancedGoalPace={enhancedGoalPace}
        onOpenDrawer={() => setShowGoalPaceDrawer(true)}
        isLoading={isLoading}
      />

      {/* Goal Attention Alerts — leader-facing unrealistic pace warnings */}
      {!isLoading && (
        <GoalAttentionAlerts
          enhancedGoalPace={enhancedGoalPace}
          onRepClick={handleRepClick}
        />
      )}

      {/* Layer 2: Effort vs Skill */}
      <EffortSkillDiagnosis
        effortSummary={effortSummary}
        skillBottleneck={skillBottleneck}
        funnelData={funnelData}
        totalReps={activeReps}
        baselineConversions={teamBaseline?.conversions}
        isLoading={isLoading}
      />

      {/* Layer 3: Sales Funnel */}
      <SalesFunnel
        doors={funnelData.doors}
        dms={funnelData.decisionMakers}
        pitches={funnelData.pitches}
        transitions={funnelData.transitions}
        presentations={funnelData.presentations}
        closes={funnelData.closes}
        fp={totalFP}
        baselineConversions={teamBaseline?.conversions}
        isLoading={isLoading}
      />

      {/* Production Trend Chart (multi-day views) */}
      <ProductionTrendChart
        data={dailyTrend}
        isLoading={isLoading}
      />

      {/* Hourly Activity Chart */}
      <HourlyActivityChart
        hourlyActivity={hourlyActivity}
        isLoading={isLoading}
      />

      {/* Layer 4: Auto Insights */}
      <AutoInsights
        constraint={constraint}
        effortSummary={effortSummary}
        skillBottleneck={skillBottleneck}
        impactPotential={impactPotential}
        teamBaseline={teamBaseline}
        totalFP={totalFP}
        totalDoors={funnelData.doors}
        activeReps={activeReps}
        isLiveView={effectivePreset === 'today'}
        isLoading={isLoading}
      />

      {/* Layer 5: Top Performers */}
      <TopPerformers
        reps={repsWithEffort}
        isLoading={isLoading}
        onRepClick={handleRepClick}
      />

      {/* Layer 6: Alerts & Highlights */}
      <AlertsHighlights
        reps={repsWithEffort}
        isLiveView={effectivePreset === 'today'}
        isLoading={isLoading}
        onRepClick={handleRepClick}
      />

      {/* Layer 7: Rep Archetypes */}
      <RepArchetypes
        reps={repsWithEffort}
        funnelData={funnelData}
        isLoading={isLoading}
        onRepClick={handleRepClick}
      />

      {/* Drawers */}
      <RepDrillDownDrawer
        rep={selectedRep ? { ...selectedRep, effort: selectedRep.effort } : null}
        isOpen={!!selectedRepId}
        onClose={() => setSelectedRepId(null)}
        onSendSms={(phone, message) => window.open(`sms:${phone}?body=${encodeURIComponent(message)}`)}
        dateRangeStart={parseISO(dateRange.start)}
        dateRangeEnd={parseISO(dateRange.end)}
      />

      <WorkingRepsDrawer
        open={showWorkingDrawer}
        onOpenChange={setShowWorkingDrawer}
        reps={repsWithEffort.map(rep => ({
          userId: rep.userId,
          name: rep.name,
          year: rep.year,
          timezone: rep.timezone,
          teamId: rep.teamId,
          teamName: rep.teamName,
          recruiterName: rep.recruiterName,
          workStartTime: rep.workStartTime,
          workEndTime: rep.workEndTime,
          avgStartTime: rep.avgStartTime,
          avgEndTime: rep.avgEndTime,
          hoursWorked: rep.hoursWorked,
          doors: rep.doors,
          transitions: rep.transitions,
          presentations: rep.presentations,
          fp: rep.fp,
          prmr: rep.prmr,
          isWorking: !rep.workEndTime && !!rep.workStartTime,
        }))}
        periodLabel={getPeriodLabel()}
        isLiveView={effectivePreset === 'today'}
        onRepClick={handleRepClick}
      />

      <GoalPaceDrawer
        open={showGoalPaceDrawer}
        onOpenChange={setShowGoalPaceDrawer}
        enhancedGoalPace={enhancedGoalPace}
        onRepClick={handleRepClick}
      />

      <RepTimesDrawer
        open={showTimeDrawer}
        onOpenChange={setShowTimeDrawer}
        reps={repTimeData}
        periodLabel={getPeriodLabel()}
        teamAvgStartMinutes={teamAvgStartMinutes}
        teamAvgEndMinutes={teamAvgEndMinutes}
        onRepClick={handleRepClick}
      />

      <DealAnalyticsDrawer
        open={showDealDrawer}
        onOpenChange={setShowDealDrawer}
        userIds={filteredUserIds}
        dateRange={dateRange}
        totalFP={totalFP}
        totalPRMR={totalPRMR}
      />

      <ReportsDateRangeSheet
        open={showCustomSheet}
        onOpenChange={setShowCustomSheet}
        startDate={customStartDate}
        endDate={customEndDate}
        onApply={handleCustomApply}
      />
    </div>
  );
};

export default ReportsV2Page;
