import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { format, parseISO } from 'date-fns';
import { GitCompare, TrendingUp, TrendingDown } from "lucide-react";

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
  const [showTrend, setShowTrend] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<6 | 12>(6);
  const [compareMode, setCompareMode] = useState(false);
  const [compareMetric, setCompareMetric] = useState<MetricKey>('fp');

  const primaryColor = 'hsl(var(--primary))';
  const compareColor = '#0ea5e9';
  const trendColor = 'hsl(var(--chart-2))';

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
      return day.fp;
    } else if (metric === 'hoursWorked') {
      return day.hoursWorked ?? 0;
    } else {
      return day[metric as keyof typeof day] as number || 0;
    }
  };

  const calculateMovingAvg = (data: number[], index: number, period: number): number | null => {
    if (index < period - 1) return null;
    const slice = data.slice(index - period + 1, index + 1);
    const sum = slice.reduce((acc, val) => acc + val, 0);
    return sum / period;
  };

  const chartData = useMemo(() => {
    const values = dailyTrend.map(day => getMetricValue(day, selectedMetric));
    
    return dailyTrend.map((day, index) => {
      const displayValue = getMetricValue(day, selectedMetric);
      const movingAvg = showTrend ? calculateMovingAvg(values, index, trendPeriod) : null;
      
      return {
        ...day,
        displayValue,
        movingAvg,
        compareValue: compareMode ? getMetricValue(day, compareMetric) : undefined,
        displayDate: format(parseISO(day.date), 'MMM d'),
      };
    });
  }, [dailyTrend, selectedMetric, compareMode, compareMetric, showTrend, trendPeriod, efpModeEnabled]);

  const trendDirection = useMemo(() => {
    if (!showTrend || chartData.length < trendPeriod) return null;
    
    const latest = chartData[chartData.length - 1];
    if (!latest.movingAvg) return null;
    
    const diff = latest.displayValue - latest.movingAvg;
    
    return {
      diff,
      isPositive: diff >= 0,
    };
  }, [chartData, showTrend, trendPeriod]);

  const chartConfig = {
    displayValue: {
      label: currentMetricConfig.label,
      color: primaryColor,
    },
    ...(showTrend && {
      movingAvg: {
        label: `${trendPeriod}d Avg`,
        color: trendColor,
      },
    }),
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
    <div className="space-y-3">
      {/* Controls Row - Compact */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Metric Selector */}
        <div className="flex items-center gap-2">
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
          
          {compareMode && (
            <>
              <span className="text-muted-foreground text-xs">vs</span>
              <div className="flex items-center gap-1.5">
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

        {/* Toggle Buttons */}
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
          <Button
            variant={showTrend ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setShowTrend(!showTrend);
              if (!showTrend) setCompareMode(false);
            }}
            className="h-7 px-2 text-xs gap-1"
          >
            <TrendingUp className="w-3 h-3" />
            {showTrend ? `${trendPeriod}d` : 'Trend'}
          </Button>
          <Button
            variant={compareMode ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setCompareMode(!compareMode);
              if (!compareMode) setShowTrend(false);
            }}
            className="h-7 px-2 text-xs gap-1"
          >
            <GitCompare className="w-3 h-3" />
            Compare
          </Button>
        </div>
      </div>

      {/* Trend Controls (when enabled) */}
      {showTrend && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
            <button
              onClick={() => setTrendPeriod(6)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${trendPeriod === 6 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              6d
            </button>
            <button
              onClick={() => setTrendPeriod(12)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${trendPeriod === 12 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              12d
            </button>
          </div>
          {trendDirection && (
            <div className="flex items-center gap-1.5 text-sm">
              {trendDirection.isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
              )}
              <span className={trendDirection.isPositive ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                {trendDirection.isPositive ? '+' : ''}{formatValue(trendDirection.diff, selectedMetric)}
              </span>
              <span className="text-muted-foreground text-xs">vs avg</span>
            </div>
          )}
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
                if (name === 'movingAvg') {
                  return [formatValue(Number(value), selectedMetric), `${trendPeriod}d Avg`];
                }
                const metric = name === 'displayValue' ? selectedMetric : compareMetric;
                const label = name === 'displayValue' ? currentMetricConfig.label : currentCompareMetricConfig.label;
                return [formatValue(Number(value), metric), label];
              }}
            />
            {showTrend && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="movingAvg"
                name="movingAvg"
                stroke={trendColor}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            )}
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
          <div className="w-5 h-1 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span className="font-medium">{currentMetricConfig.label}</span>
        </div>
        {showTrend && (
          <div className="flex items-center gap-2">
            <div className="w-5 h-0 border-t-2 border-dashed" style={{ borderColor: trendColor }} />
            <span className="font-medium" style={{ color: trendColor }}>{trendPeriod}d Avg</span>
          </div>
        )}
        {compareMode && (
          <div className="flex items-center gap-2">
            <div className="w-5 h-0 border-t-2 border-dashed" style={{ borderColor: compareColor }} />
            <span className="font-medium" style={{ color: compareColor }}>{currentCompareMetricConfig.label}</span>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className={`grid gap-2 text-xs ${compareMode ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {compareMode ? (
          <>
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
  );
};