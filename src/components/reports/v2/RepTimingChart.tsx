import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";
import { formatFP } from "@/lib/formatters";

interface DayTiming {
  date: string;
  startTime: string | null;
  endTime: string | null;
  hoursWorked: number;
  timezone?: string | null;
  fp?: number;
  prmr?: number;
}

interface RepTimingChartProps {
  days: DayTiming[];
  className?: string;
  useEfp?: boolean;
}

const HOUR_START = 6;
const HOUR_END = 23;
const TOTAL_HOURS = HOUR_END - HOUR_START;

const isoToLocalHours = (iso: string, tz?: string | null): number => {
  if (tz) {
    try {
      const d = new Date(iso);
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(d);
      const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
      const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
      return hour + minute / 60;
    } catch {
      // fallback below
    }
  }
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
};

const formatTime12 = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const ampm = h >= 12 ? 'p' : 'a';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m > 0 ? `${h12}:${m.toString().padStart(2, '0')}${ampm}` : `${h12}${ampm}`;
};

export const RepTimingChart = ({ days, className, useEfp = false }: RepTimingChartProps) => {
  const [showDates, setShowDates] = useState(false);
  const validDays = days.filter(d => d.startTime && d.endTime);

  const bestDayDate = useMemo(() => {
    if (validDays.length <= 1) return null;
    let bestVal = -1;
    let bestDate = '';
    for (const d of validDays) {
      const val = useEfp ? (d.prmr || 0) / 85 : (d.fp || 0);
      if (val > bestVal && val > 0) {
        bestVal = val;
        bestDate = d.date;
      }
    }
    return bestDate || null;
  }, [validDays, useEfp]);

  if (validDays.length === 0) return null;

  const hourLabels = [8, 12, 16, 20];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl border border-border/50 bg-card p-4 space-y-3", className)}
    >
      <div className="space-y-1">
        {/* Hour axis */}
        <div className="relative h-4 ml-10">
          {hourLabels.map(h => {
            const pct = ((h - HOUR_START) / TOTAL_HOURS) * 100;
            return (
              <span
                key={h}
                className="absolute text-[9px] text-muted-foreground/60 -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                {formatTime12(h)}
              </span>
            );
          })}
        </div>

        {/* Bars */}
        {validDays.map((day, i) => {
          const start = isoToLocalHours(day.startTime!, day.timezone);
          const end = isoToLocalHours(day.endTime!, day.timezone);
          const leftPct = Math.max(0, ((start - HOUR_START) / TOTAL_HOURS) * 100);
          const widthPct = Math.min(100 - leftPct, ((end - start) / TOTAL_HOURS) * 100);
          const dayLabel = format(parseISO(day.date), 'EEE');
          const dateLabel = format(parseISO(day.date), 'M/d');
          const isBest = day.date === bestDayDate;
          const dayFp = useEfp ? (day.prmr || 0) / 85 : (day.fp || 0);

          return (
            <div key={day.date} className={cn("flex items-center gap-2 h-6", isBest && "relative")}>
              <button
                type="button"
                onClick={() => setShowDates(v => !v)}
                className="text-[10px] text-muted-foreground w-8 text-right font-medium shrink-0 cursor-pointer select-none"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={showDates ? 'date' : 'day'}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className={cn("block", isBest && "text-primary font-bold")}
                  >
                    {showDates ? dateLabel : dayLabel}
                  </motion.span>
                </AnimatePresence>
              </button>
              <div className="flex-1 relative bg-muted/30 rounded-full h-4 overflow-hidden">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                  className={cn(
                    "absolute top-0 h-full rounded-full origin-left",
                    isBest ? "bg-primary/80" :
                    day.hoursWorked >= 6 ? "bg-primary/70" :
                    day.hoursWorked >= 4 ? "bg-primary/50" :
                    "bg-primary/30"
                  )}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                />
                <span
                  className="absolute text-[8px] text-primary-foreground/80 font-medium top-0.5 leading-tight"
                  style={{ left: `${leftPct + 1}%` }}
                >
                  {formatTime12(start)}
                </span>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {isBest && (
                  <Crown className="w-2.5 h-2.5 text-amber-500" />
                )}
                <span className={cn(
                  "text-[9px] text-muted-foreground w-10",
                  isBest && "font-semibold text-foreground"
                )}>
                  {day.hoursWorked.toFixed(1)}h
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
