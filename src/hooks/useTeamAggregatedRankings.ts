import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";

interface RepRankingData {
  userId: string;
  name: string;
  teamName?: string;
  mgmtGroupName?: string;
  year?: string;
  stats: {
    doors: number;
    dms: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    prmr: number;
    upgradePrmr: number;
  };
  hoursWorked: number;
  daysWorked: number;
  workStartTime?: string;
}

interface UseTeamAggregatedRankingsProps {
  userIds: string[];
  excludeUserIds?: string[];
  period: 'week' | 'month' | 'season' | 'ytd';
}

const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const getDateRange = (period: 'week' | 'month' | 'season' | 'ytd') => {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  switch (period) {
    case 'week': {
      const monday = getMondayOfWeek(now);
      const saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);
      return { start: getLocalDateString(monday), end: getLocalDateString(saturday) };
    }
    case 'month': {
      const monthStart = new Date(currentYear, now.getMonth(), 1);
      const monthEnd = new Date(currentYear, now.getMonth() + 1, 0);
      return { start: getLocalDateString(monthStart), end: getLocalDateString(monthEnd) };
    }
    case 'season': {
      // Preseason: Sept 28 to April 11
      const currentMonth = now.getMonth();
      const currentDay = now.getDate();
      let startDate: Date;
      let endDate: Date;
      
      if (currentMonth >= 8 && (currentMonth > 8 || currentDay >= 28)) {
        startDate = new Date(currentYear, 8, 28);
        endDate = new Date(currentYear + 1, 3, 11);
      } else {
        startDate = new Date(currentYear - 1, 8, 28);
        endDate = new Date(currentYear, 3, 11);
      }
      return { start: getLocalDateString(startDate), end: getLocalDateString(endDate) };
    }
    case 'ytd': {
      const yearStart = new Date(currentYear, 0, 1);
      return { start: getLocalDateString(yearStart), end: getLocalDateString(now) };
    }
  }
};

export const useTeamAggregatedRankings = ({ 
  userIds, 
  excludeUserIds = [], 
  period 
}: UseTeamAggregatedRankingsProps) => {
  return useQuery({
    queryKey: ["team-aggregated-rankings", userIds.sort().join(','), excludeUserIds.sort().join(','), period],
    queryFn: async () => {
      if (!userIds || userIds.length === 0) {
        return { reps: [], totalFP: 0, totalPRMR: 0, repCount: 0 };
      }

      const effectiveUserIds = userIds.filter(id => !excludeUserIds.includes(id));
      if (effectiveUserIds.length === 0) {
        return { reps: [], totalFP: 0, totalPRMR: 0, repCount: 0 };
      }

      const { start, end } = getDateRange(period);

      // Fetch reps data
      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, year, team_leader, timezone")
        .in("user_id", effectiveUserIds);

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [
        r.user_id, 
        { 
          name: r.name?.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim() || 'Unknown',
          year: r.year,
          teamName: r.team_leader,
          timezone: r.timezone || 'America/Los_Angeles'
        }
      ]) || []);

      // Fetch finalized entries for the period
      const { data: entries, error: entriesError } = await supabase
        .from("daily_entries")
        .select("user_id, doors_knocked, decision_makers, pitches, transitions, presentations, closes, fp_plus, prmr, upgrade_prmr, work_start_time, work_end_time, break_periods, entry_date, timezone")
        .eq("is_finalized", true)
        .in("user_id", effectiveUserIds)
        .gte("entry_date", start)
        .lte("entry_date", end);

      if (entriesError) throw entriesError;

      // Aggregate by user
      const userTotals = new Map<string, {
        doors: number;
        dms: number;
        pitches: number;
        transitions: number;
        presentations: number;
        closes: number;
        fp: number;
        prmr: number;
        upgradePrmr: number;
        hoursWorked: number;
        daysWorked: number;
        earliestStart?: string;
      }>();

      entries?.forEach(entry => {
        const current = userTotals.get(entry.user_id) || {
          doors: 0,
          dms: 0,
          pitches: 0,
          transitions: 0,
          presentations: 0,
          closes: 0,
          fp: 0,
          prmr: 0,
          upgradePrmr: 0,
          hoursWorked: 0,
          daysWorked: 0,
          earliestStart: undefined,
        };

        let entryHours = 0;
        if (entry.work_start_time && entry.work_end_time) {
          const startTime = new Date(entry.work_start_time);
          const endTime = new Date(entry.work_end_time);
          let totalMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

          if (entry.break_periods && Array.isArray(entry.break_periods)) {
            entry.break_periods.forEach((period: any) => {
              if (period.start && period.end) {
                const breakStart = new Date(period.start);
                const breakEnd = new Date(period.end);
                totalMinutes -= (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
              }
            });
          }

          entryHours = Math.max(0, totalMinutes) / 60;
        }

        // Track earliest start time
        let earliestStart = current.earliestStart;
        if (entry.work_start_time) {
          if (!earliestStart || entry.work_start_time < earliestStart) {
            earliestStart = entry.work_start_time;
          }
        }

        userTotals.set(entry.user_id, {
          doors: current.doors + (entry.doors_knocked || 0),
          dms: current.dms + (entry.decision_makers || 0),
          pitches: current.pitches + (entry.pitches || 0),
          transitions: current.transitions + (entry.transitions || 0),
          presentations: current.presentations + (entry.presentations || 0),
          closes: current.closes + (entry.closes || 0),
          fp: current.fp + (entry.fp_plus || 0),
          prmr: current.prmr + (entry.prmr || 0),
          upgradePrmr: current.upgradePrmr + (entry.upgrade_prmr || 0),
          hoursWorked: current.hoursWorked + entryHours,
          daysWorked: current.daysWorked + 1,
          earliestStart,
        });
      });

      // Convert to array with rep info
      const reps: RepRankingData[] = [];
      userTotals.forEach((totals, userId) => {
        const repInfo = repsMap.get(userId);
        if (!repInfo) return;

        reps.push({
          userId,
          name: repInfo.name,
          teamName: repInfo.teamName,
          year: repInfo.year,
          stats: {
            doors: totals.doors,
            dms: totals.dms,
            pitches: totals.pitches,
            transitions: totals.transitions,
            presentations: totals.presentations,
            closes: totals.closes,
            fp: totals.fp,
            prmr: totals.prmr,
            upgradePrmr: totals.upgradePrmr,
          },
          hoursWorked: totals.hoursWorked,
          daysWorked: totals.daysWorked,
          workStartTime: totals.earliestStart,
        });
      });

      // Calculate totals
      const totalFP = reps.reduce((sum, r) => sum + r.stats.fp, 0);
      const totalPRMR = reps.reduce((sum, r) => sum + r.stats.prmr, 0);

      return {
        reps,
        totalFP,
        totalPRMR,
        repCount: reps.length,
      };
    },
    enabled: userIds.length > 0,
    staleTime: 0,
  });
};
