import { Card } from "@/components/ui/card";
import { Trophy, Target, DoorOpen, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";

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
  };
}

interface LiveLeaderboardProps {
  liveReps: LiveRepData[];
  isLoading?: boolean;
}

const stripEmojis = (text: string) => {
  return text.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}]/gu, '').trim();
};

export const LiveLeaderboard = ({ liveReps, isLoading }: LiveLeaderboardProps) => {
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

  // Sort by different metrics
  const byFP = [...workingReps].sort((a, b) => b.todayStats.fp - a.todayStats.fp).slice(0, 5);
  const byDoors = [...workingReps].sort((a, b) => b.todayStats.doors - a.todayStats.doors).slice(0, 5);
  const byPresentations = [...workingReps].sort((a, b) => b.todayStats.presentations - a.todayStats.presentations).slice(0, 5);

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
    data: LiveRepData[]; 
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
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-5 text-center font-medium",
                  idx === 0 && "text-primary"
                )}>
                  {idx === 0 ? <Trophy className="w-4 h-4" /> : idx + 1}
                </span>
                <span className={cn(idx === 0 && "font-medium")}>
                  {stripEmojis(rep.name)}
                </span>
              </div>
              <span className={cn(
                "font-semibold",
                idx === 0 && "text-primary"
              )}>
                {formatValue(getValue(rep))}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

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

      <div className="space-y-5">
        <LeaderboardSection
          title="FP+"
          icon={Target}
          data={byFP}
          getValue={(r) => r.todayStats.fp}
          formatValue={(v) => v.toFixed(1)}
        />
        
        <LeaderboardSection
          title="Presentations"
          icon={Presentation}
          data={byPresentations}
          getValue={(r) => r.todayStats.presentations}
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
    </Card>
  );
};
