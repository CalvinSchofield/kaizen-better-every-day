import { Trophy, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { hapticLight } from "@/utils/haptics";
import { useCompetitorNudge } from "@/hooks/useCompetitorNudge";

interface LeaderboardMiniRowProps {
  className?: string;
}

export const LeaderboardMiniRow = ({ className }: LeaderboardMiniRowProps) => {
  const navigate = useNavigate();
  const { competitor, fallback } = useCompetitorNudge();

  const handleClick = () => {
    hapticLight();
    navigate('/leaderboard');
  };

  // Build display text based on competitor nudge or fallback
  let title: string;
  let subtitle: string;
  let icon = <Trophy className="h-4 w-4 text-amber-500" />;
  let iconBg = "bg-amber-500/10";

  if (competitor) {
    const gap = competitor.gap;
    const plural = gap !== 1 ? 's' : '';
    title = `${competitor.name} is ${gap} ${competitor.metricLabel}${plural} ahead`;
    subtitle = `Catch them ${competitor.timeframe} →`;
    icon = <Flame className="h-4 w-4 text-orange-500" />;
    iconBg = "bg-orange-500/10";
  } else if (fallback) {
    title = fallback.message;
    subtitle = fallback.subtitle;
    if (fallback.type === 'leading') {
      icon = <Trophy className="h-4 w-4 text-amber-500" />;
      iconBg = "bg-amber-500/10";
    } else if (fallback.type === 'no_activity') {
      icon = <Flame className="h-4 w-4 text-orange-500" />;
      iconBg = "bg-orange-500/10";
    }
  } else {
    title = 'See the leaderboard';
    subtitle = 'Check where you stand →';
  }

  return (
    <button
      onClick={handleClick}
      className={`group flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-card border border-border/50 active:scale-[0.98] transition-all ${className}`}
    >
      <div className={`h-8 w-8 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </button>
  );
};
