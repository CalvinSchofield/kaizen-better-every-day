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

  const timingRows: { action: string; earliest: TimingEntry | null; latest: TimingEntry | null }[] = [
    { action: 'Door Knock', earliest: gritAwards.earliestDoor, latest: gritAwards.latestDoor },
    { action: 'Decision Maker', earliest: gritAwards.earliestDM, latest: gritAwards.latestDM },
    { action: 'Pitch', earliest: gritAwards.earliestPitch, latest: gritAwards.latestPitch },
    { action: 'Transition', earliest: gritAwards.earliestTransition, latest: gritAwards.latestTransition },
    { action: 'Presentation', earliest: gritAwards.earliestPresentation, latest: gritAwards.latestPresentation },
    { action: 'Close', earliest: gritAwards.earliestClose, latest: gritAwards.latestClose },
  ];

  const hasAnyTiming = timingRows.some(row => row.earliest || row.latest);

  if (!hasAnyTiming) {
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
        <div className="mt-3 rounded-lg border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Action</span>
            <span className="text-center">🌅 Earliest</span>
            <span className="text-center">🌙 Latest</span>
          </div>

          {/* Rows */}
          {timingRows.map((row) => (
            <div 
              key={row.action} 
              className="grid grid-cols-3 px-3 py-2 border-t border-border text-sm"
            >
              <span className="text-muted-foreground">{row.action}</span>
              <TimingCell entry={row.earliest} currentUserId={currentUserId} />
              <TimingCell entry={row.latest} currentUserId={currentUserId} />
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const TimingCell = ({ entry, currentUserId }: { entry: TimingEntry | null; currentUserId: string | null }) => {
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
      <p className="text-xs text-muted-foreground">{entry.timeValue}</p>
    </div>
  );
};
