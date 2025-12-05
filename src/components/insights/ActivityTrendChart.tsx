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

  // Primary metric color (solid orange)
  const primaryColor = 'hsl(var(--primary))';
  // Comparison metric color (distinct teal/blue)
  const compareColor = '#0ea5e9'; // Sky blue for clear visual distinction

  const metrics = [
    { key: 'doors' as MetricKey, label: 'Doors' },
    { key: 'pitches' as MetricKey, label: 'Pitches' },
    { key: 'transitions' as MetricKey, label: 'Transitions' },
    { key: 'presentations' as MetricKey, label: 'Presentations' },
    ...(efpModeEnabled 
      ? [
          { key: 'fp' as MetricKey, label: 'EFP' },
          { key: 'prmr' as MetricKey, label: 'FP+' },
        ]
      : [
          { key: 'fp' as MetricKey, label: 'FP+' },
          { key: 'prmr' as MetricKey, label: 'PRMR' },
        ]
    ),
    { key: 'hoursWorked' as MetricKey, label: 'Hours' },
  ];

  const currentMetricConfig = metrics.find(m => m.key === selectedMetric)!;
  const currentCompareMetricConfig = metrics.find(m => m.key === compareMetric)!;

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
      label: currentMetricConfig.label,
      color: primaryColor,
    },
    ...(compareMode && {
      compareValue: {
        label: currentCompareMetricConfig.label,
        color: compareColor,
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

        {/* Metric Selectors - Horizontal with colored indicators */}
        <div className="flex gap-4 overflow-x-auto pb-1">
          {/* Primary Metric */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: primaryColor }} />
            <select
              value={selectedMetric}
              onChange={(e) => {
                const newMetric = e.target.value as MetricKey;
                setSelectedMetric(newMetric);
                if (compareMode && newMetric === compareMetric) {
                  setCompareMetric(selectedMetric);
                }
              }}
              className="text-sm font-medium bg-transparent border-none focus:outline-none cursor-pointer"
            >
              {metrics.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Compare Metric (only in compare mode) */}
          {compareMode && (
            <>
              <span className="text-muted-foreground text-sm">vs</span>
              <div className="flex items-center gap-2 min-w-0">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-dashed" 
                  style={{ borderColor: compareColor }} 
                />
                <select
                  value={compareMetric}
                  onChange={(e) => setCompareMetric(e.target.value as MetricKey)}
                  className="text-sm font-medium bg-transparent border-none focus:outline-none cursor-pointer"
                >
                  {metrics.filter(m => m.key !== selectedMetric).map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

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
                stroke={primaryColor}
              />
              {compareMode && (
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickMargin={8}
                  stroke={compareColor}
                />
              )}
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value: any, name: string) => {
                  const metric = name === 'displayValue' ? selectedMetric : compareMetric;
                  const label = name === 'displayValue' ? currentMetricConfig.label : currentCompareMetricConfig.label;
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
                stroke={primaryColor}
                strokeWidth={2.5}
                dot={{ fill: primaryColor, r: 4 }}
                activeDot={{ r: 6 }}
              />
              {compareMode && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="compareValue"
                  name="compareValue"
                  stroke={compareColor}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ fill: compareColor, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div 
              className="w-5 h-1 rounded-full" 
              style={{ backgroundColor: primaryColor }}
            />
            <span className="font-medium">{currentMetricConfig.label}</span>
          </div>
          {compareMode && (
            <div className="flex items-center gap-2">
              <div 
                className="w-5 h-0 border-t-2 border-dashed" 
                style={{ borderColor: compareColor }}
              />
              <span className="font-medium" style={{ color: compareColor }}>{currentCompareMetricConfig.label}</span>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className={`grid gap-2 text-xs ${compareMode ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {compareMode ? (
            <>
              {/* Primary metric stats */}
              <div className="p-3 rounded-lg space-y-2" style={{ backgroundColor: `${primaryColor}15` }}>
                <div className="font-medium text-center" style={{ color: primaryColor }}>
                  {currentMetricConfig.label}
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
              <div className="p-3 rounded-lg space-y-2" style={{ backgroundColor: `${compareColor}15` }}>
                <div className="font-medium text-center" style={{ color: compareColor }}>
                  {currentCompareMetricConfig.label}
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
