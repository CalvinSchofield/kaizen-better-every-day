import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { useCumulativeFP, CumulativeDataPoint } from "@/hooks/useCumulativeFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { GroupedCumulativeData } from "@/hooks/useTeamCumulativeFP";

type GroupBy = 'day' | 'week' | 'month';
type MetricType = 'primary' | 'secondary';
type GroupViewMode = 'all' | 'mgmt-groups' | 'teams' | 'individuals';

interface FPCumulativeChartProps {
  teamData?: CumulativeDataPoint[];
  isTeamLoading?: boolean;
  groupViewMode?: GroupViewMode;
  groupedCumulativeData?: GroupedCumulativeData | null;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export const FPCumulativeChart = ({ 
  teamData, 
  isTeamLoading, 
  groupViewMode = "all", 
  groupedCumulativeData
}: FPCumulativeChartProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [movingAvgPeriod, setMovingAvgPeriod] = useState<6 | 12>(6);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [metricType, setMetricType] = useState<MetricType>('primary');
  const { data: personalData, isLoading: personalLoading } = useCumulativeFP();
  const { efpModeEnabled } = useEfpMode();

  const cumulativeData = teamData || personalData;
  const isLoading = isTeamLoading !== undefined ? isTeamLoading : personalLoading;

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

  const hasEnoughForWeek = cumulativeData.length >= 7;
  const hasEnoughForMonth = cumulativeData.length >= 14;

  const primaryLabel = efpModeEnabled ? "EFP" : "FP+";
  const secondaryLabel = efpModeEnabled ? "FP+" : "PRMR";
  const currentMetricLabel = metricType === 'primary' ? primaryLabel : secondaryLabel;

  // Prepare grouped chart data when in grouped mode
  const prepareGroupedChartData = () => {
    if (groupViewMode === "all" || !groupedCumulativeData) return null;
    
    const allDates = new Set<string>();
    Object.values(groupedCumulativeData).forEach(groupData => {
      groupData.forEach(point => allDates.add(point.date));
    });

    const chartData = Array.from(allDates).sort().map(date => {
      const dataPoint: any = { date, displayDate: format(parseISO(date), "MMM d") };
      
      Object.entries(groupedCumulativeData).forEach(([groupName, groupData]) => {
        const point = groupData.find(p => p.date === date);
        if (point) {
          dataPoint[`${groupName}_cumulative`] = point.cumulative;
        }
      });
      
      return dataPoint;
    });

    return {
      data: chartData,
      groups: Object.keys(groupedCumulativeData)
    };
  };

  const groupedChartData = prepareGroupedChartData();

  // Group regular data by day/week/month
  const processedData = () => {
    if (groupBy === 'day') {
      return cumulativeData.map((point) => ({
        date: point.date,
        displayDate: format(parseISO(point.date), "MMM d"),
        cumulative: metricType === 'primary' 
          ? point.cumulative 
          : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr),
        movingAvg: metricType === 'primary' 
          ? (movingAvgPeriod === 6 ? point.movingAvg6 : point.movingAvg12)
          : (efpModeEnabled 
              ? (movingAvgPeriod === 6 ? point.movingAvgFp6 : point.movingAvgFp12)
              : (movingAvgPeriod === 6 ? point.movingAvgPrmr6 : point.movingAvgPrmr12)),
        dailyValue: metricType === 'primary' 
          ? point.dailyValue 
          : (efpModeEnabled ? point.dailyFp : point.dailyPrmr),
      }));
    }

    const grouped: Record<string, any> = {};
    cumulativeData.forEach((point) => {
      const date = parseISO(point.date);
      const key = groupBy === 'week' 
        ? format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        : format(startOfMonth(date), 'yyyy-MM-dd');
      
      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          displayDate: groupBy === 'week' 
            ? `Week of ${format(parseISO(key), "MMM d")}`
            : format(parseISO(key), "MMM yyyy"),
          cumulative: 0,
          count: 0,
        };
      }
      
      grouped[key].cumulative = metricType === 'primary' 
        ? point.cumulative 
        : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr);
      grouped[key].count += 1;
    });

    return Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date));
  };

  const chartData = processedData();
  const latestData = chartData[chartData.length - 1];
  const previousData = chartData[chartData.length - 2];

  const calculateComparison = () => {
    if (!latestData || !previousData) return null;
    
    const change = latestData.cumulative - previousData.cumulative;
    const percentChange = previousData.cumulative > 0 
      ? ((change / previousData.cumulative) * 100) 
      : 0;
    
    return { change, percentChange };
  };

  const comparison = calculateComparison();

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-popover p-3 rounded-lg border shadow-lg">
        <p className="text-sm font-medium">{payload[0]?.payload?.displayDate}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toFixed(1)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                <CardTitle>Progress Over Time</CardTitle>
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {!isOpen && comparison && (
              <div className="flex items-center gap-2 mt-2 text-left">
                <span className="text-2xl font-bold text-primary">
                  {latestData.cumulative.toFixed(1)} {currentMetricLabel}
                </span>
                <div className={`flex items-center gap-1 text-sm ${comparison.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {comparison.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {Math.abs(comparison.percentChange).toFixed(1)}%
                </div>
              </div>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Controls */}
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1">
                <Button
                  variant={groupBy === 'day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGroupBy('day')}
                >
                  Day
                </Button>
                {hasEnoughForWeek && (
                  <Button
                    variant={groupBy === 'week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGroupBy('week')}
                  >
                    Week
                  </Button>
                )}
                {hasEnoughForMonth && (
                  <Button
                    variant={groupBy === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGroupBy('month')}
                  >
                    Month
                  </Button>
                )}
              </div>

              {groupViewMode === "all" && (
                <>
                  <div className="flex gap-1">
                    <Button
                      variant={metricType === 'primary' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMetricType('primary')}
                    >
                      {primaryLabel}
                    </Button>
                    <Button
                      variant={metricType === 'secondary' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMetricType('secondary')}
                    >
                      {secondaryLabel}
                    </Button>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant={movingAvgPeriod === 6 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMovingAvgPeriod(6)}
                    >
                      6-day Avg
                    </Button>
                    <Button
                      variant={movingAvgPeriod === 12 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMovingAvgPeriod(12)}
                    >
                      12-day Avg
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Comparison Stats */}
            {comparison && groupViewMode === "all" && (
              <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                <div>
                  <div className="text-3xl font-bold text-primary">
                    {latestData.cumulative.toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total {currentMetricLabel}
                  </div>
                </div>
                <div className={`flex items-center gap-2 text-lg font-semibold ${comparison.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {comparison.change >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  <div className="text-right">
                    <div>{comparison.change >= 0 ? '+' : ''}{comparison.change.toFixed(1)}</div>
                    <div className="text-sm">({Math.abs(comparison.percentChange).toFixed(1)}%)</div>
                  </div>
                </div>
              </div>
            )}

            {/* Chart */}
            <ResponsiveContainer width="100%" height={300}>
              {groupedChartData ? (
                <LineChart data={groupedChartData.data}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {groupedChartData.groups.map((groupName: string, index: number) => (
                    <Line
                      key={groupName}
                      type="monotone"
                      dataKey={`${groupName}_cumulative`}
                      name={groupName}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name={currentMetricLabel}
                    stroke={CHART_COLORS[0]}
                    strokeWidth={3}
                    dot={false}
                  />
                  {groupBy === 'day' && (
                    <Line
                      type="monotone"
                      dataKey="movingAvg"
                      name={`${movingAvgPeriod}-day Avg`}
                      stroke={CHART_COLORS[1]}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  )}
                </LineChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
