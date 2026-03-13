import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { format, parseISO, getDay, isToday, isBefore, startOfWeek, addDays, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { PlannedDay } from '@/hooks/usePlannedDays';
import { GoalTier, GOAL_TIER_CONFIG } from '@/config/goalTiers';

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
  activeTier: GoalTier;
  dailyNeeded: number;
  remainingFp?: number;
  preseasonGoalHit?: boolean;
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
  isSummer: boolean;
  isBestDay: boolean;
}

// Tier-aware color palettes
const TIER_LEVEL_CLASSES: Record<GoalTier, Record<string, string>> = {
  preseason: {
    '1': 'bg-blue-200 dark:bg-blue-900',
    '2': 'bg-blue-400 dark:bg-blue-700',
    '3': 'bg-blue-500 dark:bg-blue-600',
    '4': 'bg-blue-700 dark:bg-blue-400',
  },
  mustDo: {
    '1': 'bg-emerald-200 dark:bg-emerald-900',
    '2': 'bg-emerald-400 dark:bg-emerald-700',
    '3': 'bg-emerald-500 dark:bg-emerald-600',
    '4': 'bg-emerald-700 dark:bg-emerald-400',
  },
  willDo: {
    '1': 'bg-amber-200 dark:bg-amber-900',
    '2': 'bg-amber-400 dark:bg-amber-700',
    '3': 'bg-amber-500 dark:bg-amber-600',
    '4': 'bg-amber-700 dark:bg-amber-400',
  },
  couldDo: {
    '1': 'bg-purple-200 dark:bg-purple-900',
    '2': 'bg-purple-400 dark:bg-purple-700',
    '3': 'bg-purple-500 dark:bg-purple-600',
    '4': 'bg-purple-700 dark:bg-purple-400',
  },
};

const BASE_LEVEL_CLASSES: Record<string, string> = {
  'off': 'bg-muted/30',
  'future-off': 'bg-muted/20',
  'future-planned': 'bg-background border border-border/40',
  'empty': 'bg-transparent',
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
  activeTier,
  dailyNeeded,
  remainingFp = 0,
  preseasonGoalHit = false,
}: SeasonHeatmapProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tappedCell, setTappedCell] = useState<string | null>(null);

  // Dismiss tooltip on tap outside
  const handleBackdropTap = useCallback(() => {
    setTappedCell(null);
  }, []);

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

  // Build week-column grid — only Mon–Sat (skip Sunday)
  const { weeks, monthLabels } = useMemo(() => {
    const seasonStart = parseISO(SEASON_START);
    const seasonEnd = parseISO(SEASON_END);
    const today = new Date();
    const summerStartDate = parseISO(effectiveSummerStart);

    const gridStart = startOfWeek(seasonStart, { weekStartsOn: 1 });
    
    const allWeeks: CellData[][] = [];
    const labels: { month: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    let currentDay = gridStart;
    let weekIndex = 0;

    while (!isAfter(currentDay, seasonEnd) || getDay(currentDay) !== 1) {
      const week: CellData[] = [];
      
      for (let i = 0; i < 6; i++) {
        const dateStr = format(currentDay, 'yyyy-MM-dd');
        const month = currentDay.getMonth();
        const inSeason = !isBefore(currentDay, seasonStart) && !isAfter(currentDay, seasonEnd);
        
        if (i === 0 && month !== lastMonth && inSeason) {
          labels.push({ month: format(currentDay, 'MMM'), weekIndex });
          lastMonth = month;
        }

        if (!inSeason) {
          week.push({ date: dateStr, dayOfMonth: currentDay.getDate(), level: 'empty', isToday: false, month, isSummer: false });
          currentDay = addDays(currentDay, 1);
          continue;
        }

        const isSunday = getDay(currentDay) === 0;
        const isExcluded = excludedSet.has(dateStr);
        const isFuture = isAfter(currentDay, today);
        const isPlanned = plannedSet.has(dateStr);
        const entry = entryMap.get(dateStr);
        const isTodayDate = isToday(currentDay);

        const isSummer = !isBefore(currentDay, summerStartDate);
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
          level = 'off';
        }

        week.push({
          date: dateStr,
          dayOfMonth: currentDay.getDate(),
          level,
          production,
          target: dailyTarget > 0 ? Math.round(dailyTarget * 10) / 10 : undefined,
          isToday: isTodayDate,
          month,
          isSummer,
        });

        currentDay = addDays(currentDay, 1);
      }

      // Skip Sunday
      if (getDay(currentDay) === 0) {
        currentDay = addDays(currentDay, 1);
      }
      
      allWeeks.push(week);
      weekIndex++;
      
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
    const cellSize = 16;
    const scrollTarget = Math.max(0, (weeksSinceStart - 3) * cellSize);
    scrollRef.current.scrollLeft = scrollTarget;
  }, [isLoading]);

  // Determine if we're currently in preseason or summer
  const today = new Date();
  const isCurrentlyPreseason = isBefore(today, parseISO(effectiveSummerStart));

  // For the badge: show Preseason during preseason, focus tier during summer
  const displayTier: GoalTier = isCurrentlyPreseason ? 'preseason' : activeTier;
  const displayTierConfig = GOAL_TIER_CONFIG[displayTier];
  const DisplayTierIcon = displayTierConfig.icon;

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S'];
  const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';

  // Get cell color: preseason dates always use blue, summer dates use focus tier
  const getCellClass = (level: CellLevel, isSummer: boolean) => {
    const key = String(level);
    const baseLevelClass = BASE_LEVEL_CLASSES[key];
    if (baseLevelClass) return baseLevelClass;
    
    const tierForColor = isSummer ? activeTier : 'preseason';
    const tierColors = TIER_LEVEL_CLASSES[tierForColor];
    return tierColors[key] || '';
  };

  // Find tapped cell data for the tooltip
  const tappedCellData = useMemo(() => {
    if (!tappedCell) return null;
    for (const week of weeks) {
      for (const cell of week) {
        if (cell.date === tappedCell) return cell;
      }
    }
    return null;
  }, [tappedCell, weeks]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-[110px] w-full rounded-lg" />
        <Skeleton className="h-3 w-40 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header: season label + tier badge + pace */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">
          Season 2025–26
        </div>
        {isCurrentlyPreseason && preseasonGoalHit ? (
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold",
            "bg-emerald-500/10 text-emerald-500"
          )}>
            <span>🎉</span>
            <span>Preseason goal hit!</span>
          </div>
        ) : (
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold",
            displayTierConfig.bgColor, displayTierConfig.color
          )}>
            <DisplayTierIcon className="w-3 h-3" />
            <span>{displayTierConfig.label}</span>
            <span className="opacity-60">·</span>
            <span>
              {dailyNeeded} {metricLabel}/day
              {isCurrentlyPreseason && remainingFp > 0 && dailyNeeded >= 5 && (
                <span className="opacity-60"> · {remainingFp} left</span>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 relative">
        {/* Day-of-week labels — 6 rows */}
        <div className="flex flex-col gap-[2px] pt-[16px] flex-shrink-0">
          {dayLabels.map((label, i) => (
            <div key={i} className="h-[14px] text-[8px] text-muted-foreground/60 leading-[14px] w-4 text-right pr-0.5">
              {i % 2 === 0 ? label : ''}
            </div>
          ))}
        </div>

        {/* Scrollable heatmap grid */}
        <div 
          ref={scrollRef} 
          className="overflow-x-auto flex-1 scrollbar-hide" 
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="inline-flex flex-col">
            {/* Month labels */}
            <div className="flex gap-[2px] mb-[2px]" style={{ height: '14px' }}>
              {weeks.map((_, weekIdx) => {
                const label = monthLabels.find(l => l.weekIndex === weekIdx);
                return (
                  <div key={weekIdx} className="w-[14px] flex-shrink-0">
                    {label && (
                      <span className="text-[8px] text-muted-foreground/70 font-medium whitespace-nowrap">
                        {label.month}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Grid rows (Mon–Sat = 6 rows) */}
            {Array.from({ length: 6 }).map((_, dow) => (
              <div key={dow} className="flex gap-[2px]">
                {weeks.map((week, weekIdx) => {
                  const cell = week[dow];
                  if (!cell) return <div key={weekIdx} className="w-[14px] h-[14px]" />;
                  
                  const isSelected = tappedCell === cell.date;
                  
                  return (
                    <div
                      key={weekIdx}
                      className={cn(
                        "w-[14px] h-[14px] rounded-[3px] transition-all relative",
                        getCellClass(cell.level, cell.isSummer),
                        cell.isToday && "ring-1 ring-primary ring-offset-1 ring-offset-background",
                        isSelected && "ring-2 ring-foreground scale-[1.3] z-10",
                        cell.level === 'empty' && "opacity-0"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (cell.level === 'empty') return;
                        setTappedCell(prev => prev === cell.date ? null : cell.date);
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Floating tooltip - dismiss on tap outside */}
        {tappedCell && tappedCellData && tappedCellData.level !== 'empty' && (
          <>
            {/* Invisible backdrop to catch taps outside */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={handleBackdropTap}
            />
            <div className="absolute z-50 top-0 right-0 mt-[-4px] mr-0 px-3 py-2 rounded-xl bg-popover border border-border shadow-xl text-xs pointer-events-none">
              <div className="font-semibold text-foreground">{format(parseISO(tappedCellData.date), 'EEE, MMM d')}</div>
              {tappedCellData.production !== undefined ? (
                <div className="text-muted-foreground mt-0.5">
                  {tappedCellData.production} {metricLabel}
                  {tappedCellData.target ? ` / ${tappedCellData.target} target` : ''}
                </div>
              ) : (
                <div className="text-muted-foreground mt-0.5">
                  {tappedCellData.level === 'future-planned' ? 'Planned' : 
                   tappedCellData.level === 'future-off' ? 'Off day' : 'No data'}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Legend — preseason colors (blue) + summer colors (focus tier) */}
      <div className="flex items-center justify-center gap-1.5 text-[9px] text-muted-foreground">
        <span>Less</span>
        <div className="w-[12px] h-[12px] rounded-[3px] bg-muted/30" />
        <div className={cn("w-[12px] h-[12px] rounded-[3px]", TIER_LEVEL_CLASSES[displayTier]['1'])} />
        <div className={cn("w-[12px] h-[12px] rounded-[3px]", TIER_LEVEL_CLASSES[displayTier]['2'])} />
        <div className={cn("w-[12px] h-[12px] rounded-[3px]", TIER_LEVEL_CLASSES[displayTier]['3'])} />
        <div className={cn("w-[12px] h-[12px] rounded-[3px]", TIER_LEVEL_CLASSES[displayTier]['4'])} />
        <span>More</span>
      </div>
    </div>
  );
};
