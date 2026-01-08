import { useState } from "react";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GritAwards, TimingEntry } from "@/hooks/useExpandedLeaderboard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TimingBreakdownSectionProps {
  gritAwards: GritAwards;
  currentUserId: string | null;
}

export const TimingBreakdownSection = ({ gritAwards, currentUserId }: TimingBreakdownSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const { weekday, saturday, hasWeekdayData, hasSaturdayData } = gritAwards;

  const hasAnyData = hasWeekdayData || hasSaturdayData;
  if (!hasAnyData) {
    return null;
  }

  // Only show Saturday columns if there's Saturday data
  const showSaturday = hasSaturdayData;

  const timingRows: { 
    action: string; 
    weekdayEarliest: TimingEntry | null; 
    weekdayLatest: TimingEntry | null;
    saturdayEarliest: TimingEntry | null;
    saturdayLatest: TimingEntry | null;
  }[] = [
    { 
      action: 'Door Knock', 
      weekdayEarliest: weekday.earliestDoor, weekdayLatest: weekday.latestDoor,
      saturdayEarliest: saturday.earliestDoor, saturdayLatest: saturday.latestDoor 
    },
    { 
      action: 'Decision Maker', 
      weekdayEarliest: weekday.earliestDM, weekdayLatest: weekday.latestDM,
      saturdayEarliest: saturday.earliestDM, saturdayLatest: saturday.latestDM 
    },
    { 
      action: 'Pitch', 
      weekdayEarliest: weekday.earliestPitch, weekdayLatest: weekday.latestPitch,
      saturdayEarliest: saturday.earliestPitch, saturdayLatest: saturday.latestPitch 
    },
    { 
      action: 'Transition', 
      weekdayEarliest: weekday.earliestTransition, weekdayLatest: weekday.latestTransition,
      saturdayEarliest: saturday.earliestTransition, saturdayLatest: saturday.latestTransition 
    },
    { 
      action: 'Presentation', 
      weekdayEarliest: weekday.earliestPresentation, weekdayLatest: weekday.latestPresentation,
      saturdayEarliest: saturday.earliestPresentation, saturdayLatest: saturday.latestPresentation 
    },
    { 
      action: 'Close', 
      weekdayEarliest: weekday.earliestClose, weekdayLatest: weekday.latestClose,
      saturdayEarliest: saturday.earliestClose, saturdayLatest: saturday.latestClose 
    },
  ];

  // Dynamic grid classes based on whether Saturday is shown
  const headerGridClass = showSaturday ? "grid-cols-5" : "grid-cols-3";
  const weekdayColSpan = showSaturday ? "col-span-2" : "col-span-2";

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
        <div className="mt-3 rounded-lg border border-border overflow-hidden">
          {/* Header */}
          <div className={`grid ${headerGridClass} bg-muted/50 px-2 py-2 text-[10px] font-medium text-muted-foreground`}>
            <span className="col-span-1"></span>
            <span className={`${weekdayColSpan} text-center border-l border-border`}>
              {showSaturday ? 'Mon-Fri' : 'Weekdays'}
            </span>
            {showSaturday && (
              <span className="col-span-2 text-center border-l border-border">Saturday</span>
            )}
          </div>
          <div className={`grid ${headerGridClass} bg-muted/30 px-2 py-1.5 text-[9px] font-medium text-muted-foreground`}>
            <span className="col-span-1">Action</span>
            <span className="text-center border-l border-border">🌅 Early</span>
            <span className="text-center">🌙 Late</span>
            {showSaturday && (
              <>
                <span className="text-center border-l border-border">🌅 Early</span>
                <span className="text-center">🌙 Late</span>
              </>
            )}
          </div>

          {/* Rows */}
          {timingRows.map((row) => (
            <div 
              key={row.action} 
              className={`grid ${headerGridClass} px-2 py-2 border-t border-border text-xs`}
            >
              <span className="text-muted-foreground text-[11px]">{row.action}</span>
              <TimingCell entry={row.weekdayEarliest} currentUserId={currentUserId} className="border-l border-border" />
              <TimingCell entry={row.weekdayLatest} currentUserId={currentUserId} />
              {showSaturday && (
                <>
                  <TimingCell entry={row.saturdayEarliest} currentUserId={currentUserId} className="border-l border-border" />
                  <TimingCell entry={row.saturdayLatest} currentUserId={currentUserId} />
                </>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const TimingCell = ({ 
  entry, 
  currentUserId,
  className 
}: { 
  entry: TimingEntry | null; 
  currentUserId: string | null;
  className?: string;
}) => {
  if (!entry) {
    return <span className={cn("text-center text-muted-foreground", className)}>—</span>;
  }

  const isCurrentUser = currentUserId === entry.userId;
  const firstName = entry.name.split(' ')[0];

  return (
    <div className={cn("text-center", className)}>
      <p className={cn(
        "font-medium text-[10px]",
        isCurrentUser ? "text-primary" : "text-foreground"
      )}>
        {isCurrentUser ? 'You' : firstName}
      </p>
      <p className="text-[9px] text-muted-foreground">{entry.timeValue}</p>
    </div>
  );
};
