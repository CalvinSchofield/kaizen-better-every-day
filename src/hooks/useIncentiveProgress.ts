import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Incentive, IncentiveMetric } from "./useIncentives";
import { useEffect } from "react";
import { toZonedTime } from "date-fns-tz";

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

// Calculate FP+ and PRMR from sales_log (matches Today Leaderboard logic)
const calculateFromSalesLog = (salesLog: any[]): { fp: number; prmr: number } => {
  if (!salesLog || !Array.isArray(salesLog)) return { fp: 0, prmr: 0 };
  
  let fp = 0;
  let prmr = 0;
  
  for (const sale of salesLog) {
    if (sale.install_status === 'never_installed') continue;
    
    const salePrmr = Number(sale.prmr) || 0;
    prmr += salePrmr;
    
    if (sale.type === 'fp') {
      fp += 1;
    } else if (sale.type === 'upgrade') {
      fp += salePrmr / 85;
    }
  }
  
  return { fp, prmr };
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
        const isFinalized = entry.is_finalized;
        const salesLog = entry.sales_log as any[] | null;
        
        if (incentive.metric === 'fp_plus') {
          if (isFinalized) {
            value = entry.fp_plus || 0;
          } else {
            const fromLog = calculateFromSalesLog(salesLog || []);
            const fromColumn = entry.fp_plus || 0;
            value = (salesLog && salesLog.length > 0) ? fromLog.fp : fromColumn;
          }
        } else if (incentive.metric === 'prmr') {
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

      // Progress percent based on incentive type
      const progressPercent = incentive.target_type === 'group_total'
        ? Math.min(100, (groupTotal / targetValue) * 100)
        : Math.min(100, ((participants[0]?.current_value || 0) / targetValue) * 100);

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
        isCompleted: incentive.status === 'completed',
        timeRemaining,
      } as IncentiveProgressData;
    },
    enabled: !!incentive && incentive.status === 'active',
    staleTime: 10 * 1000, // 10 seconds
  });
};
