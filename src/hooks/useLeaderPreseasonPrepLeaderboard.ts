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
  id: string; // Supabase UUID - primary identifier
  userId: string | null; // null for ghost reps
  name: string;
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
  const { data: teamAccess, isLoading: isLoadingTeamAccess } = useTeamAccess();
  
  // Only run when teamAccess is fully loaded and has accessibleReps
  const hasAccessibleReps = teamAccess?.accessibleReps && teamAccess.accessibleReps.length > 0;
  
  return useQuery({
    queryKey: ['leader-preseason-prep-leaderboard-weekly', metric, showMyTeamOnly, hasAccessibleReps ? teamAccess.accessibleReps.length : 0],
    queryFn: async () => {
      // Get current user's rep data first
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Fetch current user's info (for team filtering and name)
      const { data: currentUserRep } = await supabase
        .from('reps')
        .select('name, team_leader, id')
        .eq('user_id', currentUserId || '')
        .single();

      const currentUserName = currentUserRep?.name || '';
      const currentUserRepId = currentUserRep?.id || '';

      // Get ALL qualifying rookies from team access (includes Notion-only reps)
      // This gives us rookies who may not have a Supabase account yet
      const accessibleRookies = (teamAccess?.accessibleReps || []).filter(r => 
        r.year === 'Rookie' || r.year === '2026' || r.year === '2025' || !r.year
      );

      // Get all rookie notion page IDs we have access to
      const accessibleNotionIds = new Set(accessibleRookies.map(r => r.id));

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
          role_plays_goal,
          monday_night_lights_progress,
          monday_night_lights_goal,
          prep_score_history
        `);

      if (goalsError) throw goalsError;

      // Create a map of user_id to goals
      const goalsMap = new Map(goalsData?.map(g => [g.user_id, g]) || []);

      // Fetch all reps data from Supabase (for those who have accounts)
      const { data: repsData, error: repsError } = await supabase
        .from('reps')
        .select('user_id, name, timezone, id, year, profile_photo_url, team_leader, stage, ramp_phase_1_complete');

      if (repsError) throw repsError;

      // Create a map of id to rep data
      const repsById = new Map(repsData?.map(r => [r.id, r]) || []);

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
        id: string;
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
        const supabaseRep = repsById.get(accessRep.id);
        // Check if we have Notion recruit data
        const notionRecruit = recruitsByNotionId.get(accessRep.id);

        // Determine stage - prefer Supabase rep stage (source of truth), fallback to Notion recruit
        const stage = supabaseRep?.stage || notionRecruit?.stage || '';
        
        // Check if in valid stage
        if (!VALID_STAGES.includes(stage)) continue;

        // Check if phase 1 complete - prefer Supabase boolean, fallback to Notion recruit
        const phase1Complete = supabaseRep?.ramp_phase_1_complete ?? notionRecruit?.phase1Complete ?? false;
        
        // Must have phase 1 complete to appear in leaderboard
        if (!phase1Complete) continue;
        
        qualifyingRookies.push({
          id: accessRep.id,
          name: accessRep.name,
          teamName: accessRep.teamName || null,
          mgmtGroupName: accessRep.mgmtGroupName || null,
          userId: supabaseRep?.user_id || null,
          stage,
          phase1Complete,
          isGhostRep: !supabaseRep?.user_id,
        });
      }

      // If showMyTeamOnly, filter to only rookies that belong to current user
      // Check team_leader, recruiter, and also compare against current user's team
      let filteredRookies = qualifyingRookies;
      if (showMyTeamOnly && currentUserName) {
        const currentUserFirstName = currentUserName.split(' ')[0].toLowerCase();
        const currentUserFullNameLower = currentUserName.toLowerCase();
        
        // Get current user's team from accessibleReps to find their team name
        const currentUserAccessRep = accessibleRookies.find(r => 
          r.name.toLowerCase() === currentUserFullNameLower
        );
        const currentUserTeamName = currentUserAccessRep?.teamName?.toLowerCase() || '';
        
        filteredRookies = qualifyingRookies.filter(r => {
          // Check Notion recruit data for recruiter info
          const notionRecruit = recruitsByNotionId.get(r.id);
          const recruiterFromNotion = notionRecruit?.recruiter || '';
          
          // Check Supabase rep data for team_leader
          const supabaseRep = repsById.get(r.id);
          const teamLeader = supabaseRep?.team_leader || '';
          
          // Check the accessRep's teamName from the teamAccess data
          const accessRep = accessibleRookies.find(ar => ar.id === r.id);
          const repTeamName = (accessRep?.teamName || r.teamName || '').toLowerCase();
          
          // Match if:
          // 1. Current user is their team_leader
          // 2. Current user is their recruiter  
          // 3. Current user's name appears in recruiter field
          // 4. Rep's team matches current user's team (if current user has a team)
          const matchesTeamLeader = teamLeader.toLowerCase().includes(currentUserFirstName);
          const matchesRecruiter = recruiterFromNotion.toLowerCase().includes(currentUserFirstName);
          const matchesRecruiterFullName = recruiterFromNotion.toLowerCase().includes(currentUserFullNameLower);
          const matchesTeamName = currentUserTeamName && repTeamName === currentUserTeamName;
          
          // Also check if current user's name is the team leader in Notion data
          const notionTeamLeader = (notionRecruit?.teamLeader || '').toLowerCase();
          const matchesNotionTeamLeader = notionTeamLeader.includes(currentUserFirstName);
          
          return matchesTeamLeader || matchesRecruiter || matchesRecruiterFullName || matchesTeamName || matchesNotionTeamLeader;
        });
        
        console.log('[LeaderPreseasonPrepLeaderboard] My Team filter:', {
          currentUserName,
          currentUserFirstName,
          currentUserTeamName,
          totalQualifying: qualifyingRookies.length,
          filteredCount: filteredRookies.length,
          filteredNames: filteredRookies.map(r => r.name),
          sampleRookieData: qualifyingRookies.slice(0, 3).map(r => {
            const notionRecruit = recruitsByNotionId.get(r.id);
            const supabaseRep = repsById.get(r.id);
            return {
              name: r.name,
              teamName: r.teamName,
              teamLeader: supabaseRep?.team_leader,
              notionRecruiter: notionRecruit?.recruiter,
              notionTeamLeader: notionRecruit?.teamLeader,
            };
          }),
        });
      }

      // Count totals
      const totalRookies = filteredRookies.length;
      
      // Build entries
      const entries: LeaderboardEntry[] = [];
      let rookiesWithStandardsCount = 0;

      for (const rookie of filteredRookies) {
        const supabaseRep = repsById.get(rookie.id);
        const goal = rookie.userId ? goalsMap.get(rookie.userId) : null;
        const hasStandards = goal?.setup_complete === true;

        // Count rookies with preseason commitments (MNL, role-plays, training, or books goals)
        // NOT based on blitz commitments - only preseason prep goals
        const hasPreseasonCommitments = (
          (goal?.monday_night_lights_goal || 0) > 0 ||
          (goal?.role_plays_goal || 0) > 0 ||
          (goal?.training_hours_goal || 0) > 0 ||
          (goal?.books_goal || 0) > 0
        );

        if (hasPreseasonCommitments) {
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
          id: rookie.id,
          userId: rookie.userId,
          name: rookie.name,
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
    // Only enable when teamAccess is loaded AND has accessibleReps
    enabled: !!teamAccess && hasAccessibleReps,
  });
};
