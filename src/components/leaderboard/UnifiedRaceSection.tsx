import { useMemo, useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, TrendingUp, ChevronUp, ChevronDown, Footprints, Users, Presentation, ArrowRightLeft, Target, DollarSign, Camera, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { hapticLight } from "@/utils/haptics";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProfilePhotoUpload } from "@/components/ProfilePhotoUpload";
import { getInitials } from "@/utils/nameUtils";
import { useNavigate } from "react-router-dom";
import type { ExpandedRankings, RankedEntry } from "@/hooks/useExpandedLeaderboard";

interface RankingEntryWithWorking extends RankedEntry {
  isWorking?: boolean;
}

type MetricKey = 'fp_plus' | 'prmr' | 'doors_knocked' | 'presentations' | 'decision_makers' | 'pitches' | 'transitions' | 'closes';

interface UnifiedRaceSectionProps {
  rankings: ExpandedRankings | {
    fp_plus: RankingEntryWithWorking[];
    prmr: RankingEntryWithWorking[];
    presentations: RankingEntryWithWorking[];
    transitions: RankingEntryWithWorking[];
    pitches: RankingEntryWithWorking[];
    doors_knocked: RankingEntryWithWorking[];
    decision_makers: RankingEntryWithWorking[];
    closes?: RankingEntryWithWorking[];
  };
  currentUserId: string | null;
  isLive?: boolean;
  isFetching?: boolean;
  title?: string;
}

const metricConfig: Record<MetricKey, { label: string; shortLabel: string; icon: typeof Trophy; gapUnit: string }> = {
  fp_plus: { label: 'FP+', shortLabel: 'FP+', icon: Trophy, gapUnit: 'FP+' },
  prmr: { label: 'PRMR', shortLabel: 'RMR', icon: DollarSign, gapUnit: '' },
  presentations: { label: 'Presentations', shortLabel: 'Pres', icon: Presentation, gapUnit: 'pres' },
  doors_knocked: { label: 'Doors', shortLabel: 'Doors', icon: Footprints, gapUnit: 'doors' },
  decision_makers: { label: 'DMs', shortLabel: 'DMs', icon: Users, gapUnit: 'DMs' },
  pitches: { label: 'Pitches', shortLabel: 'Pitches', icon: Target, gapUnit: 'pitches' },
  transitions: { label: 'Transitions', shortLabel: 'Trans', icon: ArrowRightLeft, gapUnit: 'trans' },
  closes: { label: 'Closes', shortLabel: 'Closes', icon: Handshake, gapUnit: 'closes' },
};

const metricOrder: MetricKey[] = ['fp_plus', 'prmr', 'closes', 'presentations', 'transitions', 'pitches', 'decision_makers', 'doors_knocked'];
const metricPriority: MetricKey[] = ['fp_plus', 'prmr', 'presentations', 'transitions', 'pitches', 'decision_makers', 'doors_knocked', 'closes'];

export const UnifiedRaceSection = ({ rankings, currentUserId, isLive = false, isFetching = false, title }: UnifiedRaceSectionProps) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const [showPhotoUpload, setShowPhotoUpload] = useState<string | null>(null);
  const navigate = useNavigate();
  const userRowRef = useRef<HTMLDivElement>(null);

  // Track previous rankings for live mode rank change animations
  const [prevRankings, setPrevRankings] = useState<Map<string, number>>(new Map());
  const [rankChanges, setRankChanges] = useState<Map<string, 'up' | 'down' | null>>(new Map());

  const autoSelectedMetric = useMemo(() => {
    if (!rankings) return 'doors_knocked';
    for (const metric of metricPriority) {
      const arr = (rankings as any)[metric];
      if (arr && arr.length > 0) return metric;
    }
    return 'doors_knocked';
  }, [rankings]);

  const activeMetric = selectedMetric ?? autoSelectedMetric;

  const currentRankings: RankingEntryWithWorking[] = useMemo(() => {
    if (!rankings) return [];
    return ((rankings as any)[activeMetric] || []) as RankingEntryWithWorking[];
  }, [rankings, activeMetric]);

  // Track ranking changes (live mode only)
  useEffect(() => {
    if (!isLive || !currentRankings.length) return;

    const newRankMap = new Map<string, number>();
    currentRankings.forEach((entry, index) => {
      newRankMap.set(entry.userId, index);
    });

    if (prevRankings.size > 0) {
      const changes = new Map<string, 'up' | 'down' | null>();
      currentRankings.forEach((entry, newIndex) => {
        const oldIndex = prevRankings.get(entry.userId);
        if (oldIndex !== undefined && oldIndex !== newIndex) {
          changes.set(entry.userId, newIndex < oldIndex ? 'up' : 'down');
        }
      });
      if (changes.size > 0) {
        setRankChanges(changes);
        setTimeout(() => setRankChanges(new Map()), 2000);
      }
    }
    setPrevRankings(newRankMap);
  }, [currentRankings, isLive]);

  const userIndex = useMemo(() => {
    if (!currentUserId || !currentRankings.length) return -1;
    return currentRankings.findIndex(r => r.userId === currentUserId);
  }, [currentRankings, currentUserId]);

  useEffect(() => {
    if (userRowRef.current && userIndex > 2) {
      setTimeout(() => {
        userRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [userIndex, currentRankings.length]);

  const config = metricConfig[activeMetric];

  if (!currentRankings.length) {
    return null;
  }

  const formatValue = (val: number) => {
    if (activeMetric === 'fp_plus') return val.toFixed(1);
    if (activeMetric === 'prmr') return `$${val.toLocaleString()}`;
    return val.toString();
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header with Metric Toggle */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-semibold">{title || (isLive ? 'Live Race' : 'Rankings')}</span>
            {isLive && (
              <span className="relative text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {isFetching && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-primary/40" />
                )}
                <span className="relative flex items-center gap-1">
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isFetching ? "bg-primary animate-pulse" : "bg-green-500"
                  )} />
                  Live
                </span>
              </span>
            )}
          </div>
          {userIndex >= 0 && (
            <span className="text-sm text-muted-foreground">
              #{userIndex + 1} of {currentRankings.length}
            </span>
          )}
        </div>

        {/* Metric Toggle Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {metricOrder.map(metric => {
            const cfg = metricConfig[metric];
            const isActive = metric === activeMetric;
            const hasData = ((rankings as any)?.[metric]?.length ?? 0) > 0;

            return (
              <button
                key={metric}
                onClick={() => { hapticLight(); setSelectedMetric(metric); }}
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
          {currentRankings.map((entry, index) => {
            const isCurrentUser = entry.userId === currentUserId;
            const isLeader = index === 0;
            const isAboveUser = userIndex > 0 && index === userIndex - 1;
            const isBelowUser = userIndex >= 0 && userIndex < currentRankings.length - 1 && index === userIndex + 1;
            const rankChange = isLive ? rankChanges.get(entry.userId) : undefined;

            const gapToAhead = isCurrentUser && userIndex > 0
              ? currentRankings[userIndex - 1].value - entry.value
              : 0;

            const gapBehind = isCurrentUser && userIndex < currentRankings.length - 1
              ? entry.value - currentRankings[userIndex + 1].value
              : 0;

            // PRMR fallback for FP+ zero-gap
            const getPrmrGap = (): number | null => {
              if (!isCurrentUser || userIndex <= 0 || activeMetric !== 'fp_plus') return null;
              const prmrArr = (rankings as any)?.prmr || [];
              const userPrmr = prmrArr.find((e: any) => e.userId === currentUserId);
              const aheadId = currentRankings[userIndex - 1].userId;
              const aheadPrmr = prmrArr.find((e: any) => e.userId === aheadId);
              if (!userPrmr || !aheadPrmr) return null;
              return aheadPrmr.value - userPrmr.value;
            };

            const fpGapRoundsToZero = activeMetric === 'fp_plus' && gapToAhead > 0 && Number(gapToAhead.toFixed(1)) === 0;
            const prmrGap = fpGapRoundsToZero ? getPrmrGap() : null;
            const showPrmrFallback = fpGapRoundsToZero && prmrGap !== null && prmrGap > 0;

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
                      {showPrmrFallback
                        ? `$${Math.round(prmrGap!)} PRMR to catch`
                        : `${formatValue(gapToAhead)} ${config.gapUnit} to catch`}
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
                  {/* Rank change indicator (live only) */}
                  {isLive && (
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
                  )}

                  {/* Rank Badge */}
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    isLeader && "bg-amber-500 text-white",
                    index === 1 && !isCurrentUser && "bg-slate-400 text-white",
                    index === 2 && !isCurrentUser && "bg-amber-700 text-white",
                    index > 2 && !isCurrentUser && "bg-muted text-muted-foreground",
                    isCurrentUser && "bg-primary text-primary-foreground"
                  )}>
                    {isLeader ? <Trophy className="h-3 w-3" /> : `${index + 1}`}
                  </div>

                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={entry.profilePhotoUrl || undefined} alt={entry.name} />
                      <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                        {getInitials(entry.name)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Camera icon for current user without photo (live only) */}
                    {isLive && isCurrentUser && !entry.profilePhotoUrl && (
                      <button
                        onClick={() => setShowPhotoUpload(entry.userId)}
                        className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                      >
                        <Camera className="h-2.5 w-2.5" />
                      </button>
                    )}
                    {/* Working indicator (live only) */}
                    {isLive && (entry as RankingEntryWithWorking).isWorking && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 border border-background"></span>
                      </span>
                    )}
                  </div>

                  {/* Name - tappable to navigate to profile */}
                  <button
                    className="flex-1 min-w-0 text-left active:scale-[0.98] transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      hapticLight();
                      navigate(`/profile/${entry.userId}`);
                    }}
                  >
                    <div className="flex items-center gap-1.5">
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
                  </button>

                  {/* Value */}
                  <div className={cn(
                    "text-right shrink-0",
                    isCurrentUser && "text-primary font-semibold"
                  )}>
                    <span className="font-bold">{formatValue(entry.value)}</span>
                  </div>
                </motion.div>

                {/* Gap indicator below current user */}
                {isCurrentUser && userIndex < currentRankings.length - 1 && gapBehind > 0 && (
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/50">
                    <ChevronDown className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      {formatValue(gapBehind)} {config.gapUnit} ahead
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer hint (live only) */}
      {isLive && currentRankings.length > 5 && (
        <div className="px-4 py-2 bg-muted/30 text-center">
          <span className="text-xs text-muted-foreground">
            {currentRankings.filter(r => (r as RankingEntryWithWorking).isWorking).length} people knocking right now
          </span>
        </div>
      )}

      {/* Photo Upload Dialog */}
      {isLive && (
        <Dialog open={!!showPhotoUpload} onOpenChange={(open) => !open && setShowPhotoUpload(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Your Photo</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <ProfilePhotoUpload
                currentPhotoUrl={currentRankings.find(r => r.userId === showPhotoUpload)?.profilePhotoUrl || null}
                name={currentRankings.find(r => r.userId === showPhotoUpload)?.name || 'U'}
                size="lg"
                onPhotoUpdated={() => setShowPhotoUpload(null)}
              />
              <p className="text-sm text-muted-foreground text-center">
                Tap the avatar to upload your profile photo
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
