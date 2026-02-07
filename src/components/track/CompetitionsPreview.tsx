import { Card } from "@/components/ui/card";
import { Swords, Gift, ChevronRight } from "lucide-react";
import { useMyActiveChallenges, Challenge } from "@/hooks/useChallenges";
import { useMyActiveIncentives, Incentive } from "@/hooks/useIncentives";
import { useChallengeProgress } from "@/hooks/useChallengeProgress";
import { useIncentiveProgress } from "@/hooks/useIncentiveProgress";
import { useNavigate } from "react-router-dom";
import { getCleanFirstName } from "@/utils/nameUtils";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/utils/haptics";

interface CompetitionsPreviewProps {
  className?: string;
}

const ChallengeRow = ({ challenge }: { challenge: Challenge }) => {
  const { data: progress } = useChallengeProgress(challenge);
  
  // Get opponent name for 1v1
  const myParticipant = challenge.participants?.find(p => p.accepted !== false);
  const opponent = challenge.participants?.find(p => p.user_id !== myParticipant?.user_id);
  const opponentName = opponent?.rep_name ? getCleanFirstName(opponent.rep_name) : 'Opponent';
  const myName = myParticipant?.rep_name ? getCleanFirstName(myParticipant.rep_name) : 'You';
  
  // Get scores from progress data
  const myScore = progress?.userProgress?.current_value ?? 0;
  const leaderScore = progress?.leader?.current_value ?? 0;
  const theirScore = progress?.leader?.user_id === progress?.userProgress?.user_id 
    ? (progress?.participants?.[1]?.current_value ?? 0) // If I'm leader, get second place
    : leaderScore; // Otherwise, leader is opponent
  const isWinning = myScore > theirScore;
  const isTied = myScore === theirScore;
  
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Swords className="h-4 w-4 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {myName} vs {opponentName}
          </p>
          {challenge.stakes && (
            <p className="text-xs text-muted-foreground truncate">🎯 {challenge.stakes}</p>
          )}
        </div>
      </div>
      <div className={cn(
        "text-sm font-semibold tabular-nums",
        isWinning ? "text-primary" :
        isTied ? "text-muted-foreground" :
        "text-destructive"
      )}>
        {myScore.toFixed(1)} - {theirScore.toFixed(1)}
      </div>
    </div>
  );
};

const IncentiveRow = ({ incentive }: { incentive: Incentive }) => {
  const { data: progress } = useIncentiveProgress(incentive);
  
  const myProgress = progress?.participants?.find(p => p.user_id === incentive.created_by)?.current_value ?? 0;
  const targetValue = incentive.target_value || 0;
  const progressPercent = targetValue > 0 ? Math.min((myProgress / targetValue) * 100, 100) : 0;
  
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Gift className="h-4 w-4 text-secondary-foreground flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {incentive.title}
          </p>
          <p className="text-xs text-muted-foreground truncate">🏆 {incentive.reward}</p>
        </div>
      </div>
      {targetValue > 0 && (
        <div className="text-sm font-semibold tabular-nums text-muted-foreground">
          {Math.round(progressPercent)}%
        </div>
      )}
    </div>
  );
};

export const CompetitionsPreview = ({ className }: CompetitionsPreviewProps) => {
  const navigate = useNavigate();
  const { data: challenges, isLoading: loadingChallenges } = useMyActiveChallenges();
  const { data: incentives, isLoading: loadingIncentives } = useMyActiveIncentives();

  const isLoading = loadingChallenges || loadingIncentives;

  // Filter to only active (not pending) challenges
  const activeChallenges = challenges?.filter(c => c.status === 'active') || [];
  const activeIncentives = incentives?.filter(i => i.status === 'active') || [];

  // Nothing to show
  if (!isLoading && activeChallenges.length === 0 && activeIncentives.length === 0) {
    return null;
  }

  const handleNavigate = () => {
    hapticLight();
    navigate('/compete');
  };

  // Show max 2 challenges and 2 incentives in preview
  const previewChallenges = activeChallenges.slice(0, 2);
  const previewIncentives = activeIncentives.slice(0, 2);
  const hasMore = activeChallenges.length > 2 || activeIncentives.length > 2;

  return (
    <Card 
      className={`p-4 border-border/50 ${className}`}
      onClick={handleNavigate}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Active Competitions</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="divide-y divide-border/30">
        {previewChallenges.map(challenge => (
          <ChallengeRow key={challenge.id} challenge={challenge} />
        ))}
        {previewIncentives.map(incentive => (
          <IncentiveRow key={incentive.id} incentive={incentive} />
        ))}
      </div>

      {hasMore && (
        <p className="text-xs text-primary text-center mt-2">
          See all competitions →
        </p>
      )}
    </Card>
  );
};
