import { Eye } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { getCleanFirstName } from "@/utils/nameUtils";
import { format } from "date-fns";

interface WatchlistComparisonRowProps {
  userFpPlus: number;
}

export const WatchlistComparisonRow = ({ userFpPlus }: WatchlistComparisonRowProps) => {
  const { watchedUserIds } = useWatchlist();
  const { userId } = useCurrentUserId();

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: watchedToday } = useQuery({
    queryKey: ["watchlist-comparison-today", watchedUserIds, today],
    queryFn: async () => {
      if (watchedUserIds.length === 0) return [];

      const { data: entries } = await supabase
        .from("daily_entries")
        .select("user_id, fp_plus")
        .in("user_id", watchedUserIds)
        .eq("entry_date", today);

      if (!entries?.length) return [];

      const { data: reps } = await supabase
        .from("reps")
        .select("user_id, name")
        .in("user_id", entries.map((e) => e.user_id));

      const repMap = new Map(reps?.map((r) => [r.user_id, r]) || []);

      return entries.map((e) => ({
        userId: e.user_id,
        fpPlus: e.fp_plus || 0,
        name: repMap.get(e.user_id)?.name || "Unknown",
      }));
    },
    enabled: watchedUserIds.length > 0,
    staleTime: 30 * 1000,
  });

  if (!watchedToday?.length || watchedUserIds.length === 0) return null;

  const beaten = watchedToday.filter((w) => userFpPlus > w.fpPlus).length;
  const total = watchedToday.length;
  const topWatched = watchedToday.sort((a, b) => b.fpPlus - a.fpPlus)[0];

  const isAhead = userFpPlus >= topWatched.fpPlus;
  const gap = Math.abs(userFpPlus - topWatched.fpPlus);

  return (
    <div className="px-4 mb-4">
      <div
        className={`rounded-xl p-3 ${
          isAhead
            ? "bg-green-500/10 border border-green-500/20"
            : "bg-amber-500/10 border border-amber-500/20"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <Eye className={`h-3.5 w-3.5 ${isAhead ? "text-green-500" : "text-amber-500"}`} />
          <span className="text-xs font-medium">Watchlist Check-in</span>
        </div>
        <p className={`text-sm font-semibold ${isAhead ? "text-green-600" : "text-amber-600"}`}>
          {isAhead
            ? `You beat ${beaten}/${total} on your watchlist today`
            : `${getCleanFirstName(topWatched.name)} outpaced you by ${gap.toFixed(1)} FP+`}
        </p>
      </div>
    </div>
  );
};
