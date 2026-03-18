import { useState, useRef, useEffect, useMemo } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DayPicker, DateRange } from "react-day-picker";
import { buttonVariants } from "@/components/ui/button";
import { hapticSelection } from "@/utils/haptics";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  getSeasonDateRange,
  getSeasonWeeks,
  getSeasonMonths,
  getCurrentSeasonWeekLabel,
  getSeasonInfo,
  type SeasonType,
} from "@/utils/seasonWeekUtils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface CustomDateRangeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate?: Date;
  endDate?: Date;
  onApply: (start: Date, end: Date) => void;
}

const SEASON_YEAR = 2026;

type QuickSelectType = 'season' | 'week' | 'month' | null;

export const CustomDateRangeDrawer = ({
  open,
  onOpenChange,
  startDate,
  endDate,
  onApply,
}: CustomDateRangeDrawerProps) => {
  const [range, setRange] = useState<DateRange | undefined>(
    startDate && endDate ? { from: startDate, to: endDate } : undefined
  );
  const [activeQuickSelect, setActiveQuickSelect] = useState<{ type: QuickSelectType; label: string } | null>(null);
  const currentWeekRef = useRef<HTMLButtonElement>(null);

  // Reset state when drawer opens
  useEffect(() => {
    if (open) {
      setRange(startDate && endDate ? { from: startDate, to: endDate } : undefined);
      setActiveQuickSelect(null);
    }
  }, [open, startDate, endDate]);

  // Auto-scroll to current week
  useEffect(() => {
    if (open && currentWeekRef.current) {
      setTimeout(() => {
        currentWeekRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 300);
    }
  }, [open]);

  const currentWeekLabel = useMemo(() => getCurrentSeasonWeekLabel(), []);

  // Quick select data
  const seasons: { label: string; type: SeasonType; range: { start: Date; end: Date } | null }[] = useMemo(() => {
    const today = new Date();
    return (['preseason', 'summer', 'extension'] as SeasonType[]).map(type => ({
      label: type.charAt(0).toUpperCase() + type.slice(1),
      type,
      range: getSeasonDateRange(SEASON_YEAR, type),
    })).filter(s => s.range && s.range.start <= today); // Only show seasons that have started
  }, []);

  const weeks = useMemo(() => {
    const allWeeks: { label: string; start: Date; end: Date; weekNum: number; seasonType: SeasonType }[] = [];
    for (const st of ['preseason', 'summer', 'extension'] as SeasonType[]) {
      const seasonWeeks = getSeasonWeeks(SEASON_YEAR, st);
      allWeeks.push(...seasonWeeks.map(w => ({ ...w, seasonType: st })));
    }
    return allWeeks;
  }, []);

  const months = useMemo(() => getSeasonMonths(SEASON_YEAR), []);

  const handleQuickSelect = (label: string, start: Date, end: Date, type: QuickSelectType) => {
    hapticSelection();
    const today = new Date();
    const clampedEnd = end > today ? today : end;
    setRange({ from: start, to: clampedEnd });
    setActiveQuickSelect({ type, label });
  };

  const handleDayClick = () => {
    hapticSelection();
    setActiveQuickSelect(null);
  };

  const handleApply = () => {
    if (range?.from && range?.to) {
      onApply(range.from, range.to);
      onOpenChange(false);
    }
  };

  const handleReset = () => {
    setRange(undefined);
    setActiveQuickSelect(null);
  };

  const isChipActive = (label: string, type: QuickSelectType) => {
    return activeQuickSelect?.type === type && activeQuickSelect?.label === label;
  };

  const today = new Date();
  const currentSeasonInfo = getSeasonInfo(today);
  const currentMonthLabel = format(today, "MMM ''yy");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-lg">Select Date Range</DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col overflow-hidden">
          {/* Date Range Header */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-3">
              <div className="flex-1 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Start</p>
                <p className={cn(
                  "text-sm font-semibold mt-0.5",
                  range?.from ? "text-foreground" : "text-muted-foreground"
                )}>
                  {range?.from ? format(range.from, 'EEE, MMM d') : '—'}
                </p>
              </div>
              <div className="px-3">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">End</p>
                <p className={cn(
                  "text-sm font-semibold mt-0.5",
                  range?.to ? "text-foreground" : "text-muted-foreground"
                )}>
                  {range?.to ? format(range.to, 'EEE, MMM d') : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Select Section */}
          <div className="px-4 space-y-2.5 pb-3">
            {/* Seasons */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 pl-0.5">Season</p>
              <div className="flex gap-1.5">
                {seasons.map(s => {
                  if (!s.range) return null;
                  const isCurrent = currentSeasonInfo?.type === s.type;
                  return (
                    <button
                      key={s.type}
                      onClick={() => handleQuickSelect(s.label, s.range!.start, s.range!.end, 'season')}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all relative",
                        isChipActive(s.label, 'season')
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-secondary/70 text-secondary-foreground hover:bg-secondary"
                      )}
                    >
                      {s.label}
                      {isCurrent && !isChipActive(s.label, 'season') && (
                        <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weeks - horizontally scrollable */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 pl-0.5">Week</p>
              <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                <div className="flex gap-1.5 min-w-max pb-1">
                  {weeks.map((w) => {
                    const isCurrent = w.label === currentWeekLabel;
                    return (
                      <button
                        key={w.label}
                        ref={isCurrent ? currentWeekRef : undefined}
                        onClick={() => handleQuickSelect(w.label, w.start, w.end, 'week')}
                        className={cn(
                          "px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap relative",
                          isChipActive(w.label, 'week')
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : isCurrent
                              ? "bg-primary/15 text-primary border border-primary/30"
                              : "bg-secondary/70 text-secondary-foreground hover:bg-secondary"
                        )}
                      >
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Months */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 pl-0.5">Month</p>
              <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                <div className="flex gap-1.5 min-w-max pb-1">
                  {months.map((m) => {
                    const isCurrent = m.label === currentMonthLabel;
                    return (
                      <button
                        key={m.label}
                        onClick={() => handleQuickSelect(m.label, m.start, m.end, 'month')}
                        className={cn(
                          "px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap relative",
                          isChipActive(m.label, 'month')
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : isCurrent
                              ? "bg-primary/15 text-primary border border-primary/30"
                              : "bg-secondary/70 text-secondary-foreground hover:bg-secondary"
                        )}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Inline Range Calendar */}
          <div className="border-t overflow-y-auto flex-1 flex justify-center">
            <DayPicker
              mode="range"
              selected={range}
              onSelect={(r) => {
                setRange(r);
                setActiveQuickSelect(null);
              }}
              onDayClick={handleDayClick}
              numberOfMonths={1}
              disabled={(date) => date > today}
              defaultMonth={range?.from || today}
              showOutsideDays
              className={cn("p-3 pointer-events-auto")}
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                  buttonVariants({ variant: "outline" }),
                  "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-10 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: cn(
                  "h-10 w-10 text-center text-sm p-0 relative",
                  "[&:has([aria-selected].day-range-end)]:rounded-r-md",
                  "[&:has([aria-selected].day-outside)]:bg-accent/50",
                  "[&:has([aria-selected])]:bg-accent",
                  "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
                  "focus-within:relative focus-within:z-20"
                ),
                day: cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-10 w-10 p-0 font-normal aria-selected:opacity-100"
                ),
                day_range_end: "day-range-end",
                day_selected:
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground font-bold",
                day_outside:
                  "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                day_disabled: "text-muted-foreground opacity-50",
                day_range_middle:
                  "aria-selected:bg-accent aria-selected:text-accent-foreground",
                day_hidden: "invisible",
              }}
              components={{
                IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                IconRight: () => <ChevronRight className="h-4 w-4" />,
              }}
            />
          </div>

          {/* Action Bar */}
          <div className="border-t p-4 flex items-center gap-3">
            <button
              onClick={handleReset}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset
            </button>
            <Button
              onClick={handleApply}
              disabled={!range?.from || !range?.to}
              className="flex-1"
            >
              Done
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
