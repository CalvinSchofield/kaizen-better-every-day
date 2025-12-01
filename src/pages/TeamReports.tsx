import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useTeamInsightsData } from "@/hooks/useTeamInsightsData";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter, Users, Calendar as CalendarIcon, ChevronDown, TrendingUpIcon, BarChart3, Clock, Target } from "lucide-react";
import { TeamFilterSheet } from "@/components/TeamFilterSheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { SalesFunnelChart } from "@/components/insights/SalesFunnelChart";

type DatePreset = 'week' | 'month' | 'preseason' | 'custom';
type ExpandedSection = 'funnel' | 'ratios' | 'productivity' | 'trends' | null;
type GroupViewMode = 'totals' | 'teams' | 'mgmt-groups' | 'individuals';

const TeamReports = () => {
  const { data: accessData, isLoading: accessLoading } = useTeamAccess();
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [excludeUserIds, setExcludeUserIds] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'totals' | 'individual'>('totals');
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const [groupViewMode, setGroupViewMode] = useState<GroupViewMode>('totals');

  const getDateRange = (preset: DatePreset) => {
    const now = new Date();
    const summerStartDate = new Date('2026-04-12');
    
    switch (preset) {
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

  // Initialize selected users when access data loads
  const effectiveUserIds = selectedUserIds.length > 0 
    ? selectedUserIds 
    : (accessData?.accessibleUserIds || []);

  const { data: insightsData, isLoading: insightsLoading } = useTeamInsightsData({
    userIds: effectiveUserIds,
    dateRange: getDateRange(datePreset),
    excludeUserIds,
  });

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
          <div className="overflow-x-auto pb-2 -mr-20 scrollbar-hide">
            <div className="flex gap-2 pr-24 whitespace-nowrap">
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
          
          {/* Fixed Filter button with fade gradient */}
          <div className="absolute right-0 top-0 bottom-0 flex items-start pt-0 pointer-events-none">
            <div className="w-20 h-full bg-gradient-to-l from-background via-background to-transparent" />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsFilterOpen(true)}
              className="gap-2 pointer-events-auto flex-shrink-0"
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>
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
                <span className="text-sm text-primary font-medium">{insightsData.repBreakdown.length} team members</span>
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
                      <div className="text-xs text-muted-foreground">FP (New Sales)</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{insightsData.totalUpgradeFP.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">Upgrade FP+</div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

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
                      {insightsData.totalDoors} doors → {insightsData.totalCloses} closes · {((insightsData.totalDMs / insightsData.totalDoors) * 100).toFixed(1)}% DM rate
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Doors</span>
                        <span className="font-semibold">{insightsData.totalDoors}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Decision Makers</span>
                        <span className="font-semibold">{insightsData.totalDMs} ({((insightsData.totalDMs / insightsData.totalDoors) * 100).toFixed(1)}%)</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Pitches</span>
                        <span className="font-semibold">{insightsData.totalPitches} ({((insightsData.totalPitches / insightsData.totalDMs) * 100).toFixed(1)}%)</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Transitions</span>
                        <span className="font-semibold">{insightsData.totalTransitions} ({((insightsData.totalTransitions / insightsData.totalPitches) * 100).toFixed(1)}%)</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Presentations</span>
                        <span className="font-semibold">{insightsData.totalPresentations} ({((insightsData.totalPresentations / insightsData.totalTransitions) * 100).toFixed(1)}%)</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Closes</span>
                        <span className="font-semibold">{insightsData.totalCloses} ({((insightsData.totalCloses / insightsData.totalPresentations) * 100).toFixed(1)}%)</span>
                      </div>
                    </div>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Doors → FP</div>
                        <div className="text-2xl font-bold">{insightsData.doorsToFp.toFixed(1)}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Pitches → FP</div>
                        <div className="text-2xl font-bold">{insightsData.pitchesToFp.toFixed(1)}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Transitions → FP</div>
                        <div className="text-2xl font-bold">{insightsData.transitionsToFp.toFixed(1)}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Presentations → Close</div>
                        <div className="text-2xl font-bold">{insightsData.presentationsToClose.toFixed(1)}</div>
                      </div>
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
                      <h2 className="text-lg font-semibold">Productivity</h2>
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
                        <div className="text-sm text-muted-foreground">Presentations per Hour</div>
                        <div className="text-2xl font-bold">{insightsData.presentationsPerHour.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Individual Breakdown - Collapsible */}
            {viewMode === 'individual' && (
              <Card>
                <Collapsible open={expandedSection === 'trends'} onOpenChange={() => handleSectionToggle('trends')}>
                  <CollapsibleTrigger className="w-full p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        <h2 className="text-lg font-semibold">Individual Performance</h2>
                      </div>
                      <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", expandedSection === 'trends' && "rotate-180")} />
                    </div>
                    {expandedSection !== 'trends' && (
                      <div className="mt-2 text-left text-sm text-muted-foreground">
                        {insightsData.repBreakdown.length} team members
                      </div>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <div className="space-y-4">
                        {(() => {
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
                              return a.name.localeCompare(b.name);
                            });
                          } else if (accessLevel === 'mgmt_group_lead') {
                            // Sort by: Team → Name
                            sortedReps.sort((a, b) => {
                              if (a.teamName !== b.teamName) {
                                return a.teamName.localeCompare(b.teamName);
                              }
                              return a.name.localeCompare(b.name);
                            });
                          } else {
                            // Team Lead: Sort by Name only
                            sortedReps.sort((a, b) => a.name.localeCompare(b.name));
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
                                      <p className="font-semibold">{rep.name}</p>
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
          viewMode={viewMode}
          onViewModeChange={setViewMode}
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
                    onSelect={setCustomEndDate}
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
