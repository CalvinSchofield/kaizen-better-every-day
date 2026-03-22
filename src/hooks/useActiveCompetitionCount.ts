import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DateRange {
  start: string;
  end: string;
}

export const useActiveCompetitionCount = (dateRange?: DateRange) => {
  return useQuery({
    queryKey: ["active-competition-count", dateRange?.start, dateRange?.end],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
      if (!user) return { challenges: 0, incentives: 0, total: 0 };

      if (dateRange) {
        // Find challenges that overlap with the selected date range
        const [challengesRes, incentivesRes] = await Promise.all([
          supabase
            .from("challenge_participants")
            .select("challenge_id, challenges!inner(status, start_date, end_date)")
            .eq("user_id", user.id)
            .eq("accepted", true)
            .in("challenges.status", ["active", "completed"])
            .lte("challenges.start_date", dateRange.end)
            .gte("challenges.end_date", dateRange.start),
          supabase
            .from("incentives")
            .select("id, status")
            .in("status", ["active", "completed"])
            .lte("start_date", dateRange.end)
            .gte("end_date", dateRange.start),
        ]);

        const challenges = challengesRes.data?.length ?? 0;
        const incentives = incentivesRes.data?.length ?? 0;

        return { challenges, incentives, total: challenges + incentives };
      }

      // No date range = just active competitions (live mode)
      const [challengesRes, incentivesRes] = await Promise.all([
        supabase
          .from("challenge_participants")
          .select("challenge_id, challenges!inner(status)", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("accepted", true)
          .eq("challenges.status", "active"),
        supabase
          .from("incentives")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
      ]);

      const challenges = challengesRes.count ?? 0;
      const incentives = incentivesRes.count ?? 0;

      return { challenges, incentives, total: challenges + incentives };
    },
    staleTime: 60 * 1000,
  });
};
