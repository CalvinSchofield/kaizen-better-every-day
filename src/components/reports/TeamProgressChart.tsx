import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { format, parseISO } from "date-fns";
import { useEfpMode } from "@/hooks/useEfpMode";
import { TrendingUp, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type ViewMode = 'individual' | 'team' | 'mgmt' | 'office';
type MetricType = 'primary' | 'secondary';

interface TeamProgressChartProps {
  teamData?: any[];
  repBreakdown?: any[];
  groupedByTeam?: any[];
  groupedByMgmt?: any[];
  accessLevel: 'area_director' | 'mgmt_group_lead' | 'team_lead' | 'none';
  isLoading?: boolean;
}

// Generate distinct colors for multi-line charts
const LINE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#22c55e',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
];

export const TeamProgressChart = ({ 
  teamData, 
  repBreakdown,
  groupedByTeam,
  groupedByMgmt,
  accessLevel,
  isLoading 
}: TeamProgressChartProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [metricType, setMetricType] = useState<MetricType>('primary');
  const { efpModeEnabled } = useEfpMode();

  // Available view modes based on access level - order: Individual, Team, MGMT, Office
  const getAvailableViewModes = (): { value: ViewMode; label: string }[] => {
    const modes: { value: ViewMode; label: string }[] = [
      { value: 'individual', label: 'Individual' },
    ];

    // Team leads and above can view by team
    if (accessLevel === 'team_lead' || accessLevel === 'mgmt_group_lead' || accessLevel === 'area_director') {
      modes.push({ value: 'team', label: 'Team' });
    }

    // MGMT group leads and above can view by MGMT
    if (accessLevel === 'mgmt_group_lead' || accessLevel === 'area_director') {
      modes.push({ value: 'mgmt', label: 'MGMT' });
    }

    // Only area directors can view office-wide
    if (accessLevel === 'area_director') {
      modes.push({ value: 'office', label: 'Office' });
    }

    return modes;
  };

  const availableViewModes = getAvailableViewModes();
  const [viewMode, setViewMode] = useState<ViewMode>(availableViewModes[0]?.value || 'individual');

  const primaryLabel = efpModeEnabled ? "EFP" : "FP+";
  const secondaryLabel = efpModeEnabled ? "FP+" : "PRMR";
  const currentMetricLabel = metricType === 'primary' ? primaryLabel : secondaryLabel;

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5" />
          <div className="h-5 w-40 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-64 bg-muted/30 rounded animate-pulse" />
      </Card>
    );
  }

  if (!teamData || teamData.length === 0) {
    return null;
  }

  // Prepare chart data based on view mode
  const chartData = teamData.map((point) => ({
    date: point.date,
    displayDate: format(parseISO(point.date), "MMM d"),
    cumulative: metricType === 'primary' 
      ? point.cumulative 
      : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr),
  }));

  const totalValue = chartData[chartData.length - 1]?.cumulative || 0;

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
        <div className="space-y-1 text-xs">
          {payload.map((entry: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-semibold" style={{ color: entry.color }}>
                {metricType === 'secondary' && !efpModeEnabled
                  ? `$${entry.value.toFixed(0)}`
                  : entry.value.toFixed(efpModeEnabled && metricType === 'primary' ? 2 : 1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

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
              <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", isOpen && "rotate-180")} />
            </div>
            {!isOpen && (
              <div className="mt-2 text-left text-sm text-muted-foreground">
                {metricType === 'primary' 
                  ? (efpModeEnabled 
                      ? `${totalValue.toFixed(2)} EFP total`
                      : `${totalValue.toFixed(1)} FP+ total`)
                  : (efpModeEnabled
                      ? `${totalValue.toFixed(1)} FP+ total`
                      : `$${totalValue.toFixed(0)} PRMR total`)}
              </div>
            )}
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="pt-3 space-y-3">
              {/* Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* View Mode - only show if more than one option */}
                {availableViewModes.length > 1 && (
                  <div className="flex items-center gap-1 border border-border rounded-lg p-1">
                    {availableViewModes.map(({ value, label }) => (
                      <Button
                        key={value}
                        variant={viewMode === value ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode(value)}
                        className="text-xs h-7 px-2"
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Metric Toggle */}
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
            </div>
          </CollapsibleContent>
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-4">
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
                    name={`Total ${currentMetricLabel}`}
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    activeDot={{ r: 6 }}
                    animationDuration={800}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-primary rounded" />
                <span className="text-muted-foreground">Total {currentMetricLabel}</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
