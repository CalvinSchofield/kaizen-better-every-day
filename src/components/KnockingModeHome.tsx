import { RefreshCw, Calendar, TrendingUp, Target, Cloud, CheckCircle2, Coffee, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyFocusCard } from "@/components/DailyFocusCard";
import { ActivitySummaryCard } from "@/components/ActivitySummaryCard";
import { CompetitorQuickAccess } from "@/components/CompetitorQuickAccess";
import { RookieCompetitorQuickAccess } from "@/components/RookieCompetitorQuickAccess";
import { PitchPresentationQuickAccess } from "@/components/PitchPresentationQuickAccess";
import { LeaderboardCard } from "./LeaderboardCard";
import { KnockingWeatherWidget } from "@/components/KnockingWeatherWidget";
import { KnockingModeWeatherCard } from "@/components/KnockingModeWeatherCard";
import { LeaderboardCTA } from "@/components/LeaderboardCTA";
import { SaveDayAlertCard } from "@/components/SaveDayAlertCard";
import { AdminDataReviewCard } from "@/components/AdminDataReviewCard";
import { PendingInstallAlertCard } from "@/components/PendingInstallAlertCard";
import { VetBlitzCard } from "@/components/VetBlitzCard";
import { FPCumulativeChart } from "@/components/FPCumulativeChart";
import { RecapCTACard } from "@/components/recap/RecapCTACard";
import { MeVsMeMotivationCard } from "@/components/MeVsMeMotivationCard";
import { ActiveChallengesCard } from "@/components/ActiveChallengesCard";
import { LeaderRookieReviewCard } from "@/components/LeaderRookieReviewCard";
import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAppMode } from "@/hooks/useAppMode";
import { useQueryClient } from "@tanstack/react-query";
import { useDailyEntry, DailyEntry } from "@/hooks/useDailyEntry";
import { useToast } from "@/hooks/use-toast";
import { useKnockingState, KnockingState } from "@/hooks/useKnockingState";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useTodayWorkStatus } from "@/hooks/useTodayWorkStatus";

interface KnockingModeHomeProps {
  variant: "vet" | "rookie";
  repData: any;
  onSync: () => Promise<void>;
  isSyncing: boolean;
  syncSuccess: boolean;
  isTeamLead?: boolean;
  anyBlitzWithin14Days?: boolean;
}

export const KnockingModeHome = ({ 
  variant, 
  repData, 
  onSync, 
  isSyncing, 
  syncSuccess,
  isTeamLead = false,
  anyBlitzWithin14Days = false
}: KnockingModeHomeProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const { isOnActiveBlitz } = useAppMode(repData);
  const { entry, deleteEntry } = useDailyEntry();
  const { data: teamAccess } = useTeamAccess();
  const { isTodayPlanned, isRestDay, shouldStartSoon } = useTodayWorkStatus();
  
  // State-based layout using rep's timezone
  const { state: knockingState, hasActivity } = useKnockingState({ 
    timezone: repData?.timezone 
  });
  
  // Leader check - show review card only for non-rookie leaders
  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';
  const showLeaderReviewCard = isLeader && variant !== 'rookie';

  // Check if entry is a real database entry (has id)
  const isRealEntry = (e: typeof entry): e is DailyEntry => {
    return e !== null && 'id' in e && typeof e.id === 'string';
  };

  // Derived from knocking state
  const hasStartedWorkToday = knockingState === 'working';
  const isDayComplete = knockingState === 'day-complete';

  // Check if save alert should show
  const shouldShowSaveAlert = useMemo(() => {
    if (!entry || entry.is_finalized || !hasStartedWorkToday) return false;
    if (!isRealEntry(entry)) return false; // Must be a real database entry

    // Check if after 7 PM local time
    const now = new Date();
    const localHour = now.getHours();
    if (localHour < 19) return false; // Before 7 PM

    // Check if 15+ minutes since last tap
    const timestamps = entry.counter_timestamps as Record<string, string[]> | null;
    if (!timestamps) return false;

    const allTimestamps: number[] = [];
    Object.values(timestamps).forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((ts) => {
          const date = new Date(ts);
          if (!isNaN(date.getTime())) {
            allTimestamps.push(date.getTime());
          }
        });
      }
    });

    if (allTimestamps.length === 0) return false;

    const latestTimestamp = Math.max(...allTimestamps);
    const minutesSinceLastTap = (Date.now() - latestTimestamp) / (1000 * 60);

    return minutesSinceLastTap >= 15;
  }, [entry, hasStartedWorkToday]);

  const handleLogout = async () => {
    // Clear all caches before signing out
    localStorage.removeItem('rep-data-cache');
    queryClient.clear();
    
    await supabase.auth.signOut();
    navigate('/auth');
  };

  // Contextual greeting based on work day status
  const getGreeting = () => {
    const hour = new Date().getHours();
    
    // If it's a rest day, acknowledge it
    if (isRestDay) {
      if (hour < 12) return "Rest day morning";
      if (hour < 18) return "Rest day afternoon";
      return "Rest day evening";
    }
    
    // Standard time-based greeting
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };
  
  // Get contextual subtitle based on work status
  const getSubtitle = () => {
    if (isRestDay) return "Recharge and prepare for tomorrow";
    if (shouldStartSoon && knockingState === 'pre-work') return "Time to get started!";
    if (knockingState === 'working') return "Keep pushing!";
    if (knockingState === 'day-complete') return "Great work today!";
    return null;
  };
  
  const subtitle = getSubtitle();

  const firstName = repData.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim().split(' ')[0];
  
  // Scroll to leaderboard card and expand it when CTA is clicked
  const handleLeaderboardClick = () => {
    const leaderboardCard = document.querySelector('[data-leaderboard-card]');
    if (leaderboardCard) {
      leaderboardCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Trigger expand by dispatching a custom event
      window.dispatchEvent(new CustomEvent('expandLeaderboard'));
    }
  };

  const handleSaveAlertSave = () => {
    // Navigate to Track page which has the save flow
    navigate('/track?save=true');
  };

  const handleSaveAlertDiscard = async () => {
    if (!entry || !isRealEntry(entry)) return;
    
    try {
      await deleteEntry(entry.id);
      toast({ title: "Entry discarded", description: "Today's incomplete entry has been removed" });
      queryClient.invalidateQueries({ queryKey: ['daily-entry'] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to discard entry", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header with colored background */}
      <div className="bg-primary text-primary-foreground p-6 pb-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-4">
              <h1 className="text-3xl font-bold tracking-tight">
                {getGreeting()}, {firstName}
              </h1>
              {subtitle && (
                <p className="text-primary-foreground/80 text-sm mt-1 flex items-center gap-1.5">
                  {isRestDay && <Coffee className="h-4 w-4" />}
                  {shouldStartSoon && knockingState === 'pre-work' && <Zap className="h-4 w-4" />}
                  {subtitle}
                </p>
              )}
            </div>
            {/* Auto-refresh on mount, no manual button needed */}
          </div>

          {/* Show Save Alert OR Leaderboard CTA */}
          {shouldShowSaveAlert && entry && isRealEntry(entry) ? (
            <SaveDayAlertCard 
              entry={entry}
              onSave={handleSaveAlertSave}
              onDiscard={handleSaveAlertDiscard}
            />
          ) : (
            <LeaderboardCTA 
              isOnActiveBlitz={isOnActiveBlitz} 
              onLeaderboardClick={handleLeaderboardClick}
            />
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-4 pb-8 home-card-container">
        {/* Pending Install Alert - shows after 7 PM if pending installs */}
        <PendingInstallAlertCard />
        
        {/* Leader Rookie Review Card - shows for non-rookie leaders */}
        {showLeaderReviewCard && <LeaderRookieReviewCard />}
        
        {/* Period Recap CTA - shows when recap is available and not yet viewed */}
        <RecapCTACard />
        
        {/* Me vs Me Motivation Card - shows week comparison when enabled */}
        <MeVsMeMotivationCard />
        
        {/* Active Challenges Card - shows competitions and allows creating new ones */}
        <ActiveChallengesCard />
        
        {/* Pre-work layout: Weather first, then Activity, Focus, Leaderboard, YTD */}
        {knockingState === 'pre-work' && (
          <>
            <KnockingModeWeatherCard repData={repData} isOnActiveBlitz={isOnActiveBlitz} />
            <ActivitySummaryCard repData={repData} />
            <DailyFocusCard repData={repData} />
            <LeaderboardCard />
            <FPCumulativeChart />
            
            {isTeamLead && anyBlitzWithin14Days && (
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">
                  Blitz management available for team leads
                </p>
              </Card>
            )}
            
            {variant === "rookie" && (
              <>
                <PitchPresentationQuickAccess />
                <RookieCompetitorQuickAccess />
              </>
            )}
            
            <AdminDataReviewCard />
          </>
        )}
        
        {/* Working layout: Focus HERO first, then Activity (compact), Leaderboard */}
        {knockingState === 'working' && (
          <>
            <DailyFocusCard repData={repData} heroMode />
            <ActivitySummaryCard repData={repData} />
            <LeaderboardCard />
            <FPCumulativeChart />
            
            {isTeamLead && anyBlitzWithin14Days && (
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">
                  Blitz management available for team leads
                </p>
              </Card>
            )}
            
            {variant === "rookie" && (
              <>
                <PitchPresentationQuickAccess />
                <RookieCompetitorQuickAccess />
              </>
            )}
            
            <AdminDataReviewCard />
          </>
        )}
        
        {/* Day-complete layout: Results summary, Activity, Chart */}
        {knockingState === 'day-complete' && (
          <>
            <DailyFocusCard repData={repData} />
            <ActivitySummaryCard repData={repData} />
            <FPCumulativeChart />
            <LeaderboardCard />
            
            {variant === "rookie" && (
              <>
                <PitchPresentationQuickAccess />
                <RookieCompetitorQuickAccess />
              </>
            )}
            
            <AdminDataReviewCard />
          </>
        )}
      </div>

      {/* Logout Confirmation Sheet */}
      <Sheet open={logoutSheetOpen} onOpenChange={setLogoutSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Log out of Kaizen?</SheetTitle>
            <SheetDescription>
              You'll need to sign in again to access your account.
            </SheetDescription>
          </SheetHeader>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setLogoutSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleLogout}
            >
              Log out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};