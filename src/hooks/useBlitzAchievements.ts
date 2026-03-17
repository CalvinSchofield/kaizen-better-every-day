import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";

export interface BlitzAchievement {
  type: 'record' | 'challenge' | 'incentive';
  label: string;
  value?: string;
  date?: string;
}

export function useBlitzAchievements(startDate: string | null, endDate: string | null) {
  const { userId } = useCurrentUserId();

  return useQuery({
    queryKey: ['blitz-achievements', userId, startDate, endDate],
    queryFn: async (): Promise<BlitzAchievement[]> => {
      if (!userId || !startDate || !endDate) return [];

      const achievements: BlitzAchievement[] = [];

      // Personal records achieved during blitz
      const { data: records } = await supabase
        .from('personal_records')
        .select('record_type, value, entry_date')
        .eq('user_id', userId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);

      for (const r of records || []) {
        const label = r.record_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        achievements.push({
          type: 'record',
          label: `New PR: ${label}`,
          value: String(r.value),
          date: r.entry_date,
        });
      }

      // Challenges that overlapped with this blitz window
      const { data: participants } = await supabase
        .from('challenge_participants')
        .select('challenge_id, final_value, challenges(metric, stakes, status, winner_user_id, start_date, end_date)')
        .eq('user_id', userId);

      for (const p of participants || []) {
        const c = (p as any).challenges;
        if (!c || c.status !== 'completed') continue;
        // Check overlap with blitz window
        if (c.end_date < startDate || c.start_date > endDate) continue;
        const won = c.winner_user_id === userId;
        achievements.push({
          type: 'challenge',
          label: won ? `Won challenge: ${c.metric}` : `Challenge: ${c.metric}`,
          value: p.final_value ? String(p.final_value) : undefined,
        });
      }

      // Incentives earned during blitz window
      const { data: eligibles } = await supabase
        .from('incentive_eligible_reps')
        .select('final_value, incentives(title, metric, status, winner_user_id, start_date, end_date)')
        .eq('user_id', userId);

      for (const e of eligibles || []) {
        const inc = (e as any).incentives;
        if (!inc || inc.status !== 'completed') continue;
        if (inc.end_date < startDate || inc.start_date > endDate) continue;
        const won = inc.winner_user_id === userId;
        achievements.push({
          type: 'incentive',
          label: won ? `Won: ${inc.title}` : `Incentive: ${inc.title}`,
          value: e.final_value ? String(e.final_value) : undefined,
        });
      }

      return achievements;
    },
    enabled: !!userId && !!startDate && !!endDate,
    staleTime: 10 * 60 * 1000,
  });
}
