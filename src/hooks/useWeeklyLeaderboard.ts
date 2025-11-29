import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
}

interface WeeklyLeaderboard {
  mostDoors?: LeaderboardEntry;
  mostDecisionMakers?: LeaderboardEntry;
  mostFP?: LeaderboardEntry;
  mostPRMR?: LeaderboardEntry;
}

const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

const getSaturdayOfWeek = (date: Date): Date => {
  const monday = getMondayOfWeek(date);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5); // Monday + 5 days = Saturday
  return saturday;
};

export const useWeeklyLeaderboard = (filterByYear?: string) => {
  return useQuery({
    queryKey: ["weekly-leaderboard", filterByYear],
    queryFn: async () => {
      const today = new Date();
      const monday = getMondayOfWeek(today);
      const saturday = getSaturdayOfWeek(today);
      
      const mondayStr = monday.toISOString().split('T')[0];
      const saturdayStr = saturday.toISOString().split('T')[0];

      // Fetch all user data to map user_id to name and year
      const { data: users, error: usersError } = await supabase
        .from("reps")
        .select("user_id, name, year");

      if (usersError) throw usersError;

      const userMap = new Map(
        users?.map((user) => [
          user.user_id,
          { 
            name: user.name.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim(),
            year: user.year 
          },
        ]) || []
      );

      // Fetch all finalized entries for the current week
      const { data: entries, error: entriesError } = await supabase
        .from("daily_entries")
        .select("*")
        .eq("is_finalized", true)
        .gte("entry_date", mondayStr)
        .lte("entry_date", saturdayStr);

      if (entriesError) throw entriesError;

      // Filter entries by year if specified
      let filteredEntries = entries || [];
      if (filterByYear) {
        filteredEntries = filteredEntries.filter((entry) => {
          const userData = userMap.get(entry.user_id);
          return userData?.year === filterByYear;
        });
      }

      // If no entries, return empty
      if (filteredEntries.length === 0) {
        return null;
      }

      // Aggregate totals per user
      const userTotals = new Map<string, { doors: number; decisionMakers: number; fp: number; prmr: number }>();

      filteredEntries.forEach((entry) => {
        const userId = entry.user_id;
        const existing = userTotals.get(userId) || { doors: 0, decisionMakers: 0, fp: 0, prmr: 0 };
        
        userTotals.set(userId, {
          doors: existing.doors + (entry.doors_knocked || 0),
          decisionMakers: existing.decisionMakers + (entry.decision_makers || 0),
          fp: existing.fp + (entry.fp_plus || 0),
          prmr: existing.prmr + (entry.prmr || 0),
        });
      });

      // Find top performers from aggregated totals
      const result: WeeklyLeaderboard = {};

      let maxDoors = 0;
      let maxDecisionMakers = 0;
      let maxFP = 0;
      let maxPRMR = 0;

      userTotals.forEach((totals, userId) => {
        const userData = userMap.get(userId);
        if (!userData) return;

        if (totals.doors > maxDoors) {
          maxDoors = totals.doors;
          result.mostDoors = { userId, name: userData.name, value: totals.doors };
        }

        if (totals.decisionMakers > maxDecisionMakers) {
          maxDecisionMakers = totals.decisionMakers;
          result.mostDecisionMakers = { userId, name: userData.name, value: totals.decisionMakers };
        }

        if (totals.fp > maxFP) {
          maxFP = totals.fp;
          result.mostFP = { userId, name: userData.name, value: totals.fp };
        }

        if (totals.prmr > maxPRMR) {
          maxPRMR = totals.prmr;
          result.mostPRMR = { userId, name: userData.name, value: totals.prmr };
        }
      });

      return result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
