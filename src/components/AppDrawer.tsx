import { Link, useNavigate } from "react-router-dom";
import { MessageSquare, Calendar, Settings, Lock, BarChart3, BookOpen, Wrench, LogOut, Users, RefreshCw, Target, Trophy } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useAppMode } from "@/hooks/useAppMode";
import { useRepData } from "@/hooks/useRepData";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface AppDrawerProps {
  trigger: React.ReactNode;
  firstName?: string;
}

export const AppDrawer = ({ trigger, firstName }: AppDrawerProps) => {
  const { repData } = useRepData();
  const { isKnockingMode, toggleMode, isToggling, canAccessKnockingToggle } = useAppMode(repData);
  const { data: teamAccess } = useTeamAccess();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  
  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';

  // Check if user is a pre-blitz rookie
  const year = repData?.year || "Rookie";
  const isRookie = year === "Rookie";
  const isVetOrSoph = year === "Vet" || year === "Sophomore";
  
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];
  const now = new Date();
  const hasAttendedBlitz = blitzes.some((blitz: any) => {
    if (!blitz.date || !blitz.endDate) return false;
    
    // Check if today matches the blitz start date (unlock immediately on blitz day)
    const todayStr = now.toISOString().split('T')[0];
    const blitzStartStr = blitz.date;
    const isStartingToday = todayStr === blitzStartStr;
    
    // Check if blitz is currently active (between start and end date)
    const startDate = new Date(blitz.date + 'T00:00:00');
    const endDate = new Date(blitz.endDate + 'T23:59:59');
    const isCurrentlyActive = now >= startDate && now <= endDate;
    
    // Check if blitz has ended (past)
    const hasEnded = endDate < now;
    
    return isStartingToday || isCurrentlyActive || hasEnded;
  });

  const isCalendarLocked = isRookie && !hasAttendedBlitz;

  // Strip emojis from firstName
  const cleanFirstName = firstName?.replace(/[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]/gu, '').trim();

  const handleToggle = (checked: boolean) => {
    toggleMode(checked);
  };

  const handleLogout = () => {
    setOpen(false);
    setLogoutSheetOpen(true);
  };

  const confirmLogout = async () => {
    try {
      // Clear ALL caches before signing out
      // Clear all rep-data caches (user-specific)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('rep-data-cache') || 
            key?.startsWith('competitors-cache') ||
            key?.startsWith('blitzes-cache') ||
            key?.startsWith('team-access-cache') ||
            key?.startsWith('kaizen-')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Also clear the non-prefixed caches
      localStorage.removeItem('competitors-cache');
      localStorage.removeItem('blitzes-cache');
      localStorage.removeItem('team-access-cache');
      localStorage.removeItem('kaizen-setup-complete');
      localStorage.removeItem('kaizen-setup-timestamp');
      localStorage.removeItem('has-signed-up-before');
      
      // Clear React Query cache
      queryClient.clear();
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout error:", error);
        toast({
          title: "Logout failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        navigate('/auth');
      }
    } finally {
      setLogoutSheetOpen(false);
    }
  };

  const handleForceRefresh = () => {
    // Clear all localStorage caches
    localStorage.removeItem('rep-data-cache');
    localStorage.removeItem('competitors-cache');
    localStorage.removeItem('blitzes-cache');
    localStorage.removeItem('team-access-cache');
    localStorage.removeItem('kaizen-setup-complete');
    localStorage.removeItem('kaizen-setup-timestamp');
    
    // Clear React Query cache
    queryClient.clear();
    
    toast({
      title: "Refreshing app...",
      description: "Clearing cache and reloading",
    });
    
    // Reload the page after a brief delay
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] flex flex-col">
        <SheetHeader>
          <SheetTitle>
            {cleanFirstName ? `Hey, ${cleanFirstName}` : "Menu"}
          </SheetTitle>
        </SheetHeader>
        
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="flex flex-col gap-3 py-4">
            {/* Knocking Mode Toggle */}
            {canAccessKnockingToggle && (
              <>
                <div className="flex items-center justify-between p-3 rounded-lg bg-card">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="knocking-mode" className="text-sm font-semibold cursor-pointer">
                      🚪 Knocking Mode
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {isKnockingMode ? "Active" : "Preseason"}
                    </p>
                  </div>
                  <Switch
                    id="knocking-mode"
                    checked={isKnockingMode}
                    onCheckedChange={handleToggle}
                    disabled={isToggling}
                  />
                </div>
                <Separator />
              </>
            )}

            {/* Dynamic Menu Items based on user type and knocking mode */}
            {/* PRE-BLITZ ROOKIES: Show Track (locked), Calendar (locked), Insights (locked) */}
            {isCalendarLocked && (
              <>
                <Link
                  to="/track"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="relative">
                    <Wrench className="w-5 h-5 text-primary" />
                    <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full">
                      <Lock className="w-3 h-3 text-primary" />
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-semibold text-sm">Track</span>
                    <span className="text-xs text-muted-foreground truncate">
                      Unlocks on first blitz
                    </span>
                  </div>
                </Link>

                <Link
                  to="/calendar"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="relative">
                    <Calendar className="w-5 h-5 text-primary" />
                    <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full">
                      <Lock className="w-3 h-3 text-primary" />
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-semibold text-sm">Your Sales Calendar</span>
                    <span className="text-xs text-muted-foreground truncate">
                      Unlocks on first blitz
                    </span>
                  </div>
                </Link>

                <Link
                  to="/insights"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="relative">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full">
                      <Lock className="w-3 h-3 text-primary" />
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-semibold text-sm">Insights</span>
                    <span className="text-xs text-muted-foreground truncate">
                      Unlocks on first blitz
                    </span>
                  </div>
                </Link>
              </>
            )}

            {/* POST-BLITZ ROOKIES & VETS/SOPHS */}
            {!isCalendarLocked && (
              <>
                {/* KNOCKING MODE OFF: Show Track, Calendar, Insights, Reports (if leader) */}
                {!isKnockingMode && (
                  <>
                    <Link
                      to="/track"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <Target className="w-5 h-5 text-primary" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-semibold text-sm">Track</span>
                        <span className="text-xs text-muted-foreground truncate">
                          Log your activity
                        </span>
                      </div>
                    </Link>

                    <Link
                      to="/calendar"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <Calendar className="w-5 h-5 text-primary" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-semibold text-sm">Calendar</span>
                        <span className="text-xs text-muted-foreground truncate">
                          View knocking metrics
                        </span>
                      </div>
                    </Link>

                    <Link
                      to="/insights"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <BarChart3 className="w-5 h-5 text-primary" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-semibold text-sm">Insights</span>
                        <span className="text-xs text-muted-foreground truncate">
                          Track performance
                        </span>
                      </div>
                    </Link>

                    {/* Team Reports - Leaders only */}
                    {isLeader && (
                      <Link
                        to="/team-reports"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <Users className="w-5 h-5 text-primary" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-semibold text-sm">Reports</span>
                          <span className="text-xs text-muted-foreground truncate">
                            View team performance
                          </span>
                        </div>
                      </Link>
                    )}
                  </>
                )}

                {/* KNOCKING MODE ON */}
                {isKnockingMode && (
                  <>
                    {/* Team Reports - Leaders only, show first */}
                    {isLeader && (
                      <Link
                        to="/team-reports"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <Users className="w-5 h-5 text-primary" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-semibold text-sm">Reports</span>
                          <span className="text-xs text-muted-foreground truncate">
                            View team performance
                          </span>
                        </div>
                      </Link>
                    )}

                    {/* For VETS: Tools, Training. For Post-Blitz Rookies: Insights, Training */}
                    {isVetOrSoph ? (
                      <>
                        <Link
                          to="/tools"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                        >
                          <Wrench className="w-5 h-5 text-primary" />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-semibold text-sm">Tools</span>
                            <span className="text-xs text-muted-foreground truncate">
                              Quick-access resources
                            </span>
                          </div>
                        </Link>

                        <Link
                          to="/training"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                        >
                          <BookOpen className="w-5 h-5 text-primary" />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-semibold text-sm">Training</span>
                            <span className="text-xs text-muted-foreground truncate">
                              Review resources
                            </span>
                          </div>
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link
                          to="/insights"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                        >
                          <BarChart3 className="w-5 h-5 text-primary" />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-semibold text-sm">Insights</span>
                            <span className="text-xs text-muted-foreground truncate">
                              Track performance
                            </span>
                          </div>
                        </Link>

                        <Link
                          to="/training"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                        >
                          <BookOpen className="w-5 h-5 text-primary" />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-semibold text-sm">Training</span>
                            <span className="text-xs text-muted-foreground truncate">
                              Review resources
                            </span>
                          </div>
                        </Link>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            <Separator />

            {/* Goals */}
            <Link
              to="/goals"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <Trophy className="w-5 h-5 text-primary" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-semibold text-sm">Goals</span>
                <span className="text-xs text-muted-foreground truncate">
                  Set your summer goals
                </span>
              </div>
            </Link>

            <Separator />

            {/* AI Assistant */}
            <a
              href="https://chatgpt.com/g/g-67f0056351a081918e8849fb6310fa42-vivintgpt"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <MessageSquare className="w-5 h-5 text-primary" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-semibold text-sm">AI Assistant</span>
                <span className="text-xs text-muted-foreground truncate">
                  {isKnockingMode ? "Sales & objections help" : "Onboarding & training help"}
                </span>
              </div>
            </a>

            <Separator />

            {/* Personalize */}
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <Settings className="w-5 h-5 text-primary" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-semibold text-sm">Personalize</span>
                <span className="text-xs text-muted-foreground truncate">
                  {isVetOrSoph ? "Customize counters" : "Customize experience"}
                </span>
              </div>
            </Link>

            <Separator />

            {/* Force Refresh */}
            <button
              onClick={handleForceRefresh}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors w-full"
            >
              <RefreshCw className="w-5 h-5 text-primary" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-semibold text-sm">Force Refresh</span>
                <span className="text-xs text-muted-foreground truncate">
                  Clear cache & reload app
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Logout - Fixed at bottom */}
        <div className="pt-3 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-destructive/10 transition-colors text-destructive w-full"
          >
            <LogOut className="w-5 h-5" />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-semibold text-sm">Logout</span>
              <span className="text-xs text-muted-foreground truncate">
                Sign out
              </span>
            </div>
          </button>
        </div>
      </SheetContent>
    </Sheet>

    {/* Logout Confirmation Sheet */}
    <Sheet open={logoutSheetOpen} onOpenChange={setLogoutSheetOpen}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Confirm Logout</SheetTitle>
          <SheetDescription>
            Are you sure you want to log out? You'll need to sign in again to access your account.
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
            onClick={confirmLogout}
          >
            Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
};