import { Trophy, Crown, TrendingUp, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useYesterdayLeaderboard } from "@/hooks/useYesterdayLeaderboard";
import { useWeeklyLeaderboard } from "@/hooks/useWeeklyLeaderboard";
import { useBooksLeaderboard } from "@/hooks/useBooksLeaderboard";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

interface VetLeaderboardCardProps {
  isOnActiveBlitz: boolean;
}

type FilterType = "all" | "rookies";

export const VetLeaderboardCard = ({ isOnActiveBlitz }: VetLeaderboardCardProps) => {
  const [filter, setFilter] = useState<FilterType>("all"); // Default to all for vet users
  
  const yearFilter = filter === "rookies" ? "Rookie" : undefined;
  
  const { data: yesterdayLeaderboard, isLoading: isLoadingYesterday } = useYesterdayLeaderboard(yearFilter);
  const { data: weeklyLeaderboard, isLoading: isLoadingWeekly } = useWeeklyLeaderboard(yearFilter);
  const { data: booksLeaderboard } = useBooksLeaderboard();
  
  const leaderboard = isOnActiveBlitz ? yesterdayLeaderboard : weeklyLeaderboard;
  const isLoading = isOnActiveBlitz ? isLoadingYesterday : isLoadingWeekly;
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // If weekly leaderboard has no data, hide card entirely
  if (!isOnActiveBlitz && !leaderboard) {
    return null;
  }

  const isUserTopPerformer = currentUserId && (
    leaderboard?.mostDecisionMakers?.userId === currentUserId ||
    leaderboard?.mostFP?.userId === currentUserId ||
    leaderboard?.mostPRMR?.userId === currentUserId
  );

  const getTitle = () => {
    if (isUserTopPerformer) return "You're Leading the Pack! 🔥";
    const scope = filter === "rookies" ? "Rookie" : "";
    return isOnActiveBlitz 
      ? `Yesterday's ${scope} Top Performers`.trim().replace(/\s+/g, ' ')
      : `This Week's ${scope} Top Performers`.trim().replace(/\s+/g, ' ');
  };

  return (
    <Card className={isUserTopPerformer ? "border-2 border-primary shadow-lg" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isUserTopPerformer ? (
              <Crown className="h-5 w-5 text-primary" />
            ) : (
              <TrendingUp className="h-5 w-5 text-primary" />
            )}
            <CardTitle className="text-base">{getTitle()}</CardTitle>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <CardDescription>
            {isUserTopPerformer ? "Keep dominating!" : "Where do you stand?"}
          </CardDescription>
          {/* Toggle */}
          <div className="flex bg-muted rounded-full p-0.5">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                filter === "all" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("rookies")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                filter === "rookies" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Rookies
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {leaderboard?.mostDecisionMakers && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Most Homes Entered</p>
              <p className="text-xs text-muted-foreground">{leaderboard.mostDecisionMakers.name}</p>
            </div>
            <p className="text-2xl font-bold text-primary">{leaderboard.mostDecisionMakers.value}</p>
          </div>
        )}

        {leaderboard?.mostFP && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Highest FP+</p>
              <p className="text-xs text-muted-foreground">{leaderboard.mostFP.name}</p>
            </div>
            <p className="text-2xl font-bold text-primary">{leaderboard.mostFP.value.toFixed(1)}</p>
          </div>
        )}

        {leaderboard?.mostPRMR && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Highest PRMR</p>
              <p className="text-xs text-muted-foreground">{leaderboard.mostPRMR.name}</p>
            </div>
            <p className="text-2xl font-bold text-green-800 dark:text-green-500">
              ${leaderboard.mostPRMR.value.toFixed(0)}
            </p>
          </div>
        )}

        {!leaderboard?.mostDecisionMakers && !leaderboard?.mostFP && !leaderboard?.mostPRMR && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No data from yesterday yet. Time to set the bar!
          </p>
        )}

        {/* Most Well-Read Shoutout */}
        {booksLeaderboard?.mostReadOverall && booksLeaderboard.mostReadOverall.booksRead > 0 && (
          <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Most Well-Read</p>
                <p className="text-xs text-muted-foreground">{booksLeaderboard.mostReadOverall.name}</p>
              </div>
            </div>
            <p className="text-lg font-bold text-purple-500">
              {booksLeaderboard.mostReadOverall.booksRead} 📚
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};