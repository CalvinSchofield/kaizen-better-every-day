import { Flame, Sun, Moon, Clock, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GritAwards } from "@/hooks/useExpandedLeaderboard";

interface GritAwardsSectionProps {
  gritAwards: GritAwards;
  currentUserId: string | null;
}

export const GritAwardsSection = ({ gritAwards, currentUserId }: GritAwardsSectionProps) => {
  const {
    earliestDoor,
    latestDoor,
    mostHoursWorked,
    isSamePersonEarliestLatestDoor
  } = gritAwards;

  const hasAnyAward = earliestDoor || latestDoor || mostHoursWorked;

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
        <span className="text-xs text-muted-foreground italic">"First to fight, last to leave"</span>
      </div>

      <div className="space-y-3">
        {/* Ironman Award - Special! */}
        {isSamePersonEarliestLatestDoor && earliestDoor && latestDoor && (
          <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🦾</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">IRONMAN AWARD</p>
                    <span className="text-xs bg-orange-500/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">Special!</span>
                  </div>
                  <p className={cn(
                    "text-sm font-medium",
                    currentUserId === earliestDoor.userId ? "text-primary" : "text-foreground"
                  )}>
                    {currentUserId === earliestDoor.userId ? 'You' : earliestDoor.name}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Earliest AND Latest</p>
                <p className="text-sm font-medium">{earliestDoor.timeValue} - {latestDoor.timeValue}</p>
              </div>
            </div>
          </div>
        )}

        {/* Earliest Bird */}
        {earliestDoor && !isSamePersonEarliestLatestDoor && (
          <AwardCard
            icon={<Sun className="h-4 w-4 text-amber-500" />}
            emoji="🌅"
            title="Earliest Bird"
            subtitle="First door knocked"
            name={earliestDoor.name}
            value={earliestDoor.timeValue}
            isSaturday={earliestDoor.isSaturday}
            isCurrentUser={currentUserId === earliestDoor.userId}
          />
        )}

        {/* Night Owl */}
        {latestDoor && !isSamePersonEarliestLatestDoor && (
          <AwardCard
            icon={<Moon className="h-4 w-4 text-indigo-500" />}
            emoji="🌙"
            title="Night Owl"
            subtitle="Last door knocked"
            name={latestDoor.name}
            value={latestDoor.timeValue}
            isCurrentUser={currentUserId === latestDoor.userId}
          />
        )}

        {/* Marathon Runner */}
        {mostHoursWorked && (
          <AwardCard
            icon={<Clock className="h-4 w-4 text-blue-500" />}
            emoji="⏱️"
            title="Marathon Runner"
            subtitle="Most hours worked"
            name={mostHoursWorked.name}
            value={`${mostHoursWorked.value.toFixed(1)} hrs`}
            isCurrentUser={currentUserId === mostHoursWorked.userId}
          />
        )}
      </div>
    </div>
  );
};

interface AwardCardProps {
  icon: React.ReactNode;
  emoji: string;
  title: string;
  subtitle: string;
  name: string;
  value: string;
  isSaturday?: boolean;
  isCurrentUser?: boolean;
}

const AwardCard = ({ emoji, title, subtitle, name, value, isSaturday, isCurrentUser }: AwardCardProps) => (
  <div className={cn(
    "flex items-center justify-between p-3 rounded-xl transition-all",
    isCurrentUser 
      ? "bg-primary/10 border-2 border-primary/20" 
      : "bg-muted/50 border border-border"
  )}>
    <div className="flex items-center gap-3">
      <span className="text-xl">{emoji}</span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className={cn(
          "text-xs",
          isCurrentUser ? "text-primary" : "text-muted-foreground"
        )}>
          {isCurrentUser ? 'You' : name}
        </p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-lg font-bold">{value}</p>
      {isSaturday && (
        <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
          Saturday
        </span>
      )}
      {isCurrentUser && <span className="text-primary ml-1">⭐</span>}
    </div>
  </div>
);
