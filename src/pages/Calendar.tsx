import { CalendarView } from "@/components/CalendarView";
import { useRepData } from "@/hooks/useRepData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Calendar = () => {
  const { repData } = useRepData();

  // Fetch all daily entries for the logged-in user
  const { data: entries = [] } = useQuery({
    queryKey: ['all-daily-entries'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch season config for personal summer dates
  const { data: seasonConfig } = useQuery({
    queryKey: ['season-config'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('season_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Parse blitzes from repData
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];

  // Parse personal summer dates from season config
  const personalSummerStart = seasonConfig?.personal_summer_start 
    ? new Date(seasonConfig.personal_summer_start) 
    : undefined;
  const personalSummerEnd = seasonConfig?.personal_summer_end 
    ? new Date(seasonConfig.personal_summer_end) 
    : undefined;

  return (
    <CalendarView
      entries={entries}
      blitzes={blitzes}
      personalSummerStart={personalSummerStart}
      personalSummerEnd={personalSummerEnd}
    />
  );
};

export default Calendar;