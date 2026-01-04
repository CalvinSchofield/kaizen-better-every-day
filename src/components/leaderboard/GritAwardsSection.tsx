import { Flame, Sun, Moon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GritAwards, TimingAward } from "@/hooks/useExpandedLeaderboard";

interface GritAwardsSectionProps {
  gritAwards: GritAwards;
  currentUserId: string | null;
}

export const GritAwardsSection = ({ gritAwards, currentUserId }: GritAwardsSectionProps) => {
  const {
    mostHoursWorked,
    earlyBirdWeekday,
    earlyBirdSaturday,
    nightOwlWeekday,
    nightOwlSaturday,
  } = gritAwards;

  const hasEarlyBird = earlyBirdWeekday || earlyBirdSaturday;
  const hasNightOwl = nightOwlWeekday || nightOwlSaturday;
  const hasAnyAward = hasEarlyBird || hasNightOwl || mostHoursWorked;

  if (!hasAnyAward) {
    return null;
  }

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
        {/* Early Bird Award - Dual Column */}
        {hasEarlyBird && (
          <DualAwardCard
            icon={<Sun className="h-4 w-4 text-amber-500" />}
            emoji="🌅"
            title="Early Bird"
            weekdayEntry={earlyBirdWeekday}
            saturdayEntry={earlyBirdSaturday}
            currentUserId={currentUserId}
            weekdayLabel="Mon-Fri (before 3 PM)"
            saturdayLabel="Saturday (before 10 AM)"
          />
        )}

        {/* Night Owl Award - Dual Column */}
        {hasNightOwl && (
          <DualAwardCard
            icon={<Moon className="h-4 w-4 text-indigo-500" />}
            emoji="🌙"
            title="Night Owl"
            weekdayEntry={nightOwlWeekday}
            saturdayEntry={nightOwlSaturday}
            currentUserId={currentUserId}
            weekdayLabel="Mon-Fri (after 7 PM)"
            saturdayLabel="Saturday (after 7 PM)"
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
                <p className="text-sm font-semibold">Workhorse</p>
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

interface DualAwardCardProps {
  icon: React.ReactNode;
  emoji: string;
  title: string;
  weekdayEntry: TimingAward | null;
  saturdayEntry: TimingAward | null;
  currentUserId: string | null;
  weekdayLabel: string;
  saturdayLabel: string;
}

const DualAwardCard = ({ 
  emoji, 
  title, 
  weekdayEntry, 
  saturdayEntry, 
  currentUserId,
  weekdayLabel,
  saturdayLabel 
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
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{emoji}</span>
        <p className="text-sm font-semibold">{title}</p>
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
