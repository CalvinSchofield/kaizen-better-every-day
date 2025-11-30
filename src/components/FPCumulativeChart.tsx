import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { format, parseISO } from "date-fns";
import { useCumulativeFP } from "@/hooks/useCumulativeFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { TrendingUp } from "lucide-react";

export const FPCumulativeChart = () => {
  const [movingAvgPeriod, setMovingAvgPeriod] = useState<6 | 12>(6);
  const { data: cumulativeData, isLoading } = useCumulativeFP();
  const { efpModeEnabled } = useEfpMode();

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

  const metricLabel = efpModeEnabled ? "EFP" : "FP+";

  const chartData = cumulativeData.map((point) => ({
    date: point.date,
    displayDate: format(parseISO(point.date), "MMM d"),
    cumulative: point.cumulative,
    movingAvg: movingAvgPeriod === 6 ? point.movingAvg6 : point.movingAvg12,
    dailyValue: point.dailyValue,
  }));

  const chartConfig = {
    cumulative: {
      label: `Total ${metricLabel}`,
      color: "hsl(var(--primary))",
    },
    movingAvg: {
      label: `${movingAvgPeriod}-Day Avg`,
      color: "hsl(var(--chart-2))",
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
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Total {metricLabel}:</span>
            <span className="font-semibold" style={{ color: chartConfig.cumulative.color }}>
              {efpModeEnabled 
                ? data.cumulative.toFixed(2) 
                : data.cumulative.toFixed(1)}
            </span>
          </div>
          {data.movingAvg !== null && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Daily Avg ({movingAvgPeriod}d):</span>
              <span className="font-semibold" style={{ color: chartConfig.movingAvg.color }}>
                {efpModeEnabled 
                  ? data.movingAvg.toFixed(2) 
                  : data.movingAvg.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Progress Over Time
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={movingAvgPeriod === 6 ? "default" : "outline"}
              size="sm"
              onClick={() => setMovingAvgPeriod(6)}
              className="text-xs"
            >
              6-Day Avg
            </Button>
            <Button
              variant={movingAvgPeriod === 12 ? "default" : "outline"}
              size="sm"
              onClick={() => setMovingAvgPeriod(12)}
              className="text-xs"
            >
              12-Day Avg
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
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
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--primary))", r: 4 }}
                activeDot={{ r: 6 }}
                animationDuration={800}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="movingAvg"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 5 }}
                animationDuration={800}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-primary rounded" />
            <span className="text-muted-foreground">Total {metricLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-chart-2 rounded" style={{ backgroundImage: 'repeating-linear-gradient(to right, hsl(var(--chart-2)) 0, hsl(var(--chart-2)) 3px, transparent 3px, transparent 8px)' }} />
            <span className="text-muted-foreground">{movingAvgPeriod}-Day Avg</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
