import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Lightbulb, TrendingUp, Clock, Target } from "lucide-react";

interface HourlyActivityHeatmapProps {
  hourlyActivity: {
    doors: Record<number, number>;
    pitches: Record<number, number>;
    transitions: Record<number, number>;
    presentations: Record<number, number>;
    closes: Record<number, number>;
  };
  peakHours: {
    doors: number | null;
    pitches: number | null;
    transitions: number | null;
    presentations: number | null;
    closes: number | null;
  };
  hourRange: {
    minHour: number;
    maxHour: number;
  };
}

interface TimeBlockStats {
  name: string;
  range: string;
  doors: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  conversionRate: number;
}

export const HourlyActivityHeatmap = ({ hourlyActivity, peakHours, hourRange }: HourlyActivityHeatmapProps) => {
  const hours = Array.from(
    { length: hourRange.maxHour - hourRange.minHour + 1 }, 
    (_, i) => i + hourRange.minHour
  );
  const activities = [
    { key: 'doors', label: 'Doors', data: hourlyActivity.doors, peak: peakHours.doors },
    { key: 'pitches', label: 'Pitches', data: hourlyActivity.pitches, peak: peakHours.pitches },
    { key: 'transitions', label: 'Transitions', data: hourlyActivity.transitions, peak: peakHours.transitions },
    { key: 'presentations', label: 'Presentations', data: hourlyActivity.presentations, peak: peakHours.presentations },
    { key: 'closes', label: 'Closes', data: hourlyActivity.closes, peak: peakHours.closes },
  ];

  // Calculate max value PER ACTIVITY (row) for proper row-based normalization
  // This ensures doors compare to doors, pitches compare to pitches, etc.
  const getMaxPerActivity = (data: Record<number, number>) => {
    const values = Object.values(data);
    return values.length > 0 ? Math.max(...values) : 0;
  };

  const getIntensity = (count: number, activityMax: number) => {
    if (count === 0 || activityMax === 0) return 'bg-muted/20';
    const intensity = count / activityMax;
    if (intensity < 0.25) return 'bg-primary/20';
    if (intensity < 0.5) return 'bg-primary/40';
    if (intensity < 0.75) return 'bg-primary/60';
    return 'bg-primary/80';
  };

  const formatHour = (hour: number) => {
    if (hour === 12) return '12 PM';
    if (hour > 12) return `${hour - 12} PM`;
    return `${hour} AM`;
  };

  // Calculate time block statistics
  const calculateTimeBlockStats = (): TimeBlockStats[] => {
    const blocks = [
      { name: 'Morning', range: '9AM-12PM', startHour: 9, endHour: 11 },
      { name: 'Midday', range: '12PM-3PM', startHour: 12, endHour: 14 },
      { name: 'Afternoon', range: '3PM-6PM', startHour: 15, endHour: 17 },
      { name: 'Evening', range: '6PM-9PM', startHour: 18, endHour: 20 },
    ];

    return blocks.map(block => {
      let doors = 0, pitches = 0, transitions = 0, presentations = 0, closes = 0;
      
      for (let h = block.startHour; h <= block.endHour; h++) {
        doors += hourlyActivity.doors[h] || 0;
        pitches += hourlyActivity.pitches[h] || 0;
        transitions += hourlyActivity.transitions[h] || 0;
        presentations += hourlyActivity.presentations[h] || 0;
        closes += hourlyActivity.closes[h] || 0;
      }

      const conversionRate = doors > 0 ? (closes / doors) * 100 : 0;

      return {
        name: block.name,
        range: block.range,
        doors,
        pitches,
        transitions,
        presentations,
        closes,
        conversionRate
      };
    }).filter(block => block.doors > 0); // Only show blocks with activity
  };

  const timeBlocks = calculateTimeBlockStats();
  const bestConversionBlock = timeBlocks.length > 0 
    ? timeBlocks.reduce((best, block) => block.conversionRate > best.conversionRate ? block : best)
    : null;
  const highestVolumeBlock = timeBlocks.length > 0
    ? timeBlocks.reduce((best, block) => block.doors > best.doors ? block : best)
    : null;

  // Generate actionable insights
  const generateInsights = () => {
    const insights: { icon: typeof Lightbulb; text: string; type: 'tip' | 'strength' | 'opportunity' }[] = [];

    // Peak knocking time
    if (peakHours.doors !== null) {
      insights.push({
        icon: Clock,
        text: `Peak knocking: ${formatHour(peakHours.doors)} — you knock most doors during this hour`,
        type: 'strength'
      });
    }

    // Best closing window
    if (bestConversionBlock && bestConversionBlock.closes > 0) {
      insights.push({
        icon: Target,
        text: `Best closing: ${bestConversionBlock.range} — ${bestConversionBlock.conversionRate.toFixed(1)}% door-to-close conversion`,
        type: 'strength'
      });
    }

    // Volume vs conversion mismatch (opportunity)
    if (highestVolumeBlock && bestConversionBlock && 
        highestVolumeBlock.name !== bestConversionBlock.name &&
        highestVolumeBlock.conversionRate < bestConversionBlock.conversionRate * 0.7) {
      insights.push({
        icon: Lightbulb,
        text: `Consider scheduling return visits for ${bestConversionBlock.range} — your high-volume ${highestVolumeBlock.range} has lower conversions`,
        type: 'tip'
      });
    }

    // Low transitions in certain periods
    const lowTransitionBlock = timeBlocks.find(block => 
      block.pitches > 0 && block.transitions === 0 && block.pitches >= 3
    );
    if (lowTransitionBlock) {
      insights.push({
        icon: TrendingUp,
        text: `${lowTransitionBlock.range}: ${lowTransitionBlock.pitches} pitches but 0 transitions — focus on pitch-to-transition practice`,
        type: 'opportunity'
      });
    }

    // Strong closer indicator
    if (peakHours.closes !== null && peakHours.closes >= 16) {
      insights.push({
        icon: Target,
        text: `Your closing strength is in late afternoon/evening — maximize prime time presence`,
        type: 'tip'
      });
    }

    return insights;
  };

  const actionableInsights = generateInsights();

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Hour labels */}
            <div className="flex mb-2 gap-1">
              <div className="w-28 flex-shrink-0" />
              {hours.map(hour => (
                <div key={hour} className="w-6 text-center text-xs text-muted-foreground">
                  {hour % 2 === 0 ? formatHour(hour).split(' ')[0] : ''}
                </div>
              ))}
            </div>

            {/* Activity rows */}
            {activities.map(activity => {
              const activityMax = getMaxPerActivity(activity.data);
              return (
                <div key={activity.key} className="flex items-center mb-2">
                  <div className="w-28 flex-shrink-0 text-sm font-medium pr-3 text-right">
                    {activity.label}
                  </div>
                  <div className="flex flex-1 gap-1">
                    {hours.map(hour => {
                      const count = activity.data[hour] || 0;
                      const isPeak = activity.peak === hour;
                      return (
                        <div
                          key={hour}
                          className={cn(
                            "w-6 h-6 rounded transition-all hover:scale-110 cursor-pointer relative group",
                            getIntensity(count, activityMax),
                            isPeak && "ring-2 ring-primary"
                          )}
                          title={`${formatHour(hour)}: ${count} ${activity.label.toLowerCase()}`}
                        >
                          {count > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-xs font-semibold text-foreground">{count}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Less</span>
            <div className="flex gap-1">
              {['bg-muted/20', 'bg-primary/20', 'bg-primary/40', 'bg-primary/60', 'bg-primary/80'].map((color, i) => (
                <div key={i} className={cn("w-4 h-4 rounded", color)} />
              ))}
            </div>
            <span className="text-muted-foreground">More</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-primary/40 ring-2 ring-primary" />
            <span className="text-muted-foreground">Peak hour</span>
          </div>
        </div>

        {/* Time Block Comparison */}
        {timeBlocks.length > 1 && (
          <div className="pt-3 border-t border-border/50">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Time Block Efficiency
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {timeBlocks.map(block => (
                <div 
                  key={block.name} 
                  className={cn(
                    "p-2 rounded-lg text-xs",
                    bestConversionBlock?.name === block.name 
                      ? "bg-primary/10 border border-primary/30" 
                      : "bg-muted/30"
                  )}
                >
                  <div className="font-medium">{block.name}</div>
                  <div className="text-muted-foreground">{block.range}</div>
                  <div className="mt-1 flex justify-between">
                    <span>{block.doors} doors</span>
                    <span className={cn(
                      "font-medium",
                      bestConversionBlock?.name === block.name && "text-primary"
                    )}>
                      {block.conversionRate.toFixed(1)}% close
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actionable Insights */}
        {actionableInsights.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Insights & Takeaways
            </h4>
            <div className="space-y-2">
              {actionableInsights.map((insight, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "p-2 rounded-lg text-xs flex items-start gap-2",
                    insight.type === 'strength' && "bg-success/10",
                    insight.type === 'tip' && "bg-primary/10",
                    insight.type === 'opportunity' && "bg-amber-500/10"
                  )}
                >
                  <insight.icon className={cn(
                    "w-4 h-4 mt-0.5 flex-shrink-0",
                    insight.type === 'strength' && "text-success",
                    insight.type === 'tip' && "text-primary",
                    insight.type === 'opportunity' && "text-amber-500"
                  )} />
                  <span>{insight.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
