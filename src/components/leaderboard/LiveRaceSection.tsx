import { useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, Flame, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTodayLeaderboard } from "@/hooks/useTodayLeaderboard";

interface LiveRaceSectionProps {
  currentUserId: string | null;
  filterByYear?: string;
}

export const LiveRaceSection = ({ currentUserId, filterByYear }: LiveRaceSectionProps) => {
  const { data: leaderboard, isLoading } = useTodayLeaderboard(filterByYear);
  const userRowRef = useRef<HTMLDivElement>(null);

  // Get the FP+ rankings (primary metric)
  const fpRankings = useMemo(() => {
    if (!leaderboard?.rankings?.fp_plus) return [];
    return leaderboard.rankings.fp_plus;
  }, [leaderboard]);

  // Find current user's position
  const userIndex = useMemo(() => {
    if (!currentUserId || !fpRankings.length) return -1;
    return fpRankings.findIndex(r => r.userId === currentUserId);
  }, [fpRankings, currentUserId]);

  // Auto-scroll to user position on load
  useEffect(() => {
    if (userRowRef.current && userIndex > 2) {
      setTimeout(() => {
        userRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [userIndex, fpRankings.length]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 bg-muted rounded animate-pulse" />
          <div className="h-5 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!fpRankings.length) {
    return (
      <div className="bg-card rounded-2xl p-6 border border-border text-center">
        <Flame className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">No one knocking yet today.</p>
        <p className="text-sm text-muted-foreground/70">Be the first to set the pace!</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="font-semibold">FP+ Race</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Live
          </span>
        </div>
        {userIndex >= 0 && (
          <span className="text-sm text-muted-foreground">
            You're #{userIndex + 1} of {fpRankings.length}
          </span>
        )}
      </div>

      {/* Race List */}
      <div className="max-h-[400px] overflow-y-auto">
        {fpRankings.map((entry, index) => {
          const isCurrentUser = entry.userId === currentUserId;
          const isLeader = index === 0;
          const isAboveUser = userIndex > 0 && index === userIndex - 1;
          const isBelowUser = userIndex >= 0 && userIndex < fpRankings.length - 1 && index === userIndex + 1;
          
          // Calculate gap to person ahead
          const gapToAhead = isCurrentUser && userIndex > 0 
            ? fpRankings[userIndex - 1].value - entry.value 
            : 0;
          
          // Calculate gap to person behind
          const gapBehind = isCurrentUser && userIndex < fpRankings.length - 1
            ? entry.value - fpRankings[userIndex + 1].value
            : 0;

          return (
            <div key={entry.userId}>
              {/* Gap indicator above current user */}
              {isCurrentUser && userIndex > 0 && gapToAhead > 0 && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/50">
                  <ChevronUp className="h-3 w-3 text-amber-500" />
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    +{gapToAhead.toFixed(1)} FP+ to catch
                  </span>
                </div>
              )}

              {/* Race Row */}
              <motion.div
                ref={isCurrentUser ? userRowRef : undefined}
                initial={isCurrentUser ? { scale: 0.98 } : false}
                animate={isCurrentUser ? { scale: 1 } : false}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 border-b border-border/50 transition-colors",
                  isCurrentUser && "bg-primary/10 border-l-4 border-l-primary",
                  isLeader && !isCurrentUser && "bg-amber-500/5",
                  isAboveUser && "bg-amber-500/5",
                  isBelowUser && "bg-muted/30"
                )}
              >
                {/* Rank */}
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                  isLeader && "bg-amber-500 text-white",
                  index === 1 && !isCurrentUser && "bg-slate-400 text-white",
                  index === 2 && !isCurrentUser && "bg-amber-700 text-white",
                  index > 2 && !isCurrentUser && "bg-muted text-muted-foreground",
                  isCurrentUser && "bg-primary text-primary-foreground"
                )}>
                  {isLeader ? <Trophy className="h-4 w-4" /> : `#${index + 1}`}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-medium truncate",
                      isCurrentUser && "text-primary font-semibold"
                    )}>
                      {isCurrentUser ? "You" : entry.name}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                        YOU
                      </span>
                    )}
                    {entry.isWorking && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                    )}
                  </div>
                  {isAboveUser && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">
                      Catch them!
                    </span>
                  )}
                  {isBelowUser && (
                    <span className="text-[10px] text-muted-foreground">
                      On your tail
                    </span>
                  )}
                </div>

                {/* Value */}
                <div className={cn(
                  "text-right shrink-0",
                  isCurrentUser && "text-primary font-semibold"
                )}>
                  <span className="font-bold">{entry.value.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground ml-1">FP+</span>
                </div>
              </motion.div>

              {/* Gap indicator below current user */}
              {isCurrentUser && userIndex < fpRankings.length - 1 && gapBehind > 0 && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/50">
                  <ChevronDown className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    +{gapBehind.toFixed(1)} FP+ ahead
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      {fpRankings.length > 5 && (
        <div className="px-4 py-2 bg-muted/30 text-center">
          <span className="text-xs text-muted-foreground">
            {fpRankings.filter(r => r.isWorking).length} people knocking right now
          </span>
        </div>
      )}
    </div>
  );
};
