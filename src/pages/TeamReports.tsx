import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useTeamInsightsData } from "@/hooks/useTeamInsightsData";
import { useTeamLiveData } from "@/hooks/useTeamLiveData";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon, ChevronDown, TrendingUpIcon, BarChart3, Clock, Target, Award, TrendingUp, TrendingDown } from "lucide-react";
import { TeamFilterSheet } from "@/components/TeamFilterSheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, subDays, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { SalesFunnelChart } from "@/components/insights/SalesFunnelChart";
import { ActivityTrendChart } from "@/components/insights/ActivityTrendChart";
import { HourlyActivityHeatmap } from "@/components/insights/HourlyActivityHeatmap";
import { DayOfWeekAnalysis } from "@/components/insights/DayOfWeekAnalysis";
import { useTeamCumulativeFP } from "@/hooks/useTeamCumulativeFP";
import { ScopeBadge } from "@/components/reports/ScopeBadge";
import { LiveActivityCard } from "@/components/reports/LiveActivityCard";
import { LiveLeaderboard } from "@/components/reports/LiveLeaderboard";
import { TeamProgressChart } from "@/components/reports/TeamProgressChart";
import { RepDetailDrawer } from "@/components/reports/RepDetailDrawer";
import { useTeamYesterdayData } from "@/hooks/useTeamYesterdayData";
import { BestPeriodsSection } from "@/components/reports/BestPeriodsSection";

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'preseason' | 'custom';
type ExpandedSection = 'funnel' | 'ratios' | 'productivity' | 'trends' | 'hourly' | 'bestPeriods' | 'timing' | 'individuals' | null;

const TeamReports = () => {
  const { data: accessData, isLoading: accessLoading } = useTeamAccess();
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [excludeUserIds, setExcludeUserIds] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [selectedRep, setSelectedRep] = useState<any>(null);
  const [repDrawerOpen, setRepDrawerOpen] = useState(false);

  // Initialize with smart defaults based on access level
  useEffect(() => {
    if (accessData && !hasInitialized) {
      // Load saved filter from localStorage or use defaults
      const savedFilter = localStorage.getItem('team-reports-filter');
      if (savedFilter) {
        try {
          const { selectedUserIds: saved, excludeUserIds: savedExclude } = JSON.parse(savedFilter);
          if (saved?.length > 0) {
            setSelectedUserIds(saved);
            setExcludeUserIds(savedExclude || []);
          } else {
            setSelectedUserIds(accessData.accessibleUserIds || []);
          }
        } catch (e) {
          setSelectedUserIds(accessData.accessibleUserIds || []);
        }
      } else {
        // Default to all accessible users
        setSelectedUserIds(accessData.accessibleUserIds || []);
      }
      setHasInitialized(true);
    }
  }, [accessData, hasInitialized]);

  const stripEmojis = (text: string) => {
    return text.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}]/gu, '').trim();
  };

  const getDateRange = (preset: DatePreset) => {
    const now = new Date();
    const summerStartDate = new Date('2026-04-12');
    
    switch (preset) {
      case 'today':
        // For today view, still need a date range for any background data
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      case 'yesterday':
        return { start: format(subDays(now, 1), 'yyyy-MM-dd'), end: format(subDays(now, 1), 'yyyy-MM-dd') };
      case 'week':
        return { start: format(subDays(now, 7), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      case 'month':
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'preseason':
        return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(now < summerStartDate ? now : summerStartDate, 'yyyy-MM-dd') };
      case 'custom':
        return { 
          start: customStartDate ? format(customStartDate, 'yyyy-MM-dd') : format(new Date('2025-01-01'), 'yyyy-MM-dd'), 
          end: customEndDate ? format(customEndDate, 'yyyy-MM-dd') : format(now, 'yyyy-MM-dd')
        };
      default:
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
    }
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      setDatePreset('custom');
      setShowCustomDialog(false);
    }
  };

  const handleSectionToggle = (section: ExpandedSection) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getRatioComparison = (current: number, overall: number) => {
    if (current === 0 || overall === 0) return null;
    const percentDiff = ((overall - current) / overall) * 100;
    const isBetter = current < overall;
    return { percentDiff: Math.abs(percentDiff), isBetter };
  };

  const getCloseRatioComparison = (current: number, overall: number) => {
    if (current === 0 || overall === 0) return null;
    const percentDiff = ((current - overall) / overall) * 100;
    const isBetter = current < overall;
    return { percentDiff: Math.abs(percentDiff), isBetter };
  };

  // Effective user IDs for queries
  const effectiveUserIds = selectedUserIds.length > 0 
    ? selectedUserIds 
    : (accessData?.accessibleUserIds || []);

  // Today data hook
  const { data: liveData, isLoading: liveLoading } = useTeamLiveData({
    userIds: effectiveUserIds,
    excludeUserIds,
  });

  // Yesterday data hook
  const { data: yesterdayData, isLoading: yesterdayLoading } = useTeamYesterdayData({
    userIds: effectiveUserIds,
    excludeUserIds,
  });

  // Insights data (for non-live views)
  const { data: insightsData, isLoading: insightsLoading } = useTeamInsightsData({
    userIds: effectiveUserIds,
    dateRange: getDateRange(datePreset),
    excludeUserIds,
  });

  const { data: teamCumulativeData, isLoading: cumulativeLoading } = useTeamCumulativeFP({
    userIds: effectiveUserIds,
    dateRange: getDateRange(datePreset),
    excludeUserIds,
  });

  // Determine scope label
  const getScopeLabel = () => {
    if (!accessData) return "Loading...";
    
    const totalCount = accessData.accessibleUserIds?.length || 0;
    const selectedCount = effectiveUserIds.filter(id => !excludeUserIds.includes(id)).length;
    
    if (selectedCount === totalCount) {
      switch (accessData.accessLevel) {
        case 'area_director':
          return "Your Office";
        case 'mgmt_group_lead':
          return accessData.mgmtGroups?.[0]?.name || "Your MGMT Group";
        case 'team_lead':
          return accessData.teams?.[0]?.name || "Your Team";
        default:
          return "All Members";
      }
    }
    
    // Check if filtered to a specific team or MGMT group
    if (accessData.accessLevel === 'area_director') {
      // Check if all selected are from one MGMT group
      for (const mgmt of accessData.mgmtGroups || []) {
        const mgmtUserIds = accessData.accessibleReps
          ?.filter((r: any) => r.mgmtGroupName === mgmt.name)
          .map((r: any) => r.userId) || [];
        if (mgmtUserIds.length > 0 && mgmtUserIds.every((id: string) => effectiveUserIds.includes(id)) && 
            effectiveUserIds.every((id: string) => mgmtUserIds.includes(id) || excludeUserIds.includes(id))) {
          return mgmt.name;
        }
      }
    }
    
    // Check if filtered to a specific team
    for (const team of accessData.teams || []) {
      const teamUserIds = accessData.accessibleReps
        ?.filter((r: any) => r.teamName === team.name)
        .map((r: any) => r.userId) || [];
      if (teamUserIds.length > 0 && teamUserIds.every((id: string) => effectiveUserIds.includes(id)) && 
          effectiveUserIds.every((id: string) => teamUserIds.includes(id) || excludeUserIds.includes(id))) {
        return team.name;
      }
    }
    
    return `${selectedCount} members`;
  };

  // Calculate ratio comparisons
  const doorsComparison = insightsData ? getRatioComparison(insightsData.doorsToFp, insightsData.overallDoorsToFp) : null;
  const pitchesComparison = insightsData ? getRatioComparison(insightsData.pitchesToFp, insightsData.overallPitchesToFp) : null;
  const transitionsComparison = insightsData ? getRatioComparison(insightsData.transitionsToFp, insightsData.overallTransitionsToFp) : null;
  const closeComparison = insightsData ? getCloseRatioComparison(insightsData.presentationsToClose, insightsData.overallPresentationsToClose) : null;

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-background p-4 pb-24">
        <div className="max-w-lg mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (accessData?.accessLevel === 'none') {
    return (
      <div className="min-h-screen bg-background p-4 pb-24">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/40" />
              <div>
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p className="text-muted-foreground mt-2">
                  You don't have access to team reporting features.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isTodayView = datePreset === 'today';
  const isYesterdayView = datePreset === 'yesterday';

  return (
    <div className="min-h-screen bg-background p-4 pb-24 overflow-x-hidden">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Scope Badge */}
        <div className="flex items-center">
          <ScopeBadge
            accessLevel={accessData?.accessLevel || 'none'}
            selectedCount={effectiveUserIds.filter(id => !excludeUserIds.includes(id)).length}
            totalCount={accessData?.accessibleUserIds?.length || 0}
            scopeLabel={getScopeLabel()}
            onClick={() => setIsFilterOpen(true)}
          />
        </div>

        {/* Date Range Selector */}
        <div className="overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex gap-2 whitespace-nowrap">
            <Button
              variant={datePreset === 'today' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatePreset('today')}
              className="flex-shrink-0 gap-1.5"
            >
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-current" />
                {datePreset === 'today' && (liveData?.workingCount || 0) > 0 && (
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-current animate-ping opacity-75" />
                )}
              </div>
              Today
            </Button>
            <Button
              variant={datePreset === 'yesterday' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatePreset('yesterday')}
              className="flex-shrink-0"
            >
              Yesterday
            </Button>
            <Button
              variant={datePreset === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatePreset('week')}
              className="flex-shrink-0"
            >
              This Week
            </Button>
            <Button
              variant={datePreset === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatePreset('month')}
              className="flex-shrink-0"
            >
              This Month
            </Button>
            <Button
              variant={datePreset === 'preseason' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatePreset('preseason')}
              className="flex-shrink-0"
            >
              Preseason
            </Button>
            <Button
              variant={datePreset === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowCustomDialog(true)}
              className="flex-shrink-0"
            >
              <CalendarIcon className="w-4 h-4 mr-1" />
              {datePreset === 'custom' && customStartDate && customEndDate
                ? `${format(customStartDate, 'MMM d')} — ${format(customEndDate, 'MMM d')}`
                : 'Custom'}
            </Button>
          </div>
        </div>

        {/* Today View Content */}
        {isTodayView ? (
          <div className="space-y-4">
            <LiveActivityCard
              liveReps={liveData?.liveReps || []}
              workingCount={liveData?.workingCount || 0}
              forgottenCount={liveData?.forgottenCount || 0}
              isLoading={liveLoading}
            />
            <LiveLeaderboard
              liveReps={liveData?.liveReps || []}
              isLoading={liveLoading}
              hasWorkingReps={(liveData?.workingCount || 0) > 0}
            />
          </div>
        ) : isYesterdayView ? (
          <div className="space-y-4">
            <LiveLeaderboard
              liveReps={yesterdayData?.reps?.map(r => ({
                ...r,
                isWorking: false,
                hasForgottenEntry: false,
                todayStats: r.stats,
                durationMinutes: r.durationMinutes,
              })) || []}
              isLoading={yesterdayLoading}
              hasWorkingReps={false}
              title="Yesterday's Rankings"
            />
          </div>
        ) : insightsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4">
                <div className="h-5 w-32 bg-muted rounded animate-pulse mb-2" />
                <div className="h-8 w-20 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : !insightsData || insightsData.totalFP === 0 ? (
          <Card className="border-border/40">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="relative">
                  <BarChart3 className="h-16 w-16 text-muted-foreground/40" />
                  <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">No Data Yet</h2>
                <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  No finalized entries found for this period. Try selecting a different date range or check the Live view for current activity.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Card */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Team Summary</h2>
                {insightsData.uniqueRepsWorked && insightsData.uniqueRepsWorked > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {insightsData.uniqueRepsWorked} rep{insightsData.uniqueRepsWorked !== 1 ? 's' : ''} · {insightsData.daysWorked} day{insightsData.daysWorked !== 1 ? 's' : ''} total
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold text-primary">{insightsData.totalFP.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Total FP+</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">${insightsData.totalPRMR.toFixed(0)}</div>
                  <div className="text-sm text-muted-foreground">Total PRMR</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{insightsData.totalDoors}</div>
                  <div className="text-sm text-muted-foreground">Doors Knocked</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{insightsData.totalDMs}</div>
                  <div className="text-sm text-muted-foreground">Decision Makers</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{insightsData.totalPitches}</div>
                  <div className="text-sm text-muted-foreground">Pitches</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{insightsData.totalTransitions}</div>
                  <div className="text-sm text-muted-foreground">Transitions</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{insightsData.totalPresentations}</div>
                  <div className="text-sm text-muted-foreground">Presentations</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{insightsData.totalCloses}</div>
                  <div className="text-sm text-muted-foreground">Closes</div>
                </div>
              </div>

              {/* FP+ Breakdown */}
              {insightsData.totalUpgradeFP > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-muted-foreground">FP+ Breakdown</div>
                    <div className="text-xs text-primary font-semibold">{((insightsData.totalUpgradeFP / insightsData.totalFP) * 100).toFixed(0)}% upgrades</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">{(insightsData.totalFP - insightsData.totalUpgradeFP).toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">FP</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{insightsData.totalUpgradeFP.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">Upgrade FP+</div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Progress Over Time Chart */}
            <TeamProgressChart 
              teamData={teamCumulativeData}
              repBreakdown={insightsData.repBreakdown}
              groupedByTeam={insightsData.groupedByTeam}
              groupedByMgmt={insightsData.groupedByMgmt}
              dailyTrendByRep={insightsData.dailyTrendByRep}
              dailyTrendByTeam={insightsData.dailyTrendByTeam}
              dailyTrendByMgmt={insightsData.dailyTrendByMgmt}
              accessLevel={accessData?.accessLevel || 'none'}
              isLoading={cumulativeLoading}
            />

            {/* Sales Funnel - Collapsible */}
            <Card>
              <Collapsible open={expandedSection === 'funnel'} onOpenChange={() => handleSectionToggle('funnel')}>
                <CollapsibleTrigger className="w-full p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUpIcon className="w-5 h-5" />
                      <h2 className="text-lg font-semibold">Sales Funnel</h2>
                    </div>
                    <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", expandedSection === 'funnel' && "rotate-180")} />
                  </div>
                  {expandedSection !== 'funnel' && (
                    <div className="mt-2 text-left text-sm text-muted-foreground">
                      {insightsData.funnelData.doors.total} doors → {insightsData.funnelData.closes.total} closes · {insightsData.funnelData.doors.conversionToNext.toFixed(1)}% DM rate
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <SalesFunnelChart funnelData={insightsData.funnelData} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Key Ratios - Collapsible */}
            <Card>
              <Collapsible open={expandedSection === 'ratios'} onOpenChange={() => handleSectionToggle('ratios')}>
                <CollapsibleTrigger className="w-full p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      <h2 className="text-lg font-semibold">Key Ratios</h2>
                    </div>
                    <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", expandedSection === 'ratios' && "rotate-180")} />
                  </div>
                  {expandedSection !== 'ratios' && (
                    <div className="mt-2 text-left text-sm text-muted-foreground">
                      {insightsData.doorsToFp.toFixed(1)} doors/FP · {insightsData.pitchesToFp.toFixed(1)} pitches/FP
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-4">
                    {/* Doors → FP */}
                    <div className="p-4 bg-card rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-muted-foreground">Doors → FP</div>
                        {doorsComparison && (
                          <div className={cn("flex items-center gap-1 text-xs", doorsComparison.isBetter ? "text-green-600 dark:text-green-400" : "text-orange-500 dark:text-orange-400")}>
                            {doorsComparison.isBetter ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                            {doorsComparison.percentDiff.toFixed(0)}% vs overall
                          </div>
                        )}
                      </div>
                      <div className="text-3xl font-bold">{insightsData.doorsToFp.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground mt-1">Overall avg: {insightsData.overallDoorsToFp.toFixed(1)}</div>
                    </div>

                    {/* Pitches → FP */}
                    <div className="p-4 bg-card rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-muted-foreground">Pitches → FP</div>
                        {pitchesComparison && (
                          <div className={cn("flex items-center gap-1 text-xs", pitchesComparison.isBetter ? "text-green-600 dark:text-green-400" : "text-orange-500 dark:text-orange-400")}>
                            {pitchesComparison.isBetter ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                            {pitchesComparison.percentDiff.toFixed(0)}% vs overall
                          </div>
                        )}
                      </div>
                      <div className="text-3xl font-bold">{insightsData.pitchesToFp.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground mt-1">Overall avg: {insightsData.overallPitchesToFp.toFixed(1)}</div>
                    </div>

                    {/* Transitions → FP */}
                    <div className="p-4 bg-card rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-muted-foreground">Transitions → FP</div>
                        {transitionsComparison && (
                          <div className={cn("flex items-center gap-1 text-xs", transitionsComparison.isBetter ? "text-green-600 dark:text-green-400" : "text-orange-500 dark:text-orange-400")}>
                            {transitionsComparison.isBetter ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                            {transitionsComparison.percentDiff.toFixed(0)}% vs overall
                          </div>
                        )}
                      </div>
                      <div className="text-3xl font-bold">{insightsData.transitionsToFp.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground mt-1">Overall avg: {insightsData.overallTransitionsToFp.toFixed(1)}</div>
                    </div>

                    {/* Presentations → Close */}
                    <div className="p-4 bg-card rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-muted-foreground">Presentations → Close</div>
                        {closeComparison && (
                          <div className={cn("flex items-center gap-1 text-xs", closeComparison.isBetter ? "text-green-600 dark:text-green-400" : "text-orange-500 dark:text-orange-400")}>
                            {closeComparison.isBetter ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                            {closeComparison.percentDiff.toFixed(0)}% vs overall
                          </div>
                        )}
                      </div>
                      <div className="text-3xl font-bold">{insightsData.presentationsToClose.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground mt-1">Overall avg: {insightsData.overallPresentationsToClose.toFixed(1)}</div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Productivity - Collapsible */}
            <Card>
              <Collapsible open={expandedSection === 'productivity'} onOpenChange={() => handleSectionToggle('productivity')}>
                <CollapsibleTrigger className="w-full p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      <h2 className="text-lg font-semibold">Productivity per Hour</h2>
                    </div>
                    <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", expandedSection === 'productivity' && "rotate-180")} />
                  </div>
                  {expandedSection !== 'productivity' && (
                    <div className="mt-2 text-left text-sm text-muted-foreground">
                      {insightsData.doorsPerHour.toFixed(1)} doors/hr · {insightsData.hoursToFp.toFixed(1)} hrs to FP
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Doors per Hour</div>
                        <div className="text-2xl font-bold">{insightsData.doorsPerHour.toFixed(1)}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Hours to FP</div>
                        <div className="text-2xl font-bold">{insightsData.hoursToFp.toFixed(1)}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Pitches per Hour</div>
                        <div className="text-2xl font-bold">{insightsData.pitchesPerHour.toFixed(1)}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Transitions per Hour</div>
                        <div className="text-2xl font-bold">{insightsData.transitionsPerHour.toFixed(1)}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Presentations per Hour</div>
                        <div className="text-2xl font-bold">{insightsData.presentationsPerHour.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Activity Trends - Collapsible */}
            {insightsData.dailyTrend.length > 0 && (
              <Card>
                <Collapsible open={expandedSection === 'trends'} onOpenChange={() => handleSectionToggle('trends')}>
                  <CollapsibleTrigger className="w-full p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUpIcon className="w-5 h-5" />
                        <h2 className="text-lg font-semibold">Activity Trends</h2>
                      </div>
                      <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", expandedSection === 'trends' && "rotate-180")} />
                    </div>
                    {expandedSection !== 'trends' && (
                      <div className="mt-2 text-left text-sm text-muted-foreground">
                        Daily trends · {insightsData.dailyTrend.length} days tracked
                      </div>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <ActivityTrendChart dailyTrend={insightsData.dailyTrend} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}

            {/* Hourly Activity - Collapsible */}
            {insightsData.hourRange && (
              <Card>
                <Collapsible open={expandedSection === 'hourly'} onOpenChange={() => handleSectionToggle('hourly')}>
                  <CollapsibleTrigger className="w-full p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        <h2 className="text-lg font-semibold">Hourly Patterns</h2>
                      </div>
                      <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", expandedSection === 'hourly' && "rotate-180")} />
                    </div>
                    {expandedSection !== 'hourly' && insightsData.mostProductiveHour !== null && (
                      <div className="mt-2 text-left text-sm text-muted-foreground">
                        Most productive: {insightsData.mostProductiveHour === 0 ? '12' : insightsData.mostProductiveHour > 12 ? insightsData.mostProductiveHour - 12 : insightsData.mostProductiveHour}
                        {insightsData.mostProductiveHour >= 12 ? 'PM' : 'AM'}
                      </div>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <HourlyActivityHeatmap 
                        hourlyActivity={insightsData.hourlyActivity}
                        peakHours={insightsData.peakHours}
                        hourRange={insightsData.hourRange}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}

            {/* Best Periods - Collapsible */}
            {insightsData.bestPeriods && (
              <Card>
                <Collapsible open={expandedSection === 'bestPeriods'} onOpenChange={() => handleSectionToggle('bestPeriods')}>
                  <CollapsibleTrigger className="w-full p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5" />
                        <h2 className="text-lg font-semibold">Best Periods</h2>
                      </div>
                      <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", expandedSection === 'bestPeriods' && "rotate-180")} />
                    </div>
                    {expandedSection !== 'bestPeriods' && insightsData.bestPeriods.highestFpDay && (
                      <div className="mt-2 text-left text-sm text-muted-foreground">
                        Best day: {insightsData.bestPeriods.highestFpDay.date} · {insightsData.bestPeriods.highestFpDay.value.toFixed(1)} FP+
                      </div>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <BestPeriodsSection data={insightsData.bestPeriods} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}

            {/* Timing Patterns - Collapsible */}
            <Card>
              <Collapsible open={expandedSection === 'timing'} onOpenChange={() => handleSectionToggle('timing')}>
                <CollapsibleTrigger className="w-full p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      <h2 className="text-lg font-semibold">Timing Patterns</h2>
                    </div>
                    <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", expandedSection === 'timing' && "rotate-180")} />
                  </div>
                  {expandedSection !== 'timing' && (
                    <div className="mt-2 text-left text-sm text-muted-foreground">
                      {insightsData.avgStartTime} — {insightsData.avgEndTime} · {insightsData.avgHoursWorked.toFixed(1)} hrs avg
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Avg Start Time</div>
                        <div className="text-xl font-bold">{insightsData.avgStartTime}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Avg End Time</div>
                        <div className="text-xl font-bold">{insightsData.avgEndTime}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Avg Hours Worked</div>
                        <div className="text-xl font-bold">{insightsData.avgHoursWorked.toFixed(1)}h</div>
                      </div>
                      {insightsData.mostProductiveHour !== null && (
                        <div>
                          <div className="text-sm text-muted-foreground">Peak Hour</div>
                          <div className="text-xl font-bold">
                            {insightsData.mostProductiveHour === 0 ? '12' : insightsData.mostProductiveHour > 12 ? insightsData.mostProductiveHour - 12 : insightsData.mostProductiveHour}
                            {insightsData.mostProductiveHour >= 12 ? 'PM' : 'AM'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Individual Breakdown - Collapsible */}
            {insightsData.repBreakdown && insightsData.repBreakdown.length > 0 && (
              <Card>
                <Collapsible open={expandedSection === 'individuals'} onOpenChange={() => handleSectionToggle('individuals')}>
                  <CollapsibleTrigger className="w-full p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        <h2 className="text-lg font-semibold">Individual Breakdown</h2>
                      </div>
                      <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", expandedSection === 'individuals' && "rotate-180")} />
                    </div>
                    {expandedSection !== 'individuals' && (
                      <div className="mt-2 text-left text-sm text-muted-foreground">
                        {insightsData.repBreakdown.length} reps with activity
                      </div>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-3">
                      {insightsData.repBreakdown
                        .filter((rep: any) => rep.doors > 0 || rep.fp > 0)
                        .sort((a: any, b: any) => b.fp - a.fp)
                        .map((rep: any, idx: number) => (
                        <button 
                          key={rep.userId}
                          onClick={() => {
                            setSelectedRep(rep);
                            setRepDrawerOpen(true);
                          }}
                          className={cn(
                            "p-3 rounded-lg border border-border w-full text-left transition-colors hover:bg-muted/50",
                            idx === 0 && "bg-primary/5 border-primary/20"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="font-semibold">{stripEmojis(rep.name)}</div>
                              <div className="text-xs text-muted-foreground">{rep.teamName !== 'No Team' ? rep.teamName : rep.mgmtGroupName}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-primary">{rep.fp.toFixed(1)} FP+</div>
                              <div className="text-xs text-muted-foreground">${rep.prmr.toFixed(0)} PRMR</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                            <div>{rep.doors} doors</div>
                            <div>{rep.pitches} pitches</div>
                            <div>{rep.transitions} trans</div>
                            <div>{rep.presentations} pres</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}
          </>
        )}

        {/* Custom Date Dialog */}
        {showCustomDialog && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-sm p-4 space-y-4">
              <h3 className="text-lg font-semibold">Select Date Range</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate ? format(customStartDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCustomDialog(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleCustomDateApply} className="flex-1" disabled={!customStartDate || !customEndDate}>
                  Apply
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Filter Sheet */}
      <TeamFilterSheet
        open={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        accessData={accessData}
        selectedUserIds={selectedUserIds}
        onUserIdsChange={setSelectedUserIds}
        excludeUserIds={excludeUserIds}
        onExcludeUserIdsChange={setExcludeUserIds}
      />

      {/* Rep Detail Drawer */}
      <RepDetailDrawer
        open={repDrawerOpen}
        onOpenChange={setRepDrawerOpen}
        rep={selectedRep}
      />
    </div>
  );
};

export default TeamReports;
