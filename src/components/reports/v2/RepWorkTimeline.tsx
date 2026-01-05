import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Star, Clock, TrendingUp } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";

interface DayActivity {
  date: string;
  doors: number;
  dms: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp: number;
  prmr: number;
  hoursWorked: number;
  startTime?: string;
  endTime?: string;
  // Personal comparison indicators
  aboveAvgDoors?: boolean;
  aboveAvgFP?: boolean;
}

interface RepWorkTimelineProps {
  entries: DayActivity[];
  avgDoorsPerDay?: number;
  avgFPPerDay?: number;
  daysAboveAvg?: number;
  className?: string;
}

export const RepWorkTimeline = ({ 
  entries, 
  avgDoorsPerDay = 0, 
  avgFPPerDay = 0,
  daysAboveAvg = 0,
  className 
}: RepWorkTimelineProps) => {
  // Generate last 14 days
  const last14Days = useMemo(() => {
    const days: { date: string; label: string }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const date = subDays(today, i);
      days.push({
        date: format(date, 'yyyy-MM-dd'),
        label: format(date, 'EEE'),
      });
    }
    return days;
  }, []);

  // Map entries by date for quick lookup
  const entriesByDate = useMemo(() => {
    const map = new Map<string, DayActivity>();
    entries.forEach(e => map.set(e.date, e));
    return map;
  }, [entries]);

  // Calculate max values for scaling
  const maxDoors = useMemo(() => {
    return Math.max(10, ...entries.map(e => e.doors));
  }, [entries]);

  // Count work days
  const workDaysCount = entries.filter(e => e.doors > 0 || e.fp > 0).length;

  // Format time from ISO string
  const formatTime = (isoString?: string) => {
    if (!isoString) return null;
    try {
      return format(parseISO(isoString), 'h:mm a');
    } catch {
      return null;
    }
  };

  // Get bar color based on personal comparison
  const getBarColor = (entry: DayActivity) => {
    const hasSale = entry.fp > 0;
    const aboveAvg = entry.aboveAvgDoors;
    
    if (hasSale) {
      // Sale day - green tones
      return aboveAvg ? "bg-green-500" : "bg-green-500/70";
    }
    
    // Work day colors based on personal performance
    if (aboveAvg) return "bg-primary/80";
    if (entry.doors > 0 && entry.doors < avgDoorsPerDay * 0.7) return "bg-orange-400/70";
    return "bg-primary/50";
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">Last 14 Days</h4>
        </div>
        {daysAboveAvg > 0 && workDaysCount > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span>{daysAboveAvg} of {workDaysCount} above your avg</span>
          </div>
        )}
      </div>
      
      <div className="flex gap-1">
        {last14Days.map(({ date, label }) => {
          const entry = entriesByDate.get(date);
          const hasWork = entry && (entry.doors > 0 || entry.fp > 0);
          const hasSale = entry && entry.fp > 0;
          const doorHeight = entry ? (entry.doors / maxDoors) * 100 : 0;
          const isAboveAvg = entry?.aboveAvgDoors;
          const isBelowAvg = entry && entry.doors > 0 && entry.doors < avgDoorsPerDay * 0.7;
          
          return (
            <div key={date} className="flex-1 flex flex-col items-center gap-1">
              {/* Activity bar */}
              <div className="relative w-full h-16 bg-muted/30 rounded-sm overflow-hidden flex items-end">
                {hasWork && entry && (
                  <div 
                    className={cn(
                      "w-full transition-all duration-300",
                      getBarColor(entry)
                    )}
                    style={{ height: `${Math.max(doorHeight, 8)}%` }}
                  />
                )}
                {hasSale && (
                  <Star className="absolute top-1 left-1/2 -translate-x-1/2 w-3 h-3 text-yellow-500 fill-yellow-500" />
                )}
                {/* Above average indicator */}
                {isAboveAvg && !hasSale && (
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
              </div>
              
              {/* Day label with color coding */}
              <span className={cn(
                "text-[10px]",
                !hasWork && "text-muted-foreground",
                hasWork && !isBelowAvg && "text-foreground font-medium",
                isBelowAvg && "text-orange-500 font-medium"
              )}>
                {label.charAt(0)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground justify-center flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-primary/80" />
          <span>Above avg</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-primary/50" />
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-orange-400/70" />
          <span>Below avg</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-green-500" />
          <span>Sale</span>
        </div>
        <div className="flex items-center gap-1">
          <Star className="w-2 h-2 text-yellow-500 fill-yellow-500" />
          <span>FP+</span>
        </div>
      </div>

      {/* Summary stats */}
      {entries.length > 0 && (
        <div className="grid grid-cols-4 gap-2 pt-2 border-t">
          <TimelineStat 
            label="Days Worked" 
            value={workDaysCount} 
          />
          <TimelineStat 
            label="Avg Doors" 
            value={Math.round(avgDoorsPerDay)}
            subtext={avgDoorsPerDay > 0 ? "/day" : undefined}
          />
          <TimelineStat 
            label="Total FP+" 
            value={entries.reduce((sum, e) => sum + e.fp, 0).toFixed(1)}
          />
          <TimelineStat 
            label="Avg Hours" 
            value={`${(entries.reduce((sum, e) => sum + e.hoursWorked, 0) / Math.max(1, entries.filter(e => e.hoursWorked > 0).length)).toFixed(1)}`}
          />
        </div>
      )}
    </div>
  );
};

const TimelineStat = ({ 
  label, 
  value, 
  subtext 
}: { 
  label: string; 
  value: string | number;
  subtext?: string;
}) => (
  <div className="text-center">
    <div className="text-sm font-semibold tabular-nums">
      {value}{subtext && <span className="text-[10px] text-muted-foreground">{subtext}</span>}
    </div>
    <div className="text-[10px] text-muted-foreground">{label}</div>
  </div>
);