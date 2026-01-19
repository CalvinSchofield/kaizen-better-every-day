import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Timer, Dumbbell, Phone, Trophy, ChevronDown, ChevronUp, Star, CheckCircle, AlertCircle, Zap, TrendingUp, Target } from "lucide-react";
import { usePreseasonPrepLeaderboard, LeaderboardMetric, LeaderboardEntry } from "@/hooks/usePreseasonPrepLeaderboard";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  rank: number;
  metric: LeaderboardMetric;
  isCurrentUser: boolean;
}

const LeaderboardRow = ({ entry, rank, metric, isCurrentUser }: LeaderboardRowProps) => {
  return (
    <div className={cn(
      "flex items-center justify-between py-2 px-2 rounded-lg transition-all",
      isCurrentUser && "bg-primary/10 ring-1 ring-primary/20"
    )}>
      <div className="flex items-center gap-3">
        <span className="w-5 text-xs text-muted-foreground tabular-nums">{rank}</span>
        <Avatar className="h-7 w-7">
          <AvatarImage src={entry.profilePhotoUrl || undefined} alt={entry.name} />
          <AvatarFallback className="text-[10px] bg-secondary">
            {getInitials(entry.name)}
          </AvatarFallback>
        </Avatar>
        <span className={cn("text-sm", isCurrentUser && "font-medium")}>
          {entry.name}
          {isCurrentUser && <Star className="inline h-3 w-3 ml-1 text-primary fill-primary" />}
        </span>
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

// Loading skeleton for user status
const UserStatusSkeleton = () => (
  <div className="rounded-lg p-3 bg-background/60">
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  </div>
);

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

// Top 3 Podium Display
const PodiumDisplay = ({ 
  entries, 
  metric, 
  currentUserId 
}: { 
  entries: LeaderboardEntry[]; 
  metric: LeaderboardMetric;
  currentUserId?: string;
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
    
    const isCurrentUser = entry.userId === currentUserId;
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
          <Avatar className={cn(
            avatarSize,
            "ring-2",
            ringColors[rank],
            isCurrentUser && "ring-primary ring-offset-2 ring-offset-background"
          )}>
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
        <span className={cn(
          "text-xs font-medium text-center truncate max-w-[70px]",
          isCurrentUser && "text-primary"
        )}>
          {entry.name.split(' ')[0]}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {formatMetricValue(entry, metric)}
        </span>
      </div>
    );
  };

  // Single person - center them without empty podium spots
  if (entries.length === 1) {
    return (
      <div className="flex justify-center py-3">
        <PodiumSpot entry={first} rank={1} size="lg" />
      </div>
    );
  }

  // Two people - show just #1 and #2
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

// Teaser for users without standards set up
const StandardsTeaser = ({ onSetup }: { onSetup: () => void }) => (
  <div className="text-center py-6 space-y-3">
    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
      <Target className="h-6 w-6 text-primary" />
    </div>
    <div>
      <p className="font-medium">Set your standards to compete</p>
      <p className="text-sm text-muted-foreground mt-1">
        Track your books, training, role plays & more
      </p>
    </div>
    <Button onClick={onSetup} className="gap-2">
      <TrendingUp className="h-4 w-4" />
      Set Up Standards
    </Button>
  </div>
);

export const PreseasonPrepLeaderboard = () => {
  const navigate = useNavigate();
  const [selectedMetric, setSelectedMetric] = useState<LeaderboardMetric>('overall');
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, isLoading, isFetching } = usePreseasonPrepLeaderboard(selectedMetric);

  // INSTANT LOAD: Show cached data immediately, only show skeleton if truly nothing
  const hasCachedData = !!data;
  
  // Show nothing only if we've loaded and there's truly no data
  if (!isLoading && !data) return null;
  
  // If loading but no cached data, show skeleton (first-time only)
  if (isLoading && !hasCachedData) {
    return (
      <Card className="mb-6 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 pt-4 pb-3">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <CardContent className="p-4 pt-3">
          <Skeleton className="h-12 w-full mb-2" />
          <Skeleton className="h-12 w-full mb-2" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const entriesWithActivity = data?.entries.filter(e => getMetricValue(e, selectedMetric) > 0) || [];
  const entriesWithoutActivity = data?.entries.filter(e => getMetricValue(e, selectedMetric) === 0) || [];
  
  const top3 = entriesWithActivity.slice(0, 3);
  const restWithActivity = entriesWithActivity.slice(3, 8);
  const remainingEntries = [
    ...entriesWithActivity.slice(8),
    ...entriesWithoutActivity
  ];

  const isWeeklyMetric = selectedMetric !== 'books';
  const currentUserValue = data?.currentUserEntry ? getMetricValue(data.currentUserEntry, selectedMetric) : 0;
  const userHasActivity = currentUserValue > 0;
  const userRank = userHasActivity ? data?.currentUserRank : null;
  const userHasStandards = data?.currentUserHasStandards ?? false;

  // Find who's just ahead of current user for motivation
  const userAheadOfCurrent = userRank && userRank > 1 
    ? entriesWithActivity[userRank - 2] 
    : null;
  const gapToNext = userAheadOfCurrent && data?.currentUserEntry
    ? getMetricValue(userAheadOfCurrent, selectedMetric) - currentUserValue
    : null;

  return (
    <Card className="mb-6 overflow-hidden">
      {/* Header with gradient */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              {isWeeklyMetric ? "This Week" : "Most Well-Read"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {isWeeklyMetric ? "Resets Sunday midnight" : "All-time progress"}
            </p>
          </div>
          {userHasStandards && (
            <Button 
              size="sm" 
              onClick={() => navigate('/goals')}
              className="h-8 text-xs gap-1"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Log Progress
            </Button>
          )}
        </div>

        {/* User Status - Loading State (only when no cached data) */}
        {isLoading && !hasCachedData && <UserStatusSkeleton />}

        {/* User Status - No Standards Set Up */}
        {hasCachedData && !userHasStandards && (
          <div className="rounded-lg p-3 bg-background/60 border border-dashed border-primary/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium">Join the competition</span>
                <p className="text-xs text-muted-foreground">
                  Set up your standards to start tracking
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => navigate('/goals')}
                className="h-7 text-xs"
              >
                Set Up
              </Button>
            </div>
          </div>
        )}

        {/* User Status - Has Standards */}
        {hasCachedData && userHasStandards && data?.currentUserEntry && (
          <div className={cn(
            "rounded-lg p-3 transition-all",
            userHasActivity 
              ? "bg-background/80 backdrop-blur-sm" 
              : "bg-background/60 border border-dashed border-primary/30"
          )}>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-primary/30">
                <AvatarImage src={data.currentUserEntry.profilePhotoUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {getInitials(data.currentUserEntry.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                {userHasActivity ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        #{userRank}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        • {formatMetricValue(data.currentUserEntry, selectedMetric)}
                      </span>
                    </div>
                    {gapToNext !== null && gapToNext > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {selectedMetric === 'overall' && `${gapToNext} pts behind #${userRank! - 1}`}
                        {selectedMetric === 'training' && `${formatTrainingDisplay(gapToNext)} behind #${userRank! - 1}`}
                        {selectedMetric === 'books' && `${gapToNext} ${gapToNext === 1 ? 'book' : 'books'} behind #${userRank! - 1}`}
                        {selectedMetric === 'roleplays' && `${gapToNext} behind #${userRank! - 1}`}
                        {selectedMetric === 'mnl' && userRank! > 1 && 'Attend MNL to move up!'}
                      </p>
                    )}
                    {userRank === 1 && (
                      <p className="text-xs text-primary font-medium">
                        🔥 You're leading!
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium">Not ranked yet</span>
                    <p className="text-xs text-muted-foreground">
                      {selectedMetric === 'overall' && 'Train, role play, or attend MNL to get on the board'}
                      {selectedMetric === 'books' && 'Finish a book to get on the board'}
                      {selectedMetric === 'training' && 'Log training time to get on the board'}
                      {selectedMetric === 'roleplays' && 'Do a role play to get on the board'}
                      {selectedMetric === 'mnl' && 'Attend Monday Night Lights to get on the board'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <CardContent className="pt-3 space-y-3">
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
          <PodiumDisplay 
            entries={top3} 
            metric={selectedMetric} 
            currentUserId={data?.currentUserEntry?.userId}
          />
        )}

        {/* Empty State */}
        {!isLoading && top3.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No activity yet this week</p>
            <p className="text-xs mt-1">Be the first to get on the board!</p>
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
                isCurrentUser={entry.userId === data?.currentUserEntry?.userId}
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
            <CollapsibleContent className="space-y-0.5">
              {remainingEntries.map((entry, index) => (
                <LeaderboardRow
                  key={entry.userId}
                  entry={entry}
                  rank={index + 4 + restWithActivity.length}
                  metric={selectedMetric}
                  isCurrentUser={entry.userId === data?.currentUserEntry?.userId}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};
