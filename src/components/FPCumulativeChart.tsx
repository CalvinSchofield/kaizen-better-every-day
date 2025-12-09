import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ComposedChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { format, parseISO, startOfWeek, startOfMonth, isBefore, isAfter, differenceInDays } from "date-fns";
import { useCumulativeFP, CumulativeDataPoint } from "@/hooks/useCumulativeFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { TrendingUp, TrendingDown, ChevronDown, Target } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type GroupBy = 'day' | 'week' | 'month';
type MetricType = 'primary' | 'secondary'; // primary = FP+ or EFP, secondary = PRMR or FP+
type GoalLineType = 'preseason' | 'mustDo' | 'willDo' | 'couldDo';

// Season date constants - match CalendarPlanningCard
const PRESEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';
const SUMMER_START = '2026-04-12';
const SUMMER_END = '2026-09-27';

const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getLocalToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

interface FPCumulativeChartProps {
  teamData?: CumulativeDataPoint[];
  isTeamLoading?: boolean;
}

export const FPCumulativeChart = ({ teamData, isTeamLoading }: FPCumulativeChartProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [metricType, setMetricType] = useState<MetricType>('primary');
  const [showGoalLine, setShowGoalLine] = useState(true);
  const [selectedGoalLine, setSelectedGoalLine] = useState<GoalLineType>('preseason');
  
  const { data: personalData, isLoading: personalLoading } = useCumulativeFP();
  const { efpModeEnabled } = useEfpMode();
  const { goals } = useRepGoals();
  const { plannedDays } = usePlannedDays();

  // Use team data if provided, otherwise use personal data
  const cumulativeData = teamData || personalData;
  const isLoading = isTeamLoading !== undefined ? isTeamLoading : personalLoading;

  // Determine if we're in preseason or summer
  const today = getLocalToday();
  const preseasonEnd = parseLocalDate(PRESEASON_END);
  const summerStart = parseLocalDate(SUMMER_START);
  const isPreseason = isBefore(today, summerStart);
  const isSummer = !isPreseason;

  // Calculate goal pace data
  const goalPaceData = useMemo(() => {
    if (!goals || !cumulativeData || cumulativeData.length === 0) return null;

    // Get the date range from actual data
    const firstDate = parseLocalDate(cumulativeData[0].date);
    const lastDate = parseLocalDate(cumulativeData[cumulativeData.length - 1].date);

    // Calculate planned days in the relevant period
    const plannedDatesSet = new Set(plannedDays?.map(p => p.planned_date) || []);
    
    // Get raw goals - these are in FP+ units
    const preseasonGoalRaw = goals.preseason_fp_goal || 0;
    const mustDoGoalRaw = goals.must_do_fp_goal || 0;
    const willDoGoalRaw = goals.will_do_fp_goal || 0;
    const couldDoGoalRaw = goals.could_do_fp_goal || 0;
    
    // In EFP mode, goals stay the same (just different units of measurement)
    // The chart cumulative data already uses EFP or FP+ based on mode
    const preseasonGoal = preseasonGoalRaw;
    const mustDoGoal = mustDoGoalRaw;
    const willDoGoal = willDoGoalRaw;
    const couldDoGoal = couldDoGoalRaw;
    
    // Apply cancel buffer - need to fund more to hit goal after cancellations
    const cancelRate = goals.cancel_rate || 0;
    const cancelMultiplier = cancelRate > 0 && cancelRate < 1 ? 1 / (1 - cancelRate) : 1;
    
    const fundedPreseasonGoal = preseasonGoal * cancelMultiplier;
    const fundedMustDoGoal = mustDoGoal * cancelMultiplier;
    const fundedWillDoGoal = willDoGoal * cancelMultiplier;
    const fundedCouldDoGoal = couldDoGoal * cancelMultiplier;

    // Count total planned days for the season
    const preseasonStartDate = parseLocalDate(PRESEASON_START);
    const preseasonEndDate = parseLocalDate(PRESEASON_END);
    const summerEndDate = parseLocalDate(SUMMER_END);

    // Count planned days in preseason
    let preseasonPlannedCount = 0;
    let summerPlannedCount = 0;
    
    plannedDays?.forEach(p => {
      const pDate = parseLocalDate(p.planned_date);
      if (!isBefore(pDate, preseasonStartDate) && !isAfter(pDate, preseasonEndDate)) {
        preseasonPlannedCount++;
      }
      if (!isBefore(pDate, summerStart) && !isAfter(pDate, summerEndDate)) {
        summerPlannedCount++;
      }
    });

    // Also count days worked that might not be in planned (auto-populate past)
    cumulativeData.forEach(d => {
      const dDate = parseLocalDate(d.date);
      if (!plannedDatesSet.has(d.date)) {
        if (!isBefore(dDate, preseasonStartDate) && !isAfter(dDate, preseasonEndDate)) {
          preseasonPlannedCount++;
        }
        if (!isBefore(dDate, summerStart) && !isAfter(dDate, summerEndDate)) {
          summerPlannedCount++;
        }
      }
    });

    // Calculate daily pace for each goal (using funded goals that account for cancellations)
    const preseasonDailyPace = preseasonPlannedCount > 0 ? fundedPreseasonGoal / preseasonPlannedCount : 0;
    const mustDoDailyPace = summerPlannedCount > 0 ? fundedMustDoGoal / summerPlannedCount : 0;
    const willDoDailyPace = summerPlannedCount > 0 ? fundedWillDoGoal / summerPlannedCount : 0;
    const couldDoDailyPace = summerPlannedCount > 0 ? fundedCouldDoGoal / summerPlannedCount : 0;


    // Generate pace line data points matching chart data dates
    // For each worked day, calculate the expected cumulative goal at that point
    const pacePoints = cumulativeData.map((point, idx) => {
      const pointDate = parseLocalDate(point.date);
      const isInPreseason = !isBefore(pointDate, preseasonStartDate) && !isAfter(pointDate, preseasonEndDate);
      const isInSummer = !isBefore(pointDate, summerStart);

      // For pace line, we calculate based on day number in the period
      // Day 1 = first worked day, Day 2 = second worked day, etc.
      const dayNumber = idx + 1; // 1-indexed day number

      return {
        date: point.date,
        preseasonPace: isInPreseason && preseasonDailyPace > 0 ? dayNumber * preseasonDailyPace : undefined,
        mustDoPace: isInSummer && mustDoDailyPace > 0 ? dayNumber * mustDoDailyPace : undefined,
        willDoPace: isInSummer && willDoDailyPace > 0 ? dayNumber * willDoDailyPace : undefined,
        couldDoPace: isInSummer && couldDoDailyPace > 0 ? dayNumber * couldDoDailyPace : undefined,
      };
    });

    return {
      pacePoints,
      preseasonGoal: fundedPreseasonGoal,
      mustDoGoal: fundedMustDoGoal,
      willDoGoal: fundedWillDoGoal,
      couldDoGoal: fundedCouldDoGoal,
      preseasonDailyPace,
      mustDoDailyPace,
      willDoDailyPace,
      couldDoDailyPace,
      preseasonPlannedCount,
      summerPlannedCount,
    };
  }, [goals, cumulativeData, plannedDays, efpModeEnabled]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Progress Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!cumulativeData || cumulativeData.length === 0) {
    return null;
  }

  // Determine which grouping options are available based on data length
  const hasEnoughForWeek = cumulativeData.length >= 7;
  const hasEnoughForMonth = cumulativeData.length >= 14;

  // Determine labels based on mode and metric type
  const primaryLabel = efpModeEnabled ? "EFP" : "FP+";
  const secondaryLabel = efpModeEnabled ? "FP+" : "PRMR";
  const currentMetricLabel = metricType === 'primary' ? primaryLabel : secondaryLabel;

  // Group data by day/week/month
  const groupedData = () => {
    if (groupBy === 'day') {
      return cumulativeData.map((point, idx) => {
        const pacePoint = goalPaceData?.pacePoints[idx];
        return {
          date: point.date,
          displayDate: format(parseISO(point.date), "MMM d"),
          cumulative: metricType === 'primary' 
            ? point.cumulative 
            : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr),
          preseasonPace: pacePoint?.preseasonPace,
          mustDoPace: pacePoint?.mustDoPace,
          willDoPace: pacePoint?.willDoPace,
          couldDoPace: pacePoint?.couldDoPace,
        };
      });
    }

    // Group by week or month
    const grouped: Record<string, any> = {};
    cumulativeData.forEach((point, idx) => {
      const date = parseISO(point.date);
      const key = groupBy === 'week' 
        ? format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        : format(startOfMonth(date), 'yyyy-MM-dd');
      
      const pacePoint = goalPaceData?.pacePoints[idx];
      
      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          displayDate: groupBy === 'week' 
            ? format(parseISO(key), "MMM d")
            : format(parseISO(key), "MMM"),
          cumulative: metricType === 'primary' 
            ? point.cumulative 
            : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr),
          preseasonPace: pacePoint?.preseasonPace,
          mustDoPace: pacePoint?.mustDoPace,
          willDoPace: pacePoint?.willDoPace,
          couldDoPace: pacePoint?.couldDoPace,
        };
      } else {
        grouped[key].cumulative = metricType === 'primary' 
          ? point.cumulative 
          : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr);
        // Keep the latest pace values for the group
        if (pacePoint?.preseasonPace !== undefined) grouped[key].preseasonPace = pacePoint.preseasonPace;
        if (pacePoint?.mustDoPace !== undefined) grouped[key].mustDoPace = pacePoint.mustDoPace;
        if (pacePoint?.willDoPace !== undefined) grouped[key].willDoPace = pacePoint.willDoPace;
        if (pacePoint?.couldDoPace !== undefined) grouped[key].couldDoPace = pacePoint.couldDoPace;
      }
    });

    return Object.values(grouped);
  };

  const chartData = groupedData();

  // Calculate comparison metrics
  const calculateComparison = () => {
    if (chartData.length < 2) return null;

    const current = chartData[chartData.length - 1];
    const previous = chartData[chartData.length - 2];
    
    const change = current.cumulative - previous.cumulative;
    const percentChange = previous.cumulative > 0 
      ? ((change / previous.cumulative) * 100)
      : 0;

    return {
      change,
      percentChange,
      isPositive: change >= 0,
    };
  };

  const comparison = calculateComparison();

  // Get the active goal line key
  const getGoalLineKey = (): string => {
    if (isPreseason || selectedGoalLine === 'preseason') return 'preseasonPace';
    if (selectedGoalLine === 'mustDo') return 'mustDoPace';
    if (selectedGoalLine === 'willDo') return 'willDoPace';
    if (selectedGoalLine === 'couldDo') return 'couldDoPace';
    return 'preseasonPace';
  };

  const getGoalLineLabel = (): string => {
    if (isPreseason || selectedGoalLine === 'preseason') return 'Preseason Goal';
    if (selectedGoalLine === 'mustDo') return 'Must Do';
    if (selectedGoalLine === 'willDo') return 'Will Do';
    if (selectedGoalLine === 'couldDo') return 'Could Do';
    return 'Goal';
  };

  const chartConfig = {
    cumulative: {
      label: `Total ${currentMetricLabel}`,
      color: "hsl(var(--primary))",
    },
    goalPace: {
      label: getGoalLineLabel(),
      color: "hsl(var(--muted-foreground))",
    },
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const goalLineKey = getGoalLineKey();
    const goalPaceValue = data[goalLineKey];
    
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-sm mb-2">
          {format(parseISO(data.date), "MMM d, yyyy")}
        </p>
        <div className="text-xs space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Total {currentMetricLabel}:</span>
            <span className="font-semibold" style={{ color: chartConfig.cumulative.color }}>
              {metricType === 'secondary' && !efpModeEnabled
                ? `$${data.cumulative.toFixed(0)}`
                : (efpModeEnabled && metricType === 'primary')
                  ? data.cumulative.toFixed(2)
                  : data.cumulative.toFixed(1)}
            </span>
          </div>
          {showGoalLine && goalPaceValue != null && metricType === 'primary' && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{getGoalLineLabel()} Pace:</span>
              <span className="font-medium text-muted-foreground">
                {efpModeEnabled ? goalPaceValue.toFixed(2) : goalPaceValue.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const totalForMode = metricType === 'primary' 
    ? cumulativeData[cumulativeData.length - 1].cumulative  // EFP or FP+ depending on mode
    : (efpModeEnabled
        ? cumulativeData[cumulativeData.length - 1].cumulativeFp  // FP+ when in EFP mode secondary
        : cumulativeData[cumulativeData.length - 1].cumulativePrmr);  // PRMR when in FP+ mode secondary

  // Check if goal line should be available (for primary metric when there's a goal set)
  const hasPreseasonGoal = (goals?.preseason_fp_goal || 0) > 0;
  const hasSummerGoals = (goals?.must_do_fp_goal || 0) > 0;
  const canShowGoalLine = metricType === 'primary' && (hasPreseasonGoal || hasSummerGoals);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <div className="p-4">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Progress Over Time</h2>
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform text-muted-foreground ${isOpen ? "rotate-180" : ""}`} />
            </div>
            {!isOpen && (
              <div className="mt-2 text-left text-sm text-muted-foreground">
                {metricType === 'primary' 
                  ? (efpModeEnabled 
                      ? `${totalForMode.toFixed(2)} EFP total`
                      : `${totalForMode.toFixed(1)} FP+ total`)
                  : (efpModeEnabled
                      ? `${totalForMode.toFixed(1)} FP+ total`
                      : `$${totalForMode.toFixed(0)} PRMR total`)}
              </div>
            )}
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="pt-3 space-y-3">
              {/* All Controls in One Row */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Group By */}
                <div className="flex items-center gap-1 border border-border rounded-lg p-1">
                  <Button
                    variant={groupBy === 'day' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setGroupBy('day')}
                    className="text-xs h-7 px-2"
                  >
                    Day
                  </Button>
                  {hasEnoughForWeek && (
                    <Button
                      variant={groupBy === 'week' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setGroupBy('week')}
                      className="text-xs h-7 px-2"
                    >
                      Week
                    </Button>
                  )}
                  {hasEnoughForMonth && (
                    <Button
                      variant={groupBy === 'month' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setGroupBy('month')}
                      className="text-xs h-7 px-2"
                    >
                      Month
                    </Button>
                  )}
                </div>

                {/* Metric Toggle (EFP/FP+ when in EFP mode) */}
                <div className="flex items-center gap-1 border border-border rounded-lg p-1">
                  <Button
                    variant={metricType === 'primary' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setMetricType('primary')}
                    className="text-xs h-7 px-2"
                  >
                    {primaryLabel}
                  </Button>
                  <Button
                    variant={metricType === 'secondary' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setMetricType('secondary')}
                    className="text-xs h-7 px-2"
                  >
                    {secondaryLabel}
                  </Button>
                </div>

                {/* Goal Line Toggle */}
                {canShowGoalLine && (
                  <Button
                    variant={showGoalLine ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowGoalLine(!showGoalLine)}
                    className="text-xs h-7 px-2 gap-1"
                  >
                    <Target className="w-3 h-3" />
                    Goal
                  </Button>
                )}
              </div>

              {/* Summer Goal Selector (only show in summer when goal line is on) */}
              {canShowGoalLine && showGoalLine && isSummer && (
                <div className="flex items-center gap-1 border border-border rounded-lg p-1 w-fit">
                  <Button
                    variant={selectedGoalLine === 'mustDo' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedGoalLine('mustDo')}
                    className="text-xs h-6 px-2"
                  >
                    Must Do
                  </Button>
                  <Button
                    variant={selectedGoalLine === 'willDo' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedGoalLine('willDo')}
                    className="text-xs h-6 px-2"
                  >
                    Will Do
                  </Button>
                  <Button
                    variant={selectedGoalLine === 'couldDo' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedGoalLine('couldDo')}
                    className="text-xs h-6 px-2"
                  >
                    Could Do
                  </Button>
                </div>
              )}

              {/* Comparison Metrics */}
              {comparison && (
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    {comparison.isPositive ? (
                      <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                    <span className={comparison.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {comparison.isPositive ? '+' : ''}
                      {metricType === 'secondary' && !efpModeEnabled
                        ? `$${comparison.change.toFixed(0)}`
                        : comparison.change.toFixed(efpModeEnabled && metricType === 'primary' ? 2 : 1)}
                    </span>
                    <span className="text-muted-foreground">
                      ({comparison.percentChange.toFixed(1)}%)
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    vs previous {groupBy}
                  </span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
        <CollapsibleContent>
          <div className="px-4 pb-4">
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 12 }}
                tickMargin={8}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickMargin={8}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip content={<CustomTooltip />} />
              <defs>
                <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                fill="url(#cumulativeGradient)"
                dot={{ fill: "hsl(var(--primary))", r: 4 }}
                activeDot={{ r: 6 }}
                animationDuration={800}
                animationEasing="ease-out"
              />
              
              {/* Goal Pace Line - rendered after Area so it's on top */}
              {canShowGoalLine && showGoalLine && (
                <Line
                  type="linear"
                  dataKey={getGoalLineKey()}
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  connectNulls={true}
                  animationDuration={800}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          </ChartContainer>
          
          {/* Legend with daily pace info */}
          {canShowGoalLine && showGoalLine && goalPaceData && (
            <div className="flex flex-col items-center gap-1 pt-2">
              {/* Daily pace label */}
              <div className="text-xs text-muted-foreground">
                {isPreseason ? (
                  goalPaceData.preseasonDailyPace > 0 && (
                    <span>
                      {efpModeEnabled 
                        ? `${goalPaceData.preseasonDailyPace.toFixed(2)} EFP/day`
                        : `${goalPaceData.preseasonDailyPace.toFixed(2)} FP+/day`}
                      {' to fund '}
                      {efpModeEnabled 
                        ? `${goalPaceData.preseasonGoal.toFixed(1)} EFP`
                        : `${goalPaceData.preseasonGoal.toFixed(1)} FP+`}
                      {' over '}
                      {goalPaceData.preseasonPlannedCount} days
                    </span>
                  )
                ) : (
                  (() => {
                    const dailyPace = selectedGoalLine === 'mustDo' ? goalPaceData.mustDoDailyPace
                      : selectedGoalLine === 'willDo' ? goalPaceData.willDoDailyPace
                      : goalPaceData.couldDoDailyPace;
                    const goalAmount = selectedGoalLine === 'mustDo' ? goalPaceData.mustDoGoal
                      : selectedGoalLine === 'willDo' ? goalPaceData.willDoGoal
                      : goalPaceData.couldDoGoal;
                    return dailyPace > 0 && (
                      <span>
                        {efpModeEnabled 
                          ? `${dailyPace.toFixed(2)} EFP/day`
                          : `${dailyPace.toFixed(2)} FP+/day`}
                        {' to fund '}
                        {efpModeEnabled 
                          ? `${goalAmount.toFixed(1)} EFP`
                          : `${goalAmount.toFixed(1)} FP+`}
                        {' over '}
                        {goalPaceData.summerPlannedCount} days
                      </span>
                    );
                  })()
                )}
              </div>
              {/* Legend icons */}
              <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 rounded bg-primary" />
                  Actual
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 rounded bg-muted-foreground border-dashed" style={{ borderBottom: '1.5px dashed' }} />
                  {getGoalLineLabel()} Pace
                </span>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Card>
    </Collapsible>
  );
};
