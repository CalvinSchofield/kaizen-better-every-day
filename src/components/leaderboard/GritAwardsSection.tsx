import { motion } from "framer-motion";
import { Zap } from "lucide-react";
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

  const isIronmanWeekday = earlyBirdWeekday && nightOwlWeekday && 
    earlyBirdWeekday.userId === nightOwlWeekday.userId;
  const isIronmanSaturday = earlyBirdSaturday && nightOwlSaturday && 
    earlyBirdSaturday.userId === nightOwlSaturday.userId;
  const hasIronman = isIronmanWeekday || isIronmanSaturday;

  const showEarlyBirdWeekday = earlyBirdWeekday && !isIronmanWeekday;
  const showEarlyBirdSaturday = earlyBirdSaturday && !isIronmanSaturday;
  const showNightOwlWeekday = nightOwlWeekday && !isIronmanWeekday;
  const showNightOwlSaturday = nightOwlSaturday && !isIronmanSaturday;

  const hasEarlyBird = showEarlyBirdWeekday || showEarlyBirdSaturday;
  const hasNightOwl = showNightOwlWeekday || showNightOwlSaturday;
  const hasAnyAward = hasIronman || hasEarlyBird || hasNightOwl || mostHoursWorked;

  if (!hasAnyAward) return null;

  const ironmanStreakCount = streaks?.ironmanStreak?.currentStreak;
  const earlyBirdStreakCount = streaks?.earlyBirdStreak?.currentStreak;
  const nightOwlStreakCount = streaks?.nightOwlStreak?.currentStreak;
  const workhorseStreakCount = streaks?.workhorseStreak?.currentStreak;

  let cardIndex = 0;

  return (
    <div className="space-y-3">
      {/* Ironman — hero card */}
      {hasIronman && (
        <AwardCard
          index={cardIndex++}
          gradient="from-orange-500/20 via-amber-500/15 to-yellow-500/10 dark:from-orange-500/25 dark:via-amber-500/15 dark:to-yellow-500/10"
          borderGlow="border-orange-500/30 dark:border-orange-500/40"
          emoji="🦾"
          title="Ironman"
          badge="Legendary"
          badgeColor="bg-orange-500/20 text-orange-600 dark:text-orange-400"
          streakCount={ironmanStreakCount}
          streakHolderName={streaks?.ironmanStreak?.name}
        >
          <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
            First to fight & last to leave — earned both Early Bird and Night Owl.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <AwardWinnerColumn
              label="Mon – Fri"
              winner={isIronmanWeekday ? earlyBirdWeekday : null}
              subtitle={isIronmanWeekday && earlyBirdWeekday && nightOwlWeekday
                ? `${earlyBirdWeekday.timeValue} → ${nightOwlWeekday.timeValue}`
                : undefined}
              currentUserId={currentUserId}
            />
            <AwardWinnerColumn
              label="Saturday"
              winner={isIronmanSaturday ? earlyBirdSaturday : null}
              subtitle={isIronmanSaturday && earlyBirdSaturday && nightOwlSaturday
                ? `${earlyBirdSaturday.timeValue} → ${nightOwlSaturday.timeValue}`
                : undefined}
              currentUserId={currentUserId}
            />
          </div>
        </AwardCard>
      )}

      {/* Early Bird */}
      {hasEarlyBird && (
        <AwardCard
          index={cardIndex++}
          gradient="from-amber-400/15 via-yellow-300/10 to-transparent dark:from-amber-400/20 dark:via-yellow-300/10 dark:to-transparent"
          borderGlow="border-amber-400/25 dark:border-amber-400/30"
          emoji="🌅"
          title="Early Bird"
          streakCount={earlyBirdStreakCount}
          streakHolderName={streaks?.earlyBirdStreak?.name}
        >
          <div className="grid grid-cols-2 gap-3">
            <AwardWinnerColumn
              label="Mon – Fri"
              winner={showEarlyBirdWeekday ? earlyBirdWeekday : null}
              subtitle={showEarlyBirdWeekday && earlyBirdWeekday ? earlyBirdWeekday.timeValue : undefined}
              detail={showEarlyBirdWeekday && earlyBirdWeekday ? earlyBirdWeekday.actionType : undefined}
              currentUserId={currentUserId}
            />
            <AwardWinnerColumn
              label="Saturday"
              winner={showEarlyBirdSaturday ? earlyBirdSaturday : null}
              subtitle={showEarlyBirdSaturday && earlyBirdSaturday ? earlyBirdSaturday.timeValue : undefined}
              detail={showEarlyBirdSaturday && earlyBirdSaturday ? earlyBirdSaturday.actionType : undefined}
              currentUserId={currentUserId}
            />
          </div>
        </AwardCard>
      )}

      {/* Night Owl */}
      {hasNightOwl && (
        <AwardCard
          index={cardIndex++}
          gradient="from-indigo-500/15 via-purple-400/10 to-transparent dark:from-indigo-500/20 dark:via-purple-400/10 dark:to-transparent"
          borderGlow="border-indigo-400/25 dark:border-indigo-400/30"
          emoji="🌙"
          title="Night Owl"
          streakCount={nightOwlStreakCount}
          streakHolderName={streaks?.nightOwlStreak?.name}
        >
          <div className="grid grid-cols-2 gap-3">
            <AwardWinnerColumn
              label="Mon – Fri"
              winner={showNightOwlWeekday ? nightOwlWeekday : null}
              subtitle={showNightOwlWeekday && nightOwlWeekday ? nightOwlWeekday.timeValue : undefined}
              detail={showNightOwlWeekday && nightOwlWeekday ? nightOwlWeekday.actionType : undefined}
              currentUserId={currentUserId}
            />
            <AwardWinnerColumn
              label="Saturday"
              winner={showNightOwlSaturday ? nightOwlSaturday : null}
              subtitle={showNightOwlSaturday && nightOwlSaturday ? nightOwlSaturday.timeValue : undefined}
              detail={showNightOwlSaturday && nightOwlSaturday ? nightOwlSaturday.actionType : undefined}
              currentUserId={currentUserId}
            />
          </div>
        </AwardCard>
      )}

      {/* Workhorse */}
      {mostHoursWorked && (
        <AwardCard
          index={cardIndex++}
          gradient="from-sky-500/12 via-blue-400/8 to-transparent dark:from-sky-500/15 dark:via-blue-400/10 dark:to-transparent"
          borderGlow="border-sky-400/25 dark:border-sky-400/30"
          emoji="⏱️"
          title="Workhorse"
          streakCount={workhorseStreakCount}
          streakHolderName={streaks?.workhorseStreak?.name}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={cn(
                "text-sm font-semibold",
                currentUserId === mostHoursWorked.userId ? "text-primary" : "text-foreground"
              )}>
                {currentUserId === mostHoursWorked.userId ? "You" : mostHoursWorked.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Most hours on the doors</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tracking-tight text-foreground">{mostHoursWorked.value.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">hours</p>
            </div>
          </div>
        </AwardCard>
      )}
    </div>
  );
};

/* ─── Sub-components ─── */

const AwardCard = ({
  children,
  index,
  gradient,
  borderGlow,
  emoji,
  title,
  badge,
  badgeColor,
  streakCount,
  streakHolderName,
}: {
  children: React.ReactNode;
  index: number;
  gradient: string;
  borderGlow: string;
  emoji: string;
  title: string;
  badge?: string;
  badgeColor?: string;
  streakCount?: number;
  streakHolderName?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: index * 0.08, ease: "easeOut" }}
    className={cn(
      "relative rounded-2xl border p-4 overflow-hidden",
      borderGlow
    )}
  >
    {/* Gradient background */}
    <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
    
    {/* Content */}
    <div className="relative">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{emoji}</span>
          <h3 className="text-base font-bold text-foreground tracking-tight">{title}</h3>
          {badge && (
            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", badgeColor)}>
              {badge}
            </span>
          )}
        </div>
        {streakCount && streakCount >= 2 && (
          <StreakBadge count={streakCount} holderName={streakHolderName} />
        )}
      </div>
      {children}
    </div>
  </motion.div>
);

const AwardWinnerColumn = ({
  label,
  winner,
  subtitle,
  detail,
  currentUserId,
}: {
  label: string;
  winner: TimingAward | null;
  subtitle?: string;
  detail?: string;
  currentUserId: string | null;
}) => {
  if (!winner) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground/50">—</p>
      </div>
    );
  }

  const isYou = currentUserId === winner.userId;

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">{label}</p>
      <p className={cn(
        "text-sm font-semibold leading-tight",
        isYou ? "text-primary" : "text-foreground"
      )}>
        {isYou ? "You" : winner.name}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>
      )}
      {detail && (
        <p className="text-[10px] text-muted-foreground/60 italic">{detail}</p>
      )}
    </div>
  );
};

const StreakBadge = ({ count, holderName }: { count: number; holderName?: string }) => (
  <div className="flex items-center gap-1 bg-orange-500/15 dark:bg-orange-500/25 px-2.5 py-1 rounded-full">
    <Zap className="h-3 w-3 text-orange-500" />
    <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 tracking-wide">
      {count}🔥
    </span>
  </div>
);
