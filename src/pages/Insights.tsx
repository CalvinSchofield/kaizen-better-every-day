import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useInsightsData } from '@/hooks/useInsightsData';
import { useRepData } from '@/hooks/useRepData';
import { useEfpMode } from '@/hooks/useEfpMode';
import { useInsightsFeedback } from '@/hooks/useInsightsFeedback';
import { TrendingUp, TrendingDown, Clock, Target, Award, Calendar as CalendarIcon, ChevronDown, Lock, BarChart3, TrendingUpIcon, Sparkles } from 'lucide-react';
import { format, subDays, subMonths, startOfYear } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { SalesFunnelChart } from '@/components/insights/SalesFunnelChart';
import { HourlyActivityHeatmap } from '@/components/insights/HourlyActivityHeatmap';
import { ActivityTrendChart } from '@/components/insights/ActivityTrendChart';
import { DayOfWeekAnalysis } from '@/components/insights/DayOfWeekAnalysis';

type DatePreset = 'week' | 'month' | 'preseason' | 'custom';

type ExpandedSection = 'funnel' | 'ratios' | 'productivity' | 'trends' | 'hourly' | 'bestPeriods' | 'timing' | 'custom' | null;

export default function Insights() {
  const { repData, loading: loadingRepData } = useRepData();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);

  // Check if user is a pre-blitz rookie
  const year = repData?.year || "Rookie";
  const isRookie = year === "Rookie";
  
  // Check if rookie has attended a blitz (any blitz with endDate in the past)
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];
  const hasAttendedBlitz = blitzes.some((blitz: any) => {
    if (blitz.endDate) {
      const endDate = new Date(blitz.endDate);
      return endDate < new Date();
    }
    return false;
  });

  const isPreBlitzRookie = isRookie && !hasAttendedBlitz;
  
  const handleSectionToggle = (section: ExpandedSection) => {
    setExpandedSection(expandedSection === section ? null : section);
  };
  
  const getDateRange = (preset: DatePreset) => {
    const now = new Date();
    const summerStartDate = new Date('2026-04-12'); // Official summer start
    
    switch (preset) {
      case 'week':
        return { start: subDays(now, 7), end: now };
      case 'month':
        return { start: subMonths(now, 1), end: now };
      case 'preseason':
        return { start: startOfYear(now), end: now < summerStartDate ? now : summerStartDate };
      case 'custom':
        return { 
          start: customStartDate || new Date('2025-01-01'), 
          end: customEndDate || now 
        };
      default:
        return { start: subMonths(now, 1), end: now };
    }
  };

  const { data: insights, isLoading } = useInsightsData(getDateRange(datePreset));
  
  // Prepare data for AI feedback
  const feedbackParams = insights && insights.daysWorked > 0 ? {
    funnel: insights.funnelData,
    ratios: {
      doorsToFp: { 
        current: efpModeEnabled ? insights.doorsToEfp : insights.doorsToFp, 
        overall: efpModeEnabled ? insights.overallDoorsToEfp : insights.overallDoorsToFp 
      },
      pitchesToFp: { 
        current: efpModeEnabled ? insights.pitchesToEfp : insights.pitchesToFp,
        overall: efpModeEnabled ? insights.overallPitchesToEfp : insights.overallPitchesToFp
      },
      transitionsToFp: { 
        current: efpModeEnabled ? insights.transitionsToEfp : insights.transitionsToFp,
        overall: efpModeEnabled ? insights.overallTransitionsToEfp : insights.overallTransitionsToFp
      },
      presentationsToClose: { 
        current: insights.presentationsToClose, 
        overall: insights.overallPresentationsToClose 
      }
    },
    totals: {
      fp: insights.totalFp,
      doors: insights.totalDoors,
      pitches: insights.totalPitches,
      transitions: insights.totalTransitions,
      presentations: insights.totalPresentations,
      closes: insights.totalCloses
    },
    timeframe: datePreset === 'week' ? 'week' : datePreset === 'month' ? 'month' : datePreset === 'preseason' ? 'preseason' : 'custom period',
    daysWorked: insights.daysWorked
  } : null;

  const { data: aiFeedback, isLoading: feedbackLoading } = useInsightsFeedback(feedbackParams, repData?.year);
  
  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      setDatePreset('custom');
      setShowCustomDialog(false);
    }
  };

  const getRatioComparison = (current: number, overall: number) => {
    if (current === 0 || overall === 0) return null;
    const percentDiff = ((overall - current) / overall) * 100;
    const isBetter = current < overall; // Lower ratios are better (fewer doors per FP+)
    return { percentDiff: Math.abs(percentDiff), isBetter };
  };

  const getCloseRatioComparison = (current: number, overall: number) => {
    if (current === 0 || overall === 0) return null;
    const percentDiff = ((current - overall) / overall) * 100;
    const isBetter = current < overall; // Lower is better (fewer presentations per close)
    return { percentDiff: Math.abs(percentDiff), isBetter };
  };

  const doorsComparison = insights && efpModeEnabled 
    ? getRatioComparison(insights.doorsToEfp, insights.overallDoorsToEfp) 
    : insights ? getRatioComparison(insights.doorsToFp, insights.overallDoorsToFp) : null;
  const pitchesComparison = insights && efpModeEnabled
    ? getRatioComparison(insights.pitchesToEfp, insights.overallPitchesToEfp)
    : insights ? getRatioComparison(insights.pitchesToFp, insights.overallPitchesToFp) : null;
  const transitionsComparison = insights && efpModeEnabled
    ? getRatioComparison(insights.transitionsToEfp, insights.overallTransitionsToEfp)
    : insights ? getRatioComparison(insights.transitionsToFp, insights.overallTransitionsToFp) : null;
  const closeComparison = insights ? getCloseRatioComparison(insights.presentationsToClose, insights.overallPresentationsToClose) : null;

  // Show loading state while fetching rep data
  if (loadingRepData) {
    return null;
  }

  // Show locked state for pre-blitz rookies
  if (isPreBlitzRookie) {
    return (
      <div className="min-h-screen bg-background p-4 pb-24 flex items-center justify-center">
        <Card className="w-full max-w-md border-border/40">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <BarChart3 className="h-16 w-16 text-muted-foreground/40" />
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Insights Unlock on Your Blitz!</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your performance analytics will become available once you hit the doors on your first blitz. 
                Track your ratios, productivity, and best periods to level up your game.
              </p>
            </div>
            <div className="pt-2">
              <p className="text-sm text-primary font-medium">
                Can't wait to see your stats grow! 📊
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Date Range Selector - Always visible */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={datePreset === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('week')}
          >
            This Week
          </Button>
          <Button
            variant={datePreset === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('month')}
          >
            This Month
          </Button>
          <Button
            variant={datePreset === 'preseason' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('preseason')}
          >
            Preseason
          </Button>
          <Button
            variant={datePreset === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowCustomDialog(true)}
          >
            <CalendarIcon className="w-4 h-4 mr-1" />
            {datePreset === 'custom' && customStartDate && customEndDate
              ? `${format(customStartDate, 'MMM d')} — ${format(customEndDate, 'MMM d')}`
              : 'Custom'}
          </Button>
        </div>

        {isLoading ? (
          <>
            {/* Ratio Cards Skeleton */}
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4">
                  <div className="h-5 w-32 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-8 w-20 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>

            {/* Time Metrics Skeleton */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="h-6 w-48 bg-muted rounded animate-pulse mb-4" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i}>
                    <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : !insights || insights.daysWorked === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">No data available for this period</div>
            <p className="text-sm text-muted-foreground">
              Start tracking your daily entries to see insights here
            </p>
          </div>
        ) : (
          <>
            {/* Period Summary */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Summary</h2>
                <span className="text-sm text-primary font-medium">{insights.daysWorked} days worked</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {efpModeEnabled ? (
                  <>
                    <div>
                      <div className="text-2xl font-bold text-primary">{insights.totalEfp.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">Total EFP</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">{insights.totalFp.toFixed(1)}</div>
                      <div className="text-sm text-muted-foreground">Total FP+</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-2xl font-bold text-primary">{insights.totalFp.toFixed(1)}</div>
                      <div className="text-sm text-muted-foreground">Total FP+</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">${insights.totalPrmr.toFixed(0)}</div>
                      <div className="text-sm text-muted-foreground">Total PRMR</div>
                    </div>
                  </>
                )}
                <div>
                  <div className="text-xl font-bold">{insights.totalDoors}</div>
                  <div className="text-sm text-muted-foreground">Doors Knocked</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{insights.totalDecisionMakers}</div>
                  <div className="text-sm text-muted-foreground">Decision Makers</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{insights.totalPitches}</div>
                  <div className="text-sm text-muted-foreground">Pitches</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{insights.totalTransitions}</div>
                  <div className="text-sm text-muted-foreground">Transitions</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{insights.totalPresentations}</div>
                  <div className="text-sm text-muted-foreground">Presentations</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{insights.totalCloses}</div>
                  <div className="text-sm text-muted-foreground">Closes</div>
                </div>
              </div>

              {/* Upgrade Breakdown */}
              {insights.totalUpgradeFp > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-muted-foreground">FP+ Breakdown</div>
                    <div className="text-xs text-primary font-semibold">{insights.upgradeRate.toFixed(0)}% upgrades</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">{insights.totalNewFp.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">FP</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{insights.totalUpgradeFp.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">Upgrade FP+</div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Coaching Feedback */}
              {aiFeedback && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                    <p className="text-sm text-foreground/90 leading-relaxed flex-1">
                      {aiFeedback}
                    </p>
                  </div>
                </div>
              )}
              {feedbackLoading && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
                    <Sparkles className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-full bg-muted rounded animate-pulse" />
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
                      {insights.funnelData.doors.total} doors → {insights.funnelData.closes.total} closes · {insights.funnelData.doors.conversionToNext.toFixed(1)}% DM rate
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <SalesFunnelChart funnelData={insights.funnelData} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Key Ratios */}
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
                      <span className="text-primary font-semibold">
                        {efpModeEnabled ? insights.doorsToEfp.toFixed(1) : insights.doorsToFp.toFixed(1)}
                      </span> doors per {efpModeEnabled ? "EFP" : "FP+"} · {insights.presentationsToClose.toFixed(1)} presentations per close
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-3">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Doors → {efpModeEnabled ? "EFP" : "FP+"}</div>
                      <div className="text-2xl font-bold">{efpModeEnabled ? insights.doorsToEfp.toFixed(1) : insights.doorsToFp.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Overall avg: {efpModeEnabled ? insights.overallDoorsToEfp.toFixed(1) : insights.overallDoorsToFp.toFixed(1)}
                      </div>
                    </div>
                    {doorsComparison && (
                      <div className={`flex items-center gap-1 ${doorsComparison.isBetter ? 'text-green-500' : 'text-red-500'}`}>
                        {doorsComparison.isBetter ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        <span className="text-sm font-semibold">{doorsComparison.percentDiff.toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Pitches → {efpModeEnabled ? "EFP" : "FP+"}</div>
                      <div className="text-2xl font-bold">{efpModeEnabled ? insights.pitchesToEfp.toFixed(1) : insights.pitchesToFp.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Overall avg: {efpModeEnabled ? insights.overallPitchesToEfp.toFixed(1) : insights.overallPitchesToFp.toFixed(1)}
                      </div>
                    </div>
                    {pitchesComparison && (
                      <div className={`flex items-center gap-1 ${pitchesComparison.isBetter ? 'text-green-500' : 'text-red-500'}`}>
                        {pitchesComparison.isBetter ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        <span className="text-sm font-semibold">{pitchesComparison.percentDiff.toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Transitions → {efpModeEnabled ? "EFP" : "FP+"}</div>
                      <div className="text-2xl font-bold">{efpModeEnabled ? insights.transitionsToEfp.toFixed(1) : insights.transitionsToFp.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Overall avg: {efpModeEnabled ? insights.overallTransitionsToEfp.toFixed(1) : insights.overallTransitionsToFp.toFixed(1)}
                      </div>
                    </div>
                    {transitionsComparison && (
                      <div className={`flex items-center gap-1 ${transitionsComparison.isBetter ? 'text-green-500' : 'text-red-500'}`}>
                        {transitionsComparison.isBetter ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        <span className="text-sm font-semibold">{transitionsComparison.percentDiff.toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Presentations → Close</div>
                      <div className="text-2xl font-bold">{insights.presentationsToClose.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Overall avg: {insights.overallPresentationsToClose.toFixed(1)}
                      </div>
                    </div>
                    {closeComparison && (
                      <div className={`flex items-center gap-1 ${closeComparison.isBetter ? 'text-green-500' : 'text-red-500'}`}>
                        {closeComparison.isBetter ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        <span className="text-sm font-semibold">{closeComparison.percentDiff.toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Doors to FP metric */}
                {insights.totalNewFp > 0 && (
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Doors → FP</div>
                        <div className="text-2xl font-bold">{insights.doorsToNewFp.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          More accurate door efficiency
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Time-Based Productivity */}
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
                      <span className="text-primary font-semibold">
                        {efpModeEnabled ? insights.hoursToEfp.toFixed(1) : insights.hoursToFp.toFixed(1)} hours
                      </span> to sell 1 {efpModeEnabled ? "EFP" : "FP+"}
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Doors/Hour</div>
                        <div className="text-xl font-bold">{insights.doorsPerHour.toFixed(1)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Pitches/Hour</div>
                        <div className="text-xl font-bold">{insights.pitchesPerHour.toFixed(1)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Transitions/Hour</div>
                        <div className="text-xl font-bold">{insights.transitionsPerHour.toFixed(1)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Presentations/Hour</div>
                        <div className="text-xl font-bold">{insights.presentationsPerHour.toFixed(1)}</div>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-border">
                        <div className="text-sm text-muted-foreground">Hours to sell 1 {efpModeEnabled ? "EFP" : "FP+"}</div>
                        <div className="text-xl font-bold">{efpModeEnabled ? insights.hoursToEfp.toFixed(1) : insights.hoursToFp.toFixed(1)}h</div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Activity Trends */}
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
                      Track your performance over time
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <ActivityTrendChart dailyTrend={insights.dailyTrend} efpModeEnabled={efpModeEnabled} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Hourly Patterns */}
            <Card>
              <Collapsible open={expandedSection === 'hourly'} onOpenChange={() => handleSectionToggle('hourly')}>
                <CollapsibleTrigger className="w-full p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      <h2 className="text-lg font-semibold">Hourly Patterns</h2>
                    </div>
                    <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", expandedSection === 'hourly' && "rotate-180")} />
                  </div>
                  {expandedSection !== 'hourly' && insights.peakHours.doors !== null && (
                    <div className="mt-2 text-left text-sm text-muted-foreground">
                      Peak hour: {insights.peakHours.doors === 0 ? '12' : insights.peakHours.doors > 12 ? insights.peakHours.doors - 12 : insights.peakHours.doors}
                      {insights.peakHours.doors >= 12 ? 'PM' : 'AM'}
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <HourlyActivityHeatmap 
                      hourlyActivity={insights.hourlyActivity} 
                      peakHours={insights.peakHours}
                      hourRange={insights.hourRange}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Best Periods */}
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
                  {expandedSection !== 'bestPeriods' && insights.bestDay && (
                    <div className="mt-2 text-left text-sm text-muted-foreground">
                      Best day: <span className="text-primary font-semibold">
                        {efpModeEnabled ? insights.bestDay.efp.toFixed(2) : insights.bestDay.fpPlus.toFixed(1)} {efpModeEnabled ? "EFP" : "FP+"}
                      </span> on {insights.bestDay.date}
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-3">
                {insights.bestDay && (
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Best Day</div>
                    {efpModeEnabled ? (
                      <>
                        <div className="text-xl font-bold text-primary">{insights.bestDay.efp.toFixed(2)} EFP</div>
                        <div className="text-sm text-muted-foreground">{insights.bestDay.fpPlus.toFixed(1)} FP+</div>
                      </>
                    ) : (
                      <div className="text-xl font-bold text-primary">{insights.bestDay.fpPlus.toFixed(1)} FP+</div>
                    )}
                    <div className="text-sm text-muted-foreground">{insights.bestDay.date}</div>
                    <div className="text-xs text-muted-foreground mt-1">{insights.bestDay.stats}</div>
                  </Card>
                )}
                
                {insights.bestWeek && (
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Best Week</div>
                    {efpModeEnabled ? (
                      <>
                        <div className="text-xl font-bold text-primary">{insights.bestWeek.efp.toFixed(2)} EFP</div>
                        <div className="text-sm text-muted-foreground">{insights.bestWeek.fpPlus.toFixed(1)} FP+</div>
                      </>
                    ) : (
                      <div className="text-xl font-bold text-primary">{insights.bestWeek.fpPlus.toFixed(1)} FP+</div>
                    )}
                    <div className="text-sm text-muted-foreground">{insights.bestWeek.weekStart} — {insights.bestWeek.weekEnd}</div>
                    <div className="text-xs text-muted-foreground mt-1">{insights.bestWeek.stats}</div>
                  </Card>
                )}
                
                {insights.bestMonth && (
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Best Month</div>
                    {efpModeEnabled ? (
                      <>
                        <div className="text-xl font-bold text-primary">{insights.bestMonth.efp.toFixed(2)} EFP</div>
                        <div className="text-sm text-muted-foreground">{insights.bestMonth.fpPlus.toFixed(1)} FP+</div>
                      </>
                    ) : (
                      <div className="text-xl font-bold text-primary">{insights.bestMonth.fpPlus.toFixed(1)} FP+</div>
                    )}
                    <div className="text-sm text-muted-foreground">{insights.bestMonth.month}</div>
                    <div className="text-xs text-muted-foreground mt-1">{insights.bestMonth.stats}</div>
                  </Card>
                )}
                
                {insights.bestTransitionsDay && (
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Most Transitions Day</div>
                    <div className="text-xl font-bold text-primary">{insights.bestTransitionsDay.transitions} transitions</div>
                    <div className="text-sm text-muted-foreground">{insights.bestTransitionsDay.date}</div>
                    {efpModeEnabled ? (
                      <div className="text-xs text-muted-foreground mt-1">{insights.bestTransitionsDay.efp.toFixed(2)} EFP · {insights.bestTransitionsDay.fpPlus.toFixed(1)} FP+ sold</div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-1">{insights.bestTransitionsDay.fpPlus.toFixed(1)} FP+ sold</div>
                    )}
                  </Card>
                )}
                
                {/* Day of Week Analysis */}
                {insights.bestDayOfWeek && (
                  <DayOfWeekAnalysis 
                    dayOfWeekData={insights.dayOfWeekData}
                    bestDayOfWeek={insights.bestDayOfWeek}
                    efpModeEnabled={efpModeEnabled}
                  />
                )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Timing Patterns */}
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
                      {insights.avgStartTime} — {insights.avgEndTime} · {insights.avgHoursWorked.toFixed(1)} hrs avg
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Avg Start Time</div>
                        <div className="text-xl font-bold">{insights.avgStartTime}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Avg End Time</div>
                        <div className="text-xl font-bold">{insights.avgEndTime}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Avg Hours Worked</div>
                        <div className="text-xl font-bold">{insights.avgHoursWorked.toFixed(1)}h</div>
                      </div>
                      {insights.mostProductiveHour !== null && (
                        <div>
                          <div className="text-sm text-muted-foreground">Most Productive Hour</div>
                          <div className="text-xl font-bold">
                            {insights.mostProductiveHour === 0 ? '12' : insights.mostProductiveHour > 12 ? insights.mostProductiveHour - 12 : insights.mostProductiveHour}
                            {insights.mostProductiveHour >= 12 ? 'PM' : 'AM'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Personal Metrics (Custom Counters) - Only for Vets/Sophomores */}
            {(repData?.year === "Vet" || repData?.year === "Sophomore") && insights.customCounterTotals && Object.keys(insights.customCounterTotals).length > 0 && (
              <Card>
                <Collapsible open={expandedSection === 'custom'} onOpenChange={() => handleSectionToggle('custom' as ExpandedSection)}>
                  <CollapsibleTrigger className="w-full p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        <h2 className="text-lg font-semibold">Personal Metrics</h2>
                      </div>
                      <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", expandedSection === 'custom' && "rotate-180")} />
                    </div>
                    {expandedSection !== 'custom' && (
                      <div className="mt-2 text-left text-sm text-muted-foreground">
                        Your custom tracking ({Object.keys(insights.customCounterTotals).length} counters)
                      </div>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        Custom counters appear here and are not included in team leaderboards
                      </p>
                      <div className="space-y-4">
                        {Object.entries(insights.customCounterTotals).map(([counterId, total]) => {
                          const config = (repData?.custom_counter_config as any[])?.find((c: any) => c.id === counterId);
                          if (!config) return null;
                          
                          const dailyAvg = (total as number) / insights.daysWorked;
                          const perHour = insights.totalWorkMinutes > 0 
                            ? ((total as number) / insights.totalWorkMinutes) * 60 
                            : 0;
                          
                          return (
                            <Card key={counterId} className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-2xl">{config.emoji}</span>
                                <span className="font-semibold">{config.name}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <div className="text-sm text-muted-foreground">Total</div>
                                  <div className="text-xl font-bold">{total}</div>
                                </div>
                                <div>
                                  <div className="text-sm text-muted-foreground">Daily Avg</div>
                                  <div className="text-xl font-bold">{dailyAvg.toFixed(1)}</div>
                                </div>
                                {perHour > 0 && (
                                  <div>
                                    <div className="text-sm text-muted-foreground">Per Hour</div>
                                    <div className="text-xl font-bold">{perHour.toFixed(1)}</div>
                                  </div>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Custom Date Range Sheet */}
      <Sheet open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Select Custom Date Range</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div>
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
                    onSelect={setCustomStartDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEndDate ? format(customEndDate, 'PPP') : 'Pick end date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customEndDate}
                    onSelect={setCustomEndDate}
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
}
