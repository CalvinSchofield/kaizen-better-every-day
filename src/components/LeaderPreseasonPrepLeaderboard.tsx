import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Timer, Dumbbell, Phone, Trophy, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Zap, Users, Target, Crown } from "lucide-react";
import { useLeaderPreseasonPrepLeaderboard, LeaderboardMetric, LeaderboardEntry } from "@/hooks/useLeaderPreseasonPrepLeaderboard";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/utils/nameUtils";

const metrics: { key: LeaderboardMetric; label: string; icon: React.ReactNode }[] = [
  { key: 'overall', label: 'Overall', icon: <Zap className="h-3.5 w-3.5" /> },
  { key: 'books', label: 'Books', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { key: 'training', label: 'Training', icon: <Timer className="h-3.5 w-3.5" /> },
  { key: 'roleplays', label: 'Role Plays', icon: <Dumbbell className="h-3.5 w-3.5" /> },
  { key: 'mnl', label: 'MNL', icon: <Phone className="h-3.5 w-3.5" /> },
];


const formatTrainingDisplay = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const getMetricValue = (entry: LeaderboardEntry, metric: LeaderboardMetric) => {
  switch (metric) {
    case 'overall': return entry.weeklyPrepScore;
    case 'books': return entry.totalBooks;
    case 'training': return entry.weeklyTraining;
    case 'roleplays': return entry.weeklyRoleplays;
    case 'mnl': return entry.weeklyMnl;
    default: return entry.weeklyPrepScore;
  }
};

const formatMetricValue = (entry: LeaderboardEntry, metric: LeaderboardMetric): string => {
  switch (metric) {
    case 'overall': return `${entry.weeklyPrepScore} pts`;
    case 'books': return `${entry.totalBooks} ${entry.totalBooks === 1 ? 'book' : 'books'}`;
    case 'training': return formatTrainingDisplay(entry.weeklyTraining);
    case 'roleplays': return `${entry.weeklyRoleplays}`;
    case 'mnl': return entry.weeklyMnl > 0 ? '✓' : '—';
    default: return '';
  }
};

// Extract first name from team leader string
const getLeaderFirstName = (teamLeader: string | null): string => {
  if (!teamLeader) return 'Unknown';
  // Remove emojis and extra whitespace, get first name
  return teamLeader
    .replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '')
    .trim()
    .split(' ')[0] || 'Unknown';
};

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  rank: number;
  metric: LeaderboardMetric;
}

const LeaderboardRow = ({ entry, rank, metric }: LeaderboardRowProps) => {
  return (
    <div className="flex items-center justify-between py-2 px-2 rounded-lg transition-all">
      <div className="flex items-center gap-3">
        <span className="w-5 text-xs text-muted-foreground tabular-nums">{rank}</span>
        <Avatar className="h-7 w-7">
          <AvatarImage src={entry.profilePhotoUrl || undefined} alt={entry.name} />
          <AvatarFallback className="text-[10px] bg-secondary">
            {getInitials(entry.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm">{entry.name}</span>
          <span className="text-[10px] text-muted-foreground">{getLeaderFirstName(entry.teamLeader)}'s</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium tabular-nums">
          {formatMetricValue(entry, metric)}
        </span>
        {metric === 'training' && entry.trainingPaceStatus === 'ahead' && (
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        )}
        {metric === 'training' && entry.trainingPaceStatus === 'behind' && (
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        )}
      </div>
    </div>
  );
};

// Loading skeleton for podium
const PodiumSkeleton = () => (
  <div className="flex items-end justify-center gap-4 py-3">
    <div className="flex flex-col items-center gap-1">
      <Skeleton className="h-10 w-10 rounded-full" />
      <Skeleton className="h-3 w-12" />
    </div>
    <div className="flex flex-col items-center gap-1">
      <Skeleton className="h-14 w-14 rounded-full" />
      <Skeleton className="h-3 w-14" />
    </div>
    <div className="flex flex-col items-center gap-1">
      <Skeleton className="h-10 w-10 rounded-full" />
      <Skeleton className="h-3 w-12" />
    </div>
  </div>
);

// Top 3 Podium Display with leader attribution
const PodiumDisplay = ({ 
  entries, 
  metric, 
}: { 
  entries: LeaderboardEntry[]; 
  metric: LeaderboardMetric;
}) => {
  const [first, second, third] = entries;
  
  if (!first) return null;

  const PodiumSpot = ({ 
    entry, 
    rank, 
    size 
  }: { 
    entry?: LeaderboardEntry; 
    rank: 1 | 2 | 3; 
    size: 'lg' | 'md';
  }) => {
    if (!entry) return null;
    
    const avatarSize = size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
    const ringColors = {
      1: 'ring-yellow-400',
      2: 'ring-gray-300',
      3: 'ring-amber-600',
    };

    return (
      <div className={cn(
        "flex flex-col items-center gap-1",
        entries.length === 1 ? "" : (rank === 1 ? "order-2" : rank === 2 ? "order-1" : "order-3")
      )}>
        <div className="relative">
          <Avatar className={cn(avatarSize, "ring-2", ringColors[rank])}>
            <AvatarImage src={entry.profilePhotoUrl || undefined} alt={entry.name} />
            <AvatarFallback className={cn(
              "text-xs bg-secondary",
              size === 'lg' && "text-sm"
            )}>
              {getInitials(entry.name)}
            </AvatarFallback>
          </Avatar>
          {rank === 1 && (
            <Trophy className="absolute -top-2 -right-1 h-5 w-5 text-yellow-500 drop-shadow" />
          )}
        </div>
        <span className="text-xs font-medium text-center truncate max-w-[70px]">
          {entry.name.split(' ')[0]}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {getLeaderFirstName(entry.teamLeader)}'s
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {formatMetricValue(entry, metric)}
        </span>
      </div>
    );
  };

  if (entries.length === 1) {
    return (
      <div className="flex justify-center py-3">
        <PodiumSpot entry={first} rank={1} size="lg" />
      </div>
    );
  }

  if (entries.length === 2) {
    return (
      <div className="flex items-end justify-center gap-6 py-3">
        <PodiumSpot entry={second} rank={2} size="md" />
        <PodiumSpot entry={first} rank={1} size="lg" />
      </div>
    );
  }

  return (
    <div className="flex items-end justify-center gap-4 py-3">
      <PodiumSpot entry={second} rank={2} size="md" />
      <PodiumSpot entry={first} rank={1} size="lg" />
      <PodiumSpot entry={third} rank={3} size="md" />
    </div>
  );
};

// CTA for leaders with no rookies having standards
const NoStandardsTeaser = () => (
  <div className="text-center py-6 space-y-3">
    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
      <Target className="h-6 w-6 text-primary" />
    </div>
    <div>
      <p className="font-medium">No rookies with standards yet</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-[280px] mx-auto">
        Encourage your rookies to set up their preseason standards on the Goals page to track their progress
      </p>
    </div>
  </div>
);

// Leader Competition Summary - shows top leaders by total rookie prep score
interface LeaderStat {
  leader: string;
  totalScore: number;
  rookieCount: number;
  avgScore: number;
}

const LeaderCompetitionSummary = ({ 
  leaderStats, 
  currentUserName 
}: { 
  leaderStats: LeaderStat[]; 
  currentUserName: string;
}) => {
  if (!leaderStats || leaderStats.length === 0) return null;

  // Only show leaders who have actual points - no point showing rankings for 0 activity
  const leadersWithPoints = leaderStats.filter(l => l.totalScore > 0);
  
  // If no leaders have points yet, show motivational message
  if (leadersWithPoints.length === 0) {
    return (
      <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Leader Competition</h3>
            <p className="text-xs text-muted-foreground">
              Help your rookies complete training goals to get on the board!
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Get top 3 leaders with points
  const topLeaders = leadersWithPoints.slice(0, 3);
  const currentUserRank = leadersWithPoints.findIndex(l => l.leader.includes(currentUserName)) + 1;
  const currentUserStats = leadersWithPoints.find(l => l.leader.includes(currentUserName));
  const isCurrentUserTop3 = currentUserRank > 0 && currentUserRank <= 3;

  // Extract first name only from leader name
  const getFirstName = (name: string) => {
    return name.split(' ')[0].replace(/[^\w]/g, '');
  };

  return (
    <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/20">
      <div className="flex items-center gap-2 mb-3">
        <Crown className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold">Leader Competition</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">This Week</Badge>
      </div>
      
      {/* Top Leaders Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {topLeaders.map((leader, index) => {
          const isCurrentUser = leader.leader.includes(currentUserName);
          const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
          
          return (
            <div 
              key={leader.leader}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg flex-shrink-0 transition-all",
                isCurrentUser 
                  ? "bg-primary/10 border border-primary/30" 
                  : "bg-background/60"
              )}
            >
              <span className={cn("text-lg font-bold", medalColors[index])}>
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate",
                  isCurrentUser && "text-primary"
                )}>
                  {getFirstName(leader.leader)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {leader.totalScore} pts · {leader.rookieCount} rookie{leader.rookieCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current user stats if not in top 3 */}
      {!isCurrentUserTop3 && currentUserStats && currentUserRank > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your team rank</span>
            <span className="font-medium">
              #{currentUserRank} · {currentUserStats.totalScore} pts
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Loading skeleton for smooth appearance
const LeaderboardSkeleton = () => (
  <Card className="mb-6 overflow-hidden animate-pulse">
    <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 pt-4 pb-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <Skeleton className="h-5 w-40 mb-1" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="flex gap-1.5 mb-3">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-7 w-16 rounded-full flex-shrink-0" />
        ))}
      </div>
    </div>
    <CardContent className="pt-4">
      {/* Podium skeleton */}
      <div className="flex items-end justify-center gap-3 mb-6">
        <div className="flex flex-col items-center">
          <Skeleton className="h-12 w-12 rounded-full mb-2" />
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-4 w-10" />
        </div>
        <div className="flex flex-col items-center -mb-2">
          <Skeleton className="h-14 w-14 rounded-full mb-2" />
          <Skeleton className="h-3 w-20 mb-1" />
          <Skeleton className="h-5 w-12" />
        </div>
        <div className="flex flex-col items-center">
          <Skeleton className="h-12 w-12 rounded-full mb-2" />
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
      {/* Rows skeleton */}
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between py-2 px-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-7 w-7 rounded-full" />
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export const LeaderPreseasonPrepLeaderboard = () => {
  const navigate = useNavigate();
  const [selectedMetric, setSelectedMetric] = useState<LeaderboardMetric>('overall');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMyTeamOnly, setShowMyTeamOnly] = useState(false);
  const { data, isLoading, isFetching } = useLeaderPreseasonPrepLeaderboard(selectedMetric, showMyTeamOnly);

  // INSTANT LOAD: Show cached data immediately, only show skeleton if truly no cached data
  const hasCachedData = !!data;
  
  // Show skeleton only if loading AND no cached data (first-time only)
  if (isLoading && !hasCachedData) return <LeaderboardSkeleton />;

  // Only show nothing if data was fetched successfully and there's truly no rookies at all
  if (data && !showMyTeamOnly && data.totalRookies === 0) return null;

  const entriesWithActivity = data?.entries.filter(e => getMetricValue(e, selectedMetric) > 0) || [];
  const entriesWithoutActivity = data?.entries.filter(e => getMetricValue(e, selectedMetric) === 0) || [];
  
  const top3 = entriesWithActivity.slice(0, 3);
  const restWithActivity = entriesWithActivity.slice(3, 8);
  const remainingEntries = [
    ...entriesWithActivity.slice(8),
    ...entriesWithoutActivity
  ];

  const isWeeklyMetric = selectedMetric !== 'books';
  const hasAnyParticipants = (data?.totalParticipants || 0) > 0;
  const noTeamResults = showMyTeamOnly && (data?.entries.length || 0) === 0;

  return (
    <Card className="mb-6 overflow-hidden">
      {/* Header with gradient */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              {isWeeklyMetric ? "Rookie Prep This Week" : "Most Well-Read Rookies"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {isWeeklyMetric ? "Resets Sunday midnight" : "All-time progress"}
            </p>
          </div>
          {hasAnyParticipants && (
            <Button 
              size="sm" 
              onClick={() => navigate('/my-group', { 
                state: { 
                  openCategory: 'readiness',
                  autoSelectMyTeam: true 
                } 
              })}
              className="h-8 text-xs gap-1"
            >
              <Users className="h-3.5 w-3.5" />
              My Group
            </Button>
          )}
        </div>

        {/* Team Filter Toggle */}
        <div className="flex gap-1.5 mb-3">
          <button
            onClick={() => setShowMyTeamOnly(false)}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              !showMyTeamOnly
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            )}
          >
            All Rookies
          </button>
          <button
            onClick={() => setShowMyTeamOnly(true)}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              showMyTeamOnly
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            )}
          >
            My Team
          </button>
        </div>

        {/* Stats summary for leaders */}
        {!isLoading && (
          <div className="rounded-lg p-3 bg-background/60">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {data?.totalParticipants || 0} rookies tracking
                  </span>
                </div>
                {(data?.rookiesWithoutStandards || 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {data?.rookiesWithoutStandards} rookies still need to set standards
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="rounded-lg p-3 bg-background/60">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </div>
        )}
      </div>
      
      <CardContent className="pt-3 space-y-3">
        {/* Leader Competition Summary - only show when we have data */}
        {!isLoading && hasAnyParticipants && data?.leaderStats && data.leaderStats.length > 1 && (
          <LeaderCompetitionSummary 
            leaderStats={data.leaderStats} 
            currentUserName={data.currentUserName || ''} 
          />
        )}

        {/* Show teaser if no participants */}
        {!isLoading && !hasAnyParticipants && !noTeamResults && <NoStandardsTeaser />}

        {/* Empty state for "My Team" with no results */}
        {!isLoading && noTeamResults && (
          <div className="text-center py-6 space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No rookies on your team yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-[280px] mx-auto">
                Try viewing "All Rookies" to see the full leaderboard
              </p>
            </div>
          </div>
        )}

        {/* Show leaderboard content if we have participants */}
        {(isLoading || hasAnyParticipants) && (
          <>
            {/* Metric Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
              {metrics.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setSelectedMetric(key)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-all",
                    selectedMetric === key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {/* Top 3 Podium - Loading State */}
            {isLoading && <PodiumSkeleton />}

            {/* Top 3 Podium */}
            {!isLoading && top3.length > 0 && (
              <PodiumDisplay entries={top3} metric={selectedMetric} />
            )}

            {/* Empty State */}
            {!isLoading && top3.length === 0 && hasAnyParticipants && (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">No activity yet this week</p>
                <p className="text-xs mt-1">Encourage your rookies to get on the board!</p>
              </div>
            )}

            {/* Rest of leaderboard (4-8) */}
            {!isLoading && restWithActivity.length > 0 && (
              <div className="space-y-0.5 border-t pt-2">
                {restWithActivity.map((entry, index) => (
                  <LeaderboardRow
                    key={entry.userId}
                    entry={entry}
                    rank={index + 4}
                    metric={selectedMetric}
                  />
                ))}
              </div>
            )}

            {/* Expandable remaining entries */}
            {!isLoading && remainingEntries.length > 0 && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger className="flex items-center justify-center w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5 mr-1" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5 mr-1" />
                      +{remainingEntries.length} more
                    </>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 pt-1">
                  {remainingEntries.map((entry, index) => (
                    <LeaderboardRow
                      key={entry.userId}
                      entry={entry}
                      rank={index + 9}
                      metric={selectedMetric}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
