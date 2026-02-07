import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Incentive, IncentiveMetric, isIncentiveStillVisible } from "./useIncentives";
import { useEffect } from "react";
import { toZonedTime } from "date-fns-tz";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";
// Get the timezone offset in minutes for a given timezone
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

export interface ParticipantProgress {
  user_id: string;
  rep_name: string;
  profile_photo_url: string | null;
  current_value: number;
}

export interface IncentiveProgressData {
  incentive: Incentive;
  participants: ParticipantProgress[];
  groupTotal: number;
  targetValue: number;
  progressPercent: number;
  leader: ParticipantProgress | null;
  qualifiedParticipants: ParticipantProgress[]; // For 'anyone_who' type
  isCompleted: boolean;
  timeRemaining: string;
}

const getMetricColumn = (metric: IncentiveMetric): string => {
  switch (metric) {
    case 'fp_plus': return 'fp_plus';
    case 'prmr': return 'prmr';
    case 'transitions': return 'transitions';
    case 'doors_knocked': return 'doors_knocked';
    default: return 'fp_plus';
  }
};

export const useIncentiveProgress = (incentive: Incentive | null) => {
  const queryClient = useQueryClient();

  // Set up realtime subscription for daily entries
  useEffect(() => {
    if (!incentive) return;

    const channel = supabase
      .channel(`incentive-progress-${incentive.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_entries',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['incentive-progress', incentive.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [incentive?.id, queryClient]);

  return useQuery({
    queryKey: ['incentive-progress', incentive?.id],
    queryFn: async () => {
      if (!incentive) return null;

      // Get eligible user IDs
      const eligibleUserIds = incentive.eligible_reps?.map(r => r.user_id) || [];
      
      if (eligibleUserIds.length === 0) return null;

      // Get daily entries for the incentive date range
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('user_id, entry_date, fp_plus, prmr, transitions, doors_knocked, sales_log, is_finalized')
        .in('user_id', eligibleUserIds)
        .gte('entry_date', incentive.start_date)
        .lte('entry_date', incentive.end_date);

      if (error) throw error;

      // Fetch participant timezones for "latest" end time calculation
      const { data: repTimezones } = await supabase
        .from('reps')
        .select('user_id, timezone')
        .in('user_id', eligibleUserIds);
      
      const participantTimezones = repTimezones?.map(r => r.timezone) || [];

      const metricColumn = getMetricColumn(incentive.metric);

      // Aggregate values per user
      const userProgress: Record<string, number> = {};
      eligibleUserIds.forEach(userId => {
        userProgress[userId] = 0;
      });

      entries?.forEach(entry => {
        let value = 0;
        const salesLog = entry.sales_log as any[] | null;
        const hasSalesLog = salesLog && salesLog.length > 0;
        
        if (incentive.metric === 'fp_plus') {
          // Always prioritize sales_log if it has entries (regardless of finalization)
          if (hasSalesLog) {
            const fromLog = calculateFromSalesLog(salesLog);
            value = fromLog.fp;
          } else {
            value = entry.fp_plus || 0;
          }
        } else if (incentive.metric === 'prmr') {
          // Always prioritize sales_log if it has entries (regardless of finalization)
          if (hasSalesLog) {
            const fromLog = calculateFromSalesLog(salesLog);
            value = fromLog.prmr;
          } else {
            value = entry.prmr || 0;
          }
        } else {
          // transitions, doors_knocked - use column directly
          value = (entry as any)[metricColumn] || 0;
        }
        
        userProgress[entry.user_id] = (userProgress[entry.user_id] || 0) + value;
      });

      // Build participant progress
      const participants: ParticipantProgress[] = eligibleUserIds.map(userId => {
        const rep = incentive.eligible_reps?.find(r => r.user_id === userId);
        return {
          user_id: userId,
          rep_name: rep?.rep_name || 'Unknown',
          profile_photo_url: rep?.profile_photo_url || null,
          current_value: userProgress[userId] || 0,
        };
      }).sort((a, b) => b.current_value - a.current_value);

      // Calculate group total
      const groupTotal = participants.reduce((sum, p) => sum + p.current_value, 0);
      const targetValue = incentive.target_value || 1;

      // Calculate qualified participants for 'anyone_who' type
      const qualifiedParticipants = participants.filter(p => p.current_value >= targetValue);

      // Progress percent based on incentive type
      let progressPercent: number;
      if (incentive.target_type === 'group_total') {
        progressPercent = Math.min(100, (groupTotal / targetValue) * 100);
      } else if (incentive.target_type === 'anyone_who') {
        // For anyone_who, show percentage of participants who have qualified
        progressPercent = participants.length > 0 
          ? (qualifiedParticipants.length / participants.length) * 100 
          : 0;
      } else {
        // first_to - show leader's progress toward target
        progressPercent = Math.min(100, ((participants[0]?.current_value || 0) / targetValue) * 100);
      }

      // Time remaining calculation using the latest participant timezone
      const latestTimezone = getLatestTimezone(participantTimezones);
      const [year, month, day] = incentive.end_date.split('-').map(Number);
      
      // Compare "now" in the latest timezone to end of day in that timezone
      const nowInLatestTz = toZonedTime(new Date(), latestTimezone);
      const endDateInLatestTz = new Date(year, month - 1, day, 23, 59, 59, 999);
      
      const msLeft = endDateInLatestTz.getTime() - nowInLatestTz.getTime();
      
      let timeRemaining = 'Ended';
      if (msLeft > 0) {
        const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60));
        const daysLeft = Math.floor(hoursLeft / 24);
        if (daysLeft > 0) {
          timeRemaining = `${daysLeft}d ${hoursLeft % 24}h left`;
        } else if (hoursLeft > 0) {
          timeRemaining = `${hoursLeft}h left`;
        } else {
          const minsLeft = Math.floor(msLeft / (1000 * 60));
          timeRemaining = `${minsLeft}m left`;
        }
      }

      return {
        incentive,
        participants,
        groupTotal,
        targetValue,
        progressPercent,
        leader: participants[0] || null,
        qualifiedParticipants,
        isCompleted: incentive.status === 'completed',
        timeRemaining,
      } as IncentiveProgressData;
    },
    // Enable for active incentives OR completed incentives still in visibility window
    enabled: !!incentive && (
      incentive.status === 'active' || 
      (incentive.status === 'completed' && isIncentiveStillVisible(incentive, incentive.eligible_reps?.map(r => r.timezone) || []))
    ),
    staleTime: 30 * 1000, // 30 seconds - ensures quick refresh after mutations
  });
};
