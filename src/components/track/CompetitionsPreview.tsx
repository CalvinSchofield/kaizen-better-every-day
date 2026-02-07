import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Swords, Gift, ChevronRight, User, Users } from "lucide-react";
import { useMyActiveChallenges, Challenge } from "@/hooks/useChallenges";
import { useMyActiveIncentives, Incentive } from "@/hooks/useIncentives";
import { useChallengeProgress } from "@/hooks/useChallengeProgress";
import { useIncentiveProgress } from "@/hooks/useIncentiveProgress";
import { useNavigate } from "react-router-dom";
import { getCleanFirstName } from "@/utils/nameUtils";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/utils/haptics";
import { getChallengeTypeBadge, getIncentiveTypeBadge, IncentiveTargetType } from "@/utils/competitionTypeConfig";

interface CompetitionsPreviewProps {
  className?: string;
}

const ChallengeRow = ({ challenge }: { challenge: Challenge }) => {
  const { data: progress } = useChallengeProgress(challenge);
  const isGroupChallenge = challenge.type === 'group';
  const typeBadge = getChallengeTypeBadge(isGroupChallenge ? 'group' : '1v1');
  const TypeIcon = typeBadge.Icon;
  
  // Get participant names
  const captainA = challenge.participants?.find(p => p.role === 'captain_a');
  const captainB = challenge.participants?.find(p => p.role === 'captain_b');
  
  // Get scores
  let myScore = 0;
  let theirScore = 0;
  
  if (isGroupChallenge && progress) {
    const teamA = progress.participants.filter(p => p.team === 'a');
    const teamB = progress.participants.filter(p => p.team === 'b');
    myScore = teamA.reduce((sum, p) => sum + (p.current_value || 0), 0);
    theirScore = teamB.reduce((sum, p) => sum + (p.current_value || 0), 0);
  } else if (progress) {
    const myProgress = progress?.userProgress;
    const opponentProgress = progress?.participants?.find(p => p.user_id !== myProgress?.user_id);
    myScore = myProgress?.current_value ?? 0;
    theirScore = opponentProgress?.current_value ?? 0;
  }
  
  const isWinning = myScore > theirScore;
  const isTied = myScore === theirScore;
  
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Swords className="h-4 w-4 text-primary flex-shrink-0" />
        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 flex-shrink-0", typeBadge.color)}>
          <TypeIcon className="h-2 w-2 mr-0.5" />
          {typeBadge.label}
        </Badge>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {isGroupChallenge ? (
              <>
                <span className="text-red-500">{getCleanFirstName(captainA?.rep_name)}</span>
                <span className="text-muted-foreground"> vs </span>
                <span className="text-blue-500">{getCleanFirstName(captainB?.rep_name)}</span>
              </>
            ) : (
              <>
                {getCleanFirstName(captainA?.rep_name)} vs {getCleanFirstName(captainB?.rep_name)}
              </>
            )}
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
  const typeBadge = getIncentiveTypeBadge(incentive.target_type as IncentiveTargetType);
  const TypeIcon = typeBadge.Icon;
  
  const myProgress = progress?.participants?.find(p => p.user_id === incentive.created_by)?.current_value ?? 0;
  const targetValue = incentive.target_value || 0;
  const progressPercent = targetValue > 0 ? Math.min((myProgress / targetValue) * 100, 100) : 0;
  
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Gift className="h-4 w-4 text-secondary-foreground flex-shrink-0" />
        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 flex-shrink-0 border-amber-500/30", typeBadge.color)}>
          <TypeIcon className="h-2 w-2 mr-0.5" />
          {typeBadge.label}
        </Badge>
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
