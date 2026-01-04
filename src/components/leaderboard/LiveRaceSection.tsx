import { useMemo, useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, TrendingUp, Flame, ChevronUp, ChevronDown, Footprints, Users, Presentation, ArrowRightLeft, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTodayLeaderboard } from "@/hooks/useTodayLeaderboard";

interface LiveRaceSectionProps {
  currentUserId: string | null;
  filterByYear?: string;
}

type MetricKey = 'fp_plus' | 'doors_knocked' | 'presentations' | 'decision_makers' | 'pitches' | 'transitions';

const metricConfig: Record<MetricKey, { label: string; shortLabel: string; icon: typeof Trophy; unit: string }> = {
  fp_plus: { label: 'FP+', shortLabel: 'FP+', icon: Trophy, unit: 'FP+' },
  doors_knocked: { label: 'Doors', shortLabel: 'Doors', icon: Footprints, unit: '' },
  presentations: { label: 'Presentations', shortLabel: 'Pres', icon: Presentation, unit: '' },
  decision_makers: { label: 'DMs', shortLabel: 'DMs', icon: Users, unit: '' },
  pitches: { label: 'Pitches', shortLabel: 'Pitches', icon: Target, unit: '' },
  transitions: { label: 'Transitions', shortLabel: 'Trans', icon: ArrowRightLeft, unit: '' },
};

const metricOrder: MetricKey[] = ['fp_plus', 'doors_knocked', 'presentations', 'decision_makers', 'pitches', 'transitions'];

export const LiveRaceSection = ({ currentUserId, filterByYear }: LiveRaceSectionProps) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('fp_plus');
  const [prevRankings, setPrevRankings] = useState<Map<string, number>>(new Map());
  const [rankChanges, setRankChanges] = useState<Map<string, 'up' | 'down' | null>>(new Map());
  
  const { data: leaderboard, isLoading } = useTodayLeaderboard(filterByYear);
  const userRowRef = useRef<HTMLDivElement>(null);

  // Get rankings for selected metric
  const rankings = useMemo(() => {
    if (!leaderboard?.rankings) return [];
    return leaderboard.rankings[selectedMetric] || [];
  }, [leaderboard, selectedMetric]);

  // Track ranking changes for animations
  useEffect(() => {
    if (!rankings.length) return;
    
    const newRankMap = new Map<string, number>();
    rankings.forEach((entry, index) => {
      newRankMap.set(entry.userId, index);
    });

    // Compare with previous rankings
    if (prevRankings.size > 0) {
      const changes = new Map<string, 'up' | 'down' | null>();
      rankings.forEach((entry, newIndex) => {
        const oldIndex = prevRankings.get(entry.userId);
        if (oldIndex !== undefined && oldIndex !== newIndex) {
          changes.set(entry.userId, newIndex < oldIndex ? 'up' : 'down');
        }
      });
      
      if (changes.size > 0) {
        setRankChanges(changes);
        // Clear changes after animation
        setTimeout(() => setRankChanges(new Map()), 2000);
      }
    }
    
    setPrevRankings(newRankMap);
  }, [rankings]);

  // Find current user's position
  const userIndex = useMemo(() => {
    if (!currentUserId || !rankings.length) return -1;
    return rankings.findIndex(r => r.userId === currentUserId);
  }, [rankings, currentUserId]);

  // Auto-scroll to user position on load
  useEffect(() => {
    if (userRowRef.current && userIndex > 2) {
      setTimeout(() => {
        userRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [userIndex, rankings.length]);

  const config = metricConfig[selectedMetric];

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

  if (!rankings.length) {
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
      {/* Header with Metric Toggle */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-semibold">Live Race</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Live
            </span>
          </div>
          {userIndex >= 0 && (
            <span className="text-sm text-muted-foreground">
              #{userIndex + 1} of {rankings.length}
            </span>
          )}
        </div>
        
        {/* Metric Toggle Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {metricOrder.map(metric => {
            const cfg = metricConfig[metric];
            const isActive = metric === selectedMetric;
            const hasData = leaderboard?.rankings?.[metric]?.length ?? 0 > 0;
            
            return (
              <button
                key={metric}
                onClick={() => setSelectedMetric(metric)}
                disabled={!hasData}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : hasData
                      ? "bg-muted text-muted-foreground hover:bg-muted/80"
                      : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                )}
              >
                <cfg.icon className="h-3 w-3" />
                {cfg.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Race List */}
      <div className="max-h-[400px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {rankings.map((entry, index) => {
            const isCurrentUser = entry.userId === currentUserId;
            const isLeader = index === 0;
            const isAboveUser = userIndex > 0 && index === userIndex - 1;
            const isBelowUser = userIndex >= 0 && userIndex < rankings.length - 1 && index === userIndex + 1;
            const rankChange = rankChanges.get(entry.userId);
            
            // Calculate gap to person ahead
            const gapToAhead = isCurrentUser && userIndex > 0 
              ? rankings[userIndex - 1].value - entry.value 
              : 0;
            
            // Calculate gap to person behind
            const gapBehind = isCurrentUser && userIndex < rankings.length - 1
              ? entry.value - rankings[userIndex + 1].value
              : 0;

            const formatValue = (val: number) => {
              return selectedMetric === 'fp_plus' ? val.toFixed(1) : val.toString();
            };

            return (
              <motion.div 
                key={entry.userId}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                {/* Gap indicator above current user */}
                {isCurrentUser && userIndex > 0 && gapToAhead > 0 && (
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/50">
                    <ChevronUp className="h-3 w-3 text-amber-500" />
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      +{formatValue(gapToAhead)} {config.unit} to catch
                    </span>
                  </div>
                )}

                {/* Race Row */}
                <motion.div
                  ref={isCurrentUser ? userRowRef : undefined}
                  animate={rankChange ? {
                    backgroundColor: rankChange === 'up' 
                      ? ['hsl(var(--primary) / 0.3)', 'hsl(var(--primary) / 0.1)', 'transparent']
                      : ['hsl(var(--destructive) / 0.2)', 'transparent'],
                    scale: rankChange === 'up' ? [1, 1.02, 1] : 1,
                  } : {}}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 border-b border-border/50 transition-colors relative",
                    isCurrentUser && "bg-primary/10 border-l-4 border-l-primary",
                    isLeader && !isCurrentUser && "bg-amber-500/5",
                    isAboveUser && "bg-amber-500/5",
                    isBelowUser && "bg-muted/30"
                  )}
                >
                  {/* Rank change indicator */}
                  <AnimatePresence>
                    {rankChange && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0, x: -20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className={cn(
                          "absolute left-1 text-xs font-bold",
                          rankChange === 'up' ? "text-green-500" : "text-red-500"
                        )}
                      >
                        {rankChange === 'up' ? '▲' : '▼'}
                      </motion.div>
                    )}
                  </AnimatePresence>

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
                    <span className="font-bold">{formatValue(entry.value)}</span>
                    {config.unit && (
                      <span className="text-xs text-muted-foreground ml-1">{config.unit}</span>
                    )}
                  </div>
                </motion.div>

                {/* Gap indicator below current user */}
                {isCurrentUser && userIndex < rankings.length - 1 && gapBehind > 0 && (
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/50">
                    <ChevronDown className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      +{formatValue(gapBehind)} {config.unit} ahead
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer hint */}
      {rankings.length > 5 && (
        <div className="px-4 py-2 bg-muted/30 text-center">
          <span className="text-xs text-muted-foreground">
            {rankings.filter(r => r.isWorking).length} people knocking right now
          </span>
        </div>
      )}
    </div>
  );
};
