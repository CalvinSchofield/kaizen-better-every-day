import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Timer, Dumbbell, Phone, Trophy, ChevronDown, ChevronUp, Star, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { usePreseasonPrepLeaderboard, LeaderboardMetric, LeaderboardEntry } from "@/hooks/usePreseasonPrepLeaderboard";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const metrics: { key: LeaderboardMetric; label: string; icon: React.ReactNode }[] = [
  { key: 'overall', label: 'Overall', icon: <Zap className="h-3.5 w-3.5" /> },
  { key: 'books', label: 'Books', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { key: 'training', label: 'Training', icon: <Timer className="h-3.5 w-3.5" /> },
  { key: 'roleplays', label: 'Role Plays', icon: <Dumbbell className="h-3.5 w-3.5" /> },
  { key: 'mnl', label: 'MNL', icon: <Phone className="h-3.5 w-3.5" /> },
];

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const formatTrainingDisplay = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  rank: number;
  metric: LeaderboardMetric;
  isCurrentUser: boolean;
}

const LeaderboardRow = ({ entry, rank, metric, isCurrentUser }: LeaderboardRowProps) => {
  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <span className="text-xs font-bold text-gray-400">2nd</span>;
    if (rank === 3) return <span className="text-xs font-bold text-amber-600">3rd</span>;
    return <span className="text-xs text-muted-foreground">{rank}</span>;
  };

  const getMetricDisplay = () => {
    switch (metric) {
      case 'overall':
        return (
          <Badge variant="secondary" className="font-semibold tabular-nums">
            {entry.weeklyPrepScore} pts
          </Badge>
        );
      case 'books':
        return (
          <span className="text-sm font-medium tabular-nums">
            {entry.weeklyBooks} {entry.weeklyBooks === 1 ? 'book' : 'books'}
          </span>
        );
      case 'training':
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium tabular-nums">
              {formatTrainingDisplay(entry.weeklyTraining)}
            </span>
            {entry.trainingPaceStatus === 'ahead' && (
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            )}
            {entry.trainingPaceStatus === 'behind' && (
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            )}
          </div>
        );
      case 'roleplays':
        return (
          <span className="text-sm font-medium">
            {entry.weeklyRoleplays} {entry.weeklyRoleplays === 1 ? 'session' : 'sessions'}
          </span>
        );
      case 'mnl':
        return (
          <span className="text-sm font-medium">
            {entry.weeklyMnl} attended
          </span>
        );
    }
  };

  return (
    <div className={cn(
      "flex items-center justify-between py-2.5 px-2 rounded-lg transition-colors",
      isCurrentUser && "bg-primary/10 ring-1 ring-primary/20"
    )}>
      <div className="flex items-center gap-3">
        <div className="w-6 flex justify-center">
          {getRankBadge(rank)}
        </div>
        <Avatar className="h-8 w-8">
          <AvatarImage src={entry.profilePhotoUrl || undefined} alt={entry.name} />
          <AvatarFallback className={cn(
            "text-xs",
            isCurrentUser ? "bg-primary/20 text-primary" : "bg-secondary"
          )}>
            {getInitials(entry.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-sm",
            isCurrentUser && "font-semibold"
          )}>
            {entry.name}
          </span>
          {isCurrentUser && (
            <Star className="h-3 w-3 text-primary fill-primary" />
          )}
        </div>
      </div>
      {getMetricDisplay()}
    </div>
  );
};

export const PreseasonPrepLeaderboard = () => {
  const [selectedMetric, setSelectedMetric] = useState<LeaderboardMetric>('overall');
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, isLoading } = usePreseasonPrepLeaderboard(selectedMetric);

  // Don't render if no data and not loading
  if (!isLoading && (!data || data.entries.length === 0)) return null;

  // Filter out entries with 0 for the selected metric (no fake first place)
  const getMetricValue = (entry: LeaderboardEntry) => {
    switch (selectedMetric) {
      case 'overall': return entry.weeklyPrepScore;
      case 'books': return entry.weeklyBooks;
      case 'training': return entry.weeklyTraining;
      case 'roleplays': return entry.weeklyRoleplays;
      case 'mnl': return entry.weeklyMnl;
      default: return entry.weeklyPrepScore;
    }
  };

  const entriesWithActivity = data?.entries.filter(e => getMetricValue(e) > 0) || [];
  const entriesWithoutActivity = data?.entries.filter(e => getMetricValue(e) === 0) || [];
  
  const topEntries = entriesWithActivity.slice(0, 5);
  const remainingEntries = [
    ...entriesWithActivity.slice(5),
    ...entriesWithoutActivity
  ];

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              This Week's Leaderboard
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Resets every Sunday at midnight</p>
          </div>
          {data?.currentUserRank && data.currentUserRank > 0 && (
            <Badge variant="outline" className="text-xs">
              You're #{data.currentUserRank}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Metric Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {metrics.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setSelectedMetric(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all",
                selectedMetric === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Leaderboard List - Show skeleton during loading or actual content */}
        <div className={cn("space-y-1 transition-opacity duration-200", isLoading && "opacity-60")}>
          {topEntries.map((entry, index) => (
            <LeaderboardRow
              key={entry.userId}
              entry={entry}
              rank={index + 1}
              metric={selectedMetric}
              isCurrentUser={entry.userId === data?.currentUserEntry?.userId}
            />
          ))}
        </div>

        {/* Expandable remaining entries */}
        {remainingEntries.length > 0 && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger className="flex items-center justify-center w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show {remainingEntries.length} more
                </>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1">
              {remainingEntries.map((entry, index) => (
                <LeaderboardRow
                  key={entry.userId}
                  entry={entry}
                  rank={index + 6}
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
