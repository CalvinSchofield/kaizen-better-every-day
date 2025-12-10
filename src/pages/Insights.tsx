import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useInsightsData } from '@/hooks/useInsightsData';
import { useRepData } from '@/hooks/useRepData';
import { useEfpMode } from '@/hooks/useEfpMode';

import { TrendingUp, TrendingDown, Clock, Target, Award, Calendar as CalendarIcon, Lock, BarChart3, TrendingUpIcon, Gauge, PieChart } from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, startOfWeek, parseISO, isSameDay, addDays } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { SalesFunnelChart } from '@/components/insights/SalesFunnelChart';
import { HourlyActivityHeatmap } from '@/components/insights/HourlyActivityHeatmap';
import { ActivityTrendChart } from '@/components/insights/ActivityTrendChart';
import { DayOfWeekAnalysis } from '@/components/insights/DayOfWeekAnalysis';
import { FPCumulativeChart } from '@/components/FPCumulativeChart';
import { CanceledStatsCard } from '@/components/goals/CanceledStatsCard';
import { AICoachFab } from '@/components/insights/AICoachFab';
import { InsightsSummaryHero } from '@/components/insights/InsightsSummaryHero';
import { InsightsSectionHeader } from '@/components/insights/InsightsSectionHeader';
import { InsightCollapsible } from '@/components/insights/InsightCollapsible';
import { PastRecapsSection } from '@/components/recap/PastRecapsSection';

type DatePreset = 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'preseason' | 'custom';

type ExpandedSection = 'funnel' | 'ratios' | 'productivity' | 'trends' | 'hourly' | 'bestPeriods' | 'timing' | 'custom' | null;

export default function Insights() {
  const [searchParams] = useSearchParams();
  const { repData, loading: loadingRepData } = useRepData();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const [datePreset, setDatePreset] = useState<DatePreset>('week');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);

  // Handle incoming date params from calendar navigation
  useEffect(() => {
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    
    if (startParam && endParam) {
      const startDate = parseISO(startParam);
      const endDate = parseISO(endParam);
      const now = new Date();
      
      // Check if dates match "This Week" (Monday of current week to Sunday)
      const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const thisWeekEnd = addDays(thisWeekStart, 6);
      if (isSameDay(startDate, thisWeekStart) && isSameDay(endDate, thisWeekEnd)) {
        setDatePreset('week');
        return;
      }
      
      // Check if dates match "Last Week"
      const lastWeekStart = subDays(thisWeekStart, 7);
      const lastWeekEnd = addDays(lastWeekStart, 6);
      if (isSameDay(startDate, lastWeekStart) && isSameDay(endDate, lastWeekEnd)) {
        setDatePreset('lastWeek');
        return;
      }
      
      // Check if dates match "This Month"
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      if (isSameDay(startDate, thisMonthStart) && isSameDay(endDate, thisMonthEnd)) {
        setDatePreset('month');
        return;
      }
      
      // Check if dates match "Last Month"
      const lastMonthDate = subMonths(now, 1);
      const lastMonthStart = startOfMonth(lastMonthDate);
      const lastMonthEnd = endOfMonth(lastMonthDate);
      if (isSameDay(startDate, lastMonthStart) && isSameDay(endDate, lastMonthEnd)) {
        setDatePreset('lastMonth');
        return;
      }
      
      // No match - use custom with these dates
      setCustomStartDate(startDate);
      setCustomEndDate(endDate);
      setDatePreset('custom');
      return;
    }
    
    // Legacy support for old 'period' param
    const period = searchParams.get('period');
    if (period === 'week') {
      setDatePreset('week');
    } else if (period === 'month') {
      setDatePreset('month');
    } else if (period === 'lastWeek') {
      setDatePreset('lastWeek');
    } else if (period === 'lastMonth') {
      setDatePreset('lastMonth');
    }
  }, [searchParams]);

  // Check if user is a pre-blitz rookie
  const year = repData?.year || "Rookie";
  const isRookie = year === "Rookie";
  
  // Check if rookie has attended a blitz OR is currently on an active blitz
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];
  
  const now = new Date();
  const hasAttendedOrOnBlitz = blitzes.some((blitz: any) => {
    if (!blitz.date || !blitz.endDate) return false;
    
    const todayStr = now.toISOString().split('T')[0];
    const blitzStartStr = blitz.date;
    const isStartingToday = todayStr === blitzStartStr;
    const startDate = new Date(blitz.date + 'T00:00:00');
    const endDate = new Date(blitz.endDate + 'T23:59:59');
    const isCurrentlyActive = now >= startDate && now <= endDate;
    const hasEnded = endDate < now;
    
    return isStartingToday || isCurrentlyActive || hasEnded;
  });

  const isPreBlitzRookie = isRookie && !hasAttendedOrOnBlitz;
  
  const handleSectionToggle = (section: ExpandedSection) => {
    setExpandedSection(expandedSection === section ? null : section);
  };
  
  const getDateRange = (preset: DatePreset) => {
    const now = new Date();
    const summerStartDate = new Date('2026-04-12');
    
    switch (preset) {
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { start: yesterday, end: yesterday };
      case 'week':
        // Monday-based week (weekStartsOn: 1 = Monday)
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        return { start: weekStart, end: now };
      case 'lastWeek':
        // Previous Monday-Saturday
        const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
        const lastWeekStart = subDays(thisWeekStart, 7);
        const lastWeekEnd = subDays(thisWeekStart, 2); // Saturday (Sunday is 1 day before Monday)
        return { start: lastWeekStart, end: lastWeekEnd };
      case 'month':
        // Only this month up to today (not future dates)
        return { start: startOfMonth(now), end: now };
      case 'lastMonth':
        const lastMonthDate = subMonths(now, 1);
        return { start: startOfMonth(lastMonthDate), end: endOfMonth(lastMonthDate) };
      case 'preseason':
        return { start: startOfYear(now), end: now < summerStartDate ? now : summerStartDate };
      case 'custom':
        return { 
          start: customStartDate || new Date('2025-01-01'), 
          end: customEndDate || now 
        };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const { data: insights, isLoading } = useInsightsData(getDateRange(datePreset), efpModeEnabled);
  
  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      setDatePreset('custom');
      setShowCustomDialog(false);
    }
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

  if (loadingRepData) {
    return null;
  }

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
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky Date Selector */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <Button
            variant={datePreset === 'yesterday' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('yesterday')}
            className="shrink-0"
          >
            Yesterday
          </Button>
          <Button
            variant={datePreset === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('week')}
            className="shrink-0"
          >
            This Week
          </Button>
          <Button
            variant={datePreset === 'lastWeek' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('lastWeek')}
            className="shrink-0"
          >
            Last Week
          </Button>
          <Button
            variant={datePreset === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('month')}
            className="shrink-0"
          >
            This Month
          </Button>
          <Button
            variant={datePreset === 'lastMonth' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('lastMonth')}
            className="shrink-0"
          >
            Last Month
          </Button>
          <Button
            variant={datePreset === 'preseason' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('preseason')}
            className="shrink-0"
          >
            Preseason
          </Button>
          <Button
            variant={datePreset === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowCustomDialog(true)}
            className="shrink-0"
          >
            <CalendarIcon className="w-4 h-4 mr-1" />
            {datePreset === 'custom' && customStartDate && customEndDate
              ? `${format(customStartDate, 'MMM d')} — ${format(customEndDate, 'MMM d')}`
              : 'Custom'}
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="h-8 w-24 bg-muted rounded animate-pulse mb-2" />
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4">
                <div className="h-5 w-32 bg-muted rounded animate-pulse mb-2" />
                <div className="h-4 w-48 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : !insights || insights.daysWorked === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">No data available for this period</div>
            <p className="text-sm text-muted-foreground">
              Start tracking your daily entries to see insights here
            </p>
          </div>
        ) : (
          <>
            {/* Past Recaps Section */}
            <PastRecapsSection />

            {/* Hero Summary */}
            <InsightsSummaryHero
              totalFp={insights.totalFp}
              totalEfp={insights.totalEfp}
              totalPrmr={insights.totalPrmr}
              daysWorked={insights.daysWorked}
              totalDoors={insights.totalDoors}
              totalCloses={insights.totalCloses}
              efpModeEnabled={efpModeEnabled}
            />

            {/* Cancelled Stats */}
            <CanceledStatsCard />

            {/* Progress Over Time */}
            <FPCumulativeChart highlightDateRange={getDateRange(datePreset)} />

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* PERFORMANCE SECTION */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <InsightsSectionHeader 
              icon={Target} 
              title="Performance" 
              description="Your conversion rates & efficiency"
            />

            {/* Sales Funnel */}
            <InsightCollapsible
              icon={PieChart}
              title="Sales Funnel"
              isOpen={expandedSection === 'funnel'}
              onToggle={() => handleSectionToggle('funnel')}
              preview={
                <span>
                  {insights.funnelData.doors.total} doors → {insights.funnelData.closes.total} closes · <span className="text-primary font-medium">{insights.funnelData.doors.conversionToNext.toFixed(1)}%</span> DM rate
                </span>
              }
            >
              <SalesFunnelChart funnelData={insights.funnelData} />
            </InsightCollapsible>

            {/* Key Ratios */}
            <InsightCollapsible
              icon={Target}
              title="Key Ratios"
              isOpen={expandedSection === 'ratios'}
              onToggle={() => handleSectionToggle('ratios')}
              preview={
                <span>
                  <span className="text-primary font-medium">
                    {efpModeEnabled ? insights.doorsToEfp.toFixed(1) : insights.doorsToFp.toFixed(1)}
                  </span> doors per {efpModeEnabled ? "EFP" : "FP+"} · {insights.presentationsToClose.toFixed(1)} pres/close
                </span>
              }
            >
              <div className="space-y-3">
                {/* Doors Ratio */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <div className="text-sm text-muted-foreground">Doors → {efpModeEnabled ? "EFP" : "FP+"}</div>
                    <div className="text-xl font-bold">{efpModeEnabled ? insights.doorsToEfp.toFixed(1) : insights.doorsToFp.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Overall: {efpModeEnabled ? insights.overallDoorsToEfp.toFixed(1) : insights.overallDoorsToFp.toFixed(1)}</div>
                  </div>
                  {doorsComparison && (
                    <div className={cn("flex items-center gap-1", doorsComparison.isBetter ? 'text-success' : 'text-destructive')}>
                      {doorsComparison.isBetter ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span className="text-sm font-semibold">{doorsComparison.percentDiff.toFixed(0)}%</span>
                    </div>
                  )}
                </div>

                {/* Pitches Ratio */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <div className="text-sm text-muted-foreground">Pitches → {efpModeEnabled ? "EFP" : "FP+"}</div>
                    <div className="text-xl font-bold">{efpModeEnabled ? insights.pitchesToEfp.toFixed(1) : insights.pitchesToFp.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Overall: {efpModeEnabled ? insights.overallPitchesToEfp.toFixed(1) : insights.overallPitchesToFp.toFixed(1)}</div>
                  </div>
                  {pitchesComparison && (
                    <div className={cn("flex items-center gap-1", pitchesComparison.isBetter ? 'text-success' : 'text-destructive')}>
                      {pitchesComparison.isBetter ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span className="text-sm font-semibold">{pitchesComparison.percentDiff.toFixed(0)}%</span>
                    </div>
                  )}
                </div>

                {/* Transitions Ratio */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <div className="text-sm text-muted-foreground">Transitions → {efpModeEnabled ? "EFP" : "FP+"}</div>
                    <div className="text-xl font-bold">{efpModeEnabled ? insights.transitionsToEfp.toFixed(1) : insights.transitionsToFp.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Overall: {efpModeEnabled ? insights.overallTransitionsToEfp.toFixed(1) : insights.overallTransitionsToFp.toFixed(1)}</div>
                  </div>
                  {transitionsComparison && (
                    <div className={cn("flex items-center gap-1", transitionsComparison.isBetter ? 'text-success' : 'text-destructive')}>
                      {transitionsComparison.isBetter ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span className="text-sm font-semibold">{transitionsComparison.percentDiff.toFixed(0)}%</span>
                    </div>
                  )}
                </div>

                {/* Close Ratio */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <div className="text-sm text-muted-foreground">Presentations → Close</div>
                    <div className="text-xl font-bold">{insights.presentationsToClose.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Overall: {insights.overallPresentationsToClose.toFixed(1)}</div>
                  </div>
                  {closeComparison && (
                    <div className={cn("flex items-center gap-1", closeComparison.isBetter ? 'text-success' : 'text-destructive')}>
                      {closeComparison.isBetter ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span className="text-sm font-semibold">{closeComparison.percentDiff.toFixed(0)}%</span>
                    </div>
                  )}
                </div>

                {/* Doors to FP (new FP only) */}
                {insights.totalNewFp > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                    <div>
                      <div className="text-sm text-muted-foreground">Doors → FP</div>
                      <div className="text-xl font-bold">{insights.doorsToNewFp.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">More accurate door efficiency</div>
                    </div>
                  </div>
                )}
              </div>
            </InsightCollapsible>

            {/* Productivity */}
            <InsightCollapsible
              icon={Gauge}
              title="Productivity per Hour"
              isOpen={expandedSection === 'productivity'}
              onToggle={() => handleSectionToggle('productivity')}
              preview={
                <span>
                  <span className="text-primary font-medium">
                    {efpModeEnabled ? insights.hoursToEfp.toFixed(1) : insights.hoursToFp.toFixed(1)} hours
                  </span> to sell 1 {efpModeEnabled ? "EFP" : "FP+"}
                </span>
              }
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/30">
                  <div className="text-sm text-muted-foreground">Doors/Hour</div>
                  <div className="text-xl font-bold">{insights.doorsPerHour.toFixed(1)}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <div className="text-sm text-muted-foreground">Pitches/Hour</div>
                  <div className="text-xl font-bold">{insights.pitchesPerHour.toFixed(1)}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <div className="text-sm text-muted-foreground">Transitions/Hour</div>
                  <div className="text-xl font-bold">{insights.transitionsPerHour.toFixed(1)}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <div className="text-sm text-muted-foreground">Presentations/Hour</div>
                  <div className="text-xl font-bold">{insights.presentationsPerHour.toFixed(1)}</div>
                </div>
                <div className="col-span-2 p-3 rounded-xl bg-primary/10">
                  <div className="text-sm text-muted-foreground">Hours to sell 1 {efpModeEnabled ? "EFP" : "FP+"}</div>
                  <div className="text-xl font-bold text-primary">
                    {(() => {
                      const hours = efpModeEnabled ? insights.hoursToEfp : insights.hoursToFp;
                      return !isFinite(hours) || isNaN(hours) || hours <= 0 ? "-" : `${hours.toFixed(1)}h`;
                    })()}
                  </div>
                </div>
              </div>
            </InsightCollapsible>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* PATTERNS SECTION */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <InsightsSectionHeader 
              icon={TrendingUpIcon} 
              title="Patterns" 
              description="When & how you perform best"
            />

            {/* Activity Trends */}
            <InsightCollapsible
              icon={TrendingUpIcon}
              title="Activity Trends"
              isOpen={expandedSection === 'trends'}
              onToggle={() => handleSectionToggle('trends')}
              preview={
                <span>
                  {(() => {
                    const transitionsData = insights.dailyTrend;
                    if (transitionsData.length < 2) return `${insights.totalTransitions} transitions tracked`;
                    
                    const firstHalf = transitionsData.slice(0, Math.floor(transitionsData.length / 2));
                    const secondHalf = transitionsData.slice(Math.floor(transitionsData.length / 2));
                    const firstAvg = firstHalf.reduce((sum, d) => sum + d.transitions, 0) / firstHalf.length;
                    const secondAvg = secondHalf.reduce((sum, d) => sum + d.transitions, 0) / secondHalf.length;
                    const growth = ((secondAvg - firstAvg) / firstAvg) * 100;
                    
                    if (Math.abs(growth) < 5) {
                      return `${insights.totalTransitions} transitions · Steady pattern`;
                    } else if (growth > 0) {
                      return <>{insights.totalTransitions} transitions · <span className="text-success font-medium">↑ {growth.toFixed(0)}%</span></>;
                    } else {
                      return <>{insights.totalTransitions} transitions · <span className="text-destructive font-medium">↓ {Math.abs(growth).toFixed(0)}%</span></>;
                    }
                  })()}
                </span>
              }
            >
              <ActivityTrendChart dailyTrend={insights.dailyTrend} efpModeEnabled={efpModeEnabled} highlightDateRange={getDateRange(datePreset)} />
            </InsightCollapsible>

            {/* Hourly Patterns */}
            <InsightCollapsible
              icon={Clock}
              title="Hourly Patterns"
              isOpen={expandedSection === 'hourly'}
              onToggle={() => handleSectionToggle('hourly')}
              preview={
                insights.peakHours.doors !== null ? (
                  <span>
                    Peak hour: <span className="text-primary font-medium">
                      {insights.peakHours.doors === 0 ? '12' : insights.peakHours.doors > 12 ? insights.peakHours.doors - 12 : insights.peakHours.doors}
                      {insights.peakHours.doors >= 12 ? 'PM' : 'AM'}
                    </span>
                  </span>
                ) : 'View your peak productivity hours'
              }
            >
              <HourlyActivityHeatmap 
                hourlyActivity={insights.hourlyActivity} 
                peakHours={insights.peakHours}
                hourRange={insights.hourRange}
              />
            </InsightCollapsible>

            {/* Timing Patterns */}
            <InsightCollapsible
              icon={Clock}
              title="Work Schedule"
              isOpen={expandedSection === 'timing'}
              onToggle={() => handleSectionToggle('timing')}
              preview={
                <span>
                  {insights.avgStartTime} — {insights.avgEndTime} · <span className="text-primary font-medium">{insights.avgHoursWorked.toFixed(1)} hrs</span> avg
                </span>
              }
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/30">
                  <div className="text-sm text-muted-foreground">Avg Start Time</div>
                  <div className="text-xl font-bold">{insights.avgStartTime}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <div className="text-sm text-muted-foreground">Avg End Time</div>
                  <div className="text-xl font-bold">{insights.avgEndTime}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <div className="text-sm text-muted-foreground">Avg Hours Worked</div>
                  <div className="text-xl font-bold">{insights.avgHoursWorked.toFixed(1)}h</div>
                </div>
                {insights.mostProductiveHour !== null && (
                  <div className="p-3 rounded-xl bg-primary/10">
                    <div className="text-sm text-muted-foreground">Most Productive</div>
                    <div className="text-xl font-bold text-primary">
                      {insights.mostProductiveHour === 0 ? '12' : insights.mostProductiveHour > 12 ? insights.mostProductiveHour - 12 : insights.mostProductiveHour}
                      {insights.mostProductiveHour >= 12 ? 'PM' : 'AM'}
                    </div>
                  </div>
                )}
              </div>
            </InsightCollapsible>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* RECORDS SECTION */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <InsightsSectionHeader 
              icon={Award} 
              title="Records" 
              description="Your best performances"
            />

            {/* Best Periods */}
            <InsightCollapsible
              icon={Award}
              title="Best Periods"
              isOpen={expandedSection === 'bestPeriods'}
              onToggle={() => handleSectionToggle('bestPeriods')}
              preview={
                insights.bestDay ? (
                  <span>
                    Best day: <span className="text-primary font-medium">
                      {efpModeEnabled ? insights.bestDay.efp.toFixed(2) : insights.bestDay.fpPlus.toFixed(1)} {efpModeEnabled ? "EFP" : "FP+"}
                    </span> on {insights.bestDay.date}
                  </span>
                ) : 'Your personal records'
              }
            >
              <div className="space-y-3">
                {insights.bestDay && (
                  <div className="p-3 rounded-xl bg-muted/30">
                    <div className="text-sm text-muted-foreground mb-1">Best Day</div>
                    <div className="text-xl font-bold text-primary">
                      {efpModeEnabled ? insights.bestDay.efp.toFixed(2) : insights.bestDay.fpPlus.toFixed(1)} {efpModeEnabled ? "EFP" : "FP+"}
                    </div>
                    <div className="text-sm text-muted-foreground">{insights.bestDay.date}</div>
                    <div className="text-xs text-muted-foreground mt-1">{insights.bestDay.stats}</div>
                  </div>
                )}
                
                {insights.bestWeek && (
                  <div className="p-3 rounded-xl bg-muted/30">
                    <div className="text-sm text-muted-foreground mb-1">Best Week</div>
                    <div className="text-xl font-bold text-primary">
                      {efpModeEnabled ? insights.bestWeek.efp.toFixed(2) : insights.bestWeek.fpPlus.toFixed(1)} {efpModeEnabled ? "EFP" : "FP+"}
                    </div>
                    <div className="text-sm text-muted-foreground">{insights.bestWeek.weekStart} — {insights.bestWeek.weekEnd}</div>
                    <div className="text-xs text-muted-foreground mt-1">{insights.bestWeek.stats}</div>
                  </div>
                )}
                
                {insights.bestMonth && (
                  <div className="p-3 rounded-xl bg-muted/30">
                    <div className="text-sm text-muted-foreground mb-1">Best Month</div>
                    <div className="text-xl font-bold text-primary">
                      {efpModeEnabled ? insights.bestMonth.efp.toFixed(2) : insights.bestMonth.fpPlus.toFixed(1)} {efpModeEnabled ? "EFP" : "FP+"}
                    </div>
                    <div className="text-sm text-muted-foreground">{insights.bestMonth.month}</div>
                    <div className="text-xs text-muted-foreground mt-1">{insights.bestMonth.stats}</div>
                  </div>
                )}
                
                {insights.bestTransitionsDay && (
                  <div className="p-3 rounded-xl bg-muted/30">
                    <div className="text-sm text-muted-foreground mb-1">Most Transitions Day</div>
                    <div className="text-xl font-bold text-primary">{insights.bestTransitionsDay.transitions} transitions</div>
                    <div className="text-sm text-muted-foreground">{insights.bestTransitionsDay.date}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {efpModeEnabled ? `${insights.bestTransitionsDay.efp.toFixed(2)} EFP` : `${insights.bestTransitionsDay.fpPlus.toFixed(1)} FP+`} sold
                    </div>
                  </div>
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
            </InsightCollapsible>

            {/* Personal Metrics (Custom Counters) - Only for Vets/Sophomores */}
            {(repData?.year === "Vet" || repData?.year === "Sophomore") && insights.customCounterTotals && Object.keys(insights.customCounterTotals).length > 0 && (
              <InsightCollapsible
                icon={Target}
                title="Personal Metrics"
                isOpen={expandedSection === 'custom'}
                onToggle={() => handleSectionToggle('custom' as ExpandedSection)}
                preview={`Your custom tracking (${Object.keys(insights.customCounterTotals).length} counters)`}
              >
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Custom counters are not included in team leaderboards
                  </p>
                  {Object.entries(insights.customCounterTotals).map(([counterId, total]) => {
                    const config = (repData?.custom_counter_config as any[])?.find((c: any) => c.id === counterId);
                    if (!config) return null;
                    
                    const dailyAvg = (total as number) / insights.daysWorked;
                    const perHour = insights.totalWorkMinutes > 0 
                      ? ((total as number) / insights.totalWorkMinutes) * 60 
                      : 0;
                    
                    return (
                      <div key={counterId} className="p-3 rounded-xl bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{config.emoji}</span>
                          <span className="font-semibold">{config.name}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <div className="text-xs text-muted-foreground">Total</div>
                            <div className="text-lg font-bold">{total}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Daily Avg</div>
                            <div className="text-lg font-bold">{dailyAvg.toFixed(1)}</div>
                          </div>
                          {perHour > 0 && (
                            <div>
                              <div className="text-xs text-muted-foreground">Per Hour</div>
                              <div className="text-lg font-bold">{perHour.toFixed(1)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </InsightCollapsible>
            )}
          </>
        )}
      </div>

      {/* AI Coach Floating Button */}
      {insights && insights.daysWorked > 0 && <AICoachFab />}

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
}
