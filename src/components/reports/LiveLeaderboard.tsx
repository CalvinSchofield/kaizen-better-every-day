import { Card } from "@/components/ui/card";
import { Trophy, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { RepDetailDrawer } from "./RepDetailDrawer";

interface LiveRepData {
  userId: string;
  name: string;
  teamName: string;
  mgmtGroupName?: string;
  year?: string;
  todayStats: {
    doors: number;
    dms: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    prmr: number;
    upgradePrmr?: number;
    isFinalized?: boolean;
  };
  workStartTime?: string;
  workEndTime?: string;
  breakMinutes?: number;
  durationMinutes?: number;
}

interface LiveLeaderboardProps {
  liveReps: LiveRepData[];
  isLoading?: boolean;
  hasWorkingReps?: boolean;
  title?: string;
}

const stripEmojis = (text: string) => {
  return text.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}]/gu, '').trim();
};

const formatTime = (timestamp: string | undefined) => {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return null;
  }
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export const LiveLeaderboard = ({ liveReps, isLoading, hasWorkingReps = true, title = "Today's Activity" }: LiveLeaderboardProps) => {
  const [selectedRep, setSelectedRep] = useState<LiveRepData | null>(null);
  const [repDrawerOpen, setRepDrawerOpen] = useState(false);

  const handleRepClick = (rep: LiveRepData) => {
    setSelectedRep(rep);
    setRepDrawerOpen(true);
  };

  // Convert LiveRepData to RepDetailData format
  const getRepDetailData = (rep: LiveRepData & { durationMinutes?: number }) => {
    if (!rep) return null;
    return {
      userId: rep.userId,
      name: rep.name,
      year: rep.year || 'unknown',
      teamName: rep.teamName || 'No Team',
      mgmtGroupName: rep.mgmtGroupName || 'No Group',
      doors: rep.todayStats.doors,
      dms: rep.todayStats.dms,
      pitches: rep.todayStats.pitches,
      transitions: rep.todayStats.transitions,
      presentations: rep.todayStats.presentations,
      closes: rep.todayStats.closes,
      fp: rep.todayStats.fp,
      upgradeFP: (rep.todayStats.upgradePrmr || 0) / 85,
      prmr: rep.todayStats.prmr,
      upgradePRMR: rep.todayStats.upgradePrmr || 0,
      doorsToFpRatio: rep.todayStats.fp > 0 ? rep.todayStats.doors / rep.todayStats.fp : 0,
      hoursWorked: (rep.durationMinutes || 0) / 60,
      daysWorked: 1,
      workStartTime: rep.workStartTime,
      workEndTime: rep.workEndTime,
    };
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="h-5 w-32 bg-muted rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-4 w-12 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const workingReps = liveReps.filter(r => r.todayStats.doors > 0 || r.todayStats.fp > 0);

  // Calculate work duration for each rep
  const repsWithDuration = workingReps.map(rep => {
    let durationMinutes = rep.durationMinutes || 0;
    if (!durationMinutes && rep.workStartTime) {
      const start = new Date(rep.workStartTime);
      const end = rep.workEndTime ? new Date(rep.workEndTime) : new Date();
      durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      durationMinutes -= (rep.breakMinutes || 0);
      durationMinutes = Math.max(0, durationMinutes);
    }
    return { ...rep, durationMinutes };
  });

  // Sort by FP+ desc, then PRMR as tiebreaker, then doors as secondary tiebreaker
  const sortedReps = [...repsWithDuration].sort((a, b) => {
    if (b.todayStats.fp !== a.todayStats.fp) return b.todayStats.fp - a.todayStats.fp;
    if (b.todayStats.prmr !== a.todayStats.prmr) return b.todayStats.prmr - a.todayStats.prmr;
    return b.todayStats.doors - a.todayStats.doors;
  });

  // Calculate team totals
  const totalFP = repsWithDuration.reduce((sum, r) => sum + r.todayStats.fp, 0);
  const totalPRMR = repsWithDuration.reduce((sum, r) => sum + r.todayStats.prmr, 0);
  const totalDoors = repsWithDuration.reduce((sum, r) => sum + r.todayStats.doors, 0);
  const totalPresentations = repsWithDuration.reduce((sum, r) => sum + r.todayStats.presentations, 0);

  if (workingReps.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="font-semibold mb-4">{title}</h3>
        <div className="text-center py-6 text-muted-foreground text-sm">
          <Trophy className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No activity recorded yet</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              {hasWorkingReps && (
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-75" />
              )}
            </div>
            <h3 className="font-semibold">{title}</h3>
          </div>
          <span className="text-xs text-muted-foreground">{workingReps.length} working</span>
        </div>

        {/* Team Totals - compact row */}
        <div className="flex items-center gap-4 mb-4 py-2 px-3 bg-primary/5 rounded-lg text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">FP+:</span>
            <span className="font-bold text-primary">{totalFP.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">PRMR:</span>
            <span className="font-bold text-green-700 dark:text-green-500">${totalPRMR.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Doors:</span>
            <span className="font-semibold">{totalDoors}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Pres:</span>
            <span className="font-semibold">{totalPresentations}</span>
          </div>
        </div>

        {/* Simple Table Header */}
        <div className="grid grid-cols-[1fr_60px_70px_50px_50px] gap-2 px-2 py-1 text-xs text-muted-foreground font-medium border-b border-border/50 mb-1">
          <span>Rep</span>
          <span className="text-right">FP+</span>
          <span className="text-right">PRMR</span>
          <span className="text-right">Pres</span>
          <span className="text-right">Doors</span>
        </div>

        {/* Rep Rows - sorted by production */}
        <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
          {sortedReps.map((rep, idx) => {
            const hasSales = rep.todayStats.fp > 0;
            return (
              <button 
                key={rep.userId}
                onClick={() => handleRepClick(rep)}
                className={cn(
                  "grid grid-cols-[1fr_60px_70px_50px_50px] gap-2 px-2 py-2 rounded-md text-sm w-full text-left transition-colors hover:bg-muted/50",
                  hasSales && "bg-primary/5"
                )}
              >
                {/* Name + Team */}
                <div className="flex items-center gap-2 min-w-0">
                  {hasSales && idx < 3 ? (
                    <span className={cn(
                      "w-5 flex-shrink-0 text-center",
                      idx === 0 && "text-primary"
                    )}>
                      {idx === 0 ? <Trophy className="w-4 h-4" /> : idx + 1}
                    </span>
                  ) : (
                    <span className="w-5 flex-shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className={cn("truncate text-sm", hasSales && idx === 0 && "font-medium")}>
                      {stripEmojis(rep.name)}
                    </span>
                    {rep.workStartTime && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTime(rep.workStartTime)}
                        {rep.durationMinutes > 0 && ` · ${formatDuration(rep.durationMinutes)}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* FP+ */}
                <span className={cn(
                  "text-right font-semibold tabular-nums",
                  rep.todayStats.fp > 0 ? "text-primary" : "text-muted-foreground/50"
                )}>
                  {rep.todayStats.fp > 0 ? rep.todayStats.fp.toFixed(1) : "–"}
                </span>

                {/* PRMR */}
                <span className={cn(
                  "text-right font-semibold tabular-nums",
                  rep.todayStats.prmr > 0 ? "text-green-700 dark:text-green-500" : "text-muted-foreground/50"
                )}>
                  {rep.todayStats.prmr > 0 ? `$${rep.todayStats.prmr.toLocaleString()}` : "–"}
                </span>

                {/* Presentations */}
                <span className={cn(
                  "text-right tabular-nums",
                  rep.todayStats.presentations > 0 ? "font-medium" : "text-muted-foreground/50"
                )}>
                  {rep.todayStats.presentations || "–"}
                </span>

                {/* Doors */}
                <span className={cn(
                  "text-right tabular-nums",
                  rep.todayStats.doors > 0 ? "" : "text-muted-foreground/50"
                )}>
                  {rep.todayStats.doors || "–"}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Rep Detail Drawer */}
      {selectedRep && (
        <RepDetailDrawer
          open={repDrawerOpen}
          onOpenChange={setRepDrawerOpen}
          rep={getRepDetailData(selectedRep)}
        />
      )}
    </>
  );
};
