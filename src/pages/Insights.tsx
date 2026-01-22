import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInsightsData } from '@/hooks/useInsightsData';
import { useRepData } from '@/hooks/useRepData';
import { useRookieUnlockStatus } from '@/hooks/useRookieUnlockStatus';
import { useEfpMode } from '@/hooks/useEfpMode';
import { useCumulativeFP } from '@/hooks/useCumulativeFP';
import { useAvailableInsightsPresets, InsightsDatePreset, PRESEASON_START, SUMMER_START } from '@/hooks/useAvailableDatePresets';
import { usePageTour } from '@/hooks/usePageTour';
import { PageTour } from '@/components/PageTour';
import { insightsTourSteps } from '@/config/pageTours';
import { useSalesRealtime } from '@/hooks/useSalesRealtime';

import { Calendar as CalendarIcon, Lock, BarChart3 } from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, parseISO, isSameDay, addDays } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { AICoachFab } from '@/components/insights/AICoachFab';
import { InsightsOverviewTab } from '@/components/insights/InsightsOverviewTab';
import { InsightsPerformanceTab } from '@/components/insights/InsightsPerformanceTab';
import { InsightsPatternsTab } from '@/components/insights/InsightsPatternsTab';
import { InsightsDealsTab } from '@/components/insights/InsightsDealsTab';

type DatePreset = InsightsDatePreset;
type InsightsTab = 'overview' | 'performance' | 'patterns' | 'deals';

const InsightsPageSkeleton = () => (
  <div className="min-h-screen bg-background pb-24">
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/50">
      <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 w-20 rounded-md bg-muted animate-pulse shrink-0"
            />
          ))}
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="h-10 rounded-md bg-muted animate-pulse" />
      </div>
    </div>

    <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="h-8 w-28 bg-muted rounded animate-pulse mb-2" />
        <div className="h-4 w-40 bg-muted rounded animate-pulse" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4">
          <div className="h-5 w-32 bg-muted rounded animate-pulse mb-2" />
          <div className="h-4 w-56 bg-muted rounded animate-pulse" />
        </div>
      ))}
    </div>
  </div>
);

export default function Insights() {
  const [searchParams] = useSearchParams();
  const { repData, loading: loadingRepData } = useRepData();
  const { efpModeEnabled } = useEfpMode();
  const { data: cumulativeData } = useCumulativeFP();
  const { availablePresets, hasAnyData, isLoading: presetsLoading } = useAvailableInsightsPresets();
  const [datePreset, setDatePreset] = useState<DatePreset | null>(null);
  const [hasUserSelectedPreset, setHasUserSelectedPreset] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<InsightsTab>('overview');
  
  // Page tour
  const { showTour, completeTour, skipTour } = usePageTour({
    page: 'insights',
    enabled: !presetsLoading && hasAnyData,
    delay: 600,
  });
  
  // Subscribe to realtime sales updates for immediate data sync
  useSalesRealtime();
  
  // Set initial preset to first available (smallest range) once presets are known.
  useEffect(() => {
    if (hasUserSelectedPreset) return;
    if (presetsLoading) return;
    if (datePreset !== null) return;

    if (availablePresets.length > 0) {
      setDatePreset(availablePresets[0]);
    }
  }, [availablePresets, hasUserSelectedPreset, presetsLoading, datePreset]);
  
  // Check if CRM is enabled
  const crmEnabled = (repData as any)?.crm_enabled === true;
  
  // Get user's actual cumulative FP+ for default pay level
  const userCumulativeFpPlus = cumulativeData && cumulativeData.length > 0 
    ? cumulativeData[cumulativeData.length - 1].cumulativeFp 
    : 0;

  // Handle incoming date params from calendar navigation
  useEffect(() => {
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    
    if (startParam && endParam) {
      const startDate = parseISO(startParam);
      const endDate = parseISO(endParam);
      const now = new Date();
      
      const thisWeekStart = startOfWeek(now, { weekStartsOn: 0 });
      const thisWeekEnd = addDays(thisWeekStart, 6);
      if (isSameDay(startDate, thisWeekStart) && isSameDay(endDate, thisWeekEnd)) {
        setHasUserSelectedPreset(true);
        setDatePreset('week');
        return;
      }
      
      const lastWeekStart = subDays(thisWeekStart, 7);
      const lastWeekEnd = addDays(lastWeekStart, 6);
      if (isSameDay(startDate, lastWeekStart) && isSameDay(endDate, lastWeekEnd)) {
        setHasUserSelectedPreset(true);
        setDatePreset('lastWeek');
        return;
      }
      
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      if (isSameDay(startDate, thisMonthStart) && isSameDay(endDate, thisMonthEnd)) {
        setHasUserSelectedPreset(true);
        setDatePreset('month');
        return;
      }
      
      const lastMonthDate = subMonths(now, 1);
      const lastMonthStart = startOfMonth(lastMonthDate);
      const lastMonthEnd = endOfMonth(lastMonthDate);
      if (isSameDay(startDate, lastMonthStart) && isSameDay(endDate, lastMonthEnd)) {
        setHasUserSelectedPreset(true);
        setDatePreset('lastMonth');
        return;
      }
      
      setCustomStartDate(startDate);
      setCustomEndDate(endDate);
      setHasUserSelectedPreset(true);
      setDatePreset('custom');
      return;
    }
    
    const period = searchParams.get('period');
    if (period === 'week') { setHasUserSelectedPreset(true); setDatePreset('week'); }
    else if (period === 'month') { setHasUserSelectedPreset(true); setDatePreset('month'); }
    else if (period === 'lastWeek') { setHasUserSelectedPreset(true); setDatePreset('lastWeek'); }
    else if (period === 'lastMonth') { setHasUserSelectedPreset(true); setDatePreset('lastMonth'); }
  }, [searchParams]);

  // Check if user is a pre-blitz rookie - use centralized hook
  const { isPreBlitzRookie } = useRookieUnlockStatus(repData);
  
  const getDateRange = (preset: DatePreset) => {
    const now = new Date();
    
    switch (preset) {
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { start: yesterday, end: yesterday };
      case 'week':
        const weekStart = startOfWeek(now, { weekStartsOn: 0 });
        return { start: weekStart, end: now };
      case 'lastWeek':
        const thisWeekStart = startOfWeek(now, { weekStartsOn: 0 });
        const lastWeekStart = subDays(thisWeekStart, 7);
        const lastWeekEnd = subDays(thisWeekStart, 1);
        return { start: lastWeekStart, end: lastWeekEnd };
      case 'month':
        return { start: startOfMonth(now), end: now };
      case 'lastMonth':
        const lastMonthDate = subMonths(now, 1);
        return { start: startOfMonth(lastMonthDate), end: endOfMonth(lastMonthDate) };
      case 'preseason':
        // Preseason: Sept 28, 2025 to April 12, 2026 (or now if before summer)
        return { start: PRESEASON_START, end: now < SUMMER_START ? now : SUMMER_START };
      case 'custom':
        return { start: customStartDate || PRESEASON_START, end: customEndDate || now };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const effectivePreset: DatePreset = datePreset ?? (availablePresets[0] ?? 'preseason');
  const dateRange = getDateRange(effectivePreset);

  const { data: insights, isLoading } = useInsightsData(dateRange, efpModeEnabled, {
    enabled: !loadingRepData && !presetsLoading && datePreset !== null,
  });

  // Wait for presets to load AND for a preset to be chosen (prevents flash)
  if (loadingRepData || presetsLoading || datePreset === null) return <InsightsPageSkeleton />;

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
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky Header with Date Selector + Tabs */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/50">
        {/* Date Range Buttons */}
        <div className="px-4 py-3 overflow-x-auto scrollbar-hide" data-tour="insights-date-range">
          <div className="flex gap-2">
            {(['yesterday', 'week', 'lastWeek', 'month', 'lastMonth', 'preseason'] as DatePreset[])
              .filter(preset => availablePresets.includes(preset))
              .map((preset) => (
              <Button
                key={preset}
                variant={datePreset === preset ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setHasUserSelectedPreset(true);
                  setDatePreset(preset);
                }}
                className="shrink-0"
              >
                {preset === 'yesterday' && 'Yesterday'}
                {preset === 'week' && 'This Week'}
                {preset === 'lastWeek' && 'Last Week'}
                {preset === 'month' && 'This Month'}
                {preset === 'lastMonth' && 'Last Month'}
                {preset === 'preseason' && 'Preseason'}
              </Button>
            ))}
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

        {/* Tab Navigation - Hide Deals tab if CRM not enabled */}
        <div className="px-4 pb-3" data-tour="insights-tabs">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InsightsTab)}>
            <TabsList className={cn("grid w-full h-10", crmEnabled ? "grid-cols-4" : "grid-cols-3")}>
              <TabsTrigger value="overview" className="text-xs">📊 Overview</TabsTrigger>
              <TabsTrigger value="performance" className="text-xs">🎯 Perform</TabsTrigger>
              <TabsTrigger value="patterns" className="text-xs">📈 Patterns</TabsTrigger>
              {crmEnabled && (
                <TabsTrigger value="deals" className="text-xs">💰 Deals</TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-lg mx-auto px-4 pt-4" data-tour="insights-metrics">
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
        ) : !hasAnyData ? (
          <Card className="border-dashed">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/40" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">No Data Yet</h3>
                <p className="text-muted-foreground mt-2">
                  Start tracking your daily entries to unlock powerful insights about your performance.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : !insights || insights.daysWorked === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">No data available for this period</div>
            <p className="text-sm text-muted-foreground">
              Try selecting a different date range
            </p>
          </div>
        ) : (
            <>
              {activeTab === 'overview' && (
                <InsightsOverviewTab 
                  insights={insights} 
                  dateRange={dateRange} 
                  efpModeEnabled={efpModeEnabled} 
                />
              )}
              {activeTab === 'performance' && (
                <InsightsPerformanceTab 
                  insights={insights} 
                  efpModeEnabled={efpModeEnabled}
                  repData={repData}
                />
              )}
            {activeTab === 'patterns' && (
              <InsightsPatternsTab 
                insights={insights} 
                dateRange={dateRange}
                datePreset={effectivePreset}
                efpModeEnabled={efpModeEnabled}
              />
            )}
              {activeTab === 'deals' && crmEnabled && (
                <InsightsDealsTab dateRange={dateRange} userCumulativeFpPlus={userCumulativeFpPlus} />
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
                    disabled={(date) => customStartDate ? date < customStartDate : false}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button 
              onClick={() => {
                setHasUserSelectedPreset(true);
                setDatePreset('custom');
                setShowCustomDialog(false);
              }} 
              className="w-full"
              disabled={!customStartDate || !customEndDate}
            >
              Apply Date Range
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Page Tour */}
      <PageTour
        steps={insightsTourSteps}
        isOpen={showTour}
        onComplete={completeTour}
        onSkip={skipTour}
      />
    </div>
  );
}
