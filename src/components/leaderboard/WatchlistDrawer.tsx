import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, TrendingUp, TrendingDown, Minus, Trophy, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getInitials, getCleanFirstName } from "@/utils/nameUtils";
import { useWatchlistDetails, WatchedUserDetail } from "@/hooks/useWatchlistDetails";
import { useWatchlist } from "@/hooks/useWatchlist";
import { hapticLight } from "@/utils/haptics";

interface WatchlistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Mini sparkline SVG */
const Sparkline = ({ data, className }: { data: number[]; className?: string }) => {
  if (!data.length || data.every(v => v === 0)) {
    return <div className={cn("h-6 w-16 flex items-center justify-center", className)}>
      <span className="text-[9px] text-muted-foreground">No data</span>
    </div>;
  }
  
  const max = Math.max(...data, 0.1);
  const width = 64;
  const height = 24;
  const padding = 2;
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;
  
  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * usableW;
    const y = padding + usableH - (v / max) * usableH;
    return `${x},${y}`;
  }).join(" ");

  // Trend: compare last 3 to first 4
  const firstHalf = data.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  const secondHalf = data.slice(4).reduce((a, b) => a + b, 0) / Math.max(data.slice(4).length, 1);
  const trending = secondHalf > firstHalf * 1.1 ? "up" : secondHalf < firstHalf * 0.9 ? "down" : "flat";
  
  const strokeColor = trending === "up" 
    ? "hsl(var(--success))" 
    : trending === "down" 
      ? "hsl(var(--destructive))" 
      : "hsl(var(--muted-foreground))";

  return (
    <svg width={width} height={height} className={className}>
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* Dot on last point */}
      {data.length > 0 && (
        <circle
          cx={padding + usableW}
          cy={padding + usableH - (data[data.length - 1] / max) * usableH}
          r="2"
          fill={strokeColor}
        />
      )}
    </svg>
  );
};

const TrendIcon = ({ sparkline }: { sparkline: number[] }) => {
  const firstHalf = sparkline.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  const secondHalf = sparkline.slice(4).reduce((a, b) => a + b, 0) / Math.max(sparkline.slice(4).length, 1);
  
  if (secondHalf > firstHalf * 1.1) return <TrendingUp className="h-3 w-3 text-success" />;
  if (secondHalf < firstHalf * 0.9) return <TrendingDown className="h-3 w-3 text-destructive" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

type ViewMode = "cards" | "activity";

const WatchedPlayerCard = ({ 
  user, 
  currentUser, 
  rank, 
  onRemove 
}: { 
  user: WatchedUserDetail; 
  currentUser: WatchedUserDetail | null;
  rank: number;
  onRemove: (userId: string) => void;
}) => {
  const diff = currentUser ? user.todayFp - currentUser.todayFp : 0;
  const isAhead = diff > 0;
  const firstName = getCleanFirstName(user.name);
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="bg-card border border-border rounded-xl p-3 relative overflow-hidden"
    >
      {/* Rank badge */}
      <div className={cn(
        "absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
        rank === 1 && "bg-amber-500 text-white",
        rank === 2 && "bg-slate-400 text-white",
        rank === 3 && "bg-amber-700 text-white",
        rank > 3 && "bg-muted text-muted-foreground"
      )}>
      {rank === 1 ? <Trophy className="h-2.5 w-2.5" /> : rank}
      </div>

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <ProfileAvatar
          userId={user.userId}
          name={user.name}
          photoUrl={user.photoUrl}
          className="h-11 w-11"
          fallbackClassName="text-sm bg-muted"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm truncate">{firstName}</span>
            {user.year === "Rookie" && (
              <span className="text-[9px] font-bold bg-primary/10 text-primary px-1 py-0.5 rounded">R</span>
            )}
          </div>
          
          {/* Today's headline stat */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-lg font-bold text-foreground">{user.todayFp.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">FP+ today</span>
          </div>

          {/* Head-to-head vs you */}
          {currentUser && (
            <div className={cn(
              "text-[11px] font-medium mt-0.5",
              isAhead ? "text-destructive" : diff < 0 ? "text-[hsl(var(--success))]" : "text-muted-foreground"
            )}>
              {diff === 0 
                ? "Tied with you" 
                : isAhead 
                  ? `${diff.toFixed(1)} FP+ ahead of you`
                  : `You're ${Math.abs(diff).toFixed(1)} FP+ ahead`}
            </div>
          )}
        </div>

        {/* Sparkline */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <Sparkline data={user.sparkline} />
          <div className="flex items-center gap-0.5">
            <TrendIcon sparkline={user.sparkline} />
            <span className="text-[9px] text-muted-foreground">7d</span>
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-border/50">
        <StatPill label="Yesterday" value={user.yesterdayFp.toFixed(1)} />
        <StatPill label="Week" value={user.weekFp.toFixed(1)} />
        <StatPill label="Season" value={user.seasonFp.toFixed(1)} />
        <button
          onClick={(e) => { e.stopPropagation(); hapticLight(); onRemove(user.userId); }}
          className="ml-auto p-1 rounded-full hover:bg-muted active:scale-90 transition-all"
        >
          <EyeOff className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </motion.div>
  );
};

const StatPill = ({ label, value }: { label: string; value: string }) => (
  <div className="text-center">
    <div className="text-xs font-semibold text-foreground">{value}</div>
    <div className="text-[9px] text-muted-foreground">{label}</div>
  </div>
);

const ActivityFeedItem = ({ user, currentUser }: { user: WatchedUserDetail; currentUser: WatchedUserDetail | null }) => {
  const firstName = getCleanFirstName(user.name);
  if (user.todayFp === 0 && user.yesterdayFp === 0) return null;
  
  const isToday = user.todayFp > 0;
  const fp = isToday ? user.todayFp : user.yesterdayFp;
  const label = isToday ? "today" : "yesterday";
  const diff = currentUser && isToday ? fp - currentUser.todayFp : null;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
      <ProfileAvatar
        userId={user.userId}
        name={user.name}
        photoUrl={user.photoUrl}
        className="h-8 w-8"
        fallbackClassName="text-xs bg-muted"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{firstName}</span>
          <span className="text-muted-foreground"> sold </span>
          <span className="font-bold text-foreground">{fp.toFixed(1)} FP+</span>
          <span className="text-muted-foreground"> {label}</span>
        </p>
        {diff !== null && diff > 0 && (
          <p className="text-[11px] text-destructive">
            {diff.toFixed(1)} FP+ ahead of you right now
          </p>
        )}
      </div>
      <Sparkline data={user.sparkline} className="shrink-0" />
    </div>
  );
};

export const WatchlistDrawer = ({ open, onOpenChange }: WatchlistDrawerProps) => {
  const { data, isLoading } = useWatchlistDetails();
  const { removeFromWatchlist } = useWatchlist();
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const watchedUsers = data?.watchedUsers || [];
  const currentUser = data?.currentUser || null;

  // Summary stats
  const beatenToday = currentUser 
    ? watchedUsers.filter(u => currentUser.todayFp > u.todayFp).length 
    : 0;
  const activeToday = watchedUsers.filter(u => u.todayFp > 0).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] flex flex-col p-0 [&>button]:hidden">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Eye className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">Your Watchlist</h2>
                <p className="text-xs text-muted-foreground">
                  {watchedUsers.length} {watchedUsers.length === 1 ? "person" : "people"} · {activeToday} active today
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full hover:bg-muted active:scale-90 transition-all"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Summary banner */}
          {currentUser && watchedUsers.length > 0 && (
            <div className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium",
              beatenToday >= watchedUsers.length
                ? "bg-success/10 text-success border border-success/20"
                : beatenToday > 0
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-muted text-muted-foreground"
            )}>
              {beatenToday >= watchedUsers.length && activeToday > 0
                ? `🔥 You're beating everyone on your watchlist today!`
                : beatenToday > 0
                  ? `You're ahead of ${beatenToday}/${watchedUsers.length} on your watchlist`
                  : activeToday === 0
                    ? "No one on your watchlist has started today yet"
                    : "Time to catch up — get after it!"}
            </div>
          )}

          {/* View mode toggle */}
          <div className="flex items-center gap-1 mt-3 bg-muted/50 rounded-full p-0.5 w-fit">
            <button
              onClick={() => { hapticLight(); setViewMode("cards"); }}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all",
                viewMode === "cards"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              Player Cards
            </button>
            <button
              onClick={() => { hapticLight(); setViewMode("activity"); }}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all",
                viewMode === "activity"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              Activity Feed
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : watchedUsers.length === 0 ? (
            <div className="text-center py-12">
              <Eye className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">No one on your watchlist</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Visit someone's profile and tap the 👁 icon to start watching
              </p>
            </div>
          ) : viewMode === "cards" ? (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {watchedUsers.map((user, index) => (
                  <WatchedPlayerCard
                    key={user.userId}
                    user={user}
                    currentUser={currentUser}
                    rank={index + 1}
                    onRemove={removeFromWatchlist}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div>
              {watchedUsers.filter(u => u.todayFp > 0 || u.yesterdayFp > 0).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No recent activity from your watchlist
                </div>
              ) : (
                watchedUsers
                  .filter(u => u.todayFp > 0 || u.yesterdayFp > 0)
                  .sort((a, b) => (b.todayFp || b.yesterdayFp) - (a.todayFp || a.yesterdayFp))
                  .map(user => (
                    <ActivityFeedItem key={user.userId} user={user} currentUser={currentUser} />
                  ))
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
