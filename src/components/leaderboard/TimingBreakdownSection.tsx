import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GritAwards, TimingEntry } from "@/hooks/useExpandedLeaderboard";

interface TimingBreakdownSectionProps {
  gritAwards: GritAwards;
  currentUserId: string | null;
}

export const TimingBreakdownSection = ({ gritAwards, currentUserId }: TimingBreakdownSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const { weekday, saturday, hasWeekdayData, hasSaturdayData } = gritAwards;

  const hasAnyData = hasWeekdayData || hasSaturdayData;
  if (!hasAnyData) return null;

  const showSaturday = hasSaturdayData;

  const timingRows: { 
    action: string;
    emoji: string;
    weekdayEarliest: TimingEntry | null; 
    weekdayLatest: TimingEntry | null;
    saturdayEarliest: TimingEntry | null;
    saturdayLatest: TimingEntry | null;
  }[] = [
    { action: "Door Knock", emoji: "🚪", weekdayEarliest: weekday.earliestDoor, weekdayLatest: weekday.latestDoor, saturdayEarliest: saturday.earliestDoor, saturdayLatest: saturday.latestDoor },
    { action: "Decision Maker", emoji: "🤝", weekdayEarliest: weekday.earliestDM, weekdayLatest: weekday.latestDM, saturdayEarliest: saturday.earliestDM, saturdayLatest: saturday.latestDM },
    { action: "Pitch", emoji: "🎯", weekdayEarliest: weekday.earliestPitch, weekdayLatest: weekday.latestPitch, saturdayEarliest: saturday.earliestPitch, saturdayLatest: saturday.latestPitch },
    { action: "Transition", emoji: "🚪➡️", weekdayEarliest: weekday.earliestTransition, weekdayLatest: weekday.latestTransition, saturdayEarliest: saturday.earliestTransition, saturdayLatest: saturday.latestTransition },
    { action: "Presentation", emoji: "📊", weekdayEarliest: weekday.earliestPresentation, weekdayLatest: weekday.latestPresentation, saturdayEarliest: saturday.earliestPresentation, saturdayLatest: saturday.latestPresentation },
    { action: "Close", emoji: "💰", weekdayEarliest: weekday.earliestClose, weekdayLatest: weekday.latestClose, saturdayEarliest: saturday.earliestClose, saturdayLatest: saturday.latestClose },
  ];

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all",
          "bg-muted/40 border border-border/50",
          "active:scale-[0.98]"
        )}
      >
        <div className="flex items-center gap-2.5">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Timing Breakdown</span>
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform duration-300",
          isOpen && "rotate-180"
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-2">
              {/* Column headers */}
              <div className="grid gap-2" style={{ gridTemplateColumns: showSaturday ? "1fr 1fr 1fr" : "1fr 1fr" }}>
                {/* Spacer for action column — implicit via first card */}
                <div />
                <div className="text-center">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                    {showSaturday ? "Mon – Fri" : "Weekdays"}
                  </span>
                </div>
                {showSaturday && (
                  <div className="text-center">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                      Saturday
                    </span>
                  </div>
                )}
              </div>

              {timingRows.map((row, i) => (
                <motion.div
                  key={row.action}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="rounded-xl bg-card/60 border border-border/40 p-3"
                >
                  <div className="grid gap-2" style={{ gridTemplateColumns: showSaturday ? "1fr 1fr 1fr" : "1fr 1fr" }}>
                    {/* Action label */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{row.emoji}</span>
                      <span className="text-xs font-medium text-foreground">{row.action}</span>
                    </div>

                    {/* Weekday: early → late */}
                    <div className="flex items-center justify-center gap-2">
                      <TimingPill entry={row.weekdayEarliest} type="early" currentUserId={currentUserId} />
                      <span className="text-muted-foreground/30 text-[10px]">→</span>
                      <TimingPill entry={row.weekdayLatest} type="late" currentUserId={currentUserId} />
                    </div>

                    {/* Saturday: early → late */}
                    {showSaturday && (
                      <div className="flex items-center justify-center gap-2">
                        <TimingPill entry={row.saturdayEarliest} type="early" currentUserId={currentUserId} />
                        <span className="text-muted-foreground/30 text-[10px]">→</span>
                        <TimingPill entry={row.saturdayLatest} type="late" currentUserId={currentUserId} />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TimingPill = ({
  entry,
  type,
  currentUserId,
}: {
  entry: TimingEntry | null;
  type: "early" | "late";
  currentUserId: string | null;
}) => {
  if (!entry) {
    return <span className="text-[10px] text-muted-foreground/40">—</span>;
  }

  const isYou = currentUserId === entry.userId;
  const firstName = entry.name.split(" ")[0];

  return (
    <div className="text-center min-w-0">
      <p className={cn(
        "text-[10px] font-semibold leading-tight truncate",
        isYou ? "text-primary" : "text-foreground"
      )}>
        {isYou ? "You" : firstName}
      </p>
      <p className="text-[9px] text-muted-foreground">{entry.timeValue}</p>
    </div>
  );
};
