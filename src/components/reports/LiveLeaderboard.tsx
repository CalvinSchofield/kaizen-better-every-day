import { Card } from "@/components/ui/card";
import { Trophy, Target, DoorOpen, Presentation, Clock, Users, MessageSquare, Handshake, ArrowRightLeft, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface LiveRepData {
  userId: string;
  name: string;
  teamName: string;
  todayStats: {
    doors: number;
    dms: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    prmr: number;
    isFinalized?: boolean;
  };
  workStartTime?: string;
  workEndTime?: string;
  breakMinutes?: number;
}

interface LiveLeaderboardProps {
  liveReps: LiveRepData[];
  isLoading?: boolean;
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

export const LiveLeaderboard = ({ liveReps, isLoading }: LiveLeaderboardProps) => {
  const [isRankingsOpen, setIsRankingsOpen] = useState(false);

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
    let durationMinutes = 0;
    if (rep.workStartTime) {
      const start = new Date(rep.workStartTime);
      const end = rep.workEndTime ? new Date(rep.workEndTime) : new Date();
      durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      // Subtract break time
      durationMinutes -= (rep.breakMinutes || 0);
      durationMinutes = Math.max(0, durationMinutes);
    }
    return { ...rep, durationMinutes };
  });

  // Sort by different metrics
  const byFP = [...repsWithDuration].sort((a, b) => b.todayStats.fp - a.todayStats.fp).slice(0, 5);
  const byPRMR = [...repsWithDuration].sort((a, b) => b.todayStats.prmr - a.todayStats.prmr).slice(0, 5);
  const byDoors = [...repsWithDuration].sort((a, b) => b.todayStats.doors - a.todayStats.doors).slice(0, 5);
  const byDMs = [...repsWithDuration].sort((a, b) => b.todayStats.dms - a.todayStats.dms).slice(0, 5);
  const byPitches = [...repsWithDuration].sort((a, b) => b.todayStats.pitches - a.todayStats.pitches).slice(0, 5);
  const byTransitions = [...repsWithDuration].sort((a, b) => b.todayStats.transitions - a.todayStats.transitions).slice(0, 5);
  const byPresentations = [...repsWithDuration].sort((a, b) => b.todayStats.presentations - a.todayStats.presentations).slice(0, 5);
  const byCloses = [...repsWithDuration].sort((a, b) => b.todayStats.closes - a.todayStats.closes).slice(0, 5);

  // Earliest and latest doors (by work start time)
  const repsWithStartTime = repsWithDuration.filter(r => r.workStartTime);
  const earliestDoor = repsWithStartTime.length > 0 
    ? repsWithStartTime.sort((a, b) => new Date(a.workStartTime!).getTime() - new Date(b.workStartTime!).getTime())[0]
    : null;
  const latestDoor = repsWithStartTime.length > 0
    ? repsWithStartTime.sort((a, b) => new Date(b.workStartTime!).getTime() - new Date(a.workStartTime!).getTime())[0]
    : null;

  // Longest duration
  const longestDuration = repsWithDuration.length > 0
    ? repsWithDuration.sort((a, b) => b.durationMinutes - a.durationMinutes)[0]
    : null;

  if (workingReps.length === 0) {
    return null;
  }

  const LeaderboardSection = ({ 
    title, 
    icon: Icon, 
    data, 
    getValue, 
    formatValue 
  }: { 
    title: string; 
    icon: any; 
    data: (LiveRepData & { durationMinutes: number })[]; 
    getValue: (r: LiveRepData) => number;
    formatValue: (v: number) => string;
  }) => {
    const filteredData = data.filter(r => getValue(r) > 0);
    if (filteredData.length === 0) return null;

    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="space-y-1.5">
          {filteredData.map((rep, idx) => (
            <div 
              key={rep.userId} 
              className={cn(
                "flex items-center justify-between py-1.5 px-2 rounded-md text-sm",
                idx === 0 && "bg-primary/5"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  "w-5 text-center font-medium flex-shrink-0",
                  idx === 0 && "text-primary"
                )}>
                  {idx === 0 ? <Trophy className="w-4 h-4" /> : idx + 1}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className={cn("truncate", idx === 0 && "font-medium")}>
                    {stripEmojis(rep.name)}
                  </span>
                  {rep.teamName && rep.teamName !== 'Unknown Team' && (
                    <span className="text-xs text-muted-foreground truncate">{rep.teamName}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={cn(
                  "font-semibold",
                  idx === 0 && "text-primary"
                )}>
                  {formatValue(getValue(rep))}
                </span>
                {rep.todayStats.isFinalized && (
                  <span className="text-xs text-muted-foreground">(final)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const HighlightStat = ({ 
    label, 
    name, 
    teamName,
    value, 
    icon: Icon 
  }: { 
    label: string; 
    name: string; 
    teamName?: string;
    value: string; 
    icon: any;
  }) => (
    <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-sm font-medium">{stripEmojis(name)}</span>
          {teamName && teamName !== 'Unknown Team' && (
            <span className="text-xs text-muted-foreground">{teamName}</span>
          )}
        </div>
      </div>
      <span className="text-sm font-semibold text-primary">{value}</span>
    </div>
  );

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Today's Rankings</h3>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-75" />
          </div>
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>

      {/* Key Highlights - Always visible */}
      <div className="space-y-2 mb-4">
        {/* FP+ Leader */}
        {byFP[0] && byFP[0].todayStats.fp > 0 && (
          <HighlightStat
            label="Leading in FP+"
            name={byFP[0].name}
            teamName={byFP[0].teamName}
            value={`${byFP[0].todayStats.fp.toFixed(1)} FP+`}
            icon={Target}
          />
        )}

        {/* PRMR Leader */}
        {byPRMR[0] && byPRMR[0].todayStats.prmr > 0 && (
          <HighlightStat
            label="Leading in PRMR"
            name={byPRMR[0].name}
            teamName={byPRMR[0].teamName}
            value={`$${byPRMR[0].todayStats.prmr.toLocaleString()}`}
            icon={Target}
          />
        )}

        {/* Earliest Door */}
        {earliestDoor && (
          <HighlightStat
            label="First Out"
            name={earliestDoor.name}
            teamName={earliestDoor.teamName}
            value={formatTime(earliestDoor.workStartTime) || ''}
            icon={Clock}
          />
        )}

        {/* Latest Door / Still Out */}
        {latestDoor && earliestDoor && latestDoor.userId !== earliestDoor.userId && (
          <HighlightStat
            label={latestDoor.workEndTime ? "Latest Start" : "Still Going"}
            name={latestDoor.name}
            teamName={latestDoor.teamName}
            value={formatTime(latestDoor.workStartTime) || ''}
            icon={Clock}
          />
        )}

        {/* Both earliest and latest same person */}
        {earliestDoor && latestDoor && earliestDoor.userId === latestDoor.userId && repsWithStartTime.length > 1 && (
          <div className="flex items-center gap-2 py-2 px-3 bg-primary/10 rounded-lg">
            <span className="text-sm">🔥 {stripEmojis(earliestDoor.name)} was first out AND still going!</span>
          </div>
        )}

        {/* Longest Duration */}
        {longestDuration && longestDuration.durationMinutes > 0 && (
          <HighlightStat
            label="Longest Work Session"
            name={longestDuration.name}
            teamName={longestDuration.teamName}
            value={formatDuration(longestDuration.durationMinutes)}
            icon={Clock}
          />
        )}
      </div>

      {/* Collapsible Full Rankings */}
      <Collapsible open={isRankingsOpen} onOpenChange={setIsRankingsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
          <span className="text-sm font-medium">All Rankings</span>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform",
            isRankingsOpen && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <div className="space-y-5">
            <LeaderboardSection
              title="FP+"
              icon={Target}
              data={byFP}
              getValue={(r) => r.todayStats.fp}
              formatValue={(v) => v.toFixed(1)}
            />

            <LeaderboardSection
              title="PRMR"
              icon={Target}
              data={byPRMR}
              getValue={(r) => r.todayStats.prmr}
              formatValue={(v) => `$${v.toLocaleString()}`}
            />
            
            <LeaderboardSection
              title="Presentations"
              icon={Presentation}
              data={byPresentations}
              getValue={(r) => r.todayStats.presentations}
              formatValue={(v) => v.toString()}
            />

            <LeaderboardSection
              title="Closes"
              icon={Handshake}
              data={byCloses}
              getValue={(r) => r.todayStats.closes}
              formatValue={(v) => v.toString()}
            />

            <LeaderboardSection
              title="Transitions"
              icon={ArrowRightLeft}
              data={byTransitions}
              getValue={(r) => r.todayStats.transitions}
              formatValue={(v) => v.toString()}
            />

            <LeaderboardSection
              title="Pitches"
              icon={MessageSquare}
              data={byPitches}
              getValue={(r) => r.todayStats.pitches}
              formatValue={(v) => v.toString()}
            />

            <LeaderboardSection
              title="Decision Makers"
              icon={Users}
              data={byDMs}
              getValue={(r) => r.todayStats.dms}
              formatValue={(v) => v.toString()}
            />

            <LeaderboardSection
              title="Doors"
              icon={DoorOpen}
              data={byDoors}
              getValue={(r) => r.todayStats.doors}
              formatValue={(v) => v.toString()}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
