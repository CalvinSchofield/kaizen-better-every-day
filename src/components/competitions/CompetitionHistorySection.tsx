import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompetitionHistory, Rival, MonthlyGroup } from "@/hooks/useCompetitionHistory";
import { Challenge } from "@/hooks/useChallenges";
import { Incentive } from "@/hooks/useIncentives";
import { 
  ChevronDown, 
  ChevronRight, 
  Flame, 
  Trophy, 
  Swords, 
  TrendingUp,
  Users,
  Target,
  Crown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials, getCleanName, getCleanFirstName } from "@/utils/nameUtils";
import { hapticLight } from "@/utils/haptics";

const metricLabels: Record<string, string> = {
  fp_plus: 'FP+',
  prmr: 'PRMR',
  transitions: 'Trans',
  doors_knocked: 'Doors',
};

interface RivalryCardProps {
  rival: Rival;
  currentUserId: string;
}

const RivalryCard = ({ rival, currentUserId }: RivalryCardProps) => {
  const winRate = rival.total > 0 ? Math.round((rival.wins / rival.total) * 100) : 0;
  const isWinning = rival.wins > rival.losses;
  const isTied = rival.wins === rival.losses;
  
  // Streak badge
  const hasStreak = Math.abs(rival.currentStreak) >= 2;
  const streakLabel = rival.currentStreak > 0 
    ? `🔥 ${rival.currentStreak} Win Streak` 
    : rival.currentStreak < 0 
    ? `${Math.abs(rival.currentStreak)} Loss Streak`
    : null;

  return (
    <div className="p-4 rounded-xl border bg-gradient-to-br from-card to-muted/20">
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="h-12 w-12 ring-2 ring-offset-2 ring-offset-background ring-primary/20">
          <AvatarImage src={rival.profilePhotoUrl} />
          <AvatarFallback className="text-sm font-medium">
            {getInitials(rival.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{getCleanName(rival.name)}</p>
          <p className="text-sm text-muted-foreground">
            {rival.total} matchups
          </p>
        </div>
        <div className="text-right">
          <div className={cn(
            "text-lg font-bold",
            isWinning ? "text-primary" : isTied ? "text-muted-foreground" : "text-destructive"
          )}>
            {rival.wins}-{rival.losses}
            {rival.ties > 0 && <span className="text-muted-foreground">-{rival.ties}</span>}
          </div>
          <p className="text-xs text-muted-foreground">{winRate}% win rate</p>
        </div>
      </div>

      {/* Win rate bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
        <div 
          className={cn(
            "h-full transition-all",
            isWinning ? "bg-primary" : isTied ? "bg-warning" : "bg-destructive"
          )}
          style={{ width: `${winRate}%` }}
        />
      </div>

      {/* Streak and per-metric breakdown */}
      <div className="flex items-center justify-between text-xs">
        {hasStreak && streakLabel && (
          <Badge 
            variant={rival.currentStreak > 0 ? "default" : "secondary"}
            className="text-xs"
          >
            {streakLabel}
          </Badge>
        )}
        <div className="flex gap-2 ml-auto">
          {Object.entries(rival.metrics).slice(0, 2).map(([metric, stats]) => (
            <span key={metric} className="text-muted-foreground">
              {metricLabels[metric]}: {stats.wins}W
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

interface MonthGroupProps {
  group: MonthlyGroup;
  currentUserId: string;
  defaultOpen?: boolean;
}

const MonthGroup = ({ group, currentUserId, defaultOpen = false }: MonthGroupProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const getChallengeResult = (challenge: Challenge) => {
    const myParticipant = challenge.participants?.find(p => p.user_id === currentUserId);
    const wasParticipant = !!myParticipant;
    const iDeclined = myParticipant?.accepted === false;
    const wasDeclined = challenge.status === 'declined' || iDeclined;
    const wasVoided = challenge.status === 'voided';
    const noWinner = challenge.status === 'completed' && !challenge.winner_user_id;
    const won = currentUserId && challenge.winner_user_id === currentUserId;

    if (won) return { label: '🏆 Won', variant: 'default' as const, success: true };
    if (wasDeclined) return { label: 'Declined', variant: 'outline' as const, success: false };
    if (wasVoided) return { label: '❌ Expired', variant: 'secondary' as const, success: false };
    if (noWinner) return { label: 'Tie', variant: 'secondary' as const, success: false };
    if (!wasParticipant) return { label: 'Ended', variant: 'outline' as const, success: false };
    return { label: 'Lost', variant: 'secondary' as const, success: false };
  };

  const getIncentiveResult = (incentive: Incentive) => {
    const winnerIds = Array.isArray(incentive.winner_user_ids) ? incentive.winner_user_ids : [];
    const won = incentive.winner_user_id === currentUserId || winnerIds.includes(currentUserId);
    const isCancelled = incentive.status === 'cancelled';
    const hasWinner = incentive.winner_user_id || winnerIds.length > 0;

    if (isCancelled) return { label: '❌ Cancelled', variant: 'secondary' as const, success: false };
    if (won) return { label: '🏆 Won', variant: 'default' as const, success: true };
    if (hasWinner) return { label: 'Lost', variant: 'secondary' as const, success: false };
    return { label: '❌ Expired', variant: 'secondary' as const, success: false };
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-between p-4 h-auto"
          onClick={() => hapticLight()}
        >
          <div className="flex items-center gap-3">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-semibold">{group.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {group.stats.totalChallenges > 0 && (
              <Badge variant="outline" className="text-xs">
                <Swords className="h-3 w-3 mr-1" />
                {group.stats.wins}W-{group.stats.losses}L
              </Badge>
            )}
            {group.stats.totalIncentives > 0 && (
              <Badge variant="outline" className="text-xs">
                <Trophy className="h-3 w-3 mr-1" />
                {group.stats.incentivesWon}/{group.stats.totalIncentives}
              </Badge>
            )}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-2">
        {group.challenges.map(challenge => {
          const result = getChallengeResult(challenge);
          const opponent = challenge.participants?.find(p => p.user_id !== currentUserId);
          
          return (
            <div 
              key={challenge.id}
              className={cn(
                "p-3 rounded-lg border",
                result.success ? "bg-green-500/5 border-green-500/30" : "bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Swords className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {metricLabels[challenge.metric]} vs {getCleanFirstName(opponent?.rep_name)}
                  </span>
                </div>
                <Badge variant={result.variant} className="text-xs">
                  {result.label}
                </Badge>
              </div>
            </div>
          );
        })}
        {group.incentives.map(incentive => {
          const result = getIncentiveResult(incentive);
          
          return (
            <div 
              key={incentive.id}
              className={cn(
                "p-3 rounded-lg border",
                result.success ? "bg-amber-500/5 border-amber-500/30" : "bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{incentive.title}</span>
                </div>
                <Badge variant={result.variant} className="text-xs">
                  {result.label}
                </Badge>
              </div>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
};

interface OverallStatsCardProps {
  stats: {
    totalChallenges: number;
    challengeWins: number;
    challengeLosses: number;
    challengeTies: number;
    challengeWinRate: number;
    currentWinStreak: number;
    longestWinStreak: number;
    totalIncentives: number;
    incentivesWon: number;
  };
}

const OverallStatsCard = ({ stats }: OverallStatsCardProps) => {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          Your Competition Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{stats.challengeWins}</p>
            <p className="text-xs text-muted-foreground">Wins</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-destructive">{stats.challengeLosses}</p>
            <p className="text-xs text-muted-foreground">Losses</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{stats.challengeWinRate}%</p>
            <p className="text-xs text-muted-foreground">Win Rate</p>
          </div>
        </div>
        
        {(stats.currentWinStreak >= 2 || stats.longestWinStreak >= 3) && (
          <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
            {stats.currentWinStreak >= 2 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="font-medium">{stats.currentWinStreak} Win Streak</span>
              </div>
            )}
            {stats.longestWinStreak >= 3 && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Best: {stats.longestWinStreak}</span>
              </div>
            )}
          </div>
        )}

        {stats.totalIncentives > 0 && (
          <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t text-sm">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span>
              <strong>{stats.incentivesWon}</strong>/{stats.totalIncentives} incentives won
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const CompetitionHistorySection = () => {
  const { data: historyData, isLoading } = useCompetitionHistory();
  const [showAllRivalries, setShowAllRivalries] = useState(false);

  // Get current user for result calculations
  const currentUserId = historyData?.overallStats ? 
    // We need to infer the user ID - the hook internally uses it
    // For now, we'll pass it through the component
    '' : '';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  if (!historyData || (historyData.monthlyGroups.length === 0 && historyData.rivalries.length === 0)) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Swords className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No competition history yet</p>
          <p className="text-xs text-muted-foreground mt-1">Complete a challenge to see your stats!</p>
        </CardContent>
      </Card>
    );
  }

  const displayRivalries = showAllRivalries 
    ? historyData.rivalries 
    : historyData.rivalries.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Overall Stats */}
      {historyData.overallStats.totalChallenges > 0 && (
        <OverallStatsCard stats={historyData.overallStats} />
      )}

      {/* Rivalries */}
      {historyData.rivalries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Your Rivalries
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {displayRivalries.map(rival => (
              <RivalryCard 
                key={rival.userId} 
                rival={rival}
                currentUserId={currentUserId}
              />
            ))}
            {historyData.rivalries.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  hapticLight();
                  setShowAllRivalries(!showAllRivalries);
                }}
              >
                {showAllRivalries ? 'Show Less' : `Show ${historyData.rivalries.length - 3} More`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly History */}
      {historyData.monthlyGroups.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              History by Month
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {historyData.monthlyGroups.map((group, index) => (
              <MonthGroup 
                key={group.month} 
                group={group}
                currentUserId={currentUserId}
                defaultOpen={index === 0}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
