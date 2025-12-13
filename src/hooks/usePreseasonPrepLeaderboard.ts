import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTrainingPaceStatus, getWeekStartDateString } from "@/utils/timezoneUtils";
import { useTeamAccess } from "@/hooks/useTeamAccess";

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
  teamName?: string | null;
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
  // Whether they have standards set up
  hasStandards: boolean;
}

// Valid stages for preseason prep tracking (Signed and beyond)
const VALID_STAGES = ['Signed', 'Shadow ✅', 'Sold 💲', 'Sold (5+) 💰'];

export const usePreseasonPrepLeaderboard = (metric: LeaderboardMetric = 'overall') => {
  const { data: teamAccess } = useTeamAccess();
  
  const { data: currentUserId } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
  });

  return useQuery({
    queryKey: ['preseason-prep-leaderboard-weekly', metric, currentUserId, teamAccess?.accessibleReps?.length],
    queryFn: async () => {
      // Check if current user has setup_complete (separate query)
      let currentUserHasStandards = false;
      if (currentUserId) {
        const { data: currentUserGoals } = await supabase
          .from('rep_goals')
          .select('setup_complete')
          .eq('user_id', currentUserId)
          .single();
        currentUserHasStandards = currentUserGoals?.setup_complete || false;
      }

      // Get all rookies from Notion-based team access data (source of truth for who qualifies)
      const notionRookies = (teamAccess?.accessibleReps || []).filter(rep => {
        const isRookie = rep.year === 'Rookie' || rep.year === '2026' || rep.year === '2025' || !rep.year;
        return isRookie;
      });

      // Fetch all rep_goals data from Supabase
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
        `);

      if (goalsError) throw goalsError;

      // Fetch rep info for profile photos and timezones (for those in Supabase)
      const { data: repsData, error: repsError } = await supabase
        .from('reps')
        .select('user_id, name, timezone, notion_page_id, profile_photo_url, stage, ramp_phase_1_complete');

      if (repsError) throw repsError;

      // Create lookup maps
      const goalsMap = new Map(goalsData?.map(g => [g.user_id, g]) || []);
      const repsMap = new Map(repsData?.map(r => [r.user_id, r]) || []);

      // Also include current user if they're a rookie with standards (even if not in accessibleReps)
      const currentUserRep = repsData?.find(r => r.user_id === currentUserId);
      const currentUserIsRookie = currentUserRep && 
        VALID_STAGES.includes(currentUserRep.stage || '') &&
        currentUserRep.ramp_phase_1_complete === true;

      const entries: LeaderboardEntry[] = [];
      const processedUserIds = new Set<string>();
      let rookiesWithStandards = 0;
      let rookiesWithoutStandards = 0;

      // Process all Notion-based rookies
      for (const notionRep of notionRookies) {
        if (!notionRep.userId) continue;
        
        // Get Supabase rep data if exists
        const rep = repsMap.get(notionRep.userId);
        
        // Check stage from Supabase or use Notion as fallback
        const stage = rep?.stage;
        if (!stage || !VALID_STAGES.includes(stage)) continue;
        
        // Check phase 1 complete
        if (!rep?.ramp_phase_1_complete) continue;

        processedUserIds.add(notionRep.userId);

        const goal = goalsMap.get(notionRep.userId);
        const hasStandards = goal?.setup_complete === true;
        
        if (hasStandards) {
          rookiesWithStandards++;
        } else {
          rookiesWithoutStandards++;
        }

        const timezone = rep?.timezone || 'America/Los_Angeles';
        const currentWeekStart = getWeekStartDateString(timezone);
        const trainingGoalMinutes = (goal?.training_hours_goal || 0) * 60;

        // Current cumulative values (defaults for those without standards)
        const totalBooks = goal?.books_progress || 0;
        const currentTraining = goal?.training_hours_progress || 0;
        const currentRoleplays = goal?.role_plays_progress || 0;
        const currentMnl = goal?.monday_night_lights_progress || 0;

        // Get last week's snapshot to calculate this week's delta
        const rawHistory = goal?.prep_score_history;
        const history: PrepScoreHistory[] = Array.isArray(rawHistory) 
          ? (rawHistory as unknown as PrepScoreHistory[]) 
          : [];
        
        // Find the most recent week that's NOT the current week
        const previousWeek = history
          .filter(h => h.week_start !== currentWeekStart)
          .sort((a, b) => b.week_start.localeCompare(a.week_start))[0];

        // Calculate this week's activity
        const weeklyTraining = currentTraining;
        const weeklyRoleplays = previousWeek
          ? Math.max(0, currentRoleplays - (previousWeek.breakdown?.roleplays || 0))
          : currentRoleplays;
        const weeklyMnl = previousWeek
          ? Math.max(0, currentMnl - (previousWeek.breakdown?.mnl || 0))
          : currentMnl;

        // Calculate weekly prep score
        const weeklyPrepScore = Math.round(
          ((weeklyTraining / 60) * POINTS.training) +
          (weeklyRoleplays * POINTS.roleplays) +
          (weeklyMnl * POINTS.mnl)
        );

        entries.push({
          userId: notionRep.userId,
          name: notionRep.name || rep?.name || 'Unknown',
          notionPageId: notionRep.notionPageId || rep?.notion_page_id || null,
          timezone,
          profilePhotoUrl: rep?.profile_photo_url || null,
          teamName: notionRep.teamName || null,
          weeklyPrepScore,
          totalBooks,
          booksGoal: goal?.books_goal || 0,
          weeklyTraining,
          weeklyRoleplays,
          weeklyMnl,
          trainingGoal: trainingGoalMinutes,
          trainingPaceStatus: hasStandards ? getTrainingPaceStatus(
            weeklyTraining,
            trainingGoalMinutes,
            timezone
          ) : 'no-goal',
          hasStandards,
        });
      }

      // Include current user if they're a rookie but not in accessibleReps (e.g., rookie viewing themselves)
      if (currentUserId && currentUserIsRookie && !processedUserIds.has(currentUserId)) {
        const goal = goalsMap.get(currentUserId);
        const hasStandards = goal?.setup_complete === true;
        
        if (hasStandards) {
          rookiesWithStandards++;
        } else {
          rookiesWithoutStandards++;
        }
        
        const timezone = currentUserRep?.timezone || 'America/Los_Angeles';
        const currentWeekStart = getWeekStartDateString(timezone);
        const trainingGoalMinutes = (goal?.training_hours_goal || 0) * 60;

        const totalBooks = goal?.books_progress || 0;
        const currentTraining = goal?.training_hours_progress || 0;
        const currentRoleplays = goal?.role_plays_progress || 0;
        const currentMnl = goal?.monday_night_lights_progress || 0;

        const rawHistory = goal?.prep_score_history;
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
          userId: currentUserId,
          name: currentUserRep.name,
          notionPageId: currentUserRep.notion_page_id,
          timezone,
          profilePhotoUrl: currentUserRep.profile_photo_url,
          teamName: null,
          weeklyPrepScore,
          totalBooks,
          booksGoal: goal?.books_goal || 0,
          weeklyTraining,
          weeklyRoleplays,
          weeklyMnl,
          trainingGoal: trainingGoalMinutes,
          trainingPaceStatus: hasStandards ? getTrainingPaceStatus(
            weeklyTraining,
            trainingGoalMinutes,
            timezone
          ) : 'no-goal',
          hasStandards,
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

      // Find current user's rank
      const currentUserRank = sortedEntries.findIndex(e => e.userId === currentUserId) + 1;
      const currentUserEntry = sortedEntries.find(e => e.userId === currentUserId);

      return {
        entries: sortedEntries,
        currentUserRank,
        currentUserEntry,
        currentUserHasStandards,
        totalParticipants: rookiesWithStandards,
        rookiesWithoutStandards,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: currentUserId !== undefined && teamAccess !== undefined,
  });
};
