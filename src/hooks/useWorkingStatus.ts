import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface WorkingStatusEntry {
  userId: string;
  isWorking: boolean;
  hasForgottenEntry: boolean;
  forgottenDate?: string;
}

// Get "today" date string for a given timezone
const getTodayInTimezone = (timezone: string | null): string => {
  try {
    const tz = timezone || 'America/Los_Angeles';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(now);
  } catch {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
};

export const useWorkingStatus = () => {
  return useQuery({
    queryKey: ["working-status"],
    queryFn: async () => {
      // Fetch all reps with timezone
      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, timezone");

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [r.user_id, r.timezone]) || []);

      // Fetch recent unfinalized entries (last 3 days to catch forgotten entries)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("user_id, entry_date, is_finalized, doors_knocked, decision_makers, pitches, transitions, presentations, closes, work_start_time")
        .eq("is_finalized", false)
        .gte("entry_date", threeDaysAgoStr);

      if (error) throw error;

      const statusMap = new Map<string, WorkingStatusEntry>();

      entries?.forEach(entry => {
        const timezone = repsMap.get(entry.user_id);
        const repToday = getTodayInTimezone(timezone);
        
        const hasActivity = 
          (entry.doors_knocked ?? 0) > 0 ||
          (entry.decision_makers ?? 0) > 0 ||
          (entry.pitches ?? 0) > 0 ||
          (entry.transitions ?? 0) > 0 ||
          (entry.presentations ?? 0) > 0 ||
          (entry.closes ?? 0) > 0 ||
          entry.work_start_time !== null;

        const isToday = entry.entry_date === repToday;
        const existingStatus = statusMap.get(entry.user_id);

        if (isToday && hasActivity) {
          // Currently working today
          statusMap.set(entry.user_id, {
            userId: entry.user_id,
            isWorking: true,
            hasForgottenEntry: existingStatus?.hasForgottenEntry || false,
            forgottenDate: existingStatus?.forgottenDate,
          });
        } else if (!isToday && hasActivity && !entry.is_finalized) {
          // Forgot to log a previous day
          const current = statusMap.get(entry.user_id);
          if (!current?.isWorking) {
            statusMap.set(entry.user_id, {
              userId: entry.user_id,
              isWorking: current?.isWorking || false,
              hasForgottenEntry: true,
              forgottenDate: entry.entry_date,
            });
          } else if (current) {
            // User is working today but also has forgotten entry
            statusMap.set(entry.user_id, {
              ...current,
              hasForgottenEntry: true,
              forgottenDate: entry.entry_date,
            });
          }
        }
      });

      return statusMap;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
};
