import { useMemo, useRef, useEffect, useState } from 'react';
import { format, parseISO, eachDayOfInterval, getDay, isToday, isBefore, startOfWeek, addDays, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { PlannedDay } from '@/hooks/usePlannedDays';

const SEASON_START = '2025-09-28';
const SEASON_END = '2026-09-27';

export interface DailyEntry {
  entry_date: string;
  fp_plus: number | null;
  prmr: number | null;
  is_finalized: boolean | null;
}

interface SeasonHeatmapProps {
  dailyEntries: DailyEntry[] | undefined;
  plannedDays: PlannedDay[] | undefined;
  excludedSummerDays: string[];
  personalSummerStart: string | null | undefined;
  personalSummerEnd: string | null | undefined;
  preseasonDailyPace: number;
  summerDailyPace: number;
  efpModeEnabled: boolean;
  isLoading: boolean;
}

type CellLevel = 'off' | 'future-off' | 'future-planned' | 'empty' | 1 | 2 | 3 | 4;

interface CellData {
  date: string;
  dayOfMonth: number;
  level: CellLevel;
  production?: number;
  target?: number;
  isToday: boolean;
  month: number;
}

const LEVEL_CLASSES: Record<string, string> = {
  'off': 'bg-muted/30',
  'future-off': 'bg-muted/20',
  'future-planned': 'bg-background border border-border/30',
  'empty': 'bg-transparent',
  '1': 'bg-emerald-200 dark:bg-emerald-900',
  '2': 'bg-emerald-400 dark:bg-emerald-700',
  '3': 'bg-emerald-500 dark:bg-emerald-600',
  '4': 'bg-emerald-700 dark:bg-emerald-400',
};

export const SeasonHeatmap = ({
  dailyEntries,
  plannedDays,
  excludedSummerDays,
  personalSummerStart,
  personalSummerEnd,
  preseasonDailyPace,
  summerDailyPace,
  efpModeEnabled,
  isLoading,
}: SeasonHeatmapProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tappedCell, setTappedCell] = useState<string | null>(null);

  // Build lookup maps
  const entryMap = useMemo(() => {
    const map = new Map<string, DailyEntry>();
    dailyEntries?.forEach(e => map.set(e.entry_date, e));
    return map;
  }, [dailyEntries]);

  const plannedSet = useMemo(() => {
    return new Set(plannedDays?.map(d => d.planned_date) || []);
  }, [plannedDays]);

  const excludedSet = useMemo(() => new Set(excludedSummerDays), [excludedSummerDays]);

  const effectiveSummerStart = personalSummerStart || '2026-04-12';

  // Build week-column grid
  const { weeks, monthLabels } = useMemo(() => {
    const seasonStart = parseISO(SEASON_START);
    const seasonEnd = parseISO(SEASON_END);
    const today = new Date();

    // Start from the Sunday of the week containing season start
    const gridStart = startOfWeek(seasonStart, { weekStartsOn: 0 });
    
    const allWeeks: CellData[][] = [];
    const labels: { month: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    let currentDay = gridStart;
    let weekIndex = 0;

    while (!isAfter(currentDay, seasonEnd) || getDay(currentDay) !== 0) {
      const week: CellData[] = [];
      
      for (let dow = 0; dow < 7; dow++) {
        const dateStr = format(currentDay, 'yyyy-MM-dd');
        const month = currentDay.getMonth();
        const inSeason = !isBefore(currentDay, seasonStart) && !isAfter(currentDay, seasonEnd);
        
        // Track month labels
        if (dow === 0 && month !== lastMonth && inSeason) {
          labels.push({ month: format(currentDay, 'MMM'), weekIndex });
          lastMonth = month;
        }

        if (!inSeason) {
          week.push({ date: dateStr, dayOfMonth: currentDay.getDate(), level: 'empty', isToday: false, month });
          currentDay = addDays(currentDay, 1);
          continue;
        }

        const isSunday = getDay(currentDay) === 0;
        const isExcluded = excludedSet.has(dateStr);
        const isFuture = isAfter(currentDay, today);
        const isPlanned = plannedSet.has(dateStr);
        const entry = entryMap.get(dateStr);
        const isTodayDate = isToday(currentDay);

        // Determine if preseason or summer
        const isSummer = !isBefore(currentDay, parseISO(effectiveSummerStart));
        const dailyTarget = isSummer ? summerDailyPace : preseasonDailyPace;

        let level: CellLevel;
        let production: number | undefined;

        if (entry && (entry.is_finalized || isTodayDate)) {
          const prod = efpModeEnabled 
            ? ((entry.prmr || 0) / 85) 
            : (entry.fp_plus || 0);
          production = Math.round(prod * 10) / 10;

          if (dailyTarget <= 0 || production <= 0) {
            level = 1;
          } else {
            const ratio = production / dailyTarget;
            if (ratio < 1) level = 1;
            else if (ratio < 1.5) level = 2;
            else if (ratio < 2) level = 3;
            else level = 4;
          }
        } else if (isFuture) {
          if (isSunday || isExcluded) {
            level = 'future-off';
          } else if (isPlanned) {
            level = 'future-planned';
          } else {
            level = 'future-off';
          }
        } else {
          // Past day with no entry
          if (isSunday || isExcluded) {
            level = 'off';
          } else {
            level = 'off';
          }
        }

        week.push({
          date: dateStr,
          dayOfMonth: currentDay.getDate(),
          level,
          production,
          target: dailyTarget > 0 ? Math.round(dailyTarget * 10) / 10 : undefined,
          isToday: isTodayDate,
          month,
        });

        currentDay = addDays(currentDay, 1);
      }
      
      allWeeks.push(week);
      weekIndex++;
      
      // Stop if we've passed season end and completed the week
      if (isAfter(currentDay, seasonEnd)) break;
    }

    return { weeks: allWeeks, monthLabels: labels };
  }, [entryMap, plannedSet, excludedSet, effectiveSummerStart, preseasonDailyPace, summerDailyPace, efpModeEnabled]);

  // Auto-scroll to current week on mount
  useEffect(() => {
    if (!scrollRef.current || isLoading) return;
    const today = new Date();
    const seasonStart = parseISO(SEASON_START);
    if (isBefore(today, seasonStart)) return;
    
    const weeksSinceStart = Math.floor((today.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const cellSize = 12; // ~10px + 2px gap
    const scrollTarget = Math.max(0, (weeksSinceStart - 3) * cellSize);
    scrollRef.current.scrollLeft = scrollTarget;
  }, [isLoading]);

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-[100px] w-full rounded-lg" />
        <Skeleton className="h-3 w-40 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Season label */}
      <div className="text-xs font-medium text-muted-foreground">
        Season 2025–26
      </div>

      <div className="flex gap-1">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-[2px] pt-[14px] flex-shrink-0">
          {dayLabels.map((label, i) => (
            <div key={i} className="h-[10px] text-[7px] text-muted-foreground/60 leading-[10px] w-3 text-right pr-0.5">
              {i % 2 === 1 ? label : ''}
            </div>
          ))}
        </div>

        {/* Scrollable heatmap grid */}
        <div ref={scrollRef} className="overflow-x-auto flex-1 scrollbar-hide">
          <div className="inline-flex flex-col">
            {/* Month labels */}
            <div className="flex gap-[2px] mb-[2px]" style={{ height: '12px' }}>
              {weeks.map((_, weekIdx) => {
                const label = monthLabels.find(l => l.weekIndex === weekIdx);
                return (
                  <div key={weekIdx} className="w-[10px] flex-shrink-0">
                    {label && (
                      <span className="text-[7px] text-muted-foreground/60 whitespace-nowrap">
                        {label.month}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Grid rows (one per day-of-week) */}
            {Array.from({ length: 7 }).map((_, dow) => (
              <div key={dow} className="flex gap-[2px]">
                {weeks.map((week, weekIdx) => {
                  const cell = week[dow];
                  if (!cell) return <div key={weekIdx} className="w-[10px] h-[10px]" />;
                  
                  const levelKey = String(cell.level);
                  const isActive = tappedCell === cell.date;
                  
                  return (
                    <div
                      key={weekIdx}
                      className={cn(
                        "w-[10px] h-[10px] rounded-[2px] transition-colors relative",
                        LEVEL_CLASSES[levelKey],
                        cell.isToday && "ring-1 ring-primary ring-offset-1 ring-offset-background",
                        cell.level === 'empty' && "opacity-0"
                      )}
                      onClick={() => {
                        if (cell.level === 'empty') return;
                        setTappedCell(prev => prev === cell.date ? null : cell.date);
                      }}
                    >
                      {/* Tooltip on tap */}
                      {isActive && cell.level !== 'empty' && (
                        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-md bg-popover border border-border shadow-md text-[9px] whitespace-nowrap pointer-events-none">
                          <div className="font-medium text-foreground">{format(parseISO(cell.date), 'MMM d, yyyy')}</div>
                          {cell.production !== undefined ? (
                            <div className="text-muted-foreground">
                              {cell.production} {metricLabel}
                              {cell.target ? ` / ${cell.target} target` : ''}
                            </div>
                          ) : (
                            <div className="text-muted-foreground">
                              {cell.level === 'future-planned' ? 'Planned' : 
                               cell.level === 'future-off' ? 'Off day' : 'No data'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-1 text-[8px] text-muted-foreground">
        <span>Less</span>
        <div className="w-[10px] h-[10px] rounded-[2px] bg-muted/30" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-200 dark:bg-emerald-900" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-400 dark:bg-emerald-700" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-500 dark:bg-emerald-600" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-emerald-700 dark:bg-emerald-400" />
        <span>More</span>
      </div>
    </div>
  );
};
