import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTrainingPaceStatus, getWeekStartDateString } from "@/utils/timezoneUtils";

export type LeaderboardMetric = 'overall' | 'books' | 'training' | 'roleplays' | 'mnl';

// Point values for WEEKLY prep score calculation (books excluded - they're all-time)
const POINTS = {
  training: 8, // per hour
  roleplays: 12,
  mnl: 8,
};

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

export interface LeaderboardEntry {
  userId: string;
  name: string;
  notionPageId: string | null;
  timezone: string;
  profilePhotoUrl: string | null;
  // Weekly prep score (this week's effort - excludes books)
  weeklyPrepScore: number;
  // Books are ALL-TIME cumulative (not weekly)
  totalBooks: number;
  booksGoal: number;
  // Weekly progress (this week only)
  weeklyTraining: number; // in minutes
  weeklyRoleplays: number;
  weeklyMnl: number;
  // Training pace status (weekly)
  trainingGoal: number; // in minutes
  trainingPaceStatus: 'ahead' | 'on-track' | 'behind' | 'no-goal';
}

export const usePreseasonPrepLeaderboard = (metric: LeaderboardMetric = 'overall') => {
  const { data: currentUserId } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
  });

  return useQuery({
    queryKey: ['preseason-prep-leaderboard-weekly', metric],
    queryFn: async () => {
      // Fetch all rookies with setup_complete
      const { data: goalsData, error: goalsError } = await supabase
        .from('rep_goals')
        .select(`
          user_id,
          setup_complete,
          books_progress,
          books_goal,
          training_hours_progress,
          training_hours_goal,
          role_plays_progress,
          monday_night_lights_progress,
          prep_score_history
        `)
        .eq('setup_complete', true);

      if (goalsError) throw goalsError;

      // Fetch rep info for names, timezones, and profile photos
      const { data: repsData, error: repsError } = await supabase
        .from('reps')
        .select('user_id, name, timezone, notion_page_id, year, profile_photo_url');

      if (repsError) throw repsError;

      // Filter to only rookies
      const rookieUserIds = repsData
        ?.filter(r => r.year === 'Rookie' || r.year === '2026' || r.year === '2025' || !r.year)
        .map(r => r.user_id) || [];

      const entries: LeaderboardEntry[] = [];

      for (const goal of goalsData || []) {
        if (!rookieUserIds.includes(goal.user_id)) continue;

        const rep = repsData?.find(r => r.user_id === goal.user_id);
        if (!rep) continue;

        const timezone = rep.timezone || 'America/Los_Angeles';
        const currentWeekStart = getWeekStartDateString(timezone);
        const trainingGoalMinutes = (goal.training_hours_goal || 0) * 60;

        // Current cumulative values
        const totalBooks = goal.books_progress || 0; // Books stay cumulative
        const currentTraining = goal.training_hours_progress || 0; // This already resets weekly
        const currentRoleplays = goal.role_plays_progress || 0;
        const currentMnl = goal.monday_night_lights_progress || 0;

        // Get last week's snapshot to calculate this week's delta
        const rawHistory = goal.prep_score_history;
        const history: PrepScoreHistory[] = Array.isArray(rawHistory) 
          ? (rawHistory as unknown as PrepScoreHistory[]) 
          : [];
        
        // Find the most recent week that's NOT the current week
        const previousWeek = history
          .filter(h => h.week_start !== currentWeekStart)
          .sort((a, b) => b.week_start.localeCompare(a.week_start))[0];

        // Calculate this week's activity (training already resets weekly)
        const weeklyTraining = currentTraining;
        
        // For roleplays and MNL, subtract last week's cumulative
        const weeklyRoleplays = previousWeek
          ? Math.max(0, currentRoleplays - (previousWeek.breakdown?.roleplays || 0))
          : currentRoleplays;
        const weeklyMnl = previousWeek
          ? Math.max(0, currentMnl - (previousWeek.breakdown?.mnl || 0))
          : currentMnl;

        // Calculate weekly prep score (EXCLUDES books - they're all-time)
        const weeklyPrepScore = Math.round(
          ((weeklyTraining / 60) * POINTS.training) +
          (weeklyRoleplays * POINTS.roleplays) +
          (weeklyMnl * POINTS.mnl)
        );

        entries.push({
          userId: goal.user_id,
          name: rep.name,
          notionPageId: rep.notion_page_id,
          timezone,
          profilePhotoUrl: rep.profile_photo_url,
          weeklyPrepScore,
          totalBooks,
          booksGoal: goal.books_goal || 0,
          weeklyTraining,
          weeklyRoleplays,
          weeklyMnl,
          trainingGoal: trainingGoalMinutes,
          trainingPaceStatus: getTrainingPaceStatus(
            weeklyTraining,
            trainingGoalMinutes,
            timezone
          ),
        });
      }

      // Sort based on selected metric
      const sortedEntries = [...entries].sort((a, b) => {
        switch (metric) {
          case 'overall':
            return b.weeklyPrepScore - a.weeklyPrepScore;
          case 'books':
            // Books are cumulative, sort by total
            return b.totalBooks - a.totalBooks;
          case 'training':
            return b.weeklyTraining - a.weeklyTraining;
          case 'roleplays':
            return b.weeklyRoleplays - a.weeklyRoleplays;
          case 'mnl':
            return b.weeklyMnl - a.weeklyMnl;
          default:
            return b.weeklyPrepScore - a.weeklyPrepScore;
        }
      });

      // Find current user's rank
      const currentUserRank = sortedEntries.findIndex(e => e.userId === currentUserId) + 1;
      const currentUserEntry = sortedEntries.find(e => e.userId === currentUserId);

      return {
        entries: sortedEntries,
        currentUserRank,
        currentUserEntry,
        totalParticipants: sortedEntries.length,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};
