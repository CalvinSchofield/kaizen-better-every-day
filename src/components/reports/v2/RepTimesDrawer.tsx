import { useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Clock, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RepTimeData {
  userId: string;
  name: string;
  avgStartMinutes: number | null; // minutes from midnight
  avgEndMinutes: number | null;
  hoursWorked: number;
}

interface RepTimesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reps: RepTimeData[];
  periodLabel: string;
  teamAvgStartMinutes?: number;
  teamAvgEndMinutes?: number;
  onRepClick?: (userId: string) => void;
}

const minutesToTimeLabel = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

// Visual timeline: maps minutes to % position within a window (e.g. 6am-11pm)
const TIMELINE_START = 6 * 60; // 6:00 AM
const TIMELINE_END = 23 * 60; // 11:00 PM
const TIMELINE_RANGE = TIMELINE_END - TIMELINE_START;

const minutesToPercent = (mins: number): number => {
  return Math.max(0, Math.min(100, ((mins - TIMELINE_START) / TIMELINE_RANGE) * 100));
};

/**
 * Classify a rep's hustle based on start AND end times relative to team averages.
 * - 'hustler': started before avg AND ended after avg (both show hustle)
 * - 'mixed': one of the two shows hustle
 * - 'behind': started after avg AND ended before avg
 */
const getHustleClassification = (
  startMinutes: number,
  endMinutes: number | null,
  teamAvgStart: number | undefined,
  teamAvgEnd: number | undefined,
): 'hustler' | 'mixed' | 'behind' => {
  if (teamAvgStart === undefined) return 'mixed';
  
  const startedEarly = startMinutes <= teamAvgStart;
  const endedLate = teamAvgEnd !== undefined && endMinutes !== null && endMinutes >= teamAvgEnd;
  
  // If we don't have end time data, classify on start only
  if (endMinutes === null || teamAvgEnd === undefined) {
    return startedEarly ? 'hustler' : 'behind';
  }
  
  if (startedEarly && endedLate) return 'hustler';
  if (!startedEarly && !endedLate) return 'behind';
  return 'mixed';
};

export const RepTimesDrawer = ({
  open,
  onOpenChange,
  reps,
  periodLabel,
  teamAvgStartMinutes,
  teamAvgEndMinutes,
  onRepClick,
}: RepTimesDrawerProps) => {
  // Sort reps by start time (earliest first), nulls last
  const sortedReps = useMemo(() => {
    return [...reps]
      .filter(r => r.avgStartMinutes !== null)
      .sort((a, b) => (a.avgStartMinutes ?? 999) - (b.avgStartMinutes ?? 999));
  }, [reps]);

  const timeMarkers = [
    { mins: 7 * 60, label: '7a' },
    { mins: 9 * 60, label: '9a' },
    { mins: 11 * 60, label: '11a' },
    { mins: 13 * 60, label: '1p' },
    { mins: 15 * 60, label: '3p' },
    { mins: 17 * 60, label: '5p' },
    { mins: 19 * 60, label: '7p' },
    { mins: 21 * 60, label: '9p' },
  ];


  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Work Times — {periodLabel}
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto space-y-4">
          {/* Team averages summary */}
          {(teamAvgStartMinutes !== undefined || teamAvgEndMinutes !== undefined) && (
            <div className="flex gap-3">
              {teamAvgStartMinutes !== undefined && (
                <div className="flex-1 bg-muted/30 rounded-xl p-3 text-center">
                  <Sun className="w-4 h-4 mx-auto mb-1 text-amber-500" />
                  <div className="text-lg font-bold">{minutesToTimeLabel(teamAvgStartMinutes)}</div>
                  <div className="text-[10px] text-muted-foreground">Team Avg Start</div>
                </div>
              )}
              {teamAvgEndMinutes !== undefined && (
                <div className="flex-1 bg-muted/30 rounded-xl p-3 text-center">
                  <Moon className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                  <div className="text-lg font-bold">{minutesToTimeLabel(teamAvgEndMinutes)}</div>
                  <div className="text-[10px] text-muted-foreground">Team Avg End</div>
                </div>
              )}
              <div className="flex-1 bg-muted/30 rounded-xl p-3 text-center">
                <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <div className="text-lg font-bold">
                  {teamAvgStartMinutes !== undefined && teamAvgEndMinutes !== undefined
                    ? `${((teamAvgEndMinutes - teamAvgStartMinutes) / 60).toFixed(1)}h`
                    : '—'
                  }
                </div>
                <div className="text-[10px] text-muted-foreground">Avg Span</div>
              </div>
            </div>
          )}

          {/* Timeline header */}
          <div className="relative h-6 mb-1">
            {timeMarkers.map(({ mins, label }) => (
              <span
                key={mins}
                className="absolute text-[9px] text-muted-foreground -translate-x-1/2"
                style={{ left: `${minutesToPercent(mins)}%` }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Rep bars */}
          <div className="space-y-1.5">
            {sortedReps.map((rep) => {
              const startPct = minutesToPercent(rep.avgStartMinutes!);
              const endPct = rep.avgEndMinutes !== null
                ? minutesToPercent(rep.avgEndMinutes)
                : Math.min(startPct + 20, 100);
              const widthPct = Math.max(endPct - startPct, 2);

              // Classify hustle based on start + end relative to team averages
              const classification = getHustleClassification(
                rep.avgStartMinutes!,
                rep.avgEndMinutes,
                teamAvgStartMinutes,
                teamAvgEndMinutes,
              );

              return (
                <button
                  key={rep.userId}
                  onClick={() => onRepClick?.(rep.userId)}
                  className="w-full flex items-center gap-2 group hover:bg-muted/30 rounded-lg py-1 px-1 transition-colors active:scale-[0.99]"
                >
                  {/* Name */}
                  <div className="w-16 text-left shrink-0">
                    <span className="text-[11px] font-medium truncate block">
                      {rep.name.split(' ')[0]}
                    </span>
                  </div>

                  {/* Timeline bar */}
                  <div className="flex-1 relative h-5 bg-muted/20 rounded-full overflow-hidden">
                    {/* Team avg markers */}
                    {teamAvgStartMinutes !== undefined && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-muted-foreground/30"
                        style={{ left: `${minutesToPercent(teamAvgStartMinutes)}%` }}
                      />
                    )}
                    {teamAvgEndMinutes !== undefined && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-muted-foreground/30"
                        style={{ left: `${minutesToPercent(teamAvgEndMinutes)}%` }}
                      />
                    )}
                    {/* Bar */}
                    <div
                      className={cn(
                        "absolute top-0.5 bottom-0.5 rounded-full transition-all",
                        classification === 'hustler' && "bg-green-500/70",
                        classification === 'behind' && "bg-orange-500/70",
                        classification === 'mixed' && "bg-primary/60"
                      )}
                      style={{
                        left: `${startPct}%`,
                        width: `${widthPct}%`,
                      }}
                    />
                  </div>

                  {/* Time labels */}
                  <div className="w-20 text-right shrink-0">
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {minutesToTimeLabel(rep.avgStartMinutes!)}
                      {rep.avgEndMinutes !== null && (
                        <>–{minutesToTimeLabel(rep.avgEndMinutes)}</>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {sortedReps.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              No time data available for this period
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground justify-center pt-2 border-t border-border/50">
            <div className="flex items-center gap-1">
              <div className="w-3 h-2 rounded-full bg-green-500/70" />
              <span>Top 25%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-2 rounded-full bg-primary/60" />
              <span>Middle</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-2 rounded-full bg-orange-500/70" />
              <span>Bottom 25%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-px h-3 bg-muted-foreground/30" />
              <span>Team avg</span>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
