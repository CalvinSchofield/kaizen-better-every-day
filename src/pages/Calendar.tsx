import { CalendarView } from "@/components/CalendarView";
import { useRepData } from "@/hooks/useRepData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarIcon, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const Calendar = () => {
  const { repData } = useRepData();

  // Check if user is a pre-blitz rookie
  const year = repData?.year || "Rookie";
  const isRookie = year === "Rookie";
  
  // Check if rookie has attended a blitz (any blitz with endDate in the past)
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];
  const hasAttendedBlitz = blitzes.some((blitz: any) => {
    if (blitz.endDate) {
      const endDate = new Date(blitz.endDate);
      return endDate < new Date();
    }
    return false;
  });

  const isPreBlitzRookie = isRookie && !hasAttendedBlitz;

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

  // Parse personal summer dates from season config
  const personalSummerStart = seasonConfig?.personal_summer_start 
    ? new Date(seasonConfig.personal_summer_start) 
    : undefined;
  const personalSummerEnd = seasonConfig?.personal_summer_end 
    ? new Date(seasonConfig.personal_summer_end) 
    : undefined;

  // Show locked state for pre-blitz rookies
  if (isPreBlitzRookie) {
    return (
      <div className="min-h-screen bg-background p-4 pb-24 flex items-center justify-center">
        <Card className="w-full max-w-md border-border/40">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <CalendarIcon className="h-16 w-16 text-muted-foreground/40" />
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Calendar Unlocks on Your Blitz!</h2>
              <p className="text-muted-foreground leading-relaxed">
                Get ready to track your progress! Once you hit the doors on your first blitz, 
                you'll be able to log your daily numbers and watch your stats grow.
              </p>
            </div>
            <div className="pt-2">
              <p className="text-sm text-primary font-medium">
                Can't wait to see you out there crushing it! 🚀
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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