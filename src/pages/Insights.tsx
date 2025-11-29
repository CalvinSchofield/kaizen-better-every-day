import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useInsightsData } from '@/hooks/useInsightsData';
import { TrendingUp, TrendingDown, Clock, Target, Award, Calendar as CalendarIcon } from 'lucide-react';
import { format, subDays, subMonths, startOfYear } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

type DatePreset = 'week' | 'month' | 'preseason' | 'custom';

export default function Insights() {
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  
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

  const doorsComparison = insights ? getRatioComparison(insights.doorsToFp, insights.overallDoorsToFp) : null;
  const pitchesComparison = insights ? getRatioComparison(insights.pitchesToFp, insights.overallPitchesToFp) : null;
  const transitionsComparison = insights ? getRatioComparison(insights.transitionsToFp, insights.overallTransitionsToFp) : null;
  const closeComparison = insights ? getCloseRatioComparison(insights.presentationsToClose, insights.overallPresentationsToClose) : null;

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
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Period Summary</h2>
                <span className="text-sm text-muted-foreground">{insights.daysWorked} days worked</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <div className="text-2xl font-bold text-primary">{insights.totalFp.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Total FP+</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">${insights.totalPrmr.toFixed(0)}</div>
                  <div className="text-sm text-muted-foreground">Total PRMR</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{insights.totalDoors}</div>
                  <div className="text-sm text-muted-foreground">Total Doors</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{insights.totalCloses}</div>
                  <div className="text-sm text-muted-foreground">Total Closes</div>
                </div>
              </div>
            </Card>

            {/* Key Ratios */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Key Ratios
              </h2>
              <div className="space-y-3">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Doors → FP+</div>
                      <div className="text-2xl font-bold">{insights.doorsToFp.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Overall avg: {insights.overallDoorsToFp.toFixed(1)}
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
                      <div className="text-sm text-muted-foreground mb-1">Pitches → FP+</div>
                      <div className="text-2xl font-bold">{insights.pitchesToFp.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Overall avg: {insights.overallPitchesToFp.toFixed(1)}
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
                      <div className="text-sm text-muted-foreground mb-1">Transitions → FP+</div>
                      <div className="text-2xl font-bold">{insights.transitionsToFp.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Overall avg: {insights.overallTransitionsToFp.toFixed(1)}
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
              </div>
            </div>

            {/* Time-Based Productivity */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Productivity per Hour
              </h2>
              <Card className="p-4">
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
                    <div className="text-sm text-muted-foreground">Hours to sell 1 FP+</div>
                    <div className="text-xl font-bold">{insights.hoursToFp.toFixed(1)}h</div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Best Periods */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Award className="w-5 h-5" />
                Best Periods
              </h2>
              <div className="space-y-3">
                {insights.bestDay && (
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Best Day</div>
                    <div className="text-xl font-bold text-primary">{insights.bestDay.fpPlus.toFixed(1)} FP+</div>
                    <div className="text-sm text-muted-foreground">{insights.bestDay.date}</div>
                    <div className="text-xs text-muted-foreground mt-1">{insights.bestDay.stats}</div>
                  </Card>
                )}
                
                {insights.bestWeek && (
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Best Week</div>
                    <div className="text-xl font-bold text-primary">{insights.bestWeek.fpPlus.toFixed(1)} FP+</div>
                    <div className="text-sm text-muted-foreground">{insights.bestWeek.weekStart} — {insights.bestWeek.weekEnd}</div>
                    <div className="text-xs text-muted-foreground mt-1">{insights.bestWeek.stats}</div>
                  </Card>
                )}
                
                {insights.bestMonth && (
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Best Month</div>
                    <div className="text-xl font-bold text-primary">{insights.bestMonth.fpPlus.toFixed(1)} FP+</div>
                    <div className="text-sm text-muted-foreground">{insights.bestMonth.month}</div>
                    <div className="text-xs text-muted-foreground mt-1">{insights.bestMonth.stats}</div>
                  </Card>
                )}
                
                {insights.bestRatioDay && (
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Best Efficiency Day</div>
                    <div className="text-xl font-bold text-primary">{insights.bestRatioDay.ratio.toFixed(1)} doors per FP+</div>
                    <div className="text-sm text-muted-foreground">{insights.bestRatioDay.date}</div>
                    <div className="text-xs text-muted-foreground mt-1">{insights.bestRatioDay.fpPlus.toFixed(1)} FP+ sold</div>
                  </Card>
                )}
              </div>
            </div>

            {/* Timing Patterns */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timing Patterns
              </h2>
              <Card className="p-4">
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
              </Card>
            </div>
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
