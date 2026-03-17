import { useMemo } from "react";
import { useTodayLeaderboard } from "./useTodayLeaderboard";
import { useWeeklyLeaderboard } from "./useWeeklyLeaderboard";
import { useWatchlist } from "./useWatchlist";
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

interface NudgeFallback {
  type: 'leading' | 'behind_broad' | 'weekly_rank' | 'no_activity';
  message: string;
  subtitle: string;
}

interface UseCompetitorNudgeResult {
  competitor: CompetitorNudge | null;
  fallback: NudgeFallback | null;
  loading: boolean;
}

// Find a "catchable" competitor who is slightly ahead and still working
export const useCompetitorNudge = (): UseCompetitorNudgeResult => {
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

  const result = useMemo((): { competitor: CompetitorNudge | null; fallback: NudgeFallback | null } => {
    if (!currentUserId || !todayLeaderboard) return { competitor: null, fallback: null };

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

      for (const entry of ranking) {
        if (entry.userId === currentUserId) continue;
        if (!entry.isWorking) continue;
        
        const gap = entry.value - userValue;
        if (gap > 0 && gap <= maxGap) {
          return {
            name: entry.name.split(' ')[0],
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

    // Try to find catchable competitor
    for (const check of checks) {
      const found = findCatchableInRanking(check.ranking, check.metric, check.label, 'today', check.maxGap);
      if (found) return { competitor: found, fallback: null };
    }

    // No catchable competitor — build motivational fallback
    // Check if user is leading in any metric today
    const leadingMetrics: Array<{ metric: string; label: string; ranking: typeof rankings.doors_knocked }> = [
      { metric: 'doors_knocked', label: 'doors', ranking: rankings.doors_knocked },
      { metric: 'presentations', label: 'presentations', ranking: rankings.presentations },
      { metric: 'fp_plus', label: 'FP+', ranking: rankings.fp_plus },
      { metric: 'pitches', label: 'pitches', ranking: rankings.pitches },
    ];

    for (const { label, ranking } of leadingMetrics) {
      if (ranking.length > 0 && ranking[0].userId === currentUserId) {
        return {
          competitor: null,
          fallback: {
            type: 'leading',
            message: `You're #1 in ${label} today — keep it up!`,
            subtitle: 'Defend your lead →',
          },
        };
      }
    }

    // Check if someone is ahead (but not catchable) — surface the leader
    for (const { label, ranking } of leadingMetrics) {
      if (ranking.length > 0 && ranking[0].userId !== currentUserId) {
        const leader = ranking[0];
        const firstName = leader.name.split(' ')[0];
        return {
          competitor: null,
          fallback: {
            type: 'behind_broad',
            message: `${firstName} has ${leader.value} ${label} today`,
            subtitle: 'Get out there and close the gap →',
          },
        };
      }
    }

    // No daily activity at all — try weekly context
    if (weeklyLeaderboard) {
      const weeklyChecks = [
        { entry: weeklyLeaderboard.mostFP, label: 'FP+' },
        { entry: weeklyLeaderboard.mostPresentations, label: 'presentations' },
        { entry: weeklyLeaderboard.mostDoors, label: 'doors' },
      ];

      for (const { entry, label } of weeklyChecks) {
        if (entry && entry.userId === currentUserId) {
          return {
            competitor: null,
            fallback: {
              type: 'weekly_rank',
              message: `You're leading ${label} this week with ${Math.round(entry.value * 10) / 10}`,
              subtitle: 'Keep the momentum →',
            },
          };
        }
      }

      // Someone else is leading weekly
      for (const { entry, label } of weeklyChecks) {
        if (entry && entry.userId !== currentUserId) {
          const firstName = entry.name.split(' ')[0];
          return {
            competitor: null,
            fallback: {
              type: 'weekly_rank',
              message: `${firstName} leads ${label} this week with ${Math.round(entry.value * 10) / 10}`,
              subtitle: 'See where you stand →',
            },
          };
        }
      }
    }

    // Absolute fallback — no one is working
    return {
      competitor: null,
      fallback: {
        type: 'no_activity',
        message: 'Be the first one out there today',
        subtitle: 'Set the pace for everyone →',
      },
    };
  }, [currentUserId, todayLeaderboard, weeklyLeaderboard]);

  return {
    competitor: result.competitor,
    fallback: result.fallback,
    loading: todayLoading || weeklyLoading,
  };
};
