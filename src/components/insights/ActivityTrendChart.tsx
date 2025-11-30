import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { format, parseISO } from 'date-fns';

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
  }>;
  efpModeEnabled?: boolean;
}

type MetricKey = 'doors' | 'pitches' | 'transitions' | 'presentations' | 'fp' | 'prmr';

export const ActivityTrendChart = ({ dailyTrend, efpModeEnabled = false }: ActivityTrendChartProps) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('doors');

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
  ];

  const currentMetric = metrics.find(m => m.key === selectedMetric)!;

  const chartData = dailyTrend.map(day => {
    let displayValue: number;
    if (selectedMetric === 'fp' && efpModeEnabled) {
      displayValue = day.efp;
    } else if (selectedMetric === 'prmr' && efpModeEnabled) {
      displayValue = day.fp; // Show FP+ when PRMR key is selected in EFP mode
    } else {
      displayValue = day[selectedMetric];
    }
    
    return {
      ...day,
      displayValue,
      displayDate: format(parseISO(day.date), 'MMM d'),
    };
  });

  const chartConfig = {
    displayValue: {
      label: currentMetric.label,
      color: currentMetric.color,
    },
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Metric Selector */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {metrics.map(metric => (
            <Button
              key={metric.key}
              variant={selectedMetric === metric.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMetric(metric.key)}
            >
              {metric.label}
            </Button>
          ))}
        </div>

        {/* Chart */}
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis 
                dataKey="displayDate" 
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value: any) => {
                  const shouldShowDecimal = selectedMetric === 'fp' || selectedMetric === 'prmr';
                  return [
                    shouldShowDecimal ? Number(value).toFixed(1) : value,
                    currentMetric.label
                  ];
                }}
              />
              <Line
                type="monotone"
                dataKey="displayValue"
                stroke={currentMetric.color}
                strokeWidth={2}
                dot={{ fill: currentMetric.color, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-accent/30 text-center">
            <div className="text-muted-foreground mb-1">Total</div>
            <div className="font-semibold">
              {(() => {
                let sum = 0;
                if (selectedMetric === 'fp' && efpModeEnabled) {
                  sum = dailyTrend.reduce((s, d) => s + d.efp, 0);
                } else if (selectedMetric === 'prmr' && efpModeEnabled) {
                  sum = dailyTrend.reduce((s, d) => s + d.fp, 0);
                } else {
                  sum = dailyTrend.reduce((s, d) => s + d[selectedMetric], 0);
                }
                return (selectedMetric === 'fp' || selectedMetric === 'prmr') ? sum.toFixed(1) : sum.toFixed(0);
              })()}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-accent/30 text-center">
            <div className="text-muted-foreground mb-1">Avg/Day</div>
            <div className="font-semibold">
              {dailyTrend.length > 0 ? (() => {
                let sum = 0;
                if (selectedMetric === 'fp' && efpModeEnabled) {
                  sum = dailyTrend.reduce((s, d) => s + d.efp, 0) / dailyTrend.length;
                } else if (selectedMetric === 'prmr' && efpModeEnabled) {
                  sum = dailyTrend.reduce((s, d) => s + d.fp, 0) / dailyTrend.length;
                } else {
                  sum = dailyTrend.reduce((s, d) => s + d[selectedMetric], 0) / dailyTrend.length;
                }
                return (selectedMetric === 'fp' || selectedMetric === 'prmr') ? sum.toFixed(1) : sum.toFixed(0);
              })() : '0'}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-accent/30 text-center">
            <div className="text-muted-foreground mb-1">Best Day</div>
            <div className="font-semibold">
              {dailyTrend.length > 0 ? (() => {
                let values: number[];
                if (selectedMetric === 'fp' && efpModeEnabled) {
                  values = dailyTrend.map(d => d.efp);
                } else if (selectedMetric === 'prmr' && efpModeEnabled) {
                  values = dailyTrend.map(d => d.fp);
                } else {
                  values = dailyTrend.map(d => d[selectedMetric]);
                }
                const max = Math.max(...values);
                return (selectedMetric === 'fp' || selectedMetric === 'prmr') ? max.toFixed(1) : max.toFixed(0);
              })() : '0'}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
