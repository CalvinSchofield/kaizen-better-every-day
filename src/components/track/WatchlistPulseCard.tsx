import { useNavigate } from "react-router-dom";
import { Eye, ChevronRight } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getInitials, getCleanFirstName } from "@/utils/nameUtils";
import { hapticLight } from "@/utils/haptics";
import { format, subDays } from "date-fns";

export const WatchlistPulseCard = () => {
  const navigate = useNavigate();
  const { watchedUserIds, isLoading: watchlistLoading } = useWatchlist();

  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

  const { data: watchedActivity } = useQuery({
    queryKey: ["watchlist-pulse", watchedUserIds, yesterday],
    queryFn: async () => {
      if (watchedUserIds.length === 0) return [];

      // Get yesterday's entries for watched users
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("user_id, fp_plus, prmr, doors_knocked, presentations")
        .in("user_id", watchedUserIds)
        .eq("entry_date", yesterday);

      if (error || !entries?.length) return [];

      // Get rep info for these users
      const { data: reps } = await supabase
        .from("reps")
        .select("user_id, name, profile_photo_url")
        .in("user_id", entries.map((e) => e.user_id));

      const repMap = new Map(reps?.map((r) => [r.user_id, r]) || []);

      return entries
        .map((e) => ({
          userId: e.user_id,
          fpPlus: e.fp_plus || 0,
          prmr: e.prmr || 0,
          doors: e.doors_knocked || 0,
          name: repMap.get(e.user_id)?.name || "Unknown",
          photoUrl: repMap.get(e.user_id)?.profile_photo_url,
        }))
        .sort((a, b) => b.fpPlus - a.fpPlus)
        .slice(0, 5);
    },
    enabled: watchedUserIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Don't show if no watchlist or no activity
  if (watchlistLoading || watchedUserIds.length === 0 || !watchedActivity?.length) {
    return null;
  }

  const topPerformer = watchedActivity[0];

  return (
    <button
      onClick={() => {
        hapticLight();
        navigate("/leaderboard");
      }}
      className="group flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-card border border-border/50 active:scale-[0.98] transition-all"
    >
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Eye className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {getCleanFirstName(topPerformer.name)} sold {topPerformer.fpPlus.toFixed(1)} FP+ yesterday
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          {/* Stacked avatars */}
          <div className="flex -space-x-1.5">
            {watchedActivity.slice(0, 4).map((person) => (
              <Avatar key={person.userId} className="h-4 w-4 border border-background">
                <AvatarImage src={person.photoUrl || undefined} />
                <AvatarFallback className="text-[6px] bg-muted">
                  {getInitials(person.name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-1">
            {watchedActivity.length} on your watchlist worked
          </span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
};
