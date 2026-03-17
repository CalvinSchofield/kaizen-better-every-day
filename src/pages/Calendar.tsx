import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarView } from "@/components/CalendarView";
import { useRepData } from "@/hooks/useRepData";
import { useRookieUnlockStatus } from "@/hooks/useRookieUnlockStatus";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarIcon, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoalPaceCalculator } from "@/hooks/useGoalPaceCalculator";
import { useAddSaleToEntry } from "@/hooks/useAddSaleToEntry";

interface CalendarProps {
  viewMode?: "week" | "month";
  onViewModeChange?: (mode: "week" | "month") => void;
}

const Calendar = ({ viewMode = "week", onViewModeChange }: CalendarProps) => {
  const { repData, loading: loadingRepData, isInitializing } = useRepData();
  const navigate = useNavigate();
  const location = useLocation();
  const goalPaceData = useGoalPaceCalculator();
  const { addSale } = useAddSaleToEntry();

  // Handle sale data returned from LogSale page
  useEffect(() => {
    const state = location.state as {
      saleLogged?: boolean;
      saleData?: any;
      entryDate?: string;
      timestamp?: string;
    } | null;

    if (state?.saleLogged && state?.saleData && state?.entryDate) {
      addSale({
        entryDate: state.entryDate,
        sale: state.saleData,
        saleTimestamp: state.timestamp,
      });
      // Clear location state so it doesn't re-trigger
      navigate('/calendar', { replace: true, state: {} });
    }
  }, [location.state]);

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
    staleTime: 0, // Always refetch when invalidated - critical for showing today's data after save
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

  // Check if user is a pre-blitz rookie - use centralized hook
  const { isPreBlitzRookie } = useRookieUnlockStatus(repData);

  // Get blitzes for CalendarView
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];


  // Show skeleton loader while initializing auth OR loading data
  if (isInitializing || (loadingRepData && !repData)) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-[300px] w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

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
              <h2 className="text-2xl font-bold text-foreground">Your Sales Calendar Unlocks on Your Blitz!</h2>
              <p className="text-muted-foreground leading-relaxed">
                This is where you'll track your daily sales numbers and watch your stats grow.
                It unlocks once you hit the doors on your first blitz!
              </p>
            </div>
            <div className="pt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Looking for the team blitz schedule?
              </p>
              <Button 
                onClick={() => navigate("/tools")}
                variant="outline"
                className="w-full"
              >
                View Team Blitz Calendar
              </Button>
              <p className="text-sm text-primary font-medium pt-2">
                Can't wait to see you out there crushing it!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <CalendarView
        entries={entries}
        blitzes={blitzes}
        personalSummerStart={personalSummerStart}
        personalSummerEnd={personalSummerEnd}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        dailyGoal={goalPaceData.hasGoals ? goalPaceData.dailyNeeded : null}
        preseasonDailyPace={goalPaceData.hasGoals ? goalPaceData.preseasonDailyPace : null}
        summerDailyPace={goalPaceData.hasGoals ? goalPaceData.summerDailyPace : null}
      />
      
    </>
  );
};

export default Calendar;