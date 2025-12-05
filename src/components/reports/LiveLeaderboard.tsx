import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Clock, ChevronDown, Star, Activity, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RepDetailDrawer } from "./RepDetailDrawer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  avgPitchesPerHour?: number;
  avgTransitionsPerHour?: number;
  avgDoorsPerHour?: number;
  workStartTime?: string;
  workEndTime?: string;
  breakMinutes?: number;
  durationMinutes?: number;
  // Timeline data
  entryId?: string;
  counterTimestamps?: Record<string, string[]>;
  salesLog?: Array<{ type: string; prmr: number; timestamp?: string }>;
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
  const navigate = useNavigate();
  const [selectedRep, setSelectedRep] = useState<LiveRepData | null>(null);
  const [repDrawerOpen, setRepDrawerOpen] = useState(false);
  const [outstandingOpen, setOutstandingOpen] = useState(true);
  const [workingOpen, setWorkingOpen] = useState(true);
  const [attentionOpen, setAttentionOpen] = useState(true);

  const handleRepClick = (rep: LiveRepData) => {
    setSelectedRep(rep);
    setRepDrawerOpen(true);
  };

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
      // Timeline data
      entryId: rep.entryId,
      counterTimestamps: rep.counterTimestamps,
      salesLog: rep.salesLog,
      isFinalized: rep.todayStats.isFinalized,
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

  // Categorize reps
  // Outstanding: Has FP+ OR has presentations
  const outstanding = repsWithDuration
    .filter(r => r.todayStats.fp > 0 || r.todayStats.presentations > 0)
    .sort((a, b) => {
      if (b.todayStats.fp !== a.todayStats.fp) return b.todayStats.fp - a.todayStats.fp;
      if (b.todayStats.prmr !== a.todayStats.prmr) return b.todayStats.prmr - a.todayStats.prmr;
      return b.todayStats.presentations - a.todayStats.presentations;
    });

  // Need Attention: Working significantly below their historical average (pitches/transitions per hour)
  // Or if no history, under 5 doors after 30+ minutes
  const needAttention = repsWithDuration
    .filter(r => {
      // Skip if they have sales/presentations (they're doing fine)
      if (r.todayStats.fp > 0 || r.todayStats.presentations > 0) return false;
      
      const hoursWorked = r.durationMinutes / 60;
      if (hoursWorked < 0.5) return false; // Need at least 30 min to judge
      
      // Calculate current pace
      const currentPitchesPerHour = r.todayStats.pitches / hoursWorked;
      const currentTransitionsPerHour = r.todayStats.transitions / hoursWorked;
      
      // If they have historical data, compare to their average
      const hasHistory = (r.avgPitchesPerHour || 0) > 0 || (r.avgTransitionsPerHour || 0) > 0;
      
      if (hasHistory) {
        // Below 50% of their average on BOTH pitches AND transitions
        const pitchRatio = r.avgPitchesPerHour ? currentPitchesPerHour / r.avgPitchesPerHour : 1;
        const transRatio = r.avgTransitionsPerHour ? currentTransitionsPerHour / r.avgTransitionsPerHour : 1;
        return pitchRatio < 0.5 && transRatio < 0.5;
      } else {
        // No history: fallback to absolute threshold (under 5 doors after 30+ min)
        return r.todayStats.doors < 5 && r.durationMinutes >= 30;
      }
    })
    .map(r => {
      // Calculate how far below average they are
      const hoursWorked = r.durationMinutes / 60;
      const currentPitchesPerHour = hoursWorked > 0 ? r.todayStats.pitches / hoursWorked : 0;
      const currentTransitionsPerHour = hoursWorked > 0 ? r.todayStats.transitions / hoursWorked : 0;
      const pitchPct = r.avgPitchesPerHour ? Math.round((currentPitchesPerHour / r.avgPitchesPerHour) * 100) : null;
      const transPct = r.avgTransitionsPerHour ? Math.round((currentTransitionsPerHour / r.avgTransitionsPerHour) * 100) : null;
      return { ...r, pitchPct, transPct };
    })
    .sort((a, b) => {
      // Sort by worst performance first (lowest percentage of average)
      const aWorst = Math.min(a.pitchPct ?? 100, a.transPct ?? 100);
      const bWorst = Math.min(b.pitchPct ?? 100, b.transPct ?? 100);
      return aWorst - bWorst;
    });

  // Working: Everyone else with activity but not in outstanding or need attention
  const outstandingIds = new Set(outstanding.map(r => r.userId));
  const attentionIds = new Set(needAttention.map(r => r.userId));
  const working = repsWithDuration
    .filter(r => !outstandingIds.has(r.userId) && !attentionIds.has(r.userId))
    .sort((a, b) => b.todayStats.doors - a.todayStats.doors);

  // Calculate team totals
  const totalFP = repsWithDuration.reduce((sum, r) => sum + r.todayStats.fp, 0);
  const totalPRMR = repsWithDuration.reduce((sum, r) => sum + r.todayStats.prmr, 0);

  if (workingReps.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="font-semibold mb-4">{title}</h3>
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <p className="font-medium mb-1">No activity yet today</p>
          <p className="text-sm text-muted-foreground mb-4">
            Time to get out there and make it happen!
          </p>
          <Button 
            onClick={() => navigate('/track')}
            className="gap-2"
          >
            <Activity className="w-4 h-4" />
            Start Your Day
          </Button>
        </div>
      </Card>
    );
  }

  const RepRow = ({ rep, showRank, rank, paceInfo }: { 
    rep: LiveRepData & { durationMinutes: number }; 
    showRank?: boolean; 
    rank?: number;
    paceInfo?: { pitchPct: number | null; transPct: number | null };
  }) => {
    const hasSales = rep.todayStats.fp > 0;
    return (
      <button 
        onClick={() => handleRepClick(rep)}
        className="flex items-center justify-between py-2 px-2 rounded-md text-sm w-full text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showRank && rank !== undefined && (
            <span className={cn(
              "w-5 flex-shrink-0 text-center text-xs font-medium",
              rank === 0 && "text-primary"
            )}>
              {rank === 0 ? <Trophy className="w-4 h-4" /> : rank + 1}
            </span>
          )}
          <div className="flex flex-col min-w-0">
            <span className="truncate font-medium">
              {stripEmojis(rep.name)}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              {rep.workStartTime && (
                <>
                  <Clock className="w-2.5 h-2.5" />
                  {formatTime(rep.workStartTime)}
                </>
              )}
              {rep.durationMinutes > 0 && ` · ${formatDuration(rep.durationMinutes)}`}
              {rep.todayStats.doors > 0 && ` · ${rep.todayStats.doors} doors`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 text-right">
          {hasSales ? (
            <>
              <span className="font-semibold text-primary tabular-nums">
                {rep.todayStats.fp.toFixed(1)} FP+
              </span>
              {rep.todayStats.prmr > 0 && (
                <span className="font-semibold text-green-700 dark:text-green-500 tabular-nums text-xs">
                  ${rep.todayStats.prmr.toLocaleString()}
                </span>
              )}
            </>
          ) : rep.todayStats.presentations > 0 ? (
            <span className="font-medium text-amber-600 dark:text-amber-500 tabular-nums">
              {rep.todayStats.presentations} pres
            </span>
          ) : paceInfo && (paceInfo.pitchPct !== null || paceInfo.transPct !== null) ? (
            <span className="text-amber-600 dark:text-amber-500 text-xs">
              {paceInfo.pitchPct !== null && `${paceInfo.pitchPct}% pitch pace`}
              {paceInfo.pitchPct !== null && paceInfo.transPct !== null && ' · '}
              {paceInfo.transPct !== null && `${paceInfo.transPct}% trans pace`}
            </span>
          ) : (
            <span className="text-muted-foreground tabular-nums text-xs">
              {rep.todayStats.transitions > 0 ? `${rep.todayStats.transitions} trans` : 
               rep.todayStats.pitches > 0 ? `${rep.todayStats.pitches} pitch` : ''}
            </span>
          )}
        </div>
      </button>
    );
  };

  const SectionHeader = ({ 
    icon: Icon, 
    title, 
    count, 
    color, 
    isOpen, 
    onToggle 
  }: { 
    icon: any; 
    title: string; 
    count: number; 
    color: string; 
    isOpen: boolean; 
    onToggle: () => void;
  }) => (
    <CollapsibleTrigger 
      onClick={onToggle}
      className={cn(
        "flex items-center justify-between w-full py-2 px-3 rounded-lg transition-colors",
        color
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <ChevronDown className={cn(
        "w-4 h-4 transition-transform",
        isOpen && "rotate-180"
      )} />
    </CollapsibleTrigger>
  );

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
          <span className="text-xs text-muted-foreground">{workingReps.length} reps</span>
        </div>

        {/* Team Totals */}
        {(totalFP > 0 || totalPRMR > 0) && (
          <div className="flex items-center gap-4 mb-4 py-2 px-3 bg-primary/5 rounded-lg text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">FP+:</span>
              <span className="font-bold text-primary">{totalFP.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">PRMR:</span>
              <span className="font-bold text-green-700 dark:text-green-500">${totalPRMR.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Collapsible Sections */}
        <div className="space-y-2">
          {/* Outstanding Performance */}
          {outstanding.length > 0 && (
            <Collapsible open={outstandingOpen} onOpenChange={setOutstandingOpen}>
              <SectionHeader
                icon={Star}
                title="Outstanding"
                count={outstanding.length}
                color="bg-primary/10 hover:bg-primary/15 text-primary"
                isOpen={outstandingOpen}
                onToggle={() => setOutstandingOpen(!outstandingOpen)}
              />
              <CollapsibleContent className="pt-1">
                <div className="space-y-0.5 pl-1">
                  {outstanding.map((rep, idx) => (
                    <RepRow key={rep.userId} rep={rep} showRank rank={idx} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Working */}
          {working.length > 0 && (
            <Collapsible open={workingOpen} onOpenChange={setWorkingOpen}>
              <SectionHeader
                icon={Activity}
                title="Working"
                count={working.length}
                color="bg-blue-500/10 hover:bg-blue-500/15 text-blue-600 dark:text-blue-400"
                isOpen={workingOpen}
                onToggle={() => setWorkingOpen(!workingOpen)}
              />
              <CollapsibleContent className="pt-1">
                <div className="space-y-0.5 pl-1">
                  {working.map((rep) => (
                    <RepRow key={rep.userId} rep={rep} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Need Attention */}
          {needAttention.length > 0 && (
            <Collapsible open={attentionOpen} onOpenChange={setAttentionOpen}>
              <SectionHeader
                icon={AlertTriangle}
                title="Need Attention"
                count={needAttention.length}
                color="bg-amber-500/10 hover:bg-amber-500/15 text-amber-600 dark:text-amber-500"
                isOpen={attentionOpen}
                onToggle={() => setAttentionOpen(!attentionOpen)}
              />
              <CollapsibleContent className="pt-1">
                <div className="space-y-0.5 pl-1">
                  {needAttention.map((rep) => (
                    <RepRow 
                      key={rep.userId} 
                      rep={rep} 
                      paceInfo={{ pitchPct: rep.pitchPct, transPct: rep.transPct }}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
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
