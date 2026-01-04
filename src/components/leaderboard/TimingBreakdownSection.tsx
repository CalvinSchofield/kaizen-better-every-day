import { useState } from "react";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GritAwards, TimingEntry, TimingSet } from "@/hooks/useExpandedLeaderboard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TimingBreakdownSectionProps {
  gritAwards: GritAwards;
  currentUserId: string | null;
}

type DayFilter = 'all' | 'weekday' | 'saturday';

export const TimingBreakdownSection = ({ gritAwards, currentUserId }: TimingBreakdownSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dayFilter, setDayFilter] = useState<DayFilter>('all');

  const { hasWeekdayData, hasSaturdayData } = gritAwards;
  const showDayFilter = hasWeekdayData && hasSaturdayData;

  // Get the timing set based on filter
  const getTimingSet = (): TimingSet => {
    if (dayFilter === 'weekday') return gritAwards.weekday;
    if (dayFilter === 'saturday') return gritAwards.saturday;
    return {
      earliestDoor: gritAwards.earliestDoor,
      latestDoor: gritAwards.latestDoor,
      earliestDM: gritAwards.earliestDM,
      latestDM: gritAwards.latestDM,
      earliestPitch: gritAwards.earliestPitch,
      latestPitch: gritAwards.latestPitch,
      earliestTransition: gritAwards.earliestTransition,
      latestTransition: gritAwards.latestTransition,
      earliestPresentation: gritAwards.earliestPresentation,
      latestPresentation: gritAwards.latestPresentation,
      earliestClose: gritAwards.earliestClose,
      latestClose: gritAwards.latestClose,
    };
  };

  const timingSet = getTimingSet();

  const timingRows: { action: string; earliest: TimingEntry | null; latest: TimingEntry | null }[] = [
    { action: 'Door Knock', earliest: timingSet.earliestDoor, latest: timingSet.latestDoor },
    { action: 'Decision Maker', earliest: timingSet.earliestDM, latest: timingSet.latestDM },
    { action: 'Pitch', earliest: timingSet.earliestPitch, latest: timingSet.latestPitch },
    { action: 'Transition', earliest: timingSet.earliestTransition, latest: timingSet.latestTransition },
    { action: 'Presentation', earliest: timingSet.earliestPresentation, latest: timingSet.latestPresentation },
    { action: 'Close', earliest: timingSet.earliestClose, latest: timingSet.latestClose },
  ];

  const hasAnyTiming = timingRows.some(row => row.earliest || row.latest);

  // Check if we have any timing data at all (across all filters)
  const hasAnyData = gritAwards.earliestDoor || gritAwards.latestDoor;
  if (!hasAnyData) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Timing Breakdown</span>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="mt-3 space-y-3">
          {/* Day Filter Toggle */}
          {showDayFilter && (
            <div className="flex justify-end">
              <div className="flex items-center gap-0.5 bg-secondary/50 rounded-full p-0.5">
                <button
                  onClick={() => setDayFilter('all')}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                    dayFilter === 'all'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All Days
                </button>
                <button
                  onClick={() => setDayFilter('weekday')}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                    dayFilter === 'weekday'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Mon-Fri
                </button>
                <button
                  onClick={() => setDayFilter('saturday')}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                    dayFilter === 'saturday'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Saturday
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-3 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Action</span>
              <span className="text-center">🌅 Earliest</span>
              <span className="text-center">🌙 Latest</span>
            </div>

            {/* Rows */}
            {hasAnyTiming ? (
              timingRows.map((row) => (
                <div 
                  key={row.action} 
                  className="grid grid-cols-3 px-3 py-2 border-t border-border text-sm"
                >
                  <span className="text-muted-foreground">{row.action}</span>
                  <TimingCell entry={row.earliest} currentUserId={currentUserId} showDay={dayFilter === 'all'} />
                  <TimingCell entry={row.latest} currentUserId={currentUserId} showDay={dayFilter === 'all'} />
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-muted-foreground text-sm">
                No {dayFilter === 'saturday' ? 'Saturday' : dayFilter === 'weekday' ? 'weekday' : ''} timing data yet
              </div>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const TimingCell = ({ entry, currentUserId, showDay }: { entry: TimingEntry | null; currentUserId: string | null; showDay?: boolean }) => {
  if (!entry) {
    return <span className="text-center text-muted-foreground">—</span>;
  }

  const isCurrentUser = currentUserId === entry.userId;
  const firstName = entry.name.split(' ')[0];

  return (
    <div className="text-center">
      <p className={cn(
        "font-medium text-xs",
        isCurrentUser ? "text-primary" : "text-foreground"
      )}>
        {isCurrentUser ? 'You' : firstName}
      </p>
      <p className="text-xs text-muted-foreground">
        {entry.timeValue}
        {showDay && entry.isSaturday && (
          <span className="ml-1 text-[9px] text-amber-600 dark:text-amber-400">(Sat)</span>
        )}
      </p>
    </div>
  );
};
