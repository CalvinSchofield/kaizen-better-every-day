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
  teamLeader: string | null;
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

export const useLeaderPreseasonPrepLeaderboard = (metric: LeaderboardMetric = 'overall', showMyTeamOnly: boolean = false) => {
  return useQuery({
    queryKey: ['leader-preseason-prep-leaderboard-weekly', metric, showMyTeamOnly],
    queryFn: async () => {
      // Get current user's rep data first
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Fetch current user's name (for team filtering)
      const { data: currentUserRep } = await supabase
        .from('reps')
        .select('name')
        .eq('user_id', currentUserId || '')
        .single();

      const currentUserName = currentUserRep?.name || '';

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

      // Fetch rep info for names, timezones, profile photos, team_leader, stage, and ramp progress
      const { data: repsData, error: repsError } = await supabase
        .from('reps')
        .select('user_id, name, timezone, notion_page_id, year, profile_photo_url, team_leader, stage, ramp_phase_1_complete');

      if (repsError) throw repsError;

      // Valid stages for preseason prep tracking (Signed and beyond)
      const validStages = ['Signed', 'Shadow ✅', 'Sold 💲', 'Sold (5+) 💰'];

      // Filter to only rookies who are Signed+ AND have completed Phase 1
      let rookieReps = repsData?.filter(r => 
        (r.year === 'Rookie' || r.year === '2026' || r.year === '2025' || !r.year) &&
        validStages.includes(r.stage || '') &&
        r.ramp_phase_1_complete === true
      ) || [];

      // If showMyTeamOnly, filter to only rookies on the current leader's team
      if (showMyTeamOnly && currentUserName) {
        rookieReps = rookieReps.filter(r => 
          r.team_leader?.includes(currentUserName)
        );
      }

      const rookieUserIds = rookieReps.map(r => r.user_id);

      // Count all rookies (with and without standards)
      const totalRookies = rookieReps.length;

      // Count rookies without standards
      const rookiesWithStandards = new Set(goalsData?.filter(g => 
        rookieUserIds.includes(g.user_id)
      ).map(g => g.user_id) || []);
      
      const rookiesWithoutStandards = totalRookies - rookiesWithStandards.size;

      const entries: LeaderboardEntry[] = [];

      for (const goal of goalsData || []) {
        if (!rookieUserIds.includes(goal.user_id)) continue;

        const rep = repsData?.find(r => r.user_id === goal.user_id);
        if (!rep) continue;

        const timezone = rep.timezone || 'America/Los_Angeles';
        const currentWeekStart = getWeekStartDateString(timezone);
        const trainingGoalMinutes = (goal.training_hours_goal || 0) * 60;

        // Current cumulative values
        const totalBooks = goal.books_progress || 0;
        const currentTraining = goal.training_hours_progress || 0;
        const currentRoleplays = goal.role_plays_progress || 0;
        const currentMnl = goal.monday_night_lights_progress || 0;

        // Get last week's snapshot to calculate this week's delta
        const rawHistory = goal.prep_score_history;
        const history: PrepScoreHistory[] = Array.isArray(rawHistory) 
          ? (rawHistory as unknown as PrepScoreHistory[]) 
          : [];
        
        const previousWeek = history
          .filter(h => h.week_start !== currentWeekStart)
          .sort((a, b) => b.week_start.localeCompare(a.week_start))[0];

        const weeklyTraining = currentTraining;
        
        const weeklyRoleplays = previousWeek
          ? Math.max(0, currentRoleplays - (previousWeek.breakdown?.roleplays || 0))
          : currentRoleplays;
        const weeklyMnl = previousWeek
          ? Math.max(0, currentMnl - (previousWeek.breakdown?.mnl || 0))
          : currentMnl;

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
          teamLeader: rep.team_leader,
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

      // Get unique leaders from entries for leader competition view
      const leaderStats = new Map<string, { totalScore: number; rookieCount: number }>();
      for (const entry of sortedEntries) {
        const leader = entry.teamLeader || 'Unknown';
        const existing = leaderStats.get(leader) || { totalScore: 0, rookieCount: 0 };
        leaderStats.set(leader, {
          totalScore: existing.totalScore + entry.weeklyPrepScore,
          rookieCount: existing.rookieCount + 1,
        });
      }

      return {
        entries: sortedEntries,
        totalParticipants: sortedEntries.length,
        totalRookies,
        rookiesWithoutStandards,
        currentUserName,
        leaderStats: Array.from(leaderStats.entries()).map(([leader, stats]) => ({
          leader,
          ...stats,
          avgScore: stats.rookieCount > 0 ? Math.round(stats.totalScore / stats.rookieCount) : 0,
        })).sort((a, b) => b.totalScore - a.totalScore),
      };
    },
    staleTime: 2 * 60 * 1000,
  });
};
