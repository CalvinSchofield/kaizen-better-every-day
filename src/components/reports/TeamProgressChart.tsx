import { useState, useMemo } from "react";
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

interface RepBreakdownItem {
  userId: string;
  name: string;
  year: string;
  teamName: string;
  mgmtGroupName: string;
  doors: number;
  dms: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp: number;
  upgradeFP: number;
  prmr: number;
  upgradePRMR: number;
  doorsToFpRatio: number;
  hoursWorked: number;
  daysWorked?: number;
}

interface DailyTrendByEntity {
  [entityId: string]: {
    name: string;
    dailyData: Array<{ date: string; fp: number; prmr: number; efp: number }>;
  };
}

interface TeamProgressChartProps {
  teamData?: any[];
  repBreakdown?: RepBreakdownItem[];
  groupedByTeam?: any[];
  groupedByMgmt?: any[];
  dailyTrendByRep?: DailyTrendByEntity;
  dailyTrendByTeam?: DailyTrendByEntity;
  dailyTrendByMgmt?: DailyTrendByEntity;
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
  '#ef4444',
  '#84cc16',
  '#14b8a6',
  '#a855f7',
  '#f97316',
];

export const TeamProgressChart = ({ 
  teamData, 
  repBreakdown,
  groupedByTeam,
  groupedByMgmt,
  dailyTrendByRep,
  dailyTrendByTeam,
  dailyTrendByMgmt,
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
  // Default to largest scope based on access level
  const getDefaultViewMode = (): ViewMode => {
    if (accessLevel === 'area_director') return 'office';
    if (accessLevel === 'mgmt_group_lead') return 'mgmt';
    if (accessLevel === 'team_lead') return 'team';
    return 'individual';
  };
  const [viewMode, setViewMode] = useState<ViewMode>(getDefaultViewMode());

  const primaryLabel = efpModeEnabled ? "EFP" : "FP+";
  const secondaryLabel = efpModeEnabled ? "FP+" : "PRMR";
  const currentMetricLabel = metricType === 'primary' ? primaryLabel : secondaryLabel;

  // Build multi-line chart data based on view mode
  const { chartData, entities } = useMemo(() => {
    if (!teamData || teamData.length === 0) {
      return { chartData: [], entities: [] };
    }

    const dates = teamData.map(d => d.date);
    let entityTrends: DailyTrendByEntity = {};
    
    switch (viewMode) {
      case 'individual':
        entityTrends = dailyTrendByRep || {};
        break;
      case 'team':
        entityTrends = dailyTrendByTeam || {};
        break;
      case 'mgmt':
        entityTrends = dailyTrendByMgmt || {};
        break;
      case 'office':
      default:
        // Single line for office total
        return {
          chartData: teamData.map((point) => ({
            date: point.date,
            displayDate: format(parseISO(point.date), "MMM d"),
            Total: metricType === 'primary' 
              ? point.cumulative 
              : (efpModeEnabled ? point.cumulativeFp : point.cumulativePrmr),
          })),
          entities: [{ id: 'Total', name: 'Total', color: 'hsl(var(--primary))' }],
        };
    }

    // Build multi-line data - calculate totals first for sorting
    const entityTotals = Object.entries(entityTrends)
      .filter(([_, data]) => data.dailyData.length > 0)
      .map(([id, data]) => {
        const totalValue = data.dailyData.reduce((sum, d) => {
          return sum + (metricType === 'primary' 
            ? (efpModeEnabled ? d.efp : d.fp) 
            : (efpModeEnabled ? d.fp : d.prmr));
        }, 0);
        return { id, name: data.name, total: totalValue };
      })
      .sort((a, b) => b.total - a.total);

    // For individual view, limit to top 10 performers to keep chart readable
    const limitedEntities = viewMode === 'individual' 
      ? entityTotals.slice(0, 10) 
      : entityTotals;

    const entityList = limitedEntities.map((entity, idx) => ({
      id: entity.id,
      name: entity.name,
      color: LINE_COLORS[idx % LINE_COLORS.length],
    }));

    // Create cumulative data for each entity
    const cumulatives: Record<string, number> = {};
    entityList.forEach(e => { cumulatives[e.id] = 0; });

    const data = dates.map(date => {
      const point: any = {
        date,
        displayDate: format(parseISO(date), "MMM d"),
      };

      entityList.forEach(entity => {
        const entityData = entityTrends[entity.id];
        const dayData = entityData?.dailyData.find(d => d.date === date);
        
        if (dayData) {
          const value = metricType === 'primary'
            ? (efpModeEnabled ? dayData.efp : dayData.fp)
            : (efpModeEnabled ? dayData.fp : dayData.prmr);
          cumulatives[entity.id] += value;
        }
        
        point[entity.id] = cumulatives[entity.id];
      });

      return point;
    });

    return { chartData: data, entities: entityList };
  }, [teamData, viewMode, metricType, efpModeEnabled, dailyTrendByRep, dailyTrendByTeam, dailyTrendByMgmt]);

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

  const totalValue = chartData[chartData.length - 1]?.[entities[0]?.id] || 0;

  const chartConfig = entities.reduce((acc, entity) => {
    acc[entity.id] = {
      label: entity.name,
      color: entity.color,
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;
    
    // Sort payload by value descending
    const sortedPayload = [...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
    
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg max-h-64 overflow-y-auto">
        <p className="font-semibold text-sm mb-2">
          {format(parseISO(data.date), "MMM d, yyyy")}
        </p>
        <div className="space-y-1 text-xs">
          {sortedPayload.slice(0, 10).map((entry: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground truncate max-w-[120px]">{entry.name}:</span>
              <span className="font-semibold" style={{ color: entry.color }}>
                {metricType === 'secondary' && !efpModeEnabled
                  ? `$${entry.value?.toFixed(0) || 0}`
                  : (entry.value || 0).toFixed(efpModeEnabled && metricType === 'primary' ? 2 : 1)}
              </span>
            </div>
          ))}
          {sortedPayload.length > 10 && (
            <p className="text-muted-foreground text-center">+{sortedPayload.length - 10} more</p>
          )}
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
                  {entities.length <= 6 && <Legend />}
                  {entities.map((entity) => (
                    <Line
                      key={entity.id}
                      type="monotone"
                      dataKey={entity.id}
                      name={entity.name}
                      stroke={entity.color}
                      strokeWidth={viewMode === 'office' ? 3 : 2}
                      dot={viewMode === 'office' ? { fill: entity.color, r: 4 } : false}
                      activeDot={{ r: 5 }}
                      animationDuration={800}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Legend for many entities */}
            {entities.length > 6 && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4 text-xs">
                {entities.map(entity => (
                  <div key={entity.id} className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 rounded" style={{ backgroundColor: entity.color }} />
                    <span className="text-muted-foreground truncate max-w-[80px]">{entity.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
