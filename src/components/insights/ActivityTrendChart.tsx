import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { format, parseISO } from 'date-fns';
import { GitCompare } from "lucide-react";

interface ActivityTrendChartProps {
  dailyTrend: Array<{
    date: string;
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    fp: number;
    efp: number;
    prmr: number;
    hoursWorked?: number;
  }>;
  efpModeEnabled?: boolean;
}

type MetricKey = 'doors' | 'pitches' | 'transitions' | 'presentations' | 'fp' | 'prmr' | 'hoursWorked';

export const ActivityTrendChart = ({ dailyTrend, efpModeEnabled = false }: ActivityTrendChartProps) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('doors');
  const [compareMode, setCompareMode] = useState(false);
  const [compareMetric, setCompareMetric] = useState<MetricKey>('fp');

  const metrics = [
    { key: 'doors' as MetricKey, label: 'Doors', color: 'hsl(var(--chart-1))' },
    { key: 'pitches' as MetricKey, label: 'Pitches', color: 'hsl(var(--chart-2))' },
    { key: 'transitions' as MetricKey, label: 'Transitions', color: 'hsl(var(--chart-3))' },
    { key: 'presentations' as MetricKey, label: 'Presentations', color: 'hsl(var(--chart-4))' },
    ...(efpModeEnabled 
      ? [
          { key: 'fp' as MetricKey, label: 'EFP', color: 'hsl(var(--primary))' },
          { key: 'prmr' as MetricKey, label: 'FP+', color: 'hsl(var(--chart-5))' },
        ]
      : [
          { key: 'fp' as MetricKey, label: 'FP+', color: 'hsl(var(--primary))' },
          { key: 'prmr' as MetricKey, label: 'PRMR', color: 'hsl(var(--chart-5))' },
        ]
    ),
    { key: 'hoursWorked' as MetricKey, label: 'Hours', color: 'hsl(var(--muted-foreground))' },
  ];

  const currentMetric = metrics.find(m => m.key === selectedMetric)!;
  const currentCompareMetric = metrics.find(m => m.key === compareMetric)!;

  const getMetricValue = (day: typeof dailyTrend[0], metric: MetricKey): number => {
    if (metric === 'fp' && efpModeEnabled) {
      return day.efp;
    } else if (metric === 'prmr' && efpModeEnabled) {
      return day.fp; // Show FP+ when PRMR key is selected in EFP mode
    } else if (metric === 'hoursWorked') {
      return day.hoursWorked ?? 0;
    } else {
      return day[metric as keyof typeof day] as number || 0;
    }
  };

  const chartData = dailyTrend.map(day => {
    return {
      ...day,
      displayValue: getMetricValue(day, selectedMetric),
      compareValue: compareMode ? getMetricValue(day, compareMetric) : undefined,
      displayDate: format(parseISO(day.date), 'MMM d'),
    };
  });

  const chartConfig = {
    displayValue: {
      label: currentMetric.label,
      color: currentMetric.color,
    },
    ...(compareMode && {
      compareValue: {
        label: currentCompareMetric.label,
        color: currentCompareMetric.color,
      },
    }),
  };

  const shouldShowDecimal = (metric: MetricKey) => 
    metric === 'fp' || metric === 'prmr' || metric === 'hoursWorked';

  const formatValue = (value: number, metric: MetricKey) => {
    if (shouldShowDecimal(metric)) {
      return value.toFixed(1);
    }
    return value.toFixed(0);
  };

  const calculateStats = (metric: MetricKey) => {
    const values = dailyTrend.map(d => getMetricValue(d, metric));
    const sum = values.reduce((s, v) => s + v, 0);
    const avg = dailyTrend.length > 0 ? sum / dailyTrend.length : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;
    return { sum, avg, max };
  };

  const primaryStats = calculateStats(selectedMetric);
  const compareStats = compareMode ? calculateStats(compareMetric) : null;

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header with Compare Toggle */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground">Activity Trends</h3>
          <Button
            variant={compareMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCompareMode(!compareMode)}
            className="gap-1.5"
          >
            <GitCompare className="w-3.5 h-3.5" />
            Compare
          </Button>
        </div>

        {/* Primary Metric Selector */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground font-medium">
            {compareMode ? 'Primary Metric' : 'Select Metric'}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {metrics.map(metric => (
              <Button
                key={metric.key}
                variant={selectedMetric === metric.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectedMetric(metric.key);
                  // If switching to same as compare, swap them
                  if (compareMode && metric.key === compareMetric) {
                    setCompareMetric(selectedMetric);
                  }
                }}
                className="whitespace-nowrap"
              >
                {metric.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Compare Metric Selector (only shown in compare mode) */}
        {compareMode && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium">Compare With</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {metrics.filter(m => m.key !== selectedMetric).map(metric => (
                <Button
                  key={metric.key}
                  variant={compareMetric === metric.key ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setCompareMetric(metric.key)}
                  className="whitespace-nowrap"
                  style={{
                    borderWidth: compareMetric === metric.key ? '2px' : '1px',
                    borderColor: compareMetric === metric.key ? metric.color : undefined,
                    borderStyle: 'dashed',
                  }}
                >
                  {metric.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Chart */}
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: compareMode ? 50 : 10, left: 0, bottom: 5 }}>
              <XAxis 
                dataKey="displayDate" 
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 12 }}
                tickMargin={8}
                stroke={currentMetric.color}
              />
              {compareMode && (
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickMargin={8}
                  stroke={currentCompareMetric.color}
                />
              )}
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value: any, name: string) => {
                  const metric = name === 'displayValue' ? selectedMetric : compareMetric;
                  const label = name === 'displayValue' ? currentMetric.label : currentCompareMetric.label;
                  return [
                    formatValue(Number(value), metric),
                    label
                  ];
                }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="displayValue"
                name="displayValue"
                stroke={currentMetric.color}
                strokeWidth={2}
                dot={{ fill: currentMetric.color, r: 4 }}
                activeDot={{ r: 6 }}
              />
              {compareMode && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="compareValue"
                  name="compareValue"
                  stroke={currentCompareMetric.color}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: currentCompareMetric.color, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Legend (only in compare mode) */}
        {compareMode && (
          <div className="flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div 
                className="w-6 h-0.5" 
                style={{ backgroundColor: currentMetric.color }}
              />
              <span className="text-muted-foreground">{currentMetric.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-6 h-0.5 border-t-2 border-dashed" 
                style={{ borderColor: currentCompareMetric.color }}
              />
              <span className="text-muted-foreground">{currentCompareMetric.label}</span>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className={`grid gap-2 text-xs ${compareMode ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {compareMode ? (
            <>
              {/* Primary metric stats */}
              <div className="p-3 rounded-lg bg-accent/30 space-y-2">
                <div className="font-medium text-center" style={{ color: currentMetric.color }}>
                  {currentMetric.label}
                </div>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <div className="text-muted-foreground text-[10px]">Total</div>
                    <div className="font-semibold">{formatValue(primaryStats.sum, selectedMetric)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10px]">Avg</div>
                    <div className="font-semibold">{formatValue(primaryStats.avg, selectedMetric)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10px]">Best</div>
                    <div className="font-semibold">{formatValue(primaryStats.max, selectedMetric)}</div>
                  </div>
                </div>
              </div>
              {/* Compare metric stats */}
              <div className="p-3 rounded-lg bg-accent/30 space-y-2">
                <div className="font-medium text-center" style={{ color: currentCompareMetric.color }}>
                  {currentCompareMetric.label}
                </div>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <div className="text-muted-foreground text-[10px]">Total</div>
                    <div className="font-semibold">{formatValue(compareStats!.sum, compareMetric)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10px]">Avg</div>
                    <div className="font-semibold">{formatValue(compareStats!.avg, compareMetric)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10px]">Best</div>
                    <div className="font-semibold">{formatValue(compareStats!.max, compareMetric)}</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 rounded-lg bg-accent/30 text-center">
                <div className="text-muted-foreground mb-1">Total</div>
                <div className="font-semibold">{formatValue(primaryStats.sum, selectedMetric)}</div>
              </div>
              <div className="p-2 rounded-lg bg-accent/30 text-center">
                <div className="text-muted-foreground mb-1">Avg/Day</div>
                <div className="font-semibold">{formatValue(primaryStats.avg, selectedMetric)}</div>
              </div>
              <div className="p-2 rounded-lg bg-accent/30 text-center">
                <div className="text-muted-foreground mb-1">Best Day</div>
                <div className="font-semibold">{formatValue(primaryStats.max, selectedMetric)}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};
