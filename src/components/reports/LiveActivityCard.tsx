import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Activity, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface LiveRepData {
  userId: string;
  name: string;
  teamName: string;
  mgmtGroupName: string;
  isWorking: boolean;
  hasForgottenEntry: boolean;
  forgottenDate?: string;
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
  workStartTime?: string;
}

interface LiveActivityCardProps {
  liveReps: LiveRepData[];
  workingCount: number;
  forgottenCount: number;
  isLoading?: boolean;
}

const stripEmojis = (text: string) => {
  return text.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}]/gu, '').trim();
};

const formatStartTime = (timestamp: string) => {
  try {
    return format(new Date(timestamp), 'h:mm a');
  } catch {
    return '';
  }
};

export const LiveActivityCard = ({ 
  liveReps, 
  workingCount, 
  forgottenCount,
  isLoading 
}: LiveActivityCardProps) => {
  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const workingReps = liveReps.filter(r => r.isWorking);
  const forgottenReps = liveReps.filter(r => r.hasForgottenEntry && !r.isWorking);

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping opacity-75" />
          </div>
          <h3 className="font-semibold">Live Activity</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-green-600 dark:text-green-400 font-medium">{workingCount} working</span>
          {forgottenCount > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-600 dark:text-amber-400">{forgottenCount} forgotten</span>
            </>
          )}
        </div>
      </div>

      {/* Working Reps */}
      {workingReps.length > 0 ? (
        <div className="space-y-3">
          {workingReps.map((rep) => (
            <div 
              key={rep.userId} 
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-75" />
                </div>
                <div>
                  <div className="font-medium text-sm">{stripEmojis(rep.name)}</div>
                  <div className="text-xs text-muted-foreground">{rep.teamName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-xs">
                  {rep.todayStats.fp > 0 && (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 border-0">
                      {rep.todayStats.fp.toFixed(1)} FP+
                    </Badge>
                  )}
                  {rep.todayStats.presentations > 0 && (
                    <span className="text-muted-foreground">{rep.todayStats.presentations} pres</span>
                  )}
                  {rep.todayStats.doors > 0 && (
                    <span className="text-muted-foreground">{rep.todayStats.doors} doors</span>
                  )}
                </div>
                {rep.workStartTime && (
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    Started {formatStartTime(rep.workStartTime)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No one is currently working</p>
          <p className="text-xs mt-1">Activity will appear here when reps start tracking</p>
        </div>
      )}

      {/* Forgotten Entries Warning */}
      {forgottenReps.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Forgotten Entries
            </span>
          </div>
          <div className="space-y-2">
            {forgottenReps.slice(0, 3).map((rep) => (
              <div key={rep.userId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>{stripEmojis(rep.name)}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {rep.forgottenDate && format(new Date(rep.forgottenDate + 'T12:00:00'), 'MMM d')}
                </span>
              </div>
            ))}
            {forgottenReps.length > 3 && (
              <div className="text-xs text-muted-foreground">
                +{forgottenReps.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};
