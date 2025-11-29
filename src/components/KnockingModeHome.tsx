import { RefreshCw, LogOut, Calendar, TrendingUp, Target, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyFocusCard } from "@/components/DailyFocusCard";
import { WeekSummaryCard } from "@/components/WeekSummaryCard";
import { QuickStatsBar } from "@/components/QuickStatsBar";
import { CompetitorQuickAccess } from "@/components/CompetitorQuickAccess";
import { KnockingWeatherWidget } from "@/components/KnockingWeatherWidget";
import { VetBlitzCard } from "@/components/VetBlitzCard";
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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

  const firstName = repData?.name?.split(' ')[0]?.replace(/[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]/gu, '').trim();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-6 pt-8 pb-32">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">
            {getGreeting()}, {firstName || "Rep"}
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onSync}
              disabled={isSyncing}
              className={`text-primary-foreground hover:bg-primary-foreground/10 transition-colors ${
                syncSuccess ? "bg-green-500 hover:bg-green-600" : ""
              }`}
            >
              {syncSuccess ? (
                <span className="text-lg">✓</span>
              ) : (
                <RefreshCw className={`h-5 w-5 ${isSyncing ? "animate-spin" : ""}`} />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLogoutSheetOpen(true)}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content with negative margin to overlap header */}
      <div className="px-6 space-y-6 -mt-20">
        {/* Daily Focus Card */}
        <DailyFocusCard repData={repData} />

        {/* This Week's Summary */}
        <WeekSummaryCard repData={repData} />

        {/* Quick Stats Bar */}
        <QuickStatsBar repData={repData} />

        {/* Weather Widget (conditional - shows if on active blitz) */}
        <KnockingWeatherWidget repData={repData} />

        {/* Blitz Management (Team Leads only, if blitz within 14 days) */}
        {isTeamLead && anyBlitzWithin14Days && (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Blitz management available for team leads
            </p>
          </Card>
        )}

        {/* Competitor Quick Access */}
        <CompetitorQuickAccess />
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
