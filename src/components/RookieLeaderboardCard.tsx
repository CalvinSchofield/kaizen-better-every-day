import { Trophy, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useYesterdayLeaderboard } from "@/hooks/useYesterdayLeaderboard";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const RookieLeaderboardCard = () => {
  const { data: leaderboard, isLoading } = useYesterdayLeaderboard("Rookie");
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
            {isUserTopPerformer ? "You're a Top Performer! 🎉" : "Yesterday's Rookie Leaders"}
          </CardTitle>
        </div>
        <CardDescription>
          {isUserTopPerformer ? "Keep crushing it!" : "See who led the pack yesterday"}
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
      </CardContent>
    </Card>
  );
};
