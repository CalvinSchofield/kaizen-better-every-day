import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
}

export const HourlyActivityHeatmap = ({ hourlyActivity, peakHours }: HourlyActivityHeatmapProps) => {
  const hours = Array.from({ length: 13 }, (_, i) => i + 10); // 10 AM to 10 PM
  const activities = [
    { key: 'doors', label: 'Doors', data: hourlyActivity.doors, peak: peakHours.doors },
    { key: 'pitches', label: 'Pitches', data: hourlyActivity.pitches, peak: peakHours.pitches },
    { key: 'transitions', label: 'Transitions', data: hourlyActivity.transitions, peak: peakHours.transitions },
    { key: 'presentations', label: 'Presentations', data: hourlyActivity.presentations, peak: peakHours.presentations },
    { key: 'closes', label: 'Closes', data: hourlyActivity.closes, peak: peakHours.closes },
  ];

  // Find max value for normalization
  const maxValue = Math.max(
    ...activities.flatMap(activity => Object.values(activity.data))
  );

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-muted/20';
    const intensity = count / maxValue;
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

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Hourly Activity Pattern</h3>
          <p className="text-sm text-muted-foreground">When you're most active throughout the day</p>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Hour labels */}
            <div className="flex mb-2">
              <div className="w-28 flex-shrink-0" />
              {hours.map(hour => (
                <div key={hour} className="flex-1 text-center text-xs text-muted-foreground">
                  {hour === 10 || hour === 14 || hour === 18 || hour === 22 ? formatHour(hour).split(' ')[0] : ''}
                </div>
              ))}
            </div>

            {/* Activity rows */}
            {activities.map(activity => (
              <div key={activity.key} className="flex items-center mb-2">
                <div className="w-28 flex-shrink-0 text-sm font-medium pr-3 text-right">
                  {activity.label}
                </div>
                <div className="flex-1 flex gap-1">
                  {hours.map(hour => {
                    const count = activity.data[hour] || 0;
                    const isPeak = activity.peak === hour;
                    return (
                      <div
                        key={hour}
                        className={cn(
                          "flex-1 aspect-square rounded transition-all hover:scale-110 cursor-pointer relative group",
                          getIntensity(count),
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
            ))}
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
      </div>
    </Card>
  );
};
