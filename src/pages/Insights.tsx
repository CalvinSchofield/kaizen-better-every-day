import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useInsightsData } from '@/hooks/useInsightsData';
import { TrendingUp, TrendingDown, Clock, Target, Award } from 'lucide-react';
import { format, subDays, subMonths, startOfYear } from 'date-fns';

type DatePreset = 'week' | 'month' | 'last30' | 'season' | 'alltime';

export default function Insights() {
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  
  const getDateRange = (preset: DatePreset) => {
    const now = new Date();
    switch (preset) {
      case 'week':
        return { start: subDays(now, 7), end: now };
      case 'month':
        return { start: subMonths(now, 1), end: now };
      case 'last30':
        return { start: subDays(now, 30), end: now };
      case 'season':
        return { start: startOfYear(now), end: now };
      case 'alltime':
        return { start: new Date('2025-01-01'), end: now };
      default:
        return { start: subMonths(now, 1), end: now };
    }
  };

  const { data: insights, isLoading } = useInsightsData(getDateRange(datePreset));

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading insights...</div>
      </div>
    );
  }

  if (!insights || insights.daysWorked === 0) {
    return (
      <div className="min-h-screen bg-background p-4 pb-24">
        <div className="max-w-lg mx-auto text-center py-12">
          <div className="text-muted-foreground mb-4">No data available for this period</div>
          <p className="text-sm text-muted-foreground">
            Start tracking your daily entries to see insights here
          </p>
        </div>
      </div>
    );
  }

  const doorsComparison = getRatioComparison(insights.doorsToFp, insights.overallDoorsToFp);
  const pitchesComparison = getRatioComparison(insights.pitchesToFp, insights.overallPitchesToFp);
  const transitionsComparison = getRatioComparison(insights.transitionsToFp, insights.overallTransitionsToFp);
  const closeComparison = getCloseRatioComparison(insights.presentationsToClose, insights.overallPresentationsToClose);

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Date Range Selector */}
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
            variant={datePreset === 'last30' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('last30')}
          >
            Last 30 Days
          </Button>
          <Button
            variant={datePreset === 'season' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('season')}
          >
            This Season
          </Button>
          <Button
            variant={datePreset === 'alltime' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('alltime')}
          >
            All Time
          </Button>
        </div>

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
      </div>
    </div>
  );
}
