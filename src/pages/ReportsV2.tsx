import { useState, useMemo } from "react";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useReportsV2Data } from "@/hooks/useReportsV2Data";
import { useAvailableTeamReportsPresets, ReportsDatePreset } from "@/hooks/useAvailableDatePresets";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  ReportsExecutiveSnapshot, 
  ReportsEffortSection, 
  ReportsSkillSection,
  RepDrillDownDrawer,
} from "@/components/reports/v2";
import { ReportsDateRangeSheet } from "@/components/reports/v2/ReportsDateRangeSheet";
import { ReportsTeamFilter, TeamFilter } from "@/components/reports/v2/ReportsTeamFilter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, startOfYear } from "date-fns";
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
  
  // Get team access
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  
  // Get current user's ID to include self in reports
  const { data: currentUserId } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
  });
  
  // Include current user in the accessible user IDs for reports (self is excluded by fetch-team-access)
  const allUserIds = useMemo(() => {
    const ids = teamAccess?.accessibleUserIds || [];
    // Add current user if they're a leader and not already included
    if (currentUserId && teamAccess?.accessLevel !== 'none' && !ids.includes(currentUserId)) {
      return [currentUserId, ...ids];
    }
    return ids;
  }, [teamAccess?.accessibleUserIds, teamAccess?.accessLevel, currentUserId]);
  
  // Get available presets based on team data with smart auto-selection
  const { availablePresets, autoSelectedPreset, isLoading: presetsLoading, isFetching } = useAvailableTeamReportsPresets(allUserIds);

  // Use auto-selected preset when user hasn't manually selected
  const effectivePreset = datePreset ?? autoSelectedPreset;

  // Filter userIds based on team filter
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

    // Reports should include the leader viewing it (self)
    if (currentUserId && teamAccess.accessLevel !== 'none' && !ids.includes(currentUserId)) {
      ids = [currentUserId, ...ids];
    }

    return ids;
  }, [teamAccess, teamFilter, allUserIds, currentUserId]);

  // Calculate date range based on preset
  const getDateRange = () => {
    const today = new Date();
    
    if (effectivePreset === 'custom' && customStartDate && customEndDate) {
      return {
        start: format(customStartDate, 'yyyy-MM-dd'),
        end: format(customEndDate, 'yyyy-MM-dd'),
      };
    }
    
    switch (effectivePreset) {
      case 'today':
        return {
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
        };
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return {
          start: format(yesterday, 'yyyy-MM-dd'),
          end: format(yesterday, 'yyyy-MM-dd'),
        };
      case 'week':
        return {
          start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        };
      case 'lastWeek':
        const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        return {
          start: format(lastWeekStart, 'yyyy-MM-dd'),
          end: format(lastWeekEnd, 'yyyy-MM-dd'),
        };
      case 'month':
        return {
          start: format(startOfMonth(today), 'yyyy-MM-dd'),
          end: format(endOfMonth(today), 'yyyy-MM-dd'),
        };
      case 'lastMonth':
        const lastMonthStart = startOfMonth(subMonths(today, 1));
        const lastMonthEnd = endOfMonth(subMonths(today, 1));
        return {
          start: format(lastMonthStart, 'yyyy-MM-dd'),
          end: format(lastMonthEnd, 'yyyy-MM-dd'),
        };
      case 'preseason':
        return {
          start: format(PRESEASON_START, 'yyyy-MM-dd'),
          end: format(today < PRESEASON_END ? today : PRESEASON_END, 'yyyy-MM-dd'),
        };
      case 'ytd':
        return {
          start: format(startOfYear(today), 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
        };
      default:
        return {
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
        };
    }
  };

  const dateRange = getDateRange();

  // Get V2 data with filtered user IDs
  const {
    isLoading,
    totalFP,
    totalPRMR,
    activeReps,
    workingCount,
    workingNames,
    constraint,
    actions,
    effortSummary,
    skillBottleneck,
    impactPotential,
    teamGoalStatus,
    teamGoalStatusDetails,
    teamBaseline,
    repsWithEffort,
    funnelData,
    getRepById,
  } = useReportsV2Data({
    userIds: filteredUserIds,
    dateRange,
    isLiveView: effectivePreset === 'today',
  });

  // Get period label for display
  const getPeriodLabel = () => {
    if (effectivePreset === 'custom' && customStartDate && customEndDate) {
      return `${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d')}`;
    }
    
    const labels: Record<string, string> = {
      today: 'Today',
      yesterday: 'Yesterday',
      week: 'This Week',
      lastWeek: 'Last Week',
      month: 'This Month',
      lastMonth: 'Last Month',
      preseason: 'Preseason',
      ytd: 'Year to Date',
    };
    
    return labels[effectivePreset] || 'Today';
  };

  // Get goal-specific period label for TeamGoalSummary
  const getGoalPeriodLabel = () => {
    if (effectivePreset === 'today') return 'Daily Goal';
    if (effectivePreset === 'yesterday') return 'Daily Goal';
    if (effectivePreset === 'week' || effectivePreset === 'lastWeek') return 'Weekly Goal';
    if (effectivePreset === 'month' || effectivePreset === 'lastMonth') return 'Monthly Goal';
    if (effectivePreset === 'custom' && customStartDate && customEndDate) return 'Period Goal';
    return undefined; // Use default (preseason) label
  };

  // Handle custom date range apply
  const handleCustomApply = (start: Date, end: Date) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setDatePreset('custom');
  };

  // Handle rep click
  const handleRepClick = (userId: string) => {
    setSelectedRepId(userId);
  };

  // Handle SMS
  const handleSendSms = (phone: string, message: string) => {
    const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
    window.open(smsUrl);
  };

  // Preset button config with Live indicator for today
  const presetConfig: { key: ReportsDatePreset; label: string; isLive?: boolean }[] = [
    { key: 'today', label: 'Live', isLive: true },
    { key: 'yesterday', label: 'Yest' },
    { key: 'week', label: 'Week' },
    { key: 'lastWeek', label: 'Last Wk' },
    { key: 'month', label: 'Month' },
    { key: 'lastMonth', label: 'Last Mo' },
    { key: 'preseason', label: 'Preseason' },
    { key: 'ytd', label: 'YTD' },
  ];

  // Loading state
  if (accessLoading || presetsLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded" />
        <div className="h-60 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  // No access
  if (!teamAccess || teamAccess.accessLevel === 'none') {
    return (
      <div className="p-4">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            You don't have access to team reports.
          </p>
        </Card>
      </div>
    );
  }

  const selectedRep = selectedRepId ? getRepById(selectedRepId) : null;

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Reports</h1>
          
          <ReportsTeamFilter
            teams={teamAccess.teams || []}
            mgmtGroups={teamAccess.mgmtGroups || []}
            accessLevel={teamAccess.accessLevel}
            selectedFilter={teamFilter}
            onFilterChange={setTeamFilter}
            repCount={filteredUserIds.length}
          />
        </div>

        {/* Filter badge */}
        {teamFilter !== 'all' && (
          <Badge variant="secondary" className="text-xs">
            Viewing: {teamFilter.name} ({filteredUserIds.length} reps)
          </Badge>
        )}

        {/* Date presets - horizontally scrollable */}
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
          
          {/* Custom button */}
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
      </div>

      {/* Section 1: Executive Snapshot */}
      <ReportsExecutiveSnapshot
        totalFP={totalFP}
        totalPRMR={totalPRMR}
        activeReps={activeReps}
        workingCount={workingCount}
        workingNames={workingNames}
        periodLabel={getPeriodLabel()}
        goalPeriodLabel={getGoalPeriodLabel()}
        isLiveView={effectivePreset === 'today'}
        constraint={constraint}
        actions={actions}
        teamGoalStatus={teamGoalStatus}
        teamGoalStatusDetails={teamGoalStatusDetails}
        teamBaseline={teamBaseline}
        isLoading={isLoading}
      />

      {/* Section 2: Effort */}
      <ReportsEffortSection
        reps={repsWithEffort}
        summary={effortSummary}
        onRepClick={handleRepClick}
        isLoading={isLoading}
      />

      {/* Section 3: Skill */}
      <ReportsSkillSection
        bottleneck={skillBottleneck}
        impactPotential={impactPotential}
        funnelData={funnelData}
        isLoading={isLoading}
      />

      {/* Rep Drill-Down Drawer */}
      <RepDrillDownDrawer
        rep={selectedRep ? {
          ...selectedRep,
          effort: selectedRep.effort,
        } : null}
        isOpen={!!selectedRepId}
        onClose={() => setSelectedRepId(null)}
        onSendSms={handleSendSms}
      />

      {/* Custom Date Range Sheet */}
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
