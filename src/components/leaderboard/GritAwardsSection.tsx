import { Flame, Sun, Moon, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GritAwards, TimingAward } from "@/hooks/useExpandedLeaderboard";
import type { AwardStreak } from "@/hooks/useAwardStreaks";

interface GritAwardsSectionProps {
  gritAwards: GritAwards;
  currentUserId: string | null;
  streaks?: {
    earlyBirdStreak: AwardStreak | null;
    nightOwlStreak: AwardStreak | null;
    ironmanStreak: AwardStreak | null;
    workhorseStreak: AwardStreak | null;
  };
}

export const GritAwardsSection = ({ gritAwards, currentUserId, streaks }: GritAwardsSectionProps) => {
  const {
    mostHoursWorked,
    earlyBirdWeekday,
    earlyBirdSaturday,
    nightOwlWeekday,
    nightOwlSaturday,
  } = gritAwards;

  // Check for Ironman: same person wins both Early Bird AND Night Owl
  const isIronmanWeekday = earlyBirdWeekday && nightOwlWeekday && 
    earlyBirdWeekday.userId === nightOwlWeekday.userId;
  const isIronmanSaturday = earlyBirdSaturday && nightOwlSaturday && 
    earlyBirdSaturday.userId === nightOwlSaturday.userId;
  const hasIronman = isIronmanWeekday || isIronmanSaturday;

  // For non-ironman display
  const showEarlyBirdWeekday = earlyBirdWeekday && !isIronmanWeekday;
  const showEarlyBirdSaturday = earlyBirdSaturday && !isIronmanSaturday;
  const showNightOwlWeekday = nightOwlWeekday && !isIronmanWeekday;
  const showNightOwlSaturday = nightOwlSaturday && !isIronmanSaturday;

  const hasEarlyBird = showEarlyBirdWeekday || showEarlyBirdSaturday;
  const hasNightOwl = showNightOwlWeekday || showNightOwlSaturday;
  const hasAnyAward = hasIronman || hasEarlyBird || hasNightOwl || mostHoursWorked;

  if (!hasAnyAward) {
    return null;
  }

  // Get relevant streak for each award
  const ironmanStreakCount = streaks?.ironmanStreak?.currentStreak;
  const earlyBirdStreakCount = streaks?.earlyBirdStreak?.currentStreak;
  const nightOwlStreakCount = streaks?.nightOwlStreak?.currentStreak;
  const workhorseStreakCount = streaks?.workhorseStreak?.currentStreak;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-500" />
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Grit Awards
        </h2>
        <span className="text-xs text-muted-foreground italic hidden sm:inline">"First to fight, last to leave"</span>
      </div>

      <div className="space-y-3">
        {/* Ironman Award - Special! */}
        {hasIronman && (
          <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 rounded-xl p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🦾</span>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-orange-600 dark:text-orange-400">IRONMAN AWARD</p>
                  <span className="text-xs bg-orange-500/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">Special!</span>
                </div>
              </div>
              {ironmanStreakCount && ironmanStreakCount >= 2 && (
                <StreakBadge count={ironmanStreakCount} />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mb-2 italic">Early Bird + Night Owl = First to fight, last to leave!</p>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Weekday Ironman */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Mon-Fri</p>
                {isIronmanWeekday && earlyBirdWeekday && nightOwlWeekday ? (
                  <div>
                    <p className={cn(
                      "text-sm font-medium",
                      currentUserId === earlyBirdWeekday.userId ? "text-primary" : "text-foreground"
                    )}>
                      {currentUserId === earlyBirdWeekday.userId ? 'You' : earlyBirdWeekday.name}
                      {currentUserId === earlyBirdWeekday.userId && <span className="ml-1">⭐</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {earlyBirdWeekday.timeValue} → {nightOwlWeekday.timeValue}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">—</p>
                )}
              </div>

              {/* Saturday Ironman */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Saturday</p>
                {isIronmanSaturday && earlyBirdSaturday && nightOwlSaturday ? (
                  <div>
                    <p className={cn(
                      "text-sm font-medium",
                      currentUserId === earlyBirdSaturday.userId ? "text-primary" : "text-foreground"
                    )}>
                      {currentUserId === earlyBirdSaturday.userId ? 'You' : earlyBirdSaturday.name}
                      {currentUserId === earlyBirdSaturday.userId && <span className="ml-1">⭐</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {earlyBirdSaturday.timeValue} → {nightOwlSaturday.timeValue}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">—</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Early Bird Award - Dual Column (excluding Ironman winners) */}
        {hasEarlyBird && (
          <DualAwardCard
            icon={<Sun className="h-4 w-4 text-amber-500" />}
            emoji="🌅"
            title="Early Bird"
            weekdayEntry={showEarlyBirdWeekday ? earlyBirdWeekday : null}
            saturdayEntry={showEarlyBirdSaturday ? earlyBirdSaturday : null}
            currentUserId={currentUserId}
            weekdayLabel="Mon-Fri (before 3 PM)"
            saturdayLabel="Saturday (before 10 AM)"
            streakCount={earlyBirdStreakCount}
          />
        )}

        {/* Night Owl Award - Dual Column (excluding Ironman winners) */}
        {hasNightOwl && (
          <DualAwardCard
            icon={<Moon className="h-4 w-4 text-indigo-500" />}
            emoji="🌙"
            title="Night Owl"
            weekdayEntry={showNightOwlWeekday ? nightOwlWeekday : null}
            saturdayEntry={showNightOwlSaturday ? nightOwlSaturday : null}
            currentUserId={currentUserId}
            weekdayLabel="Mon-Fri (after 7 PM)"
            saturdayLabel="Saturday (after 7 PM)"
            streakCount={nightOwlStreakCount}
          />
        )}

        {/* Workhorse - Most Hours */}
        {mostHoursWorked && (
          <div className={cn(
            "flex items-center justify-between p-3 rounded-xl transition-all",
            currentUserId === mostHoursWorked.userId
              ? "bg-primary/10 border-2 border-primary/20" 
              : "bg-muted/50 border border-border"
          )}>
            <div className="flex items-center gap-3">
              <span className="text-xl">⏱️</span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Workhorse</p>
                  {workhorseStreakCount && workhorseStreakCount >= 2 && (
                    <StreakBadge count={workhorseStreakCount} />
                  )}
                </div>
                <p className={cn(
                  "text-xs",
                  currentUserId === mostHoursWorked.userId ? "text-primary" : "text-muted-foreground"
                )}>
                  {currentUserId === mostHoursWorked.userId ? 'You' : mostHoursWorked.name}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{mostHoursWorked.value.toFixed(1)} hrs</p>
              {currentUserId === mostHoursWorked.userId && <span className="text-primary">⭐</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Streak badge component
const StreakBadge = ({ count }: { count: number }) => (
  <div className="flex items-center gap-1 bg-orange-500/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
    <Zap className="h-3 w-3" />
    <span className="text-xs font-medium">{count} day streak!</span>
  </div>
);

interface DualAwardCardProps {
  icon: React.ReactNode;
  emoji: string;
  title: string;
  weekdayEntry: TimingAward | null;
  saturdayEntry: TimingAward | null;
  currentUserId: string | null;
  weekdayLabel: string;
  saturdayLabel: string;
  streakCount?: number;
}

const DualAwardCard = ({ 
  emoji, 
  title, 
  weekdayEntry, 
  saturdayEntry, 
  currentUserId,
  weekdayLabel,
  saturdayLabel,
  streakCount
}: DualAwardCardProps) => {
  const isWeekdayCurrentUser = weekdayEntry && currentUserId === weekdayEntry.userId;
  const isSaturdayCurrentUser = saturdayEntry && currentUserId === saturdayEntry.userId;
  const isCurrentUserAny = isWeekdayCurrentUser || isSaturdayCurrentUser;

  return (
    <div className={cn(
      "rounded-xl transition-all p-3",
      isCurrentUserAny
        ? "bg-primary/10 border-2 border-primary/20" 
        : "bg-muted/50 border border-border"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <p className="text-sm font-semibold">{title}</p>
        </div>
        {streakCount && streakCount >= 2 && (
          <StreakBadge count={streakCount} />
        )}
      </div>

      {/* Dual columns */}
      <div className="grid grid-cols-2 gap-3">
        {/* Weekday Column */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Mon-Fri</p>
          {weekdayEntry ? (
            <div>
              <p className={cn(
                "text-sm font-medium",
                isWeekdayCurrentUser ? "text-primary" : "text-foreground"
              )}>
                {isWeekdayCurrentUser ? 'You' : weekdayEntry.name}
                {isWeekdayCurrentUser && <span className="ml-1">⭐</span>}
              </p>
              <p className="text-xs text-muted-foreground">{weekdayEntry.timeValue}</p>
              <p className="text-[10px] text-muted-foreground/70 italic">({weekdayEntry.actionType})</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </div>

        {/* Saturday Column */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Saturday</p>
          {saturdayEntry ? (
            <div>
              <p className={cn(
                "text-sm font-medium",
                isSaturdayCurrentUser ? "text-primary" : "text-foreground"
              )}>
                {isSaturdayCurrentUser ? 'You' : saturdayEntry.name}
                {isSaturdayCurrentUser && <span className="ml-1">⭐</span>}
              </p>
              <p className="text-xs text-muted-foreground">{saturdayEntry.timeValue}</p>
              <p className="text-[10px] text-muted-foreground/70 italic">({saturdayEntry.actionType})</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </div>
      </div>
    </div>
  );
};
