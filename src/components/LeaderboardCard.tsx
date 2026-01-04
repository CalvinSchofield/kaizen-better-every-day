import { useNavigate } from "react-router-dom";
import { ChevronRight, Crown } from "lucide-react";
import { useRepData } from "@/hooks/useRepData";
import { useUserHighlight } from "@/hooks/useUserHighlight";

export const LeaderboardCard = () => {
  const navigate = useNavigate();
  const { repData } = useRepData();
  const highlight = useUserHighlight(repData?.user_id ?? null);

  return (
    <button
      onClick={() => navigate('/leaderboard')}
      className="w-full rounded-lg bg-card border border-border mb-6 px-6 py-4 hover:bg-accent/5 transition-colors text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <div>
            <span className="text-foreground text-lg font-semibold block">Leaderboard</span>
            {highlight && (
              <div className="flex items-center gap-1 mt-0.5">
                {highlight.isLeading ? (
                  <>
                    <Crown className="h-3 w-3 text-amber-500" />
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Leading {highlight.metric} {highlight.timeframe}
                    </span>
                  </>
                ) : highlight.name && (
                  <span className="text-xs text-muted-foreground">
                    Top: {highlight.name} ({highlight.value})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </button>
  );
};
