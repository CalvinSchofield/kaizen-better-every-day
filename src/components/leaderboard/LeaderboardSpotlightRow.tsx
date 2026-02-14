import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Swords, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/utils/haptics";
import { useActiveCompetitionCount } from "@/hooks/useActiveCompetitionCount";
import { usePersonalRecords } from "@/hooks/useRecordsTracking";
import { GritAwardsSheet } from "./GritAwardsSheet";
import { RecordsSheet } from "./RecordsSheet";
import type { GritAwards } from "@/hooks/useExpandedLeaderboard";
import type { AwardStreak } from "@/hooks/useAwardStreaks";

interface LeaderboardSpotlightRowProps {
  gritAwards?: GritAwards;
  currentUserId: string | null;
  streaks?: {
    earlyBirdStreak: AwardStreak | null;
    nightOwlStreak: AwardStreak | null;
    ironmanStreak: AwardStreak | null;
    workhorseStreak: AwardStreak | null;
  };
  showCompetitions?: boolean;
}

const SpotlightCard = ({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  badge,
  onClick,
}: {
  icon: typeof Flame;
  iconColor: string;
  title: string;
  subtitle: string;
  badge?: string;
  onClick: () => void;
}) => (
  <button
    onClick={() => {
      hapticLight();
      onClick();
    }}
    className={cn(
      "flex-shrink-0 w-[160px] bg-card border border-border rounded-xl p-3",
      "flex flex-col gap-2 text-left",
      "active:scale-[0.97] transition-transform"
    )}
  >
    <div className="flex items-center justify-between">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      {badge && (
        <span className="text-[10px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </div>
    <div>
      <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
      <p className="text-xs text-muted-foreground leading-tight mt-0.5 line-clamp-2">{subtitle}</p>
    </div>
  </button>
);

export const LeaderboardSpotlightRow = ({
  gritAwards,
  currentUserId,
  streaks,
  showCompetitions = true,
}: LeaderboardSpotlightRowProps) => {
  const [gritOpen, setGritOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const navigate = useNavigate();
  const { data: competitionCount } = useActiveCompetitionCount();
  const { dayRecord, weekRecord, monthRecord } = usePersonalRecords(currentUserId ?? undefined);

  // Build grit subtitle
  const getGritSubtitle = () => {
    if (!gritAwards) return "No awards yet";
    const { earlyBirdWeekday, nightOwlWeekday, mostHoursWorked } = gritAwards;
    const isIronman = earlyBirdWeekday && nightOwlWeekday && earlyBirdWeekday.userId === nightOwlWeekday.userId;
    if (isIronman) return `🦾 ${earlyBirdWeekday!.name.split(" ")[0]}: ${earlyBirdWeekday!.timeValue} → ${nightOwlWeekday!.timeValue}`;
    if (earlyBirdWeekday) return `🌅 ${earlyBirdWeekday.name.split(" ")[0]}: ${earlyBirdWeekday.timeValue}`;
    if (mostHoursWorked) return `⏱️ ${mostHoursWorked.name.split(" ")[0]}: ${mostHoursWorked.value.toFixed(1)} hrs`;
    return "View effort awards";
  };

  const hasGritAwards = gritAwards && (
    gritAwards.earlyBirdWeekday || gritAwards.earlyBirdSaturday ||
    gritAwards.nightOwlWeekday || gritAwards.nightOwlSaturday ||
    gritAwards.mostHoursWorked
  );

  // Records subtitle
  const recordCount = [dayRecord, weekRecord, monthRecord].filter(v => v > 0).length;
  const recordsSubtitle = recordCount > 0
    ? `Best day: ${dayRecord} FP+`
    : "View personal bests & class records";

  const totalComps = competitionCount?.total ?? 0;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
        {hasGritAwards && (
          <SpotlightCard
            icon={Flame}
            iconColor="text-orange-500"
            title="Grit Awards"
            subtitle={getGritSubtitle()}
            onClick={() => setGritOpen(true)}
          />
        )}

        {showCompetitions && (
          <SpotlightCard
            icon={Swords}
            iconColor="text-purple-500"
            title="Competitions"
            subtitle={totalComps > 0 ? `${totalComps} active right now` : "Create or join challenges"}
            badge={totalComps > 0 ? `${totalComps} Live` : undefined}
            onClick={() => navigate("/compete")}
          />
        )}

        <SpotlightCard
          icon={Trophy}
          iconColor="text-primary"
          title="Records"
          subtitle={recordsSubtitle}
          badge={recordCount > 0 ? `${recordCount} PBs` : undefined}
          onClick={() => setRecordsOpen(true)}
        />
      </div>

      {gritAwards && (
        <GritAwardsSheet
          open={gritOpen}
          onOpenChange={setGritOpen}
          gritAwards={gritAwards}
          currentUserId={currentUserId}
          streaks={streaks}
        />
      )}

      <RecordsSheet
        open={recordsOpen}
        onOpenChange={setRecordsOpen}
        userId={currentUserId}
      />
    </>
  );
};
