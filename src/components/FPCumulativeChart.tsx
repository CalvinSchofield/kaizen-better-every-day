import { useState, useMemo, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ComposedChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { format, parseISO, startOfWeek, startOfMonth, isBefore, isAfter } from "date-fns";
import { useCumulativeFP, CumulativeDataPoint } from "@/hooks/useCumulativeFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useMeVsMe } from "@/hooks/useMeVsMe";
import { useHistoricalCumulativeData } from "@/hooks/useHistoricalComparison";
import { getSeasonInfo } from "@/utils/seasonWeekUtils";
import { TrendingUp, TrendingDown, ChevronDown, Settings2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from "@/components/ui/carousel";
import { motion, AnimatePresence } from "framer-motion";

type GroupBy = 'day' | 'week' | 'month';
type MetricType = 'primary' | 'secondary';
type GoalLineType = 'preseason' | 'mustDo' | 'willDo' | 'couldDo';

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
  const [showOptions, setShowOptions] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  
  const { data: personalData, isLoading: personalLoading } = useCumulativeFP();
  const { efpModeEnabled } = useEfpMode();
  const { goals } = useRepGoals();
  const { plannedDays } = usePlannedDays();
  const { isEnabled: meVsMeEnabled, dataSummary } = useMeVsMe();
  
  const comparisonYear = 2025;
  const { data: historicalData } = useHistoricalCumulativeData(
    comparisonYear, 
    meVsMeEnabled && showHistoricalLine
  );
  
  const hasHistoricalData = meVsMeEnabled && (dataSummary?.totalDays || 0) > 0;
  const cumulativeData = teamData || personalData;
  const isLoading = isTeamLoading !== undefined ? isTeamLoading : personalLoading;

  const today = getLocalToday();
  const summerStart = parseLocalDate(SUMMER_START);
  const isPreseason = isBefore(today, summerStart);
  const isSummer = !isPreseason;

  // Handle carousel slide change
  const handleSlideChange = useCallback(() => {
    if (!carouselApi) return;
    const index = carouselApi.selectedScrollSnap();
    const views: GroupBy[] = ['day', 'week', 'month'];
    setGroupBy(views[index] || 'day');
  }, [carouselApi]);

  // Set up carousel event listener
  useEffect(() => {
    if (!carouselApi) return;
    carouselApi.on('select', handleSlideChange);
    return () => {
      carouselApi.off('select', handleSlideChange);
    };
  }, [carouselApi, handleSlideChange]);

  // Goal pace calculation
  const goalPaceData = useMemo(() => {
    if (!goals || !cumulativeData || cumulativeData.length === 0) return null;

    const preseasonGoalRaw = goals.preseason_fp_goal || 0;
    const mustDoGoalRaw = goals.must_do_fp_goal || 0;
    const willDoGoalRaw = goals.will_do_fp_goal || 0;
    const couldDoGoalRaw = goals.could_do_fp_goal || 0;
    
    const cancelRate = goals.cancel_rate || 0;
    const cancelMultiplier = cancelRate > 0 && cancelRate < 1 ? 1 / (1 - cancelRate) : 1;
    
    const fundedPreseasonGoal = preseasonGoalRaw * cancelMultiplier;
    const fundedMustDoGoal = mustDoGoalRaw * cancelMultiplier;
    const fundedWillDoGoal = willDoGoalRaw * cancelMultiplier;
    const fundedCouldDoGoal = couldDoGoalRaw * cancelMultiplier;

    const plannedDatesSet = new Set(plannedDays?.map(p => p.planned_date) || []);
    const workedDatesSet = new Set(cumulativeData.map(d => d.date));
    const todayStr = format(today, 'yyyy-MM-dd');
    
    const preseasonStartDate = parseLocalDate(PRESEASON_START);
    const preseasonEndDate = parseLocalDate(PRESEASON_END);
    const summerEndDate = parseLocalDate(SUMMER_END);
    
    let futurePreseasonPlannedCount = 0;
    let futureSummerPlannedCount = 0;
    
    plannedDays?.forEach(p => {
      if (workedDatesSet.has(p.planned_date) || p.planned_date <= todayStr) return;
      const pDate = parseLocalDate(p.planned_date);
      if (!isBefore(pDate, preseasonStartDate) && !isAfter(pDate, preseasonEndDate)) {
        futurePreseasonPlannedCount++;
      }
      if (!isBefore(pDate, summerStart) && !isAfter(pDate, summerEndDate)) {
        futureSummerPlannedCount++;
      }
    });

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

    const totalPreseasonDays = preseasonKnockingDays + futurePreseasonPlannedCount;
    const totalSummerDays = summerKnockingDays + futureSummerPlannedCount;

    const preseasonDailyPace = totalPreseasonDays > 0 ? fundedPreseasonGoal / totalPreseasonDays : 0;
    const mustDoDailyPace = totalSummerDays > 0 ? fundedMustDoGoal / totalSummerDays : 0;
    const willDoDailyPace = totalSummerDays > 0 ? fundedWillDoGoal / totalSummerDays : 0;
    const couldDoDailyPace = totalSummerDays > 0 ? fundedCouldDoGoal / totalSummerDays : 0;

    let preseasonKnockingCount = 0;
    let summerKnockingCount = 0;
    
    const pacePoints = cumulativeData.map((point) => {
      const pointDate = parseLocalDate(point.date);
      const isInPreseason = !isBefore(pointDate, preseasonStartDate) && !isAfter(pointDate, preseasonEndDate);
      const isInSummer = !isBefore(pointDate, summerStart);

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
    };
  }, [goals, cumulativeData, plannedDays, today, summerStart]);

  // Historical data map
  const historicalByDayNumber = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return new Map<number, number>();
    const map = new Map<number, number>();
    historicalData.forEach(entry => {
      const dayNumber = (entry.seasonWeek - 1) * 7 + entry.dayOfWeek;
      const value = metricType === 'primary' ? entry.cumulativeFp : entry.cumulativePrmr;
      map.set(dayNumber, value);
    });
    return map;
  }, [historicalData, metricType]);

  const getHistoricalCumulativeForDay = (dayNumber: number): number | undefined => {
    if (historicalByDayNumber.size === 0) return undefined;
    if (historicalByDayNumber.has(dayNumber)) return historicalByDayNumber.get(dayNumber);
    for (let d = dayNumber - 1; d >= 0; d--) {
      if (historicalByDayNumber.has(d)) return historicalByDayNumber.get(d);
    }
    return undefined;
  };

  const hasEnoughForWeek = (cumulativeData?.length || 0) >= 7;
  const hasEnoughForMonth = (cumulativeData?.length || 0) >= 14;
  const primaryLabel = efpModeEnabled ? "EFP" : "FP+";
  const secondaryLabel = efpModeEnabled ? "FP+" : "PRMR";

  const isInHighlightRange = (dateStr: string): boolean => {
    if (!highlightDateRange) return false;
    const date = parseLocalDate(dateStr);
    const start = new Date(highlightDateRange.start.getFullYear(), highlightDateRange.start.getMonth(), highlightDateRange.start.getDate());
    const end = new Date(highlightDateRange.end.getFullYear(), highlightDateRange.end.getMonth(), highlightDateRange.end.getDate());
    return !isBefore(date, start) && !isAfter(date, end);
  };

  // Rolling averages calculation
  const rollingAverages = useMemo(() => {
    if (!cumulativeData || cumulativeData.length === 0) return null;
    
    const knockingDays = cumulativeData.filter(d => d.isKnockingDay);
    if (knockingDays.length < 2) return null;
    
    const dailyValues = knockingDays.map((d, i) => {
      const prevCumulative = i > 0 ? knockingDays[i - 1].cumulative : 0;
      return metricType === 'primary' 
        ? d.cumulative - prevCumulative
        : (efpModeEnabled 
            ? (d.cumulativeFp ?? 0) - (knockingDays[i - 1]?.cumulativeFp ?? 0)
            : (d.cumulativePrmr ?? 0) - (knockingDays[i - 1]?.cumulativePrmr ?? 0));
    });
    
    const last12Days = dailyValues.slice(-12);
    const avg12Day = last12Days.length > 0 ? last12Days.reduce((sum, v) => sum + v, 0) / last12Days.length : 0;
    
    let dailyGoalPace = 0;
    if (goalPaceData) {
      if (isPreseason) {
        dailyGoalPace = goalPaceData.preseasonDailyPace || 0;
      } else {
        if (selectedGoalLine === 'mustDo') dailyGoalPace = goalPaceData.mustDoDailyPace || 0;
        else if (selectedGoalLine === 'willDo') dailyGoalPace = goalPaceData.willDoDailyPace || 0;
        else if (selectedGoalLine === 'couldDo') dailyGoalPace = goalPaceData.couldDoDailyPace || 0;
        else dailyGoalPace = goalPaceData.preseasonDailyPace || 0;
      }
    }
    
    return { avg12Day, dailyGoalPace };
  }, [cumulativeData, metricType, efpModeEnabled, goalPaceData, isPreseason, selectedGoalLine]);

  const isInHighlightRangeMemo = useCallback((dateStr: string): boolean => {
    if (!highlightDateRange) return false;
    const date = parseLocalDate(dateStr);
    const start = new Date(highlightDateRange.start.getFullYear(), highlightDateRange.start.getMonth(), highlightDateRange.start.getDate());
    const end = new Date(highlightDateRange.end.getFullYear(), highlightDateRange.end.getMonth(), highlightDateRange.end.getDate());
    return !isBefore(date, start) && !isAfter(date, end);
  }, [highlightDateRange]);

  // Chart data grouping - now takes groupBy as parameter for per-view computation
  const getGroupedData = useCallback((viewGroupBy: GroupBy) => {
    if (!cumulativeData) return [];
    
    if (viewGroupBy === 'day') {
      return cumulativeData.map((point, idx) => {
        const pacePoint = goalPaceData?.pacePoints[idx];
        const inRange = isInHighlightRangeMemo(point.date);
        const cumValue = metricType === 'primary' 
          ? point.cumulative 
          : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr);
        
        const seasonInfo = getSeasonInfo(parseLocalDate(point.date));
        let historicalCumulative: number | undefined;
        if (showHistoricalLine && seasonInfo && historicalByDayNumber.size > 0) {
          const dayNumber = (seasonInfo.week - 1) * 7 + seasonInfo.dayOfWeek;
          historicalCumulative = getHistoricalCumulativeForDay(dayNumber);
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

    const grouped: Record<string, any> = {};
    cumulativeData.forEach((point, idx) => {
      const date = parseISO(point.date);
      const key = viewGroupBy === 'week' 
        ? format(startOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd')
        : format(startOfMonth(date), 'yyyy-MM-dd');
      
      const pacePoint = goalPaceData?.pacePoints[idx];
      const inRange = isInHighlightRangeMemo(point.date);
      const cumValue = metricType === 'primary' 
        ? point.cumulative 
        : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr);
      
      const seasonInfo = getSeasonInfo(parseLocalDate(point.date));
      let historicalCumulative: number | undefined;
      if (showHistoricalLine && seasonInfo && historicalByDayNumber.size > 0) {
        const dayNumber = (seasonInfo.week - 1) * 7 + seasonInfo.dayOfWeek;
        historicalCumulative = getHistoricalCumulativeForDay(dayNumber);
      }
      
      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          displayDate: viewGroupBy === 'week' ? format(parseISO(key), "MMM d") : format(parseISO(key), "MMM"),
          cumulative: cumValue,
          highlightCumulative: inRange ? cumValue : undefined,
          preseasonPace: pacePoint?.preseasonPace,
          mustDoPace: pacePoint?.mustDoPace,
          willDoPace: pacePoint?.willDoPace,
          couldDoPace: pacePoint?.couldDoPace,
          historicalCumulative,
        };
      } else {
        grouped[key].cumulative = cumValue;
        if (inRange) grouped[key].highlightCumulative = cumValue;
        if (pacePoint?.preseasonPace !== undefined) grouped[key].preseasonPace = pacePoint.preseasonPace;
        if (pacePoint?.mustDoPace !== undefined) grouped[key].mustDoPace = pacePoint.mustDoPace;
        if (pacePoint?.willDoPace !== undefined) grouped[key].willDoPace = pacePoint.willDoPace;
        if (pacePoint?.couldDoPace !== undefined) grouped[key].couldDoPace = pacePoint.couldDoPace;
        if (historicalCumulative !== undefined) grouped[key].historicalCumulative = historicalCumulative;
      }
    });

    return Object.values(grouped);
  }, [cumulativeData, goalPaceData, metricType, efpModeEnabled, showHistoricalLine, historicalByDayNumber, isInHighlightRangeMemo]);

  // Compute chart data for each view
  const dayChartData = useMemo(() => getGroupedData('day'), [getGroupedData]);
  const weekChartData = useMemo(() => getGroupedData('week'), [getGroupedData]);
  const monthChartData = useMemo(() => getGroupedData('month'), [getGroupedData]);

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Progress Over Time</h2>
        </div>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Loading...
        </div>
      </Card>
    );
  }

  if (!cumulativeData || cumulativeData.length === 0) return null;

  // For current view state (used for hero display)
  const chartData = groupBy === 'day' ? dayChartData : groupBy === 'week' ? weekChartData : monthChartData;
  const totalForMode = metricType === 'primary' 
    ? cumulativeData[cumulativeData.length - 1].cumulative
    : (efpModeEnabled ? cumulativeData[cumulativeData.length - 1].cumulativeFp : cumulativeData[cumulativeData.length - 1].cumulativePrmr);

  const hasPreseasonGoal = (goals?.preseason_fp_goal || 0) > 0;
  const hasSummerGoals = (goals?.must_do_fp_goal || 0) > 0;
  const canShowGoalLine = metricType === 'primary' && (hasPreseasonGoal || hasSummerGoals);

  const getGoalLineKey = (): string => {
    if (isPreseason || selectedGoalLine === 'preseason') return 'preseasonPace';
    if (selectedGoalLine === 'mustDo') return 'mustDoPace';
    if (selectedGoalLine === 'willDo') return 'willDoPace';
    if (selectedGoalLine === 'couldDo') return 'couldDoPace';
    return 'preseasonPace';
  };

  const chartConfig = {
    cumulative: { label: `Total ${primaryLabel}`, color: "hsl(var(--primary))" },
    goalPace: { label: "Goal", color: "hsl(var(--muted-foreground))" },
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;
    const goalLineKey = getGoalLineKey();
    const goalPaceValue = data[goalLineKey];
    
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-sm mb-2">{format(parseISO(data.date), "MMM d, yyyy")}</p>
        <div className="text-xs space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{primaryLabel}:</span>
            <span className="font-semibold" style={{ color: chartConfig.cumulative.color }}>
              {efpModeEnabled && metricType === 'primary' ? data.cumulative.toFixed(2) : data.cumulative.toFixed(1)}
            </span>
          </div>
          {showHistoricalLine && data.historicalCumulative != null && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{comparisonYear}:</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {efpModeEnabled && metricType === 'primary' ? data.historicalCumulative.toFixed(2) : data.historicalCumulative.toFixed(1)}
              </span>
            </div>
          )}
          {showGoalLine && goalPaceValue != null && metricType === 'primary' && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Goal Pace:</span>
              <span className="font-medium text-muted-foreground">
                {efpModeEnabled ? goalPaceValue.toFixed(2) : goalPaceValue.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Determine if above/below goal (using 12-day rolling average)
  const isAboveGoal = rollingAverages && rollingAverages.dailyGoalPace > 0 
    ? rollingAverages.avg12Day >= rollingAverages.dailyGoalPace 
    : true;

  const paceGap = rollingAverages && rollingAverages.dailyGoalPace > 0
    ? Math.abs(rollingAverages.avg12Day - rollingAverages.dailyGoalPace)
    : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <div className="p-4">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Progress Over Time</h2>
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform text-muted-foreground ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            {/* Hero Section */}
            <div className="mt-4 text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={totalForMode}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-4xl font-bold">
                    {metricType === 'primary' 
                      ? (efpModeEnabled ? totalForMode.toFixed(2) : totalForMode.toFixed(1))
                      : (efpModeEnabled ? totalForMode.toFixed(1) : `$${totalForMode.toFixed(0)}`)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {metricType === 'primary' ? primaryLabel : secondaryLabel}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Summary Line - 12 working day rolling average */}
              {rollingAverages && metricType === 'primary' && rollingAverages.dailyGoalPace > 0 && (
                <div className={`mt-2 text-sm font-medium flex items-center justify-center gap-1.5 ${isAboveGoal ? 'text-success' : 'text-destructive'}`}>
                  {isAboveGoal ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span>
                    {efpModeEnabled ? rollingAverages.avg12Day.toFixed(2) : rollingAverages.avg12Day.toFixed(1)}/day (12-day avg)
                  </span>
                  {/* Only show gap when behind, not when ahead */}
                  {!isAboveGoal && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span>
                        {efpModeEnabled ? paceGap.toFixed(2) : paceGap.toFixed(1)} below goal
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>

        <CollapsibleContent>
          {/* Chart with Swipe Navigation */}
          <div className="px-4 pb-2">
            <Carousel
              setApi={setCarouselApi}
              opts={{ startIndex: groupBy === 'day' ? 0 : groupBy === 'week' ? 1 : 2 }}
              className="w-full"
            >
              <CarouselContent>
                {/* Day View */}
                <CarouselItem>
                  <ChartView
                    chartData={dayChartData}
                    chartConfig={chartConfig}
                    CustomTooltip={CustomTooltip}
                    canShowGoalLine={canShowGoalLine}
                    showGoalLine={showGoalLine}
                    getGoalLineKey={getGoalLineKey}
                    showHistoricalLine={showHistoricalLine}
                    highlightDateRange={highlightDateRange}
                  />
                </CarouselItem>
                {/* Week View */}
                {hasEnoughForWeek && (
                  <CarouselItem>
                    <ChartView
                      chartData={weekChartData}
                      chartConfig={chartConfig}
                      CustomTooltip={CustomTooltip}
                      canShowGoalLine={canShowGoalLine}
                      showGoalLine={showGoalLine}
                      getGoalLineKey={getGoalLineKey}
                      showHistoricalLine={showHistoricalLine}
                      highlightDateRange={highlightDateRange}
                    />
                  </CarouselItem>
                )}
                {/* Month View */}
                {hasEnoughForMonth && (
                  <CarouselItem>
                    <ChartView
                      chartData={monthChartData}
                      chartConfig={chartConfig}
                      CustomTooltip={CustomTooltip}
                      canShowGoalLine={canShowGoalLine}
                      showGoalLine={showGoalLine}
                      getGoalLineKey={getGoalLineKey}
                      showHistoricalLine={showHistoricalLine}
                      highlightDateRange={highlightDateRange}
                    />
                  </CarouselItem>
                )}
              </CarouselContent>
            </Carousel>

            {/* View Indicators */}
            <div className="flex items-center justify-center gap-2 mt-3">
              {(['day', 'week', 'month'] as const).filter((v, i) => 
                i === 0 || (i === 1 && hasEnoughForWeek) || (i === 2 && hasEnoughForMonth)
              ).map((view) => (
                <button
                  key={view}
                  onClick={() => {
                    setGroupBy(view);
                    const idx = view === 'day' ? 0 : view === 'week' ? 1 : 2;
                    carouselApi?.scrollTo(idx);
                  }}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    groupBy === view 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Collapsible Options */}
          <div className="px-4 pb-4">
            <Collapsible open={showOptions} onOpenChange={setShowOptions}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground gap-2">
                  <Settings2 className="w-4 h-4" />
                  Options
                  <ChevronDown className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-3 space-y-3">
                  {/* Metric Toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Metric:</span>
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
                  </div>

                  {/* Goal Toggle */}
                  {canShowGoalLine && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Goal Line:</span>
                      <Button
                        variant={showGoalLine ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowGoalLine(!showGoalLine)}
                        className="text-xs h-7 px-2"
                      >
                        {showGoalLine ? 'On' : 'Off'}
                      </Button>
                    </div>
                  )}

                  {/* Summer Goal Selector */}
                  {canShowGoalLine && showGoalLine && isSummer && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Goal:</span>
                      <div className="flex items-center gap-1 border border-border rounded-lg p-1">
                        {(['mustDo', 'willDo', 'couldDo'] as const).map((tier) => (
                          <Button
                            key={tier}
                            variant={selectedGoalLine === tier ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setSelectedGoalLine(tier)}
                            className="text-xs h-6 px-2"
                          >
                            {tier === 'mustDo' ? 'Must' : tier === 'willDo' ? 'Will' : 'Could'}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Historical Toggle */}
                  {hasHistoricalData && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{comparisonYear} Data:</span>
                      <Button
                        variant={showHistoricalLine ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowHistoricalLine(!showHistoricalLine)}
                        className="text-xs h-7 px-2"
                      >
                        {showHistoricalLine ? 'Showing' : 'Hidden'}
                      </Button>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

// Chart View Component
interface ChartViewProps {
  chartData: any[];
  chartConfig: any;
  CustomTooltip: React.ComponentType<any>;
  canShowGoalLine: boolean;
  showGoalLine: boolean;
  getGoalLineKey: () => string;
  showHistoricalLine: boolean;
  highlightDateRange?: { start: Date; end: Date };
}

const ChartView = ({
  chartData,
  chartConfig,
  CustomTooltip,
  canShowGoalLine,
  showGoalLine,
  getGoalLineKey,
  showHistoricalLine,
  highlightDateRange,
}: ChartViewProps) => (
  <ChartContainer config={chartConfig} className="h-56 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <XAxis
          dataKey="displayDate"
          tick={{ fontSize: 10 }}
          tickMargin={8}
          stroke="hsl(var(--muted-foreground))"
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip content={<CustomTooltip />} />
        <defs>
          <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="highlightGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.6} />
            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.15} />
          </linearGradient>
        </defs>
        
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#cumulativeGradient)"
          dot={false}
          activeDot={{ r: 6 }}
          animationDuration={600}
        />
        
        {highlightDateRange && (
          <Area
            type="monotone"
            dataKey="highlightCumulative"
            stroke="hsl(var(--success))"
            strokeWidth={3}
            fill="url(#highlightGradient)"
            dot={{ fill: "hsl(var(--success))", r: 4 }}
            activeDot={{ r: 6, fill: "hsl(var(--success))" }}
            connectNulls={false}
          />
        )}
        
        {canShowGoalLine && showGoalLine && (
          <Line
            type="linear"
            dataKey={getGoalLineKey()}
            stroke="hsl(var(--foreground))"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls={true}
            animationDuration={600}
          />
        )}
        
        {showHistoricalLine && (
          <Line
            type="monotone"
            dataKey="historicalCumulative"
            stroke="hsl(38, 92%, 50%)"
            strokeWidth={2}
            strokeOpacity={0.8}
            dot={false}
            connectNulls={true}
            animationDuration={600}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  </ChartContainer>
);
