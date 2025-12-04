import { useMemo } from "react";
import { useTodayLeaderboard } from "./useTodayLeaderboard";
import { useWeeklyLeaderboard } from "./useWeeklyLeaderboard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface CompetitorNudge {
  name: string;
  metric: 'presentations' | 'pitches' | 'fp_plus' | 'prmr' | 'decision_makers' | 'doors_knocked';
  metricLabel: string;
  timeframe: 'today' | 'this week';
  gap: number;
  userValue: number;
  competitorValue: number;
}

// Find a "catchable" competitor who is slightly ahead and still working
export const useCompetitorNudge = () => {
  const { data: todayLeaderboard, isLoading: todayLoading } = useTodayLeaderboard();
  const { data: weeklyLeaderboard, isLoading: weeklyLoading } = useWeeklyLeaderboard();
  
  // Get current user ID
  const { data: currentUserId } = useQuery({
    queryKey: ["current-user-id-nudge"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
  });

  const competitor = useMemo(() => {
    if (!currentUserId || !todayLeaderboard) return null;

    const rankings = todayLeaderboard.rankings;

    // Helper to find a catchable competitor in a ranking
    const findCatchableInRanking = (
      ranking: Array<{ userId: string; name: string; value: number; isWorking?: boolean }>,
      metric: CompetitorNudge['metric'],
      metricLabel: string,
      timeframe: 'today' | 'this week',
      maxGap: number
    ): CompetitorNudge | null => {
      const userEntry = ranking.find(r => r.userId === currentUserId);
      const userValue = userEntry?.value || 0;

      // Find someone ahead by 1-maxGap who is working
      for (const entry of ranking) {
        if (entry.userId === currentUserId) continue;
        if (!entry.isWorking) continue; // Must be actively working
        
        const gap = entry.value - userValue;
        // They're ahead by a small amount (catchable)
        if (gap > 0 && gap <= maxGap) {
          return {
            name: entry.name.split(' ')[0], // First name only
            metric,
            metricLabel,
            timeframe,
            gap,
            userValue,
            competitorValue: entry.value,
          };
        }
      }
      return null;
    };

    // Priority order: presentations, pitches, FP+, PRMR, decision makers, doors
    // Use different max gaps for different metrics
    const checks: Array<{
      ranking: Array<{ userId: string; name: string; value: number; isWorking?: boolean }>;
      metric: CompetitorNudge['metric'];
      label: string;
      maxGap: number;
    }> = [
      { ranking: rankings.presentations, metric: 'presentations', label: 'presentation', maxGap: 1 },
      { ranking: rankings.pitches, metric: 'pitches', label: 'pitch', maxGap: 3 },
      { ranking: rankings.fp_plus, metric: 'fp_plus', label: 'FP+', maxGap: 1 },
      { ranking: rankings.prmr, metric: 'prmr', label: 'PRMR', maxGap: 50 },
      { ranking: rankings.decision_makers, metric: 'decision_makers', label: 'decision maker', maxGap: 3 },
      { ranking: rankings.doors_knocked, metric: 'doors_knocked', label: 'door', maxGap: 3 },
    ];

    // Try to find catchable competitor in today's data first
    for (const check of checks) {
      const result = findCatchableInRanking(
        check.ranking,
        check.metric,
        check.label,
        'today',
        check.maxGap
      );
      if (result) return result;
    }

    // If no daily catchable competitor, try weekly for presentations only
    if (weeklyLeaderboard?.mostPresentations) {
      // Weekly leaderboard structure is different - just check if someone is working
      // For now, we prioritize daily comparisons
    }

    return null;
  }, [currentUserId, todayLeaderboard, weeklyLeaderboard]);

  return {
    competitor,
    loading: todayLoading || weeklyLoading,
  };
};
