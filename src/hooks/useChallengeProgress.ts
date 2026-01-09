import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Challenge, ChallengeMetric } from "./useChallenges";
import { useEffect } from "react";
import { toZonedTime } from "date-fns-tz";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";
// Get the timezone offset in minutes for a given timezone
// More negative = further west = later in the day
const getTimezoneOffset = (timezone: string): number => {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return (tzDate.getTime() - utcDate.getTime()) / 60000;
  } catch {
    return 0;
  }
};

// Find the westernmost (latest) timezone among a list
const getLatestTimezone = (timezones: (string | null | undefined)[]): string => {
  const validTimezones = timezones.filter(Boolean) as string[];
  if (validTimezones.length === 0) return Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  return validTimezones.reduce((latest, tz) => {
    return getTimezoneOffset(tz) < getTimezoneOffset(latest) ? tz : latest;
  });
};

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

export const useChallengeProgress = (challenge: Challenge | null, options?: { includePending?: boolean }) => {
  const queryClient = useQueryClient();
  const includePending = options?.includePending ?? false;

  // Set up realtime subscription for live updates (only for active challenges)
  useEffect(() => {
    if (!challenge || challenge.status !== 'active') return;

    const participantUserIds = challenge.participants?.map(p => p.user_id) || [];
    if (!participantUserIds.length) return;

    // Subscribe to daily_entries changes for challenge participants
    const channel = supabase
      .channel(`challenge-progress-${challenge.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_entries',
          filter: `user_id=in.(${participantUserIds.join(',')})`,
        },
        (payload) => {
          console.log('[Realtime] Daily entry changed:', payload);
          // Invalidate the query to refetch fresh data
          queryClient.invalidateQueries({ 
            queryKey: ['challenge-progress', challenge.id] 
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'challenges',
          filter: `id=eq.${challenge.id}`,
        },
        (payload) => {
          console.log('[Realtime] Challenge changed:', payload);
          // Invalidate both challenge progress and challenges list
          queryClient.invalidateQueries({ 
            queryKey: ['challenge-progress', challenge.id] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['challenges'] 
          });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Challenge progress subscription:', status);
      });

    return () => {
      console.log('[Realtime] Unsubscribing from challenge progress');
      supabase.removeChannel(channel);
    };
  }, [challenge?.id, challenge?.status, challenge?.participants, queryClient]);

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
        .select('user_id, fp_plus, prmr, transitions, doors_knocked, entry_date, sales_log, is_finalized')
        .in('user_id', participantUserIds)
        .gte('entry_date', challenge.start_date)
        .lte('entry_date', challenge.end_date);

      if (error) throw error;

      // Fetch participant timezones for "latest" end time calculation
      const { data: repTimezones } = await supabase
        .from('reps')
        .select('user_id, timezone')
        .in('user_id', participantUserIds);
      
      const participantTimezones = repTimezones?.map(r => r.timezone) || [];

      // Aggregate values per user
      const metricColumn = getMetricColumn(challenge.metric);
      const userTotals = new Map<string, number>();

      entries?.forEach(entry => {
        let value = 0;
        const isFinalized = entry.is_finalized;
        const salesLog = entry.sales_log as any[] | null;
        
        if (challenge.metric === 'fp_plus') {
          if (isFinalized) {
            value = entry.fp_plus || 0;
          } else {
            const fromLog = calculateFromSalesLog(salesLog || []);
            const fromColumn = entry.fp_plus || 0;
            value = (salesLog && salesLog.length > 0) ? fromLog.fp : fromColumn;
          }
        } else if (challenge.metric === 'prmr') {
          if (isFinalized) {
            value = entry.prmr || 0;
          } else {
            const fromLog = calculateFromSalesLog(salesLog || []);
            const fromColumn = entry.prmr || 0;
            value = (salesLog && salesLog.length > 0) ? fromLog.prmr : fromColumn;
          }
        } else {
          // transitions, doors_knocked - use column directly
          value = (entry as any)[metricColumn] || 0;
        }
        
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

      // Calculate time remaining using the latest participant timezone
      const latestTimezone = getLatestTimezone(participantTimezones);
      const [year, month, day] = challenge.end_date.split('-').map(Number);
      
      // Compare "now" in the latest timezone to end of day in that timezone
      const nowInLatestTz = toZonedTime(new Date(), latestTimezone);
      const endDateInLatestTz = new Date(year, month - 1, day, 23, 59, 59, 999);
      
      const diffMs = endDateInLatestTz.getTime() - nowInLatestTz.getTime();
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
    enabled: !!challenge && (challenge.status === 'active' || (includePending && challenge.status === 'pending')),
    staleTime: 30 * 1000, // 30 seconds - ensures quick refresh after mutations
  });
};
