import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInsightsData } from '@/hooks/useInsightsData';
import { useRepData } from '@/hooks/useRepData';
import { useEfpMode } from '@/hooks/useEfpMode';

import { Calendar as CalendarIcon, Lock, BarChart3 } from 'lucide-react';
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
import { AICoachFab } from '@/components/insights/AICoachFab';
import { InsightsOverviewTab } from '@/components/insights/InsightsOverviewTab';
import { InsightsPerformanceTab } from '@/components/insights/InsightsPerformanceTab';
import { InsightsPatternsTab } from '@/components/insights/InsightsPatternsTab';
import { InsightsDealsTab } from '@/components/insights/InsightsDealsTab';

type DatePreset = 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'preseason' | 'custom';
type InsightsTab = 'overview' | 'performance' | 'patterns' | 'deals';

export default function Insights() {
  const [searchParams] = useSearchParams();
  const { repData, loading: loadingRepData } = useRepData();
  const { efpModeEnabled } = useEfpMode();
  const [datePreset, setDatePreset] = useState<DatePreset>('week');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<InsightsTab>('overview');

  // Handle incoming date params from calendar navigation
  useEffect(() => {
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    
    if (startParam && endParam) {
      const startDate = parseISO(startParam);
      const endDate = parseISO(endParam);
      const now = new Date();
      
      const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const thisWeekEnd = addDays(thisWeekStart, 6);
      if (isSameDay(startDate, thisWeekStart) && isSameDay(endDate, thisWeekEnd)) {
        setDatePreset('week');
        return;
      }
      
      const lastWeekStart = subDays(thisWeekStart, 7);
      const lastWeekEnd = addDays(lastWeekStart, 6);
      if (isSameDay(startDate, lastWeekStart) && isSameDay(endDate, lastWeekEnd)) {
        setDatePreset('lastWeek');
        return;
      }
      
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      if (isSameDay(startDate, thisMonthStart) && isSameDay(endDate, thisMonthEnd)) {
        setDatePreset('month');
        return;
      }
      
      const lastMonthDate = subMonths(now, 1);
      const lastMonthStart = startOfMonth(lastMonthDate);
      const lastMonthEnd = endOfMonth(lastMonthDate);
      if (isSameDay(startDate, lastMonthStart) && isSameDay(endDate, lastMonthEnd)) {
        setDatePreset('lastMonth');
        return;
      }
      
      setCustomStartDate(startDate);
      setCustomEndDate(endDate);
      setDatePreset('custom');
      return;
    }
    
    const period = searchParams.get('period');
    if (period === 'week') setDatePreset('week');
    else if (period === 'month') setDatePreset('month');
    else if (period === 'lastWeek') setDatePreset('lastWeek');
    else if (period === 'lastMonth') setDatePreset('lastMonth');
  }, [searchParams]);

  const year = repData?.year || "Rookie";
  const isRookie = year === "Rookie";
  
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];
  
  const now = new Date();
  const hasAttendedOrOnBlitz = blitzes.some((blitz: any) => {
    if (!blitz.date || !blitz.endDate) return false;
    const yearNum = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yearNum}-${month}-${day}`;
    const isStartingToday = todayStr === blitz.date;
    const startDate = new Date(blitz.date + 'T00:00:00');
    const endDate = new Date(blitz.endDate + 'T23:59:59');
    const isCurrentlyActive = now >= startDate && now <= endDate;
    const hasEnded = endDate < now;
    return isStartingToday || isCurrentlyActive || hasEnded;
  });

  const isPreBlitzRookie = isRookie && !hasAttendedOrOnBlitz;
  
  const getDateRange = (preset: DatePreset) => {
    const now = new Date();
    const summerStartDate = new Date('2026-04-12');
    
    switch (preset) {
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { start: yesterday, end: yesterday };
      case 'week':
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        return { start: weekStart, end: now };
      case 'lastWeek':
        const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
        const lastWeekStart = subDays(thisWeekStart, 7);
        const lastWeekEnd = subDays(thisWeekStart, 2);
        return { start: lastWeekStart, end: lastWeekEnd };
      case 'month':
        return { start: startOfMonth(now), end: now };
      case 'lastMonth':
        const lastMonthDate = subMonths(now, 1);
        return { start: startOfMonth(lastMonthDate), end: endOfMonth(lastMonthDate) };
      case 'preseason':
        return { start: startOfYear(now), end: now < summerStartDate ? now : summerStartDate };
      case 'custom':
        return { start: customStartDate || new Date('2025-01-01'), end: customEndDate || now };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const { data: insights, isLoading } = useInsightsData(getDateRange(datePreset), efpModeEnabled);

  if (loadingRepData) return null;

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
        <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {(['yesterday', 'week', 'lastWeek', 'month', 'lastMonth', 'preseason'] as DatePreset[]).map((preset) => (
              <Button
                key={preset}
                variant={datePreset === preset ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDatePreset(preset)}
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

        {/* Tab Navigation */}
        <div className="px-4 pb-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InsightsTab)}>
            <TabsList className="grid w-full grid-cols-4 h-10">
              <TabsTrigger value="overview" className="text-xs">📊 Overview</TabsTrigger>
              <TabsTrigger value="performance" className="text-xs">🎯 Perform</TabsTrigger>
              <TabsTrigger value="patterns" className="text-xs">📈 Patterns</TabsTrigger>
              <TabsTrigger value="deals" className="text-xs">💰 Deals</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-lg mx-auto px-4 pt-4">
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
            {activeTab === 'overview' && (
              <InsightsOverviewTab 
                insights={insights} 
                dateRange={getDateRange(datePreset)} 
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
                dateRange={getDateRange(datePreset)}
                datePreset={datePreset}
                efpModeEnabled={efpModeEnabled}
              />
            )}
            {activeTab === 'deals' && (
              <InsightsDealsTab dateRange={getDateRange(datePreset)} />
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
              onClick={() => { setDatePreset('custom'); setShowCustomDialog(false); }} 
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
