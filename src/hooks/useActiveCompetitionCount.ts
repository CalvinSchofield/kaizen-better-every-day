import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useActiveCompetitionCount = () => {
  return useQuery({
    queryKey: ["active-competition-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { challenges: 0, incentives: 0, total: 0 };

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
