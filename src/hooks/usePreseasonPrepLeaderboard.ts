import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getExpectedWeeklyProgress, getTrainingPaceStatus } from "@/utils/timezoneUtils";

export type LeaderboardMetric = 'books' | 'training' | 'roleplays' | 'mnl';

export interface LeaderboardEntry {
  userId: string;
  name: string;
  notionPageId: string | null;
  timezone: string;
  profilePhotoUrl: string | null;
  // Books
  booksProgress: number;
  booksGoal: number;
  booksPercent: number;
  // Training (in minutes)
  trainingProgress: number;
  trainingGoal: number; // in minutes
  trainingPercent: number;
  trainingPaceStatus: 'ahead' | 'on-track' | 'behind' | 'no-goal';
  // Role Plays
  roleplaysProgress: number;
  // MNL
  mnlProgress: number;
}

export const usePreseasonPrepLeaderboard = (metric: LeaderboardMetric = 'books') => {
  const { data: currentUserId } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
  });

  return useQuery({
    queryKey: ['preseason-prep-leaderboard', metric],
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
          monday_night_lights_progress
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
        const trainingGoalMinutes = (goal.training_hours_goal || 0) * 60;

        entries.push({
          userId: goal.user_id,
          name: rep.name,
          notionPageId: rep.notion_page_id,
          timezone,
          profilePhotoUrl: rep.profile_photo_url,
          booksProgress: goal.books_progress || 0,
          booksGoal: goal.books_goal || 0,
          booksPercent: goal.books_goal ? ((goal.books_progress || 0) / goal.books_goal) * 100 : 0,
          trainingProgress: goal.training_hours_progress || 0,
          trainingGoal: trainingGoalMinutes,
          trainingPercent: trainingGoalMinutes ? ((goal.training_hours_progress || 0) / trainingGoalMinutes) * 100 : 0,
          trainingPaceStatus: getTrainingPaceStatus(
            goal.training_hours_progress || 0,
            trainingGoalMinutes,
            timezone
          ),
          roleplaysProgress: goal.role_plays_progress || 0,
          mnlProgress: goal.monday_night_lights_progress || 0,
        });
      }

      // Sort based on selected metric
      const sortedEntries = [...entries].sort((a, b) => {
        switch (metric) {
          case 'books':
            // Sort by percent complete, then raw count
            if (a.booksPercent !== b.booksPercent) return b.booksPercent - a.booksPercent;
            return b.booksProgress - a.booksProgress;
          case 'training':
            // Sort by percent complete
            if (a.trainingPercent !== b.trainingPercent) return b.trainingPercent - a.trainingPercent;
            return b.trainingProgress - a.trainingProgress;
          case 'roleplays':
            return b.roleplaysProgress - a.roleplaysProgress;
          case 'mnl':
            return b.mnlProgress - a.mnlProgress;
          default:
            return 0;
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
