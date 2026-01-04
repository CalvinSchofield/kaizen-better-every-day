import { Crown, TrendingUp } from "lucide-react";
import { useUserHighlight } from "@/hooks/useUserHighlight";

interface LeaderboardHeroBannerProps {
  userId: string | null;
  filterByYear?: string;
}

export const LeaderboardHeroBanner = ({ userId, filterByYear }: LeaderboardHeroBannerProps) => {
  const highlight = useUserHighlight(userId, filterByYear);

  if (!highlight) {
    return (
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-full">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Your Highlight</p>
            <p className="font-medium">Start working to see your stats!</p>
          </div>
        </div>
      </div>
    );
  }

  if (highlight.isLeading) {
    return (
      <div className="bg-gradient-to-r from-primary/20 to-amber-500/10 rounded-xl p-4 border border-primary/30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/30 rounded-full">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-primary font-medium uppercase tracking-wide">🔥 You're Leading</p>
            <p className="font-semibold text-lg">
              {highlight.metric} <span className="text-muted-foreground font-normal text-sm">{highlight.timeframe}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/50 rounded-xl p-4 border border-border">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-muted rounded-full">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Top Performer</p>
          <p className="font-medium">
            <span className="text-foreground">{highlight.name}</span>
            <span className="text-muted-foreground"> leads {highlight.metric} {highlight.timeframe} at </span>
            <span className="text-primary font-semibold">{highlight.value}</span>
          </p>
        </div>
      </div>
    </div>
  );
};
