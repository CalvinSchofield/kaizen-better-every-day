import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompetitionHistory, Rival, MonthlyGroup } from "@/hooks/useCompetitionHistory";
import { Challenge } from "@/hooks/useChallenges";
import { Incentive } from "@/hooks/useIncentives";
import { ChallengeDetailSheet } from "@/components/leaderboard/ChallengeDetailSheet";
import { IncentiveDetailSheet } from "@/components/leaderboard/IncentiveDetailSheet";
import { 
  ChevronDown, 
  ChevronRight, 
  Flame, 
  Trophy, 
  Swords, 
  TrendingUp,
  Users,
  Target,
  Crown,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials, getCleanName, getCleanFirstName } from "@/utils/nameUtils";
import { hapticLight } from "@/utils/haptics";
import { metricConfig } from "@/utils/challengeMetricConfig";

const metricLabels: Record<string, string> = {
  fp_plus: 'FP+',
  prmr: 'PRMR',
  transitions: 'Trans',
  doors_knocked: 'Doors',
};

// Loading skeleton for the entire section
const HistoryLoadingSkeleton = () => (
  <div className="space-y-4">
    {/* Stats card skeleton */}
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="text-center space-y-2">
              <Skeleton className="h-8 w-12 mx-auto" />
              <Skeleton className="h-3 w-10 mx-auto" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* Rivalries skeleton */}
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="p-4 rounded-xl border">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="text-right space-y-2">
                <Skeleton className="h-5 w-12 ml-auto" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>

    {/* History skeleton */}
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="p-0 space-y-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);

interface RivalryCardProps {
  rival: Rival;
  currentUserId: string;
}

const RivalryCard = ({ rival, currentUserId }: RivalryCardProps) => {
  const winRate = rival.total > 0 ? Math.round((rival.wins / rival.total) * 100) : 0;
  const isWinning = rival.wins > rival.losses;
  const isTied = rival.wins === rival.losses;
  
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

      <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
        <div 
          className={cn(
            "h-full transition-all",
            isWinning ? "bg-primary" : isTied ? "bg-warning" : "bg-destructive"
          )}
          style={{ width: `${winRate}%` }}
        />
      </div>

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

interface CompetitionItemProps {
  challenge?: Challenge;
  incentive?: Incentive;
  currentUserId: string;
  onTap: () => void;
}

const CompetitionItem = ({ challenge, incentive, currentUserId, onTap }: CompetitionItemProps) => {
  if (challenge) {
    const myParticipant = challenge.participants?.find(p => p.user_id === currentUserId);
    const wasParticipant = !!myParticipant;
    const won = currentUserId && challenge.winner_user_id === currentUserId;
    const isTie = challenge.is_tie && !challenge.tiebreaker_winner_id;
    const lost = challenge.winner_user_id && challenge.winner_user_id !== currentUserId && wasParticipant;
    
    const opponent = challenge.type === '1v1' 
      ? challenge.participants?.find(p => p.user_id !== currentUserId)
      : null;
    
    const getResultBadge = () => {
      if (won) return { label: '🏆 Won', variant: 'default' as const, className: 'bg-primary text-primary-foreground' };
      if (isTie) return { label: 'Tie', variant: 'secondary' as const, className: '' };
      if (lost) return { label: 'Lost', variant: 'secondary' as const, className: '' };
      return { label: 'Ended', variant: 'outline' as const, className: '' };
    };
    
    const result = getResultBadge();
    const config = metricConfig[challenge.metric];
    const metricIcon = config?.icon;

    return (
      <button
        onClick={() => {
          hapticLight();
          onTap();
        }}
        className={cn(
          "w-full p-3 rounded-lg border text-left transition-all active:scale-[0.98]",
          won ? "bg-primary/5 border-primary/30" : "bg-muted/30 hover:bg-muted/50"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Swords className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            {metricIcon && <span className="text-sm flex-shrink-0">{metricIcon}</span>}
            <span className="text-sm font-medium truncate">
              {challenge.type === '1v1' 
                ? `${metricLabels[challenge.metric]} vs ${getCleanFirstName(opponent?.rep_name)}`
                : `${metricLabels[challenge.metric]} Team Battle`
              }
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Type badge */}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {challenge.type === '1v1' ? (
                <><User className="h-2.5 w-2.5 mr-0.5" />1v1</>
              ) : (
                <><Users className="h-2.5 w-2.5 mr-0.5" />Team</>
              )}
            </Badge>
            <Badge variant={result.variant} className={cn("text-xs", result.className)}>
              {result.label}
            </Badge>
          </div>
        </div>
      </button>
    );
  }

  if (incentive) {
    const winnerIds = Array.isArray(incentive.winner_user_ids) ? incentive.winner_user_ids : [];
    const won = incentive.winner_user_id === currentUserId || winnerIds.includes(currentUserId);
    const hasWinner = incentive.winner_user_id || winnerIds.length > 0;
    
    const getResultBadge = () => {
      if (won) return { label: '🏆 Won', variant: 'default' as const, className: 'bg-primary text-primary-foreground' };
      if (hasWinner) return { label: 'Lost', variant: 'secondary' as const, className: '' };
      return { label: 'No Winner', variant: 'outline' as const, className: '' };
    };
    
    const result = getResultBadge();
    const eligibleCount = incentive.eligible_count || incentive.eligible_reps?.length || 0;

    return (
      <button
        onClick={() => {
          hapticLight();
          onTap();
        }}
        className={cn(
          "w-full p-3 rounded-lg border text-left transition-all active:scale-[0.98]",
          won ? "bg-amber-500/5 border-amber-500/30" : "bg-muted/30 hover:bg-muted/50"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Trophy className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span className="text-sm font-medium truncate">{incentive.title}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {eligibleCount > 1 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <Users className="h-2.5 w-2.5 mr-0.5" />{eligibleCount}
              </Badge>
            )}
            <Badge variant={result.variant} className={cn("text-xs", result.className)}>
              {result.label}
            </Badge>
          </div>
        </div>
      </button>
    );
  }

  return null;
};

interface MonthGroupProps {
  group: MonthlyGroup;
  currentUserId: string;
  defaultOpen?: boolean;
}

const MonthGroup = ({ group, currentUserId, defaultOpen = false }: MonthGroupProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [selectedIncentive, setSelectedIncentive] = useState<Incentive | null>(null);

  // Filter out expired/voided - only show completed items with actual results
  const validChallenges = group.challenges.filter(c => 
    c.status === 'completed' && (c.winner_user_id || c.is_tie)
  );
  const validIncentives = group.incentives.filter(i => 
    i.status === 'completed'
  );

  // Don't show month if no valid items
  if (validChallenges.length === 0 && validIncentives.length === 0) {
    return null;
  }

  return (
    <>
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
          {validChallenges.map(challenge => (
            <CompetitionItem
              key={challenge.id}
              challenge={challenge}
              currentUserId={currentUserId}
              onTap={() => setSelectedChallenge(challenge)}
            />
          ))}
          {validIncentives.map(incentive => (
            <CompetitionItem
              key={incentive.id}
              incentive={incentive}
              currentUserId={currentUserId}
              onTap={() => setSelectedIncentive(incentive)}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Detail Sheets */}
      {selectedChallenge && (
        <ChallengeDetailSheet
          challenge={selectedChallenge}
          open={!!selectedChallenge}
          onOpenChange={(open) => !open && setSelectedChallenge(null)}
        />
      )}
      {selectedIncentive && (
        <IncentiveDetailSheet
          incentive={selectedIncentive}
          open={!!selectedIncentive}
          onOpenChange={(open) => !open && setSelectedIncentive(null)}
        />
      )}
    </>
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

  // Get current user ID from the history data
  const currentUserId = historyData?.currentUserId || '';

  if (isLoading) {
    return <HistoryLoadingSkeleton />;
  }

  // Filter monthly groups to only show months with valid completed items
  const validMonthlyGroups = historyData?.monthlyGroups.filter(group => {
    const hasValidChallenges = group.challenges.some(c => 
      c.status === 'completed' && (c.winner_user_id || c.is_tie)
    );
    const hasValidIncentives = group.incentives.some(i => i.status === 'completed');
    return hasValidChallenges || hasValidIncentives;
  }) || [];

  if (!historyData || (validMonthlyGroups.length === 0 && historyData.rivalries.length === 0)) {
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
      {validMonthlyGroups.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              History by Month
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {validMonthlyGroups.map((group, index) => (
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
