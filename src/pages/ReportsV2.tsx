import { useState, useMemo } from "react";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useReportsV2Data } from "@/hooks/useReportsV2Data";
import { useAvailableTeamReportsPresets, ReportsDatePreset } from "@/hooks/useAvailableDatePresets";
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
  
  const allUserIds = teamAccess?.accessibleUserIds || [];
  
  // Get available presets based on team data
  const { availablePresets, isLoading: presetsLoading } = useAvailableTeamReportsPresets(allUserIds);

  // Auto-select first available preset
  const effectivePreset = datePreset ?? (availablePresets.length > 0 ? availablePresets[0] : 'today');

  // Filter userIds based on team filter
  const filteredUserIds = useMemo(() => {
    if (!teamAccess) return [];
    if (teamFilter === 'all') return teamAccess.accessibleUserIds;
    
    if (teamFilter.type === 'team') {
      return teamAccess.accessibleReps
        ?.filter(r => r.teamId === teamFilter.id)
        .map(r => r.userId) || [];
    }
    
    if (teamFilter.type === 'mgmt_group') {
      const group = teamAccess.mgmtGroups?.find(g => g.id === teamFilter.id);
      const teamIds = group?.teamIds || [];
      return teamAccess.accessibleReps
        ?.filter(r => teamIds.includes(r.teamId))
        .map(r => r.userId) || [];
    }
    
    return teamAccess.accessibleUserIds;
  }, [teamAccess, teamFilter]);

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

  // Get period label
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

  // Preset button config
  const presetConfig: { key: ReportsDatePreset; label: string }[] = [
    { key: 'today', label: 'Today' },
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
                className="flex-shrink-0"
              >
                {preset.label}
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
        periodLabel={getPeriodLabel()}
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
