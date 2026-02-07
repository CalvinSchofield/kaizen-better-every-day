import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, parseISO } from "date-fns";
import { Challenge } from "./useChallenges";
import { Incentive } from "./useIncentives";

export interface Rival {
  userId: string;
  name: string;
  profilePhotoUrl?: string;
  wins: number;
  losses: number;
  ties: number;
  total: number;
  lastChallengeDate: string;
  currentStreak: number; // Positive = win streak, negative = loss streak
  metrics: Record<string, { wins: number; losses: number }>; // Per-metric breakdown
}

export interface MonthlyGroup {
  month: string; // "2026-02"
  label: string; // "February 2026"
  challenges: Challenge[];
  incentives: Incentive[];
  stats: {
    totalChallenges: number;
    wins: number;
    losses: number;
    ties: number;
    winRate: number;
    totalIncentives: number;
    incentivesWon: number;
  };
}

export interface CompetitionHistoryData {
  monthlyGroups: MonthlyGroup[];
  rivalries: Rival[];
  overallStats: {
    totalChallenges: number;
    challengeWins: number;
    challengeLosses: number;
    challengeTies: number;
    challengeWinRate: number;
    currentWinStreak: number;
    longestWinStreak: number;
    totalIncentives: number;
    incentivesWon: number;
  };
}

export const useCompetitionHistory = () => {
  return useQuery({
    queryKey: ['competition-history'],
    queryFn: async (): Promise<CompetitionHistoryData> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch all completed/declined/voided challenges where user is a participant
      const { data: myParticipations } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', user.id);

      const challengeIds = myParticipations?.map(p => p.challenge_id) || [];

      const { data: challenges } = await supabase
        .from('challenges')
        .select(`
          *,
          challenge_participants (
            id,
            user_id,
            team,
            role,
            accepted,
            final_value
          )
        `)
        .in('id', challengeIds)
        .in('status', ['completed', 'declined', 'voided'])
        .order('completed_at', { ascending: false })
        .limit(100);

      // Fetch all completed/cancelled incentives where user is eligible
      const { data: myEligibility } = await supabase
        .from('incentive_eligible_reps')
        .select('incentive_id')
        .eq('user_id', user.id);

      const incentiveIds = myEligibility?.map(e => e.incentive_id) || [];

      const { data: incentives } = await supabase
        .from('incentives')
        .select(`
          *,
          incentive_eligible_reps (
            id,
            user_id
          )
        `)
        .in('id', incentiveIds)
        .in('status', ['completed', 'cancelled'])
        .order('completed_at', { ascending: false })
        .limit(50);

      // Get rep names for all users
      const userIds = new Set<string>();
      challenges?.forEach(c => {
        userIds.add(c.created_by);
        c.challenge_participants?.forEach((p: any) => userIds.add(p.user_id));
      });
      incentives?.forEach(i => {
        userIds.add(i.created_by);
        i.incentive_eligible_reps?.forEach((r: any) => userIds.add(r.user_id));
      });

      const { data: reps } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url')
        .in('user_id', Array.from(userIds));

      const repMap = new Map(reps?.map(r => [r.user_id, r]) || []);

      // Enrich challenges with names
      const enrichedChallenges = (challenges || []).map(c => ({
        ...c,
        creator_name: repMap.get(c.created_by)?.name || 'Unknown',
        participants: c.challenge_participants?.map((p: any) => ({
          ...p,
          rep_name: repMap.get(p.user_id)?.name || 'Unknown',
          profile_photo_url: repMap.get(p.user_id)?.profile_photo_url,
        })),
      })) as Challenge[];

      // Enrich incentives
      const enrichedIncentives = (incentives || []).map(i => ({
        ...i,
        creator_name: repMap.get(i.created_by)?.name || 'Unknown',
        eligible_count: i.incentive_eligible_reps?.length || 0,
        eligible_reps: i.incentive_eligible_reps?.map((r: any) => ({
          ...r,
          rep_name: repMap.get(r.user_id)?.name || 'Unknown',
          profile_photo_url: repMap.get(r.user_id)?.profile_photo_url,
        })),
      })) as Incentive[];

      // Calculate rivalries (head-to-head records)
      const rivalryMap = new Map<string, Rival>();

      enrichedChallenges.forEach(c => {
        if (c.status !== 'completed' || c.type !== '1v1') return;
        
        const myParticipant = c.participants?.find(p => p.user_id === user.id);
        const opponent = c.participants?.find(p => p.user_id !== user.id);
        
        if (!opponent?.user_id || !myParticipant) return;

        const isWin = c.winner_user_id === user.id;
        const isLoss = c.winner_user_id && c.winner_user_id !== user.id;
        const isTie = c.is_tie && !c.tiebreaker_winner_id;

        let rival = rivalryMap.get(opponent.user_id);
        if (!rival) {
          rival = {
            userId: opponent.user_id,
            name: opponent.rep_name || 'Unknown',
            profilePhotoUrl: opponent.profile_photo_url,
            wins: 0,
            losses: 0,
            ties: 0,
            total: 0,
            lastChallengeDate: c.completed_at || c.end_date,
            currentStreak: 0,
            metrics: {},
          };
          rivalryMap.set(opponent.user_id, rival);
        }

        rival.total++;
        if (isWin) rival.wins++;
        else if (isLoss) rival.losses++;
        else if (isTie) rival.ties++;

        // Track per-metric stats
        if (!rival.metrics[c.metric]) {
          rival.metrics[c.metric] = { wins: 0, losses: 0 };
        }
        if (isWin) rival.metrics[c.metric].wins++;
        else if (isLoss) rival.metrics[c.metric].losses++;

        // Update last challenge date
        if (c.completed_at && c.completed_at > rival.lastChallengeDate) {
          rival.lastChallengeDate = c.completed_at;
        }
      });

      // Calculate current streak per rival (based on chronological order)
      rivalryMap.forEach(rival => {
        const rivalChallenges = enrichedChallenges
          .filter(c => 
            c.status === 'completed' && 
            c.type === '1v1' &&
            c.participants?.some(p => p.user_id === rival.userId)
          )
          .sort((a, b) => (b.completed_at || b.end_date).localeCompare(a.completed_at || a.end_date));

        let streak = 0;
        for (const c of rivalChallenges) {
          const isWin = c.winner_user_id === user.id;
          const isLoss = c.winner_user_id && c.winner_user_id !== user.id;
          
          if (streak === 0) {
            streak = isWin ? 1 : (isLoss ? -1 : 0);
          } else if (streak > 0 && isWin) {
            streak++;
          } else if (streak < 0 && isLoss) {
            streak--;
          } else {
            break; // Streak ended
          }
        }
        rival.currentStreak = streak;
      });

      const rivalries = Array.from(rivalryMap.values())
        .filter(r => r.total >= 2) // Only show rivalries with 2+ matchups
        .sort((a, b) => b.total - a.total);

      // Group by month
      const monthMap = new Map<string, MonthlyGroup>();

      enrichedChallenges.forEach(c => {
        const date = c.completed_at || c.end_date;
        const monthKey = format(parseISO(date), 'yyyy-MM');
        
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            month: monthKey,
            label: format(parseISO(date), 'MMMM yyyy'),
            challenges: [],
            incentives: [],
            stats: {
              totalChallenges: 0,
              wins: 0,
              losses: 0,
              ties: 0,
              winRate: 0,
              totalIncentives: 0,
              incentivesWon: 0,
            },
          });
        }

        const group = monthMap.get(monthKey)!;
        group.challenges.push(c);
        group.stats.totalChallenges++;

        // Calculate win/loss for this user
        const myParticipant = c.participants?.find(p => p.user_id === user.id);
        if (c.status === 'completed') {
          if (c.winner_user_id === user.id) {
            group.stats.wins++;
          } else if (c.is_tie && !c.tiebreaker_winner_id) {
            group.stats.ties++;
          } else if (c.winner_user_id) {
            group.stats.losses++;
          }
        }
      });

      enrichedIncentives.forEach(i => {
        const date = i.completed_at || i.end_date;
        const monthKey = format(parseISO(date), 'yyyy-MM');
        
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            month: monthKey,
            label: format(parseISO(date), 'MMMM yyyy'),
            challenges: [],
            incentives: [],
            stats: {
              totalChallenges: 0,
              wins: 0,
              losses: 0,
              ties: 0,
              winRate: 0,
              totalIncentives: 0,
              incentivesWon: 0,
            },
          });
        }

        const group = monthMap.get(monthKey)!;
        group.incentives.push(i);
        group.stats.totalIncentives++;

        // Check if user won
        const winnerIds = Array.isArray(i.winner_user_ids) ? i.winner_user_ids : [];
        if (i.winner_user_id === user.id || winnerIds.includes(user.id)) {
          group.stats.incentivesWon++;
        }
      });

      // Calculate win rates
      monthMap.forEach(group => {
        const played = group.stats.wins + group.stats.losses + group.stats.ties;
        group.stats.winRate = played > 0 ? Math.round((group.stats.wins / played) * 100) : 0;
      });

      const monthlyGroups = Array.from(monthMap.values())
        .sort((a, b) => b.month.localeCompare(a.month));

      // Calculate overall stats
      let totalChallenges = 0;
      let challengeWins = 0;
      let challengeLosses = 0;
      let challengeTies = 0;

      enrichedChallenges.forEach(c => {
        if (c.status !== 'completed') return;
        totalChallenges++;
        if (c.winner_user_id === user.id) challengeWins++;
        else if (c.is_tie && !c.tiebreaker_winner_id) challengeTies++;
        else if (c.winner_user_id) challengeLosses++;
      });

      // Calculate current and longest win streak
      const sortedCompleted = enrichedChallenges
        .filter(c => c.status === 'completed')
        .sort((a, b) => (b.completed_at || b.end_date).localeCompare(a.completed_at || a.end_date));

      let currentWinStreak = 0;
      let longestWinStreak = 0;
      let tempStreak = 0;

      for (const c of sortedCompleted) {
        if (c.winner_user_id === user.id) {
          tempStreak++;
          if (currentWinStreak === 0) currentWinStreak = tempStreak;
          longestWinStreak = Math.max(longestWinStreak, tempStreak);
        } else {
          if (currentWinStreak > 0 && tempStreak < currentWinStreak) {
            // Streak already counted
          } else if (currentWinStreak === 0) {
            currentWinStreak = 0; // User started with a loss
          }
          tempStreak = 0;
        }
      }

      // Recalculate current streak properly
      currentWinStreak = 0;
      for (const c of sortedCompleted) {
        if (c.winner_user_id === user.id) {
          currentWinStreak++;
        } else {
          break;
        }
      }

      let totalIncentives = enrichedIncentives.filter(i => i.status === 'completed').length;
      let incentivesWon = 0;

      enrichedIncentives.forEach(i => {
        if (i.status !== 'completed') return;
        const winnerIds = Array.isArray(i.winner_user_ids) ? i.winner_user_ids : [];
        if (i.winner_user_id === user.id || winnerIds.includes(user.id)) {
          incentivesWon++;
        }
      });

      const played = challengeWins + challengeLosses + challengeTies;
      const challengeWinRate = played > 0 ? Math.round((challengeWins / played) * 100) : 0;

      return {
        monthlyGroups,
        rivalries,
        overallStats: {
          totalChallenges,
          challengeWins,
          challengeLosses,
          challengeTies,
          challengeWinRate,
          currentWinStreak,
          longestWinStreak,
          totalIncentives,
          incentivesWon,
        },
      };
    },
    staleTime: 60 * 1000, // 1 minute
  });
};

// Hook to get head-to-head record with a specific opponent
export const useHeadToHeadRecord = (opponentUserId?: string) => {
  return useQuery({
    queryKey: ['head-to-head', opponentUserId],
    queryFn: async () => {
      if (!opponentUserId) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find challenges where both users are participants
      const { data: myParticipations } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', user.id);

      const { data: theirParticipations } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', opponentUserId);

      const myIds = new Set(myParticipations?.map(p => p.challenge_id) || []);
      const sharedIds = theirParticipations
        ?.filter(p => myIds.has(p.challenge_id))
        .map(p => p.challenge_id) || [];

      if (sharedIds.length === 0) {
        return { wins: 0, losses: 0, ties: 0, total: 0, recentResults: [] };
      }

      const { data: challenges } = await supabase
        .from('challenges')
        .select('id, status, winner_user_id, is_tie, tiebreaker_winner_id, metric, completed_at, end_date')
        .in('id', sharedIds)
        .eq('status', 'completed')
        .eq('type', '1v1')
        .order('completed_at', { ascending: false });

      let wins = 0;
      let losses = 0;
      let ties = 0;

      const recentResults: Array<{ won: boolean; tied: boolean; metric: string; date: string }> = [];

      challenges?.forEach(c => {
        const isWin = c.winner_user_id === user.id;
        const isLoss = c.winner_user_id && c.winner_user_id !== user.id;
        const isTie = c.is_tie && !c.tiebreaker_winner_id;

        if (isWin) wins++;
        else if (isLoss) losses++;
        else if (isTie) ties++;

        if (recentResults.length < 5) {
          recentResults.push({
            won: isWin,
            tied: isTie,
            metric: c.metric,
            date: c.completed_at || c.end_date,
          });
        }
      });

      return {
        wins,
        losses,
        ties,
        total: wins + losses + ties,
        recentResults,
      };
    },
    enabled: !!opponentUserId,
    staleTime: 60 * 1000,
  });
};
