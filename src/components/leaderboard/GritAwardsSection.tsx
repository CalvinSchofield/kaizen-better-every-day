import { useState } from "react";
import { Flame, Sun, Moon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GritAwards, TimingSet } from "@/hooks/useExpandedLeaderboard";

interface GritAwardsSectionProps {
  gritAwards: GritAwards;
  currentUserId: string | null;
}

type DayFilter = 'all' | 'weekday' | 'saturday';

export const GritAwardsSection = ({ gritAwards, currentUserId }: GritAwardsSectionProps) => {
  const [dayFilter, setDayFilter] = useState<DayFilter>('all');
  
  const {
    mostHoursWorked,
    isSamePersonEarliestLatestDoor,
    hasWeekdayData,
    hasSaturdayData,
  } = gritAwards;

  // Get the timing set based on filter
  const getTimingSet = (): TimingSet => {
    if (dayFilter === 'weekday') return gritAwards.weekday;
    if (dayFilter === 'saturday') return gritAwards.saturday;
    return {
      earliestDoor: gritAwards.earliestDoor,
      latestDoor: gritAwards.latestDoor,
      earliestDM: gritAwards.earliestDM,
      latestDM: gritAwards.latestDM,
      earliestPitch: gritAwards.earliestPitch,
      latestPitch: gritAwards.latestPitch,
      earliestTransition: gritAwards.earliestTransition,
      latestTransition: gritAwards.latestTransition,
      earliestPresentation: gritAwards.earliestPresentation,
      latestPresentation: gritAwards.latestPresentation,
      earliestClose: gritAwards.earliestClose,
      latestClose: gritAwards.latestClose,
    };
  };

  const timingSet = getTimingSet();
  const { earliestDoor, latestDoor } = timingSet;

  const hasAnyAward = gritAwards.earliestDoor || gritAwards.latestDoor || mostHoursWorked;
  const showDayFilter = hasWeekdayData && hasSaturdayData;

  if (!hasAnyAward) {
    return null;
  }

  // Check ironman for current filter
  const isIronman = dayFilter === 'all' 
    ? isSamePersonEarliestLatestDoor
    : (earliestDoor && latestDoor && earliestDoor.userId === latestDoor.userId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Grit Awards
          </h2>
          <span className="text-xs text-muted-foreground italic hidden sm:inline">"First to fight, last to leave"</span>
        </div>
        
        {/* Day Filter Toggle */}
        {showDayFilter && (
          <div className="flex items-center gap-0.5 bg-secondary/50 rounded-full p-0.5">
            <button
              onClick={() => setDayFilter('all')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                dayFilter === 'all'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            <button
              onClick={() => setDayFilter('weekday')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                dayFilter === 'weekday'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              M-F
            </button>
            <button
              onClick={() => setDayFilter('saturday')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                dayFilter === 'saturday'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sat
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Ironman Award - Special! */}
        {isIronman && earliestDoor && latestDoor && (
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
        {earliestDoor && !isIronman && (
          <AwardCard
            icon={<Sun className="h-4 w-4 text-amber-500" />}
            emoji="🌅"
            title="Earliest Bird"
            subtitle="First door knocked"
            name={earliestDoor.name}
            value={earliestDoor.timeValue}
            dayLabel={dayFilter === 'all' ? (earliestDoor.isSaturday ? 'Saturday' : undefined) : undefined}
            isCurrentUser={currentUserId === earliestDoor.userId}
          />
        )}

        {/* Night Owl */}
        {latestDoor && !isIronman && (
          <AwardCard
            icon={<Moon className="h-4 w-4 text-indigo-500" />}
            emoji="🌙"
            title="Night Owl"
            subtitle="Last door knocked"
            name={latestDoor.name}
            value={latestDoor.timeValue}
            dayLabel={dayFilter === 'all' ? (latestDoor.isSaturday ? 'Saturday' : undefined) : undefined}
            isCurrentUser={currentUserId === latestDoor.userId}
          />
        )}

        {/* Marathon Runner - Only show on "All" filter */}
        {dayFilter === 'all' && mostHoursWorked && (
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
        
        {/* No data message for filtered view */}
        {dayFilter !== 'all' && !earliestDoor && !latestDoor && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No {dayFilter === 'saturday' ? 'Saturday' : 'weekday'} data yet
          </div>
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
  dayLabel?: string;
  isCurrentUser?: boolean;
}

const AwardCard = ({ emoji, title, subtitle, name, value, dayLabel, isCurrentUser }: AwardCardProps) => (
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
      {dayLabel && (
        <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
          {dayLabel}
        </span>
      )}
      {isCurrentUser && <span className="text-primary ml-1">⭐</span>}
    </div>
  </div>
);
