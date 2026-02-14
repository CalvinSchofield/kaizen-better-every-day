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
            </div>
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
    
    const config = metricConfig[challenge.metric];

    // Get scores for 1v1
    const myValue = myParticipant?.final_value ?? 0;
    const opponentValue = opponent?.final_value ?? 0;

    // Team battle totals
    const teamA = challenge.participants?.filter(p => p.role === 'captain_a' || p.team === 'a') || [];
    const teamB = challenge.participants?.filter(p => p.role === 'captain_b' || p.team === 'b') || [];
    const teamATotal = teamA.reduce((sum, p) => sum + (p.final_value ?? 0), 0);
    const teamBTotal = teamB.reduce((sum, p) => sum + (p.final_value ?? 0), 0);

    return (
      <button
        onClick={() => {
          hapticLight();
          onTap();
        }}
        className={cn(
          "w-full p-3 rounded-xl border text-left transition-all active:scale-[0.97]",
          won ? "bg-primary/5 border-primary/30" : "bg-card hover:bg-muted/50"
        )}
      >
        {challenge.type === '1v1' && opponent ? (
          /* ESPN-style 1v1 face-off row */
          <div className="flex items-center gap-2">
            {/* Left participant (me or first) */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative shrink-0">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={myParticipant?.profile_photo_url} />
                  <AvatarFallback className="text-xs">{getInitials(myParticipant?.rep_name)}</AvatarFallback>
                </Avatar>
                {won && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                    <Crown className="h-2.5 w-2.5 text-white fill-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{config.format(myValue)}</p>
                <p className="text-[11px] text-muted-foreground truncate">{getCleanFirstName(myParticipant?.rep_name)}</p>
              </div>
            </div>

            {/* VS + metric */}
            <div className="flex flex-col items-center shrink-0 px-1">
              <span className="text-[10px] font-bold text-muted-foreground">VS</span>
              <span className="text-[10px] text-muted-foreground">{config.icon} {config.label}</span>
            </div>

            {/* Right participant (opponent) */}
            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              <div className="min-w-0 text-right">
                <p className="text-sm font-bold truncate">{config.format(opponentValue)}</p>
                <p className="text-[11px] text-muted-foreground truncate">{getCleanFirstName(opponent.rep_name)}</p>
              </div>
              <div className="relative shrink-0">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={opponent.profile_photo_url} />
                  <AvatarFallback className="text-xs">{getInitials(opponent.rep_name)}</AvatarFallback>
                </Avatar>
                {challenge.winner_user_id === opponent.user_id && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                    <Crown className="h-2.5 w-2.5 text-white fill-white" />
                  </div>
                )}
              </div>
            </div>

            {/* Result badge */}
            <Badge 
              variant={won ? "default" : isTie ? "secondary" : "secondary"} 
              className={cn("text-[10px] shrink-0 ml-1", won && "bg-primary text-primary-foreground")}
            >
              {won ? 'W' : isTie ? 'T' : lost ? 'L' : '-'}
            </Badge>
          </div>
        ) : (
          /* Team battle row */
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Swords className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  🔴 {config.format(teamATotal)} vs {config.format(teamBTotal)} 🔵
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {config.icon} {config.label} • Team Battle
                </p>
              </div>
            </div>
            <Badge 
              variant={won ? "default" : "secondary"} 
              className={cn("text-xs", won && "bg-primary text-primary-foreground")}
            >
              {won ? '🏆 Won' : isTie ? 'Tie' : lost ? 'Lost' : 'Ended'}
            </Badge>
          </div>
        )}
      </button>
    );
  }

  if (incentive) {
    const winnerIds = Array.isArray(incentive.winner_user_ids) ? incentive.winner_user_ids : [];
    const won = incentive.winner_user_id === currentUserId || winnerIds.includes(currentUserId);
    const hasWinner = incentive.winner_user_id || winnerIds.length > 0;
    
    // Find winner rep info
    const winnerRep = incentive.eligible_reps?.find(r => r.user_id === incentive.winner_user_id);

    return (
      <button
        onClick={() => {
          hapticLight();
          onTap();
        }}
        className={cn(
          "w-full p-3 rounded-xl border text-left transition-all active:scale-[0.97]",
          won ? "bg-amber-500/5 border-amber-500/30" : "bg-card hover:bg-muted/50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {winnerRep ? (
              <Avatar className="h-9 w-9 border border-amber-500/50">
                <AvatarImage src={winnerRep.profile_photo_url} />
                <AvatarFallback className="text-xs">{getInitials(winnerRep.rep_name)}</AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-9 w-9 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Trophy className="h-4 w-4 text-amber-500" />
              </div>
            )}
            {won && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                <Trophy className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{incentive.title}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              🎁 {incentive.reward}
            </p>
          </div>
          <Badge 
            variant={won ? "default" : hasWinner ? "secondary" : "outline"} 
            className={cn("text-xs shrink-0", won && "bg-primary text-primary-foreground")}
          >
            {won ? '🏆 Won' : hasWinner ? 'Lost' : 'No Winner'}
          </Badge>
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

  const validChallenges = group.challenges.filter(c => 
    c.status === 'completed' && (c.winner_user_id || c.is_tie)
  );
  const validIncentives = group.incentives.filter(i => 
    i.status === 'completed'
  );

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

  const currentUserId = historyData?.currentUserId || '';

  if (isLoading) {
    return <HistoryLoadingSkeleton />;
  }

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
      {historyData.overallStats.totalChallenges > 0 && (
        <OverallStatsCard stats={historyData.overallStats} />
      )}

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
