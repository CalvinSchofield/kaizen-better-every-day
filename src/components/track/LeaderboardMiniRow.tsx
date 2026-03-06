import { Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { hapticLight } from "@/utils/haptics";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useCompetitorNudge } from "@/hooks/useCompetitorNudge";

interface LeaderboardMiniRowProps {
  className?: string;
}

export const LeaderboardMiniRow = ({ className }: LeaderboardMiniRowProps) => {
  const navigate = useNavigate();
  const { totalFP, totalEFP } = usePreseasonFP();
  const { efpModeEnabled } = useEfpMode();
  const { competitor } = useCompetitorNudge();

  const currentValue = efpModeEnabled ? totalEFP : totalFP;
  const unitLabel = efpModeEnabled ? 'EFP' : 'FP+';

  const handleClick = () => {
    hapticLight();
    navigate('/leaderboard');
  };

  // Build display text based on competitor nudge or fallback
  let title: string;
  let subtitle: string;

  if (competitor) {
    const gap = competitor.gap;
    const plural = gap !== 1 ? 's' : '';
    title = `${competitor.name} is ${gap} ${competitor.metricLabel}${plural} ahead`;
    subtitle = `Catch them ${competitor.timeframe} →`;
  } else {
    title = `Your season: ${Math.round(currentValue * 10) / 10} ${unitLabel}`;
    subtitle = 'See where you stand →';
  }

  return (
    <button
      onClick={handleClick}
      className={`group flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-card border border-border/50 active:scale-[0.98] transition-all ${className}`}
    >
      <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
        <Trophy className="h-4 w-4 text-amber-500" />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      
    </button>
  );
};
