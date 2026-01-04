import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export const LeaderboardCard = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/leaderboard')}
      className="w-full rounded-lg bg-card border border-border mb-6 px-6 py-4 flex items-center justify-between hover:bg-accent/5 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">🏆</span>
        <span className="text-foreground text-lg font-semibold">Leaderboard</span>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </button>
  );
};
