import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useTeamInsightsData } from "@/hooks/useTeamInsightsData";
import { useTeamLiveData } from "@/hooks/useTeamLiveData";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon, BarChart3, Users, TrendingUp, Layers } from "lucide-react";
import { TeamFilterSheet } from "@/components/TeamFilterSheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, subDays, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { useTeamCumulativeFP } from "@/hooks/useTeamCumulativeFP";
import { ScopeBadge } from "@/components/reports/ScopeBadge";
import { useTeamYesterdayData } from "@/hooks/useTeamYesterdayData";
import { useTeamAggregatedRankings } from "@/hooks/useTeamAggregatedRankings";
import { useTeamCanceledStats } from "@/hooks/useTeamCanceledStats";
import { ReportsHeroCard } from "@/components/reports/ReportsHeroCard";
import { ReportsPeopleTab } from "@/components/reports/ReportsPeopleTab";
import { ReportsPerformanceTab } from "@/components/reports/ReportsPerformanceTab";
import { ReportsPatternsTab } from "@/components/reports/ReportsPatternsTab";
import { LeaderAICoachFab } from "@/components/reports/LeaderAICoachFab";

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'preseason' | 'ytd' | 'custom';
type ReportTab = 'people' | 'performance' | 'patterns';

const TeamReports = () => {
  const { data: accessData, isLoading: accessLoading } = useTeamAccess();
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [excludeUserIds, setExcludeUserIds] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTab>('people');

  // Role-aware default tab based on downline size
  useEffect(() => {
    if (accessData && !hasInitialized) {
      const downlineSize = accessData.accessibleUserIds?.length || 0;
      
      // Large downlines (40+) → default to Performance (executive summary)
      // Medium (15-40) → default to People (team comparison)
      // Small (<15) → default to People (individual focus)
      if (downlineSize >= 40) {
        setActiveTab('performance');
      } else {
        setActiveTab('people');
      }

      // Load saved filter from localStorage or use defaults
      const savedFilter = localStorage.getItem('team-reports-filter');
      if (savedFilter) {
        try {
          const { selectedUserIds: saved, excludeUserIds: savedExclude, yearFilter: savedYear } = JSON.parse(savedFilter);
          if (saved?.length > 0) {
            setSelectedUserIds(saved);
            setExcludeUserIds(savedExclude || []);
            setYearFilter(savedYear || []);
          } else {
            setSelectedUserIds(accessData.accessibleUserIds || []);
          }
        } catch (e) {
          setSelectedUserIds(accessData.accessibleUserIds || []);
        }
      } else {
        setSelectedUserIds(accessData.accessibleUserIds || []);
      }
      setHasInitialized(true);
    }
  }, [accessData, hasInitialized]);

  const getDateRange = (preset: DatePreset) => {
    const now = new Date();
    const summerStartDate = new Date('2026-04-12');
    
    switch (preset) {
      case 'today':
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      case 'yesterday':
        return { start: format(subDays(now, 1), 'yyyy-MM-dd'), end: format(subDays(now, 1), 'yyyy-MM-dd') };
      case 'week':
        return { start: format(subDays(now, 7), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      case 'month':
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'preseason':
        return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(now < summerStartDate ? now : summerStartDate, 'yyyy-MM-dd') };
      case 'ytd':
        return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
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

  // Effective user IDs for queries (with year filter applied)
  const effectiveUserIds = useMemo(() => {
    let userIds = selectedUserIds.length > 0 
      ? selectedUserIds 
      : (accessData?.accessibleUserIds || []);
    
    if (yearFilter.length > 0 && accessData?.accessibleReps) {
      const repsMatchingYear = accessData.accessibleReps
        .filter((rep: any) => yearFilter.includes(rep.year?.toLowerCase()))
        .map((rep: any) => rep.userId);
      userIds = userIds.filter((id: string) => repsMatchingYear.includes(id));
    }
    
    return userIds;
  }, [selectedUserIds, accessData?.accessibleUserIds, accessData?.accessibleReps, yearFilter]);

  // Data hooks
  const { data: liveData, isLoading: liveLoading } = useTeamLiveData({
    userIds: effectiveUserIds,
    excludeUserIds,
  });

  const { data: yesterdayData, isLoading: yesterdayLoading } = useTeamYesterdayData({
    userIds: effectiveUserIds,
    excludeUserIds,
  });

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

  const aggregatedPeriod = datePreset === 'week' ? 'week' : 
                          datePreset === 'month' ? 'month' : 
                          datePreset === 'preseason' ? 'season' : 
                          datePreset === 'ytd' ? 'ytd' : null;

  const { data: aggregatedRankings, isLoading: aggregatedLoading } = useTeamAggregatedRankings({
    userIds: effectiveUserIds,
    excludeUserIds,
    period: aggregatedPeriod || 'week',
  });

  const isAggregatedView = datePreset === 'week' || datePreset === 'month' || datePreset === 'preseason' || datePreset === 'ytd';
  const currentDateRange = getDateRange(datePreset);
  
  const { data: canceledStats, isLoading: canceledLoading } = useTeamCanceledStats({
    userIds: effectiveUserIds,
    excludeUserIds,
    startDate: isAggregatedView ? currentDateRange.start : undefined,
    endDate: isAggregatedView ? currentDateRange.end : undefined,
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
    
    if (accessData.accessLevel === 'area_director') {
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

  // Get period label for hero card
  const getPeriodLabel = () => {
    switch (datePreset) {
      case 'today': return "Today";
      case 'yesterday': return "Yesterday";
      case 'week': return "This Week";
      case 'month': return "This Month";
      case 'preseason': return "Preseason";
      case 'ytd': return "Year to Date";
      case 'custom': 
        if (customStartDate && customEndDate) {
          return `${format(customStartDate, 'MMM d')} — ${format(customEndDate, 'MMM d')}`;
        }
        return "Custom Range";
      default: return "";
    }
  };

  // Hero metrics based on view type
  const getHeroMetrics = () => {
    if (datePreset === 'today') {
      const totalFP = liveData?.liveReps?.reduce((sum: number, r: any) => sum + (r.todayStats?.fp || 0), 0) || 0;
      const totalPRMR = liveData?.liveReps?.reduce((sum: number, r: any) => sum + (r.todayStats?.prmr || 0), 0) || 0;
      const repCount = liveData?.liveReps?.length || 0;
      return {
        totalFP,
        totalPRMR,
        repCount,
        workingCount: liveData?.workingCount || 0,
        avgFPPerRep: repCount > 0 ? totalFP / repCount : 0,
        isLive: true,
      };
    }
    
    if (datePreset === 'yesterday') {
      const totalFP = yesterdayData?.reps?.reduce((sum: number, r: any) => sum + (r.stats?.fp || 0), 0) || 0;
      const totalPRMR = yesterdayData?.reps?.reduce((sum: number, r: any) => sum + (r.stats?.prmr || 0), 0) || 0;
      const repCount = yesterdayData?.reps?.length || 0;
      return {
        totalFP,
        totalPRMR,
        repCount,
        avgFPPerRep: repCount > 0 ? totalFP / repCount : 0,
        isLive: false,
      };
    }

    // Aggregated views
    return {
      totalFP: aggregatedRankings?.totalFP || insightsData?.totalFP || 0,
      totalPRMR: aggregatedRankings?.totalPRMR || insightsData?.totalPRMR || 0,
      repCount: aggregatedRankings?.repCount || 0,
      avgFPPerRep: (aggregatedRankings?.repCount || 0) > 0 
        ? (aggregatedRankings?.totalFP || 0) / aggregatedRankings!.repCount 
        : 0,
      isLive: false,
    };
  };

  const heroMetrics = getHeroMetrics();

  // View type for people tab
  const getViewType = () => {
    if (datePreset === 'today') return 'today' as const;
    if (datePreset === 'yesterday') return 'yesterday' as const;
    return 'aggregated' as const;
  };

  // Rankings title
  const getRankingsTitle = () => {
    switch (datePreset) {
      case 'week': return "This Week's Rankings";
      case 'month': return "This Month's Rankings";
      case 'ytd': return "YTD Rankings";
      case 'preseason': return "Season Rankings";
      default: return "Rankings";
    }
  };

  // Canceled title
  const getCanceledTitle = () => {
    switch (datePreset) {
      case 'week': return "This Week's Cancellations";
      case 'month': return "This Month's Cancellations";
      case 'ytd': return "YTD Cancellations";
      case 'preseason': return "Season Cancellations";
      default: return "Cancellations";
    }
  };

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-background p-4 pb-24">
        <div className="max-w-lg mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
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

  const isTodayOrYesterday = datePreset === 'today' || datePreset === 'yesterday';
  const showSummerAvailability = datePreset === 'today' || datePreset === 'preseason' || datePreset === 'ytd';

  return (
    <div className="min-h-screen bg-background p-4 pb-24 overflow-x-hidden">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Scope Badge */}
        <div className="flex items-center justify-end">
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
              Week
            </Button>
            <Button
              variant={datePreset === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatePreset('month')}
              className="flex-shrink-0"
            >
              Month
            </Button>
            <Button
              variant={datePreset === 'preseason' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatePreset('preseason')}
              className="flex-shrink-0"
            >
              Season
            </Button>
            <Button
              variant={datePreset === 'ytd' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatePreset('ytd')}
              className="flex-shrink-0"
            >
              YTD
            </Button>
            <Popover open={showCustomDialog} onOpenChange={setShowCustomDialog}>
              <PopoverTrigger asChild>
                <Button
                  variant={datePreset === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-shrink-0"
                >
                  <CalendarIcon className="w-4 h-4 mr-1" />
                  {datePreset === 'custom' && customStartDate && customEndDate
                    ? `${format(customStartDate, 'MMM d')} — ${format(customEndDate, 'MMM d')}`
                    : 'Custom'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      disabled={(date) => date > new Date()}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      disabled={(date) => date > new Date() || (customStartDate && date < customStartDate)}
                    />
                  </div>
                  <Button onClick={handleCustomDateApply} className="w-full">
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Hero Summary Card */}
        <ReportsHeroCard
          totalFP={heroMetrics.totalFP}
          totalPRMR={heroMetrics.totalPRMR}
          repCount={heroMetrics.repCount}
          workingCount={heroMetrics.workingCount}
          avgFPPerRep={heroMetrics.avgFPPerRep}
          periodLabel={getPeriodLabel()}
          isLive={heroMetrics.isLive}
        />

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="people" className="gap-1.5">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">People</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-1.5">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger 
              value="patterns" 
              className="gap-1.5"
              disabled={isTodayOrYesterday}
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Patterns</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="people" className="mt-0">
              <ReportsPeopleTab
                viewType={getViewType()}
                liveReps={liveData?.liveReps}
                workingCount={liveData?.workingCount}
                forgottenCount={liveData?.forgottenCount}
                liveLoading={liveLoading}
                yesterdayReps={yesterdayData?.reps}
                yesterdayLoading={yesterdayLoading}
                aggregatedReps={aggregatedRankings?.reps}
                totalFP={aggregatedRankings?.totalFP}
                totalPRMR={aggregatedRankings?.totalPRMR}
                repCount={aggregatedRankings?.repCount}
                aggregatedLoading={aggregatedLoading}
                rankingsTitle={getRankingsTitle()}
                userIds={effectiveUserIds}
                excludeUserIds={excludeUserIds}
                accessibleReps={accessData?.accessibleReps || []}
                showSummerAvailability={showSummerAvailability}
              />
            </TabsContent>

            <TabsContent value="performance" className="mt-0">
              {isTodayOrYesterday ? (
                <Card className="p-6 text-center">
                  <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="font-medium">Performance metrics available for multi-day views</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select Week, Month, Season, or YTD to see detailed performance data
                  </p>
                </Card>
              ) : (
                <ReportsPerformanceTab
                  insightsData={insightsData}
                  teamCumulativeData={teamCumulativeData}
                  repBreakdown={insightsData?.repBreakdown}
                  groupedByTeam={insightsData?.groupedByTeam}
                  groupedByMgmt={insightsData?.groupedByMgmt}
                  dailyTrendByRep={insightsData?.dailyTrendByRep}
                  dailyTrendByTeam={insightsData?.dailyTrendByTeam}
                  dailyTrendByMgmt={insightsData?.dailyTrendByMgmt}
                  accessLevel={accessData?.accessLevel || 'none'}
                  cumulativeLoading={cumulativeLoading}
                  canceledStats={canceledStats}
                  canceledLoading={canceledLoading}
                  canceledTitle={getCanceledTitle()}
                  isLoading={insightsLoading}
                />
              )}
            </TabsContent>

            <TabsContent value="patterns" className="mt-0">
              <ReportsPatternsTab
                insightsData={insightsData}
                isLoading={insightsLoading}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* Filter Sheet */}
        <TeamFilterSheet
          open={isFilterOpen}
          onOpenChange={setIsFilterOpen}
          accessData={accessData}
          selectedUserIds={selectedUserIds}
          onUserIdsChange={setSelectedUserIds}
          excludeUserIds={excludeUserIds}
          onExcludeUserIdsChange={setExcludeUserIds}
          yearFilter={yearFilter}
          onYearFilterChange={setYearFilter}
        />

        {/* AI Coach FAB */}
        <LeaderAICoachFab />
      </div>
    </div>
  );
};

export default TeamReports;
