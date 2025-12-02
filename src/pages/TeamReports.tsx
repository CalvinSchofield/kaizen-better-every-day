import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useTeamInsightsData } from "@/hooks/useTeamInsightsData";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter, Users, Calendar as CalendarIcon, ChevronDown, TrendingUpIcon, BarChart3, Clock, Target, Award, TrendingUp, TrendingDown } from "lucide-react";
import { TeamFilterSheet } from "@/components/TeamFilterSheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { SalesFunnelChart } from "@/components/insights/SalesFunnelChart";
import { ActivityTrendChart } from "@/components/insights/ActivityTrendChart";
import { HourlyActivityHeatmap } from "@/components/insights/HourlyActivityHeatmap";
import { DayOfWeekAnalysis } from "@/components/insights/DayOfWeekAnalysis";
import { FPCumulativeChart } from "@/components/FPCumulativeChart";
import { useTeamCumulativeFP } from "@/hooks/useTeamCumulativeFP";

type DatePreset = 'yesterday' | 'week' | 'month' | 'ytd' | 'preseason' | 'summer' | 'custom';
type ExpandedSection = 'funnel' | 'ratios' | 'productivity' | 'trends' | 'hourly' | 'bestPeriods' | 'timing' | 'individuals' | null;
type GroupViewMode = 'all' | 'mgmt-groups' | 'teams' | 'individuals';

const TeamReports = () => {
  const { data: accessData, isLoading: accessLoading } = useTeamAccess();
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [excludeUserIds, setExcludeUserIds] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [groupViewMode, setGroupViewMode] = useState<GroupViewMode>('all');
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);

  const stripEmojis = (text: string) => {
    return text.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}]/gu, '').trim();
  };

  const getDateRange = (preset: DatePreset) => {
    const now = new Date();
    const nowStr = format(now, 'yyyy-MM-dd');
    const summerStartDate = new Date('2026-04-12');
    
    switch (preset) {
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
        return { start: yesterdayStr, end: yesterdayStr };
      }
      case 'week':
        return { start: format(subDays(now, 7), 'yyyy-MM-dd'), end: nowStr };
      case 'month':
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'ytd':
        return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: nowStr };
      case 'preseason': {
        const preseasonStart = new Date(2025, 8, 28); // Sept 28, 2025
        const preseasonEnd = new Date(2026, 3, 11); // Apr 11, 2026
        return { start: format(preseasonStart, 'yyyy-MM-dd'), end: format(preseasonEnd, 'yyyy-MM-dd') };
      }
      case 'summer': {
        const summerStart = new Date(2026, 3, 12); // Apr 12, 2026
        const summerEnd = new Date(2026, 8, 27); // Sept 27, 2026
        return { start: format(summerStart, 'yyyy-MM-dd'), end: format(summerEnd, 'yyyy-MM-dd') };
      }
      case 'custom':
        return { 
          start: customStartDate ? format(customStartDate, 'yyyy-MM-dd') : format(new Date('2025-01-01'), 'yyyy-MM-dd'), 
          end: customEndDate ? format(customEndDate, 'yyyy-MM-dd') : nowStr
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
    const isBetter = current < overall; // Lower ratios are better
    return { percentDiff: Math.abs(percentDiff), isBetter };
  };

  const getCloseRatioComparison = (current: number, overall: number) => {
    if (current === 0 || overall === 0) return null;
    const percentDiff = ((current - overall) / overall) * 100;
    const isBetter = current < overall; // Lower is better
    return { percentDiff: Math.abs(percentDiff), isBetter };
  };

  // Initialize selected users when access data loads
  const effectiveUserIds = selectedUserIds.length > 0 
    ? selectedUserIds 
    : (accessData?.accessibleUserIds || []);

  const { data: insightsData, isLoading: insightsLoading } = useTeamInsightsData({
    userIds: effectiveUserIds,
    dateRange: getDateRange(datePreset),
    excludeUserIds,
  });

  const { data: teamCumulativeData, groupedData: groupedCumulativeData, isLoading: cumulativeLoading } = useTeamCumulativeFP({
    userIds: effectiveUserIds,
    dateRange: getDateRange(datePreset),
    excludeUserIds,
    groupBy: groupViewMode === 'mgmt-groups' ? 'mgmt' : groupViewMode === 'teams' ? 'team' : null,
  });

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
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                You don't have access to team reporting features.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24 overflow-x-hidden">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Date Range Selector with Fade and Fixed Filter */}
        <div className="relative">
          {/* Scrollable date buttons */}
          <div className="overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex gap-2 pr-24 whitespace-nowrap">
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
                variant={datePreset === 'ytd' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDatePreset('ytd')}
                className="flex-shrink-0"
              >
                YTD
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
                variant={datePreset === 'summer' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDatePreset('summer')}
                className="flex-shrink-0"
              >
                Summer
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
          
          {/* Fixed Filter button with fade gradient */}
          <div className="absolute right-0 top-0 bottom-2 flex items-start pointer-events-none">
            <div className="w-20 h-full bg-gradient-to-l from-background from-60% to-transparent" />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsFilterOpen(true)}
              className="gap-2 pointer-events-auto flex-shrink-0 bg-background"
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 pb-2 whitespace-nowrap">
            {(accessData?.accessLevel === 'area_director' || accessData?.accessLevel === 'mgmt_group_lead') && (
              <>
                <Button
                  variant={groupViewMode === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGroupViewMode('all')}
                  className="flex-shrink-0"
                >
                  All
                </Button>
                {accessData?.accessLevel === 'area_director' && (
                  <Button
                    variant={groupViewMode === 'mgmt-groups' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGroupViewMode('mgmt-groups')}
                    className="flex-shrink-0"
                  >
                    By MGMT
                  </Button>
                )}
                <Button
                  variant={groupViewMode === 'teams' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGroupViewMode('teams')}
                  className="flex-shrink-0"
                >
                  By Team
                </Button>
                <Button
                  variant={groupViewMode === 'individuals' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGroupViewMode('individuals')}
                  className="flex-shrink-0"
                >
                  Individual
                </Button>
              </>
            )}
            {accessData?.accessLevel === 'team_lead' && (
              <>
                <Button
                  variant={groupViewMode === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGroupViewMode('all')}
                  className="flex-shrink-0"
                >
                  All
                </Button>
                <Button
                  variant={groupViewMode === 'individuals' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGroupViewMode('individuals')}
                  className="flex-shrink-0"
                >
                  Individual
                </Button>
              </>
            )}
          </div>
        </div>


        {insightsLoading ? (
          <>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4">
                  <div className="h-5 w-32 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </>
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
                  Encourage your team to track their daily activity so you can pull insights into what they need and how to help them level up. 
                  No more guessing — get the data you need to lead effectively.
                </p>
              </div>
              <div className="pt-2">
                <p className="text-sm text-primary font-medium">
                  Let's get tracking! 📊
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Card - Not Collapsible */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Team Summary</h2>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm text-primary font-medium">{insightsData.daysWorked} days worked</span>
                  {insightsData.dataQuality && (
                    <span className="text-xs text-muted-foreground">
                      {insightsData.dataQuality.percentage.toFixed(0)}% with activity tracking
                    </span>
                  )}
                </div>
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
            <FPCumulativeChart 
              teamData={teamCumulativeData}
              isTeamLoading={cumulativeLoading}
              groupViewMode={groupViewMode}
              groupedCumulativeData={groupedCumulativeData}
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
                    <SalesFunnelChart 
                      funnelData={insightsData.funnelData}
                      groupViewMode={groupViewMode === 'mgmt-groups' ? 'mgmt' : groupViewMode === 'teams' ? 'team' : 'all'}
                      teamInsightsData={insightsData}
                    />
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
            {(insightsData.bestDay || insightsData.bestWeek || insightsData.bestDayOfWeek) && (
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
                    {expandedSection !== 'bestPeriods' && insightsData.bestDay && (
                      <div className="mt-2 text-left text-sm text-muted-foreground">
                        Best day: {insightsData.bestDay.date} · {insightsData.bestDay.fp.toFixed(1)} FP
                      </div>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4">
                      {insightsData.bestDay && (
                        <Card className="p-4 bg-accent/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Award className="w-4 h-4 text-primary" />
                            <div className="text-sm font-semibold">Best Day</div>
                          </div>
                          <div className="text-lg font-bold">{insightsData.bestDay.date}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {insightsData.bestDay.fp.toFixed(1)} FP+ · {insightsData.bestDay.repName}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{insightsData.bestDay.stats}</div>
                        </Card>
                      )}

                      {insightsData.bestWeek && (
                        <Card className="p-4">
                          <div className="text-sm font-semibold text-muted-foreground mb-2">Best Week</div>
                          <div className="text-lg font-bold">{insightsData.bestWeek.weekStart} — {insightsData.bestWeek.weekEnd}</div>
                          <div className="text-sm text-muted-foreground mt-1">{insightsData.bestWeek.fp.toFixed(1)} FP+</div>
                          <div className="text-xs text-muted-foreground mt-1">{insightsData.bestWeek.stats}</div>
                        </Card>
                      )}

                      {insightsData.bestMonth && (
                        <Card className="p-4">
                          <div className="text-sm font-semibold text-muted-foreground mb-2">Best Month</div>
                          <div className="text-lg font-bold">{insightsData.bestMonth.month}</div>
                          <div className="text-sm text-muted-foreground mt-1">{insightsData.bestMonth.fp.toFixed(1)} FP+</div>
                          <div className="text-xs text-muted-foreground mt-1">{insightsData.bestMonth.stats}</div>
                        </Card>
                      )}

                      {insightsData.bestTransitionsDay && (
                        <Card className="p-4">
                          <div className="text-sm font-semibold text-muted-foreground mb-2">Most Transitions</div>
                          <div className="text-lg font-bold">{insightsData.bestTransitionsDay.date} · {insightsData.bestTransitionsDay.repName}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {insightsData.bestTransitionsDay.transitions} transitions · {insightsData.bestTransitionsDay.fp.toFixed(1)} FP+
                          </div>
                        </Card>
                      )}

                      {insightsData.bestDayOfWeek && (
                        <DayOfWeekAnalysis 
                          dayOfWeekData={insightsData.dayOfWeekData}
                          bestDayOfWeek={insightsData.bestDayOfWeek}
                        />
                      )}
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
                          <div className="text-sm text-muted-foreground">Most Productive Hour</div>
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

            {/* Individual/Group Breakdown - Collapsible */}
            {groupViewMode !== 'all' && (
              <Card>
                <Collapsible open={expandedSection === 'individuals'} onOpenChange={() => handleSectionToggle('individuals')}>
                  <CollapsibleTrigger className="w-full p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        <h2 className="text-lg font-semibold">
                          {groupViewMode === 'mgmt-groups' ? 'MGMT Group Performance' : 
                           groupViewMode === 'teams' ? 'Team Performance' : 
                           'Individual Performance'}
                        </h2>
                      </div>
                      <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", expandedSection === 'individuals' && "rotate-180")} />
                    </div>
                    {expandedSection !== 'individuals' && (
                      <div className="mt-2 text-left text-sm text-muted-foreground">
                        {groupViewMode === 'individuals' && `${insightsData.repBreakdown.length} team members`}
                        {groupViewMode === 'mgmt-groups' && `${insightsData.groupedByMgmt?.length || 0} groups`}
                        {groupViewMode === 'teams' && `${insightsData.groupedByTeam?.length || 0} teams`}
                      </div>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <div className="space-y-4">
                        {groupViewMode === 'individuals' && (() => {
                          // Sort based on access level
                          const accessLevel = accessData?.accessLevel || 'none';
                          let sortedReps = [...insightsData.repBreakdown];
                          
                          if (accessLevel === 'area_director') {
                            // Sort by: MGMT Group → Team → Name
                            sortedReps.sort((a, b) => {
                              if (a.mgmtGroupName !== b.mgmtGroupName) {
                                return a.mgmtGroupName.localeCompare(b.mgmtGroupName);
                              }
                              if (a.teamName !== b.teamName) {
                                return a.teamName.localeCompare(b.teamName);
                              }
                              return stripEmojis(a.name).localeCompare(stripEmojis(b.name));
                            });
                          } else if (accessLevel === 'mgmt_group_lead') {
                            // Sort by: Team → Name
                            sortedReps.sort((a, b) => {
                              if (a.teamName !== b.teamName) {
                                return a.teamName.localeCompare(b.teamName);
                              }
                              return stripEmojis(a.name).localeCompare(stripEmojis(b.name));
                            });
                          } else {
                            // Team Lead: Sort by Name only
                            sortedReps.sort((a, b) => stripEmojis(a.name).localeCompare(stripEmojis(b.name)));
                          }
                          
                          return sortedReps.map((rep, index, arr) => {
                            // Determine if we should show group/team headers
                            const showMgmtHeader = accessLevel === 'area_director' && 
                              (index === 0 || arr[index - 1].mgmtGroupName !== rep.mgmtGroupName);
                            const showTeamHeader = (accessLevel === 'area_director' || accessLevel === 'mgmt_group_lead') &&
                              (index === 0 || arr[index - 1].teamName !== rep.teamName);
                            
                            return (
                              <div key={rep.userId}>
                                {showMgmtHeader && (
                                  <div className="pt-4 pb-2 -mx-4 px-4 bg-muted/30 border-t border-b border-border">
                                    <p className="text-sm font-semibold text-primary">{rep.mgmtGroupName}</p>
                                  </div>
                                )}
                                {showTeamHeader && !showMgmtHeader && (
                                  <div className="pt-3 pb-2 -mx-4 px-4 bg-muted/20 border-t border-border">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{rep.teamName}</p>
                                  </div>
                                )}
                                {showTeamHeader && showMgmtHeader && (
                                  <div className="pt-1 pb-2 -mx-4 px-4 bg-muted/20">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{rep.teamName}</p>
                                  </div>
                                )}
                                <div className="border-b pb-4 last:border-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <p className="font-semibold">{stripEmojis(rep.name)}</p>
                                      <p className="text-sm text-muted-foreground">{rep.year}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-lg font-bold">{rep.fp.toFixed(1)} FP</p>
                                      <p className="text-sm text-muted-foreground">${rep.prmr.toFixed(0)}</p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">Doors</p>
                                      <p className="font-semibold">{rep.doors}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Pitches</p>
                                      <p className="font-semibold">{rep.pitches}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Presentations</p>
                                      <p className="font-semibold">{rep.presentations}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Closes</p>
                                      <p className="font-semibold">{rep.closes}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}

                        {groupViewMode === 'mgmt-groups' && insightsData.groupedByMgmt?.map((group) => (
                          <Card key={group.mgmtGroupName} className="p-4">
                            <div className="mb-3">
                              <p className="font-semibold text-lg">{group.mgmtGroupName}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-3">
                              <div>
                                <div className="text-2xl font-bold text-primary">{group.totals.fp.toFixed(1)}</div>
                                <div className="text-xs text-muted-foreground">FP+</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-primary">${group.totals.prmr.toFixed(0)}</div>
                                <div className="text-xs text-muted-foreground">PRMR</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold">{group.totals.doors}</div>
                                <div className="text-xs text-muted-foreground">Doors</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold">{group.totals.pitches}</div>
                                <div className="text-xs text-muted-foreground">Pitches</div>
                              </div>
                            </div>
                            <div className="pt-3 border-t border-border">
                              <p className="text-xs text-muted-foreground">{group.members.length} members</p>
                            </div>
                          </Card>
                        ))}

                        {groupViewMode === 'teams' && insightsData.groupedByTeam?.map((team) => (
                          <Card key={team.teamName} className="p-4">
                            <div className="mb-3">
                              <p className="font-semibold text-lg">{team.teamName}</p>
                              <p className="text-xs text-muted-foreground">{team.mgmtGroupName}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-3">
                              <div>
                                <div className="text-2xl font-bold text-primary">{team.totals.fp.toFixed(1)}</div>
                                <div className="text-xs text-muted-foreground">FP+</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-primary">${team.totals.prmr.toFixed(0)}</div>
                                <div className="text-xs text-muted-foreground">PRMR</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold">{team.totals.doors}</div>
                                <div className="text-xs text-muted-foreground">Doors</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold">{team.totals.pitches}</div>
                                <div className="text-xs text-muted-foreground">Pitches</div>
                              </div>
                            </div>
                            <div className="pt-3 border-t border-border">
                              <p className="text-xs text-muted-foreground">{team.members.length} members</p>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}
          </>
        )}

        <TeamFilterSheet
          open={isFilterOpen}
          onOpenChange={setIsFilterOpen}
          accessData={accessData}
          selectedUserIds={selectedUserIds}
          onUserIdsChange={setSelectedUserIds}
          excludeUserIds={excludeUserIds}
          onExcludeUserIdsChange={setExcludeUserIds}
        />
      </div>

      {/* Custom Date Range Sheet */}
      <Sheet open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Select Custom Date Range</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className={cn("transition-all duration-300", customStartDate && "animate-scale-in")}>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStartDate ? format(customStartDate, 'PPP') : 'Pick start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customStartDate}
                    onSelect={(date) => {
                      setCustomStartDate(date);
                      // Auto-open end date picker if end date is empty
                      if (date && !customEndDate) {
                        setTimeout(() => {
                          const endDateButton = document.querySelector('[data-end-date-trigger]') as HTMLButtonElement;
                          endDateButton?.click();
                        }, 200);
                      }
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className={cn("transition-all duration-300", customStartDate && !customEndDate && "animate-pulse")}>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left font-normal"
                    data-end-date-trigger
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEndDate ? format(customEndDate, 'PPP') : 'Pick end date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customEndDate}
                    onSelect={(date) => {
                      setCustomEndDate(date);
                      if (date) {
                        // Auto-close after selecting end date
                        setTimeout(() => setShowCustomDialog(false), 150);
                      }
                    }}
                    disabled={(date) => customStartDate ? date < customStartDate : false}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button 
              onClick={handleCustomDateApply} 
              className="w-full"
              disabled={!customStartDate || !customEndDate}
            >
              Apply Date Range
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TeamReports;
