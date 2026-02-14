import { useNavigate } from "react-router-dom";
import { ChevronRight, Crown, TrendingUp } from "lucide-react";
import { useRepData } from "@/hooks/useRepData";
import { useUserHighlight } from "@/hooks/useUserHighlight";

export const LeaderboardCard = () => {
  const navigate = useNavigate();
  const { repData } = useRepData();
  const highlight = useUserHighlight(repData?.user_id ?? null);

  return (
    <button
      onClick={() => navigate('/leaderboard')}
      className="w-full rounded-lg bg-card border border-border mb-6 px-6 py-5 active:scale-[0.97] transition-all text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🏆</span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-foreground text-lg font-semibold block">Leaderboard</span>
            {highlight && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {highlight.isLeading ? (
                  <>
                    <Crown className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="text-xs text-primary font-semibold truncate">
                      You're leading {highlight.metric} {highlight.timeframe}!
                    </span>
                  </>
                ) : highlight.name ? (
                  <>
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">
                      {highlight.name} · {highlight.value} {highlight.timeframe}
                    </span>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2" />
      </div>
    </button>
  );
};
