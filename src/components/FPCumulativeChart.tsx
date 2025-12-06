import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { useCumulativeFP, CumulativeDataPoint } from "@/hooks/useCumulativeFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type GroupBy = 'day' | 'week' | 'month';
type MetricType = 'primary' | 'secondary'; // primary = FP+ or EFP, secondary = PRMR or FP+

interface FPCumulativeChartProps {
  teamData?: CumulativeDataPoint[];
  isTeamLoading?: boolean;
}

export const FPCumulativeChart = ({ teamData, isTeamLoading }: FPCumulativeChartProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [metricType, setMetricType] = useState<MetricType>('primary');
  const { data: personalData, isLoading: personalLoading } = useCumulativeFP();
  const { efpModeEnabled } = useEfpMode();

  // Use team data if provided, otherwise use personal data
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
      return cumulativeData.map((point) => ({
        date: point.date,
        displayDate: format(parseISO(point.date), "MMM d"),
        cumulative: metricType === 'primary' 
          ? point.cumulative 
          : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr),
      }));
    }

    // Group by week or month
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
            ? format(parseISO(key), "MMM d")
            : format(parseISO(key), "MMM"),
          cumulative: metricType === 'primary' 
            ? point.cumulative 
            : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr),
        };
      } else {
        grouped[key].cumulative = metricType === 'primary' 
          ? point.cumulative 
          : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr);
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

  const chartConfig = {
    cumulative: {
      label: `Total ${currentMetricLabel}`,
      color: "hsl(var(--primary))",
    },
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-sm mb-2">
          {format(parseISO(data.date), "MMM d, yyyy")}
        </p>
        <div className="text-xs">
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
        </div>
      </div>
    );
  };

  const totalForMode = metricType === 'primary' 
    ? cumulativeData[cumulativeData.length - 1].cumulative  // EFP or FP+ depending on mode
    : (efpModeEnabled
        ? cumulativeData[cumulativeData.length - 1].cumulativeFp  // FP+ when in EFP mode secondary
        : cumulativeData[cumulativeData.length - 1].cumulativePrmr);  // PRMR when in FP+ mode secondary

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

              </div>

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
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
            </AreaChart>
          </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CollapsibleContent>
    </Card>
    </Collapsible>
  );
};
