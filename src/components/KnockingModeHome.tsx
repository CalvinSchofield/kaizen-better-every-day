import { RefreshCw, LogOut, Calendar, TrendingUp, Target, Cloud, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyFocusCard } from "@/components/DailyFocusCard";
import { WeekSummaryCard } from "@/components/WeekSummaryCard";
import { QuickStatsBar } from "@/components/QuickStatsBar";
import { CompetitorQuickAccess } from "@/components/CompetitorQuickAccess";
import { RookieCompetitorQuickAccess } from "@/components/RookieCompetitorQuickAccess";
import { PitchPresentationQuickAccess } from "@/components/PitchPresentationQuickAccess";
import { LeaderboardCard } from "./LeaderboardCard";
import { KnockingWeatherWidget } from "@/components/KnockingWeatherWidget";
import { KnockingModeWeatherCard } from "@/components/KnockingModeWeatherCard";
import { LeaderboardCTA } from "@/components/LeaderboardCTA";
import { VetBlitzCard } from "@/components/VetBlitzCard";
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAppMode } from "@/hooks/useAppMode";

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
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const { isOnActiveBlitz } = useAppMode(repData);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Determine if weather should be at top (second position) or bottom
  const shouldWeatherBeAtTop = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    
    // 10:30 PM = 22:30 = 1350 minutes
    // 10:00 AM = 10:00 = 600 minutes
    
    // Show at top if: 10:30 PM (1350) to midnight (1440) OR midnight (0) to 10:00 AM (600)
    return currentMinutes >= 1350 || currentMinutes < 600;
  };

  const weatherAtTop = shouldWeatherBeAtTop();

  const firstName = repData.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim().split(' ')[0];
  
  // Scroll to leaderboard card when CTA is clicked
  const handleLeaderboardClick = () => {
    const leaderboardCard = document.querySelector('[data-leaderboard-card]');
    if (leaderboardCard) {
      leaderboardCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            </div>
            <div className="flex gap-2 flex-shrink-0 self-start">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSync}
                disabled={isSyncing}
                className={`rounded-full transition-all duration-300 border ${
                  syncSuccess 
                    ? 'bg-green-500 text-white border-green-500 hover:bg-green-500' 
                    : 'bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 border-primary-foreground/20'
                }`}
                aria-label="Refresh data"
              >
                {syncSuccess ? (
                  <CheckCircle2 className="w-4 h-4 animate-scale-in" />
                ) : (
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogoutSheetOpen(true)}
                className="rounded-full text-primary-foreground hover:bg-primary-foreground/10"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Leaderboard CTA */}
          <LeaderboardCTA 
            isOnActiveBlitz={isOnActiveBlitz} 
            onLeaderboardClick={handleLeaderboardClick}
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-4 pb-8 space-y-6">
        <DailyFocusCard repData={repData} />
        
        {/* Weather Card - positioned after DailyFocusCard during night/morning hours */}
        {weatherAtTop && (
          <div className="animate-fade-in">
            <KnockingModeWeatherCard repData={repData} isOnActiveBlitz={isOnActiveBlitz} />
          </div>
        )}
        
        <WeekSummaryCard repData={repData} />
        <QuickStatsBar repData={repData} />

        {/* Blitz Management (Team Leads only, if blitz within 14 days) */}
        {isTeamLead && anyBlitzWithin14Days && (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Blitz management available for team leads
            </p>
          </Card>
        )}

        {variant === "rookie" ? (
          <>
            <RookieCompetitorQuickAccess />
            <PitchPresentationQuickAccess />
          </>
        ) : null}
        
        <LeaderboardCard />

        {!weatherAtTop && (
          <div className="animate-fade-in">
            <KnockingModeWeatherCard repData={repData} isOnActiveBlitz={isOnActiveBlitz} />
          </div>
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
