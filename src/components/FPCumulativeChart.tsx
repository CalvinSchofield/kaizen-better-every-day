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
import { useMeVsMe } from "@/hooks/useMeVsMe";
import { useHistoricalCumulativeData } from "@/hooks/useHistoricalComparison";
import { getSeasonInfo } from "@/utils/seasonWeekUtils";
import { TrendingUp, TrendingDown, ChevronDown, Target, History } from "lucide-react";
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
  highlightDateRange?: { start: Date; end: Date };
}

export const FPCumulativeChart = ({ teamData, isTeamLoading, highlightDateRange }: FPCumulativeChartProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [metricType, setMetricType] = useState<MetricType>('primary');
  const [showGoalLine, setShowGoalLine] = useState(true);
  const [selectedGoalLine, setSelectedGoalLine] = useState<GoalLineType>('preseason');
  const [showHistoricalLine, setShowHistoricalLine] = useState(false);
  
  const { data: personalData, isLoading: personalLoading } = useCumulativeFP();
  const { efpModeEnabled } = useEfpMode();
  const { goals } = useRepGoals();
  const { plannedDays } = usePlannedDays();
  const { isEnabled: meVsMeEnabled, dataSummary } = useMeVsMe();
  
  // Fetch historical data for comparison (2025)
  const comparisonYear = 2025;
  const { data: historicalData, isLoading: historicalLoading } = useHistoricalCumulativeData(
    comparisonYear, 
    meVsMeEnabled && showHistoricalLine
  );
  
  // Check if we have historical data available
  const hasHistoricalData = meVsMeEnabled && (dataSummary?.totalDays || 0) > 0;

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

    // Get raw goals - these are in FP+ units
    const preseasonGoalRaw = goals.preseason_fp_goal || 0;
    const mustDoGoalRaw = goals.must_do_fp_goal || 0;
    const willDoGoalRaw = goals.will_do_fp_goal || 0;
    const couldDoGoalRaw = goals.could_do_fp_goal || 0;
    
    // Apply cancel buffer - need to fund more to hit goal after cancellations
    const cancelRate = goals.cancel_rate || 0;
    const cancelMultiplier = cancelRate > 0 && cancelRate < 1 ? 1 / (1 - cancelRate) : 1;
    
    const fundedPreseasonGoal = preseasonGoalRaw * cancelMultiplier;
    const fundedMustDoGoal = mustDoGoalRaw * cancelMultiplier;
    const fundedWillDoGoal = willDoGoalRaw * cancelMultiplier;
    const fundedCouldDoGoal = couldDoGoalRaw * cancelMultiplier;

    // Count ONLY actual knocking days from cumulative data
    // This matches the standardized definition: doors >= 5 AND work_start_time AND work_end_time set
    const totalKnockingDays = cumulativeData.filter(d => d.isKnockingDay).length;
    
    // Also count planned future days that haven't happened yet
    const plannedDatesSet = new Set(plannedDays?.map(p => p.planned_date) || []);
    const workedDatesSet = new Set(cumulativeData.map(d => d.date));
    const todayStr = format(today, 'yyyy-MM-dd');
    
    const preseasonStartDate = parseLocalDate(PRESEASON_START);
    const preseasonEndDate = parseLocalDate(PRESEASON_END);
    const summerEndDate = parseLocalDate(SUMMER_END);
    
    // Count future planned days (not yet worked)
    let futurePreseasonPlannedCount = 0;
    let futureSummerPlannedCount = 0;
    
    plannedDays?.forEach(p => {
      // Skip if already worked or in the past
      if (workedDatesSet.has(p.planned_date) || p.planned_date <= todayStr) return;
      
      const pDate = parseLocalDate(p.planned_date);
      if (!isBefore(pDate, preseasonStartDate) && !isAfter(pDate, preseasonEndDate)) {
        futurePreseasonPlannedCount++;
      }
      if (!isBefore(pDate, summerStart) && !isAfter(pDate, summerEndDate)) {
        futureSummerPlannedCount++;
      }
    });

    // Count knocking days in preseason vs summer from actual data
    let preseasonKnockingDays = 0;
    let summerKnockingDays = 0;
    
    cumulativeData.forEach(d => {
      if (!d.isKnockingDay) return;
      const dDate = parseLocalDate(d.date);
      if (!isBefore(dDate, preseasonStartDate) && !isAfter(dDate, preseasonEndDate)) {
        preseasonKnockingDays++;
      }
      if (!isBefore(dDate, summerStart) && !isAfter(dDate, summerEndDate)) {
        summerKnockingDays++;
      }
    });

    // Total expected knocking days = worked + future planned
    const totalPreseasonDays = preseasonKnockingDays + futurePreseasonPlannedCount;
    const totalSummerDays = summerKnockingDays + futureSummerPlannedCount;

    // Calculate daily pace based on total expected days
    const preseasonDailyPace = totalPreseasonDays > 0 ? fundedPreseasonGoal / totalPreseasonDays : 0;
    const mustDoDailyPace = totalSummerDays > 0 ? fundedMustDoGoal / totalSummerDays : 0;
    const willDoDailyPace = totalSummerDays > 0 ? fundedWillDoGoal / totalSummerDays : 0;
    const couldDoDailyPace = totalSummerDays > 0 ? fundedCouldDoGoal / totalSummerDays : 0;

    // Generate pace line data points matching chart data dates
    // Track knocking days separately for preseason and summer
    let preseasonKnockingCount = 0;
    let summerKnockingCount = 0;
    
    const pacePoints = cumulativeData.map((point) => {
      const pointDate = parseLocalDate(point.date);
      const isInPreseason = !isBefore(pointDate, preseasonStartDate) && !isAfter(pointDate, preseasonEndDate);
      const isInSummer = !isBefore(pointDate, summerStart);

      // Only count this point if it's a knocking day
      if (point.isKnockingDay) {
        if (isInPreseason) preseasonKnockingCount++;
        if (isInSummer) summerKnockingCount++;
      }

      return {
        date: point.date,
        preseasonPace: isInPreseason && preseasonDailyPace > 0 && preseasonKnockingCount > 0 
          ? preseasonKnockingCount * preseasonDailyPace : undefined,
        mustDoPace: isInSummer && mustDoDailyPace > 0 && summerKnockingCount > 0 
          ? summerKnockingCount * mustDoDailyPace : undefined,
        willDoPace: isInSummer && willDoDailyPace > 0 && summerKnockingCount > 0 
          ? summerKnockingCount * willDoDailyPace : undefined,
        couldDoPace: isInSummer && couldDoDailyPace > 0 && summerKnockingCount > 0 
          ? summerKnockingCount * couldDoDailyPace : undefined,
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
      preseasonPlannedCount: totalPreseasonDays,
      summerPlannedCount: totalSummerDays,
    };
  }, [goals, cumulativeData, plannedDays, today]);

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

  // Helper to check if a date is within highlight range
  const isInHighlightRange = (dateStr: string): boolean => {
    if (!highlightDateRange) return false;
    const date = parseLocalDate(dateStr);
    const start = new Date(highlightDateRange.start.getFullYear(), highlightDateRange.start.getMonth(), highlightDateRange.start.getDate());
    const end = new Date(highlightDateRange.end.getFullYear(), highlightDateRange.end.getMonth(), highlightDateRange.end.getDate());
    return !isBefore(date, start) && !isAfter(date, end);
  };

  // Build a map of historical data by season week + day for matching
  const historicalMap = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return new Map();
    const map = new Map<string, number>();
    historicalData.forEach(entry => {
      const key = `${entry.seasonType}-${entry.seasonWeek}-${entry.dayOfWeek}`;
      const value = metricType === 'primary' ? entry.cumulativeFp : entry.cumulativePrmr;
      map.set(key, value);
    });
    return map;
  }, [historicalData, metricType]);

  // Group data by day/week/month
  const groupedData = () => {
    if (groupBy === 'day') {
      return cumulativeData.map((point, idx) => {
        const pacePoint = goalPaceData?.pacePoints[idx];
        const inRange = isInHighlightRange(point.date);
        const cumValue = metricType === 'primary' 
          ? point.cumulative 
          : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr);
        
        // Get matching historical value by season week + day
        const seasonInfo = getSeasonInfo(parseLocalDate(point.date));
        let historicalCumulative: number | undefined;
        if (showHistoricalLine && seasonInfo && historicalMap.size > 0) {
          const key = `${seasonInfo.type}-${seasonInfo.week}-${seasonInfo.dayOfWeek}`;
          historicalCumulative = historicalMap.get(key);
        }
        
        return {
          date: point.date,
          displayDate: format(parseISO(point.date), "MMM d"),
          cumulative: cumValue,
          highlightCumulative: inRange ? cumValue : undefined,
          inHighlightRange: inRange,
          preseasonPace: pacePoint?.preseasonPace,
          mustDoPace: pacePoint?.mustDoPace,
          willDoPace: pacePoint?.willDoPace,
          couldDoPace: pacePoint?.couldDoPace,
          historicalCumulative,
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
      const inRange = isInHighlightRange(point.date);
      const cumValue = metricType === 'primary' 
        ? point.cumulative 
        : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr);
      
      // Get matching historical value
      const seasonInfo = getSeasonInfo(parseLocalDate(point.date));
      let historicalCumulative: number | undefined;
      if (showHistoricalLine && seasonInfo && historicalMap.size > 0) {
        const histKey = `${seasonInfo.type}-${seasonInfo.week}-${seasonInfo.dayOfWeek}`;
        historicalCumulative = historicalMap.get(histKey);
      }
      
      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          displayDate: groupBy === 'week' 
            ? format(parseISO(key), "MMM d")
            : format(parseISO(key), "MMM"),
          cumulative: cumValue,
          highlightCumulative: inRange ? cumValue : undefined,
          inHighlightRange: inRange,
          preseasonPace: pacePoint?.preseasonPace,
          mustDoPace: pacePoint?.mustDoPace,
          willDoPace: pacePoint?.willDoPace,
          couldDoPace: pacePoint?.couldDoPace,
          historicalCumulative,
        };
      } else {
        grouped[key].cumulative = cumValue;
        // Mark as in range if any day in the group is in range
        if (inRange) {
          grouped[key].highlightCumulative = cumValue;
          grouped[key].inHighlightRange = true;
        }
        // Keep the latest pace values for the group
        if (pacePoint?.preseasonPace !== undefined) grouped[key].preseasonPace = pacePoint.preseasonPace;
        if (pacePoint?.mustDoPace !== undefined) grouped[key].mustDoPace = pacePoint.mustDoPace;
        if (pacePoint?.willDoPace !== undefined) grouped[key].willDoPace = pacePoint.willDoPace;
        if (pacePoint?.couldDoPace !== undefined) grouped[key].couldDoPace = pacePoint.couldDoPace;
        // Keep the latest historical value for the group
        if (historicalCumulative !== undefined) grouped[key].historicalCumulative = historicalCumulative;
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
            <span className="text-muted-foreground">{new Date().getFullYear()} {currentMetricLabel}:</span>
            <span className="font-semibold" style={{ color: chartConfig.cumulative.color }}>
              {metricType === 'secondary' && !efpModeEnabled
                ? `$${data.cumulative.toFixed(0)}`
                : (efpModeEnabled && metricType === 'primary')
                  ? data.cumulative.toFixed(2)
                  : data.cumulative.toFixed(1)}
            </span>
          </div>
          {showHistoricalLine && data.historicalCumulative != null && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{comparisonYear} {currentMetricLabel}:</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {metricType === 'secondary' && !efpModeEnabled
                  ? `$${data.historicalCumulative.toFixed(0)}`
                  : (efpModeEnabled && metricType === 'primary')
                    ? data.historicalCumulative.toFixed(2)
                    : data.historicalCumulative.toFixed(1)}
              </span>
            </div>
          )}
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

                {/* Historical Line Toggle */}
                {hasHistoricalData && (
                  <Button
                    variant={showHistoricalLine ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowHistoricalLine(!showHistoricalLine)}
                    className="text-xs h-7 px-2 gap-1"
                  >
                    <History className="w-3 h-3" />
                    {comparisonYear}
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
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="highlightGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                strokeOpacity={0.4}
                fill="url(#cumulativeGradient)"
                dot={false}
                activeDot={{ r: 6 }}
                animationDuration={800}
                animationEasing="ease-out"
              />
              
              {/* Highlighted date range overlay */}
              {highlightDateRange && (
                <Area
                  type="monotone"
                  dataKey="highlightCumulative"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  fill="url(#highlightGradient)"
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  activeDot={{ r: 6 }}
                  animationDuration={800}
                  animationEasing="ease-out"
                  connectNulls={false}
                />
              )}
              
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
              
              {/* Historical Pace Line */}
              {showHistoricalLine && (
                <Line
                  type="monotone"
                  dataKey="historicalCumulative"
                  stroke="hsl(38, 92%, 50%)"
                  strokeWidth={2}
                  strokeOpacity={0.8}
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
              <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground flex-wrap">
                {highlightDateRange && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 rounded bg-muted-foreground/40" />
                      All Time
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 rounded bg-primary" />
                      Selected Period
                    </span>
                  </>
                )}
                {!highlightDateRange && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 rounded bg-primary" />
                    {new Date().getFullYear()} Actual
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 rounded bg-muted-foreground border-dashed" style={{ borderBottom: '1.5px dashed' }} />
                  {getGoalLineLabel()} Pace
                </span>
                {showHistoricalLine && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 rounded" style={{ backgroundColor: 'hsl(38, 92%, 50%)' }} />
                    {comparisonYear} Actual
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Legend when only highlight is shown (no goal line) */}
          {highlightDateRange && !(canShowGoalLine && showGoalLine) && (
            <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground pt-2 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 rounded bg-muted-foreground/40" />
                All Time
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 rounded bg-primary" />
                Selected Period
              </span>
              {showHistoricalLine && (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 rounded" style={{ backgroundColor: 'hsl(38, 92%, 50%)' }} />
                  {comparisonYear} Actual
                </span>
              )}
            </div>
          )}
          
          {/* Legend when only historical line is shown (no goal line, no highlight) */}
          {showHistoricalLine && !(canShowGoalLine && showGoalLine) && !highlightDateRange && (
            <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground pt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 rounded bg-primary" />
                {new Date().getFullYear()} Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 rounded" style={{ backgroundColor: 'hsl(38, 92%, 50%)' }} />
                {comparisonYear} Actual
              </span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Card>
    </Collapsible>
  );
};
