import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTrainingPaceStatus } from "@/utils/timezoneUtils";

export type LeaderboardMetric = 'overall' | 'books' | 'training' | 'roleplays' | 'mnl';

// Point values for prep score calculation
const POINTS = {
  books: 15,
  training: 8, // per hour
  roleplays: 12,
  mnl: 8,
};

export interface LeaderboardEntry {
  userId: string;
  name: string;
  notionPageId: string | null;
  timezone: string;
  profilePhotoUrl: string | null;
  // Overall prep score
  prepScore: number;
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

        const booksProgress = goal.books_progress || 0;
        const trainingProgress = goal.training_hours_progress || 0;
        const roleplaysProgress = goal.role_plays_progress || 0;
        const mnlProgress = goal.monday_night_lights_progress || 0;

        // Calculate overall prep score
        const prepScore = 
          (booksProgress * POINTS.books) +
          ((trainingProgress / 60) * POINTS.training) + // Convert minutes to hours
          (roleplaysProgress * POINTS.roleplays) +
          (mnlProgress * POINTS.mnl);

        entries.push({
          userId: goal.user_id,
          name: rep.name,
          notionPageId: rep.notion_page_id,
          timezone,
          profilePhotoUrl: rep.profile_photo_url,
          prepScore: Math.round(prepScore),
          booksProgress,
          booksGoal: goal.books_goal || 0,
          booksPercent: goal.books_goal ? (booksProgress / goal.books_goal) * 100 : 0,
          trainingProgress,
          trainingGoal: trainingGoalMinutes,
          trainingPercent: trainingGoalMinutes ? (trainingProgress / trainingGoalMinutes) * 100 : 0,
          trainingPaceStatus: getTrainingPaceStatus(
            trainingProgress,
            trainingGoalMinutes,
            timezone
          ),
          roleplaysProgress,
          mnlProgress,
        });
      }

      // Sort based on selected metric
      const sortedEntries = [...entries].sort((a, b) => {
        switch (metric) {
          case 'overall':
            return b.prepScore - a.prepScore;
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
            return b.prepScore - a.prepScore;
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
