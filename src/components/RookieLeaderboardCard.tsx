import { Trophy, Crown, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useYesterdayLeaderboard } from "@/hooks/useYesterdayLeaderboard";
import { useWeeklyLeaderboard } from "@/hooks/useWeeklyLeaderboard";
import { useBooksLeaderboard } from "@/hooks/useBooksLeaderboard";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

interface RookieLeaderboardCardProps {
  isOnActiveBlitz: boolean;
}

export const RookieLeaderboardCard = ({ isOnActiveBlitz }: RookieLeaderboardCardProps) => {
  const { data: yesterdayLeaderboard, isLoading: isLoadingYesterday } = useYesterdayLeaderboard("Rookie");
  const { data: weeklyLeaderboard, isLoading: isLoadingWeekly } = useWeeklyLeaderboard("Rookie");
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
    leaderboard?.mostDoors?.userId === currentUserId ||
    leaderboard?.mostDecisionMakers?.userId === currentUserId ||
    leaderboard?.mostFP?.userId === currentUserId ||
    leaderboard?.mostPRMR?.userId === currentUserId
  );

  return (
    <Card className={isUserTopPerformer ? "border-2 border-primary shadow-lg" : ""}>
      <CardHeader>
        <div className="flex items-center gap-2">
          {isUserTopPerformer ? (
            <Crown className="h-5 w-5 text-primary" />
          ) : (
            <Trophy className="h-5 w-5 text-primary" />
          )}
          <CardTitle>
            {isUserTopPerformer ? "You're a Top Performer! 🎉" : isOnActiveBlitz ? "Yesterday's Rookie Leaders" : "This Week's Rookie Leaders"}
          </CardTitle>
        </div>
        <CardDescription>
          {isUserTopPerformer ? "Keep crushing it!" : isOnActiveBlitz ? "See who led the pack yesterday" : "See who's dominating this week"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {leaderboard?.mostDoors && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Most Doors</p>
              <p className="text-xs text-muted-foreground">{leaderboard.mostDoors.name}</p>
            </div>
            <p className="text-2xl font-bold text-primary">{leaderboard.mostDoors.value}</p>
          </div>
        )}

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
              <p className="text-sm font-medium">Most FP+</p>
              <p className="text-xs text-muted-foreground">{leaderboard.mostFP.name}</p>
            </div>
            <p className="text-2xl font-bold text-primary">{leaderboard.mostFP.value.toFixed(1)}</p>
          </div>
        )}

        {leaderboard?.mostPRMR && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Most PRMR</p>
              <p className="text-xs text-muted-foreground">{leaderboard.mostPRMR.name}</p>
            </div>
            <p className="text-2xl font-bold text-green-800 dark:text-green-500">
              ${leaderboard.mostPRMR.value.toFixed(0)}
            </p>
          </div>
        )}

        {!leaderboard?.mostDoors && !leaderboard?.mostDecisionMakers && !leaderboard?.mostFP && !leaderboard?.mostPRMR && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No data from yesterday yet. Be the first to log!
          </p>
        )}

        {/* Most Well-Read Rookie Shoutout - only show if different from overall leader */}
        {booksLeaderboard?.mostReadRookie && 
         booksLeaderboard.mostReadRookie.booksRead > 0 &&
         (!booksLeaderboard.mostReadOverall || 
          booksLeaderboard.mostReadRookie.userId !== booksLeaderboard.mostReadOverall.userId) && (
          <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Most Well-Read Rookie</p>
                <p className="text-xs text-muted-foreground">{booksLeaderboard.mostReadRookie.name}</p>
              </div>
            </div>
            <p className="text-lg font-bold text-purple-500">
              {booksLeaderboard.mostReadRookie.booksRead} 📚
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
