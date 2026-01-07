import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Challenge, ChallengeMetric } from "./useChallenges";
import { format } from "date-fns";

interface ParticipantProgress {
  user_id: string;
  rep_name: string;
  profile_photo_url?: string;
  team: 'a' | 'b' | null;
  current_value: number;
}

interface TeamProgress {
  team: 'a' | 'b';
  members: ParticipantProgress[];
  total_value: number;
}

export interface ChallengeProgressData {
  challenge: Challenge;
  participants: ParticipantProgress[];
  teams?: {
    a: TeamProgress;
    b: TeamProgress;
  };
  leader: ParticipantProgress | null;
  isUserAhead: boolean;
  userProgress: ParticipantProgress | null;
  gap: number;
  timeRemaining: string;
}

const getMetricColumn = (metric: ChallengeMetric): string => {
  switch (metric) {
    case 'fp_plus': return 'fp_plus';
    case 'prmr': return 'prmr';
    case 'transitions': return 'transitions';
    case 'doors_knocked': return 'doors_knocked';
    default: return 'fp_plus';
  }
};

export const useChallengeProgress = (challenge: Challenge | null) => {
  return useQuery({
    queryKey: ['challenge-progress', challenge?.id],
    queryFn: async () => {
      if (!challenge) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get all participant user IDs
      const participantUserIds = challenge.participants?.map(p => p.user_id) || [];
      if (!participantUserIds.length) return null;

      // Fetch daily entries for the challenge period
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('user_id, fp_plus, prmr, transitions, doors_knocked, entry_date')
        .in('user_id', participantUserIds)
        .gte('entry_date', challenge.start_date)
        .lte('entry_date', challenge.end_date);

      if (error) throw error;

      // Aggregate values per user
      const metricColumn = getMetricColumn(challenge.metric);
      const userTotals = new Map<string, number>();

      entries?.forEach(entry => {
        const value = (entry as any)[metricColumn] || 0;
        userTotals.set(
          entry.user_id,
          (userTotals.get(entry.user_id) || 0) + value
        );
      });

      // Build participant progress
      const participants: ParticipantProgress[] = (challenge.participants || []).map(p => ({
        user_id: p.user_id,
        rep_name: p.rep_name || 'Unknown',
        profile_photo_url: p.profile_photo_url,
        team: p.team,
        current_value: userTotals.get(p.user_id) || 0,
      }));

      // Sort by value descending
      participants.sort((a, b) => b.current_value - a.current_value);

      // Build team progress for group challenges
      let teams: { a: TeamProgress; b: TeamProgress } | undefined;
      if (challenge.type === 'group') {
        const teamA = participants.filter(p => p.team === 'a');
        const teamB = participants.filter(p => p.team === 'b');
        
        teams = {
          a: {
            team: 'a',
            members: teamA,
            total_value: teamA.reduce((sum, p) => sum + p.current_value, 0),
          },
          b: {
            team: 'b',
            members: teamB,
            total_value: teamB.reduce((sum, p) => sum + p.current_value, 0),
          },
        };
      }

      const leader = participants[0] || null;
      const userProgress = participants.find(p => p.user_id === user.id) || null;
      const isUserAhead = userProgress === leader;
      
      // Calculate gap
      let gap = 0;
      if (userProgress && leader && userProgress !== leader) {
        gap = leader.current_value - userProgress.current_value;
      }

      // Calculate time remaining
      const now = new Date();
      const endDate = new Date(challenge.end_date);
      endDate.setHours(23, 59, 59, 999);
      
      const diffMs = endDate.getTime() - now.getTime();
      let timeRemaining = 'Ended';
      
      if (diffMs > 0) {
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
          timeRemaining = `${days}d ${hours % 24}h left`;
        } else if (hours > 0) {
          timeRemaining = `${hours}h left`;
        } else {
          const minutes = Math.floor(diffMs / (1000 * 60));
          timeRemaining = `${minutes}m left`;
        }
      }

      return {
        challenge,
        participants,
        teams,
        leader,
        isUserAhead,
        userProgress,
        gap,
        timeRemaining,
      } as ChallengeProgressData;
    },
    enabled: !!challenge && challenge.status === 'active',
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for live updates
    staleTime: 10 * 1000,
  });
};
