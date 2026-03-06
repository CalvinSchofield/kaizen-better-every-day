import { Swords, Plus } from "lucide-react";
import { useMyActiveChallenges } from "@/hooks/useChallenges";
import { useMyActiveIncentives } from "@/hooks/useIncentives";
import { useNavigate } from "react-router-dom";
import { hapticLight } from "@/utils/haptics";

interface CompetitionsPreviewProps {
  className?: string;
}

export const CompetitionsPreview = ({ className }: CompetitionsPreviewProps) => {
  const navigate = useNavigate();
  const { data: challenges, isLoading: loadingChallenges } = useMyActiveChallenges();
  const { data: incentives, isLoading: loadingIncentives } = useMyActiveIncentives();

  const isLoading = loadingChallenges || loadingIncentives;

  const activeChallenges = challenges?.filter(c => c.status === 'active') || [];
  const activeIncentives = incentives?.filter(i => i.status === 'active') || [];
  const totalActive = activeChallenges.length + activeIncentives.length;

  const handleNavigate = () => {
    hapticLight();
    navigate('/compete');
  };

  // Empty state — same row style as LeaderboardMiniRow
  if (!isLoading && totalActive === 0) {
    return (
      <button
        onClick={handleNavigate}
        className={`group flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-card border border-border/50 active:scale-[0.98] transition-all ${className}`}
      >
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Swords className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-foreground">No active competitions</p>
          <p className="text-xs text-muted-foreground">Challenge a teammate →</p>
        </div>
        <div
          onClick={(e) => { e.stopPropagation(); hapticLight(); navigate('/compete'); }}
          className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5 text-primary" />
        </div>
      </button>
    );
  }

  // Active competitions — same row style
  const label = totalActive === 1 ? '1 active competition' : `${totalActive} active competitions`;

  return (
    <button
      onClick={handleNavigate}
      className={`group flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-card border border-border/50 active:scale-[0.98] transition-all ${className}`}
    >
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Swords className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">View details →</p>
      </div>
      
    </button>
  );
};
