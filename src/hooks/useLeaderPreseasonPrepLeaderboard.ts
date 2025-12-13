import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTrainingPaceStatus, getWeekStartDateString } from "@/utils/timezoneUtils";
import { useTeamAccess } from "./useTeamAccess";

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
  id: string; // notionPageId as unique identifier
  userId: string | null; // null for ghost reps
  name: string;
  notionPageId: string | null;
  timezone: string;
  profilePhotoUrl: string | null;
  teamLeader: string | null;
  teamName: string | null;
  isGhostRep: boolean;
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
  // Whether they have set up standards
  hasStandards: boolean;
}

// Valid stages for preseason prep tracking
const VALID_STAGES = ['Signed', 'Shadow ✅', 'Sold 💲', 'Sold (5+) 💰'];

export const useLeaderPreseasonPrepLeaderboard = (metric: LeaderboardMetric = 'overall', showMyTeamOnly: boolean = false) => {
  const { data: teamAccess } = useTeamAccess();
  
  return useQuery({
    queryKey: ['leader-preseason-prep-leaderboard-weekly', metric, showMyTeamOnly, teamAccess?.accessibleReps?.length],
    queryFn: async () => {
      // Get current user's rep data first
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Fetch current user's info (for team filtering and name)
      const { data: currentUserRep } = await supabase
        .from('reps')
        .select('name, team_leader, notion_page_id')
        .eq('user_id', currentUserId || '')
        .single();

      const currentUserName = currentUserRep?.name || '';

      // Get ALL qualifying rookies from team access (includes Notion-only reps)
      // This gives us rookies who may not have a Supabase account yet
      const accessibleRookies = (teamAccess?.accessibleReps || []).filter(r => 
        r.year === 'Rookie' || r.year === '2026' || r.year === '2025' || !r.year
      );

      // Get all rookie notion page IDs we have access to
      const accessibleNotionIds = new Set(accessibleRookies.map(r => r.notionPageId));

      // Fetch rep_goals for standards data
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

      // Create a map of user_id to goals
      const goalsMap = new Map(goalsData?.map(g => [g.user_id, g]) || []);

      // Fetch all reps data from Supabase (for those who have accounts)
      const { data: repsData, error: repsError } = await supabase
        .from('reps')
        .select('user_id, name, timezone, notion_page_id, year, profile_photo_url, team_leader, stage, ramp_phase_1_complete');

      if (repsError) throw repsError;

      // Create a map of notion_page_id to rep data
      const repsByNotionId = new Map(repsData?.map(r => [r.notion_page_id, r]) || []);

      // Also get fresh stage data from group recruits if available
      const { data: { session } } = await supabase.auth.getSession();
      let notionRecruits: any[] = [];
      
      if (session) {
        try {
          const { data: groupData } = await supabase.functions.invoke('fetch-group-recruits', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: { includeActivities: false },
          });
          notionRecruits = groupData?.recruits || [];
        } catch (e) {
          console.log('Could not fetch group recruits for leaderboard:', e);
        }
      }

      // Create map of notion page id to recruit data (includes stage)
      const recruitsByNotionId = new Map(notionRecruits.map((r: any) => [r.notionPageId, r]));

      // Build the list of qualifying rookies
      // A rookie qualifies if: they're a rookie AND in a valid stage AND have completed phase 1
      const qualifyingRookies: Array<{
        notionPageId: string;
        name: string;
        teamName: string | null;
        mgmtGroupName: string | null;
        userId: string | null;
        stage: string;
        phase1Complete: boolean;
        isGhostRep: boolean;
      }> = [];

      for (const accessRep of accessibleRookies) {
        // Check if we have Supabase data
        const supabaseRep = repsByNotionId.get(accessRep.notionPageId);
        // Check if we have Notion recruit data
        const notionRecruit = recruitsByNotionId.get(accessRep.notionPageId);

        // Determine stage - prefer Notion data (more current), fallback to Supabase
        const stage = notionRecruit?.stage || supabaseRep?.stage || '';
        
        // Check if in valid stage
        if (!VALID_STAGES.includes(stage)) continue;

        // Check if phase 1 complete - from Notion first, then Supabase
        const phase1Complete = notionRecruit?.phase1Complete ?? supabaseRep?.ramp_phase_1_complete ?? false;
        
        // Must have phase 1 complete to appear in leaderboard
        if (!phase1Complete) continue;
        
        qualifyingRookies.push({
          notionPageId: accessRep.notionPageId,
          name: accessRep.name,
          teamName: accessRep.teamName || null,
          mgmtGroupName: accessRep.mgmtGroupName || null,
          userId: supabaseRep?.user_id || null,
          stage,
          phase1Complete,
          isGhostRep: !supabaseRep?.user_id,
        });
      }

      // If showMyTeamOnly, filter to only rookies whose team_leader matches current user's name
      let filteredRookies = qualifyingRookies;
      if (showMyTeamOnly && currentUserName) {
        // Simple approach: filter to rookies whose team_leader contains the current user's name
        // This works for all access levels (team lead, MGMT lead, Area Director)
        filteredRookies = qualifyingRookies.filter(r => {
          const supabaseRep = repsByNotionId.get(r.notionPageId);
          const teamLeader = supabaseRep?.team_leader || '';
          // Check if team_leader matches current user's name (case-insensitive, partial match)
          const currentUserFirstName = currentUserName.split(' ')[0];
          return teamLeader.toLowerCase().includes(currentUserFirstName.toLowerCase());
        });
        
        console.log('[LeaderPreseasonPrepLeaderboard] My Team filter:', {
          currentUserName,
          currentUserFirstName: currentUserName.split(' ')[0],
          totalQualifying: qualifyingRookies.length,
          filteredCount: filteredRookies.length,
          filteredNames: filteredRookies.map(r => r.name),
        });
      }

      // Count totals
      const totalRookies = filteredRookies.length;
      
      // Build entries
      const entries: LeaderboardEntry[] = [];
      let rookiesWithStandardsCount = 0;

      for (const rookie of filteredRookies) {
        const supabaseRep = repsByNotionId.get(rookie.notionPageId);
        const goal = rookie.userId ? goalsMap.get(rookie.userId) : null;
        const hasStandards = goal?.setup_complete === true;

        if (hasStandards) {
          rookiesWithStandardsCount++;
        }

        const timezone = supabaseRep?.timezone || 'America/Los_Angeles';
        const currentWeekStart = getWeekStartDateString(timezone);
        const trainingGoalMinutes = (goal?.training_hours_goal || 0) * 60;

        // Current cumulative values (from goals if they exist)
        const totalBooks = goal?.books_progress || 0;
        const currentTraining = goal?.training_hours_progress || 0;
        const currentRoleplays = goal?.role_plays_progress || 0;
        const currentMnl = goal?.monday_night_lights_progress || 0;

        // Get last week's snapshot to calculate this week's delta
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
          id: rookie.notionPageId,
          userId: rookie.userId,
          name: rookie.name,
          notionPageId: rookie.notionPageId,
          timezone,
          profilePhotoUrl: supabaseRep?.profile_photo_url || null,
          teamLeader: supabaseRep?.team_leader || null,
          teamName: rookie.teamName,
          isGhostRep: rookie.isGhostRep,
          weeklyPrepScore,
          totalBooks,
          booksGoal: goal?.books_goal || 0,
          weeklyTraining,
          weeklyRoleplays,
          weeklyMnl,
          trainingGoal: trainingGoalMinutes,
          trainingPaceStatus: getTrainingPaceStatus(
            weeklyTraining,
            trainingGoalMinutes,
            timezone
          ),
          hasStandards,
        });
      }

      const rookiesWithoutStandards = totalRookies - rookiesWithStandardsCount;

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
        totalParticipants: rookiesWithStandardsCount, // Those who have set up standards
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
    enabled: !!teamAccess, // Wait for team access data
  });
};
