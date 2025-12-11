import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getWeekStartDateString } from "@/utils/timezoneUtils";

interface PrepScoreBreakdown {
  books: number;
  training: number; // in minutes
  roleplays: number;
  mnl: number;
}

interface PrepScoreHistory {
  week_start: string;
  score: number;
  breakdown: PrepScoreBreakdown;
}

export interface RookieStats {
  userId: string;
  name: string;
  notionPageId: string | null;
  timezone: string;
  currentScore: number;
  previousScore: number;
  improvement: number;
  breakdown: PrepScoreBreakdown;
  previousBreakdown: PrepScoreBreakdown | null;
}

// Point values for each metric (NO FP+)
const POINTS = {
  books: 15,
  training: 8, // per hour
  roleplays: 12,
  mnl: 8,
};

const calculatePrepScore = (breakdown: PrepScoreBreakdown): number => {
  return (
    (breakdown.books * POINTS.books) +
    ((breakdown.training / 60) * POINTS.training) + // Convert minutes to hours
    (breakdown.roleplays * POINTS.roleplays) +
    (breakdown.mnl * POINTS.mnl)
  );
};

export const useRookieOfTheWeek = () => {
  const { data: currentUserId } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
  });

  return useQuery({
    queryKey: ['rookie-of-the-week'],
    queryFn: async () => {
      // Fetch all rookies with setup_complete
      const { data: goalsData, error: goalsError } = await supabase
        .from('rep_goals')
        .select(`
          user_id,
          setup_complete,
          books_progress,
          training_hours_progress,
          role_plays_progress,
          monday_night_lights_progress,
          prep_score_history
        `)
        .eq('setup_complete', true);

      if (goalsError) throw goalsError;

      // Fetch rep info for names and timezones
      const { data: repsData, error: repsError } = await supabase
        .from('reps')
        .select('user_id, name, timezone, notion_page_id, year');

      if (repsError) throw repsError;

      // Filter to only rookies (year = "2026" or rookie-related years)
      const rookieUserIds = repsData
        ?.filter(r => r.year === '2026' || r.year === '2025' || !r.year)
        .map(r => r.user_id) || [];

      const rookies: RookieStats[] = [];

      for (const goal of goalsData || []) {
        // Skip non-rookies
        if (!rookieUserIds.includes(goal.user_id)) continue;

        const rep = repsData?.find(r => r.user_id === goal.user_id);
        if (!rep) continue;

        const timezone = rep.timezone || 'America/Los_Angeles';
        const currentWeekStart = getWeekStartDateString(timezone);

        // Current breakdown from live progress
        const currentBreakdown: PrepScoreBreakdown = {
          books: goal.books_progress || 0,
          training: goal.training_hours_progress || 0, // Already in minutes
          roleplays: goal.role_plays_progress || 0,
          mnl: goal.monday_night_lights_progress || 0,
        };

        const currentScore = calculatePrepScore(currentBreakdown);

        // Get previous week's score from history
        const rawHistory = goal.prep_score_history;
        const history: PrepScoreHistory[] = Array.isArray(rawHistory) 
          ? (rawHistory as unknown as PrepScoreHistory[]) 
          : [];
        const previousWeek = history.find(h => {
          // Find most recent week before current
          return h.week_start !== currentWeekStart;
        });

        const previousScore = previousWeek?.score || 0;
        const previousBreakdown = previousWeek?.breakdown || null;
        const improvement = currentScore - previousScore;

        rookies.push({
          userId: goal.user_id,
          name: rep.name,
          notionPageId: rep.notion_page_id,
          timezone,
          currentScore,
          previousScore,
          improvement,
          breakdown: currentBreakdown,
          previousBreakdown,
        });
      }

      // Sort by improvement (most improved first)
      rookies.sort((a, b) => b.improvement - a.improvement);

      // Get winner and runner-ups (only those with positive improvement)
      const improvedRookies = rookies.filter(r => r.improvement > 0);
      const winner = improvedRookies[0] || null;
      const runnerUps = improvedRookies.slice(1, 3);

      // Check if current user is the winner
      const isCurrentUserWinner = winner?.userId === currentUserId;

      // Get current user's stats
      const currentUserStats = rookies.find(r => r.userId === currentUserId) || null;

      return {
        winner,
        runnerUps,
        isCurrentUserWinner,
        currentUserStats,
        allRookies: rookies,
        hasData: rookies.length > 0,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: true,
  });
};
