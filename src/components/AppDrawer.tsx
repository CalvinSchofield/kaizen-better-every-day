import { Link, useNavigate } from "react-router-dom";
import { MessageSquare, Calendar, Settings, Lock, BarChart3, BookOpen, Wrench, LogOut } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface AppDrawerProps {
  trigger: React.ReactNode;
  firstName?: string;
  navItems?: Array<{ path: string; icon: any; label: string }>;
}

export const AppDrawer = ({ trigger, firstName, navItems = [] }: AppDrawerProps) => {
  const { repData } = useRepData();
  const { isKnockingMode, toggleMode, isToggling, canAccessKnockingToggle } = useAppMode(repData);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);

  // Check if user is a pre-blitz rookie
  const year = repData?.year || "Rookie";
  const isRookie = year === "Rookie";
  const isVetOrSoph = year === "Vet" || year === "Sophomore";
  
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
      // Clear all caches before signing out
      localStorage.removeItem('rep-data-cache');
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

  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px]">
        <SheetHeader>
          <SheetTitle>
            {cleanFirstName ? `Hey, ${cleanFirstName}` : "Menu"}
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col gap-4 p-4 h-full">
          <div className="flex flex-col gap-4">
            {/* Knocking Mode Toggle - Only show if user has access */}
            {canAccessKnockingToggle && (
              <>
                <div className="flex items-center justify-between p-4 rounded-lg bg-card">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="knocking-mode" className="text-base font-semibold cursor-pointer">
                      🚪 Knocking Mode
                    </Label>
                    <p className="text-sm text-muted-foreground">
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

            {/* Training Link - Show in drawer only when NOT in bottom tabs */}
            {!navItems.some(item => item.path === "/training") && (
              <Link
                to="/training"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors"
              >
                <BookOpen className="w-5 h-5 text-primary" />
                <div className="flex flex-col">
                  <span className="font-semibold">Training</span>
                  <span className="text-sm text-muted-foreground">
                    Access training resources
                  </span>
                </div>
              </Link>
            )}

            {/* Tools Link - Show in drawer only when NOT in bottom tabs */}
            {!navItems.some(item => item.path === "/tools") && (
              <Link
                to="/tools"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors"
              >
                <Wrench className="w-5 h-5 text-primary" />
                <div className="flex flex-col">
                  <span className="font-semibold">Tools</span>
                  <span className="text-sm text-muted-foreground">
                    Access sales tools
                  </span>
                </div>
              </Link>
            )}

            {/* Separator only if we showed Training or Tools */}
            {(!navItems.some(item => item.path === "/training") || !navItems.some(item => item.path === "/tools")) && <Separator />}

            {/* Calendar Link - Show only when NOT in bottom tabs */}
            {!navItems.some(item => item.path === "/calendar") && (
              <Link
                to="/calendar"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="relative">
                  <Calendar className="w-5 h-5 text-primary" />
                  {isCalendarLocked && (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full">
                      <Lock className="w-3 h-3 text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">Calendar</span>
                  <span className="text-sm text-muted-foreground">
                    {isCalendarLocked ? "Unlocks on your first blitz" : "View your knocking metrics"}
                  </span>
                </div>
              </Link>
            )}

            {/* Insights Link - Show only when NOT in bottom tabs */}
            {!navItems.some(item => item.path === "/insights") && (
              <Link
                to="/insights"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="relative">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  {isCalendarLocked && (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full">
                      <Lock className="w-3 h-3 text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">Insights</span>
                  <span className="text-sm text-muted-foreground">
                    {isCalendarLocked ? "Unlocks on your first blitz" : "Track your performance"}
                  </span>
                </div>
              </Link>
            )}

            {/* Show separator after Insights only when it's visible in drawer (knocking mode off) */}
            {!navItems.some(item => item.path === "/insights") && <Separator />}

            {/* AI Assistant Link */}
            <a
              href="https://chatgpt.com/g/g-67f0056351a081918e8849fb6310fa42-vivintgpt"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors"
            >
              <MessageSquare className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="font-semibold">AI Assistant</span>
                <span className="text-sm text-muted-foreground">
                  {isKnockingMode
                    ? "Help with sales & objections"
                    : "Help with onboarding & training"}
                </span>
              </div>
            </a>

            <Separator />

            {/* Personalize */}
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors"
            >
              <Settings className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="font-semibold">Personalize</span>
                <span className="text-sm text-muted-foreground">
                  {isVetOrSoph 
                    ? "Customize counters & preferences" 
                    : "Customize your experience"}
                </span>
              </div>
            </Link>
          </div>

          {/* Logout Button - Pushed to bottom - Hidden for pre-blitz rookies */}
          {!isCalendarLocked && (
            <div className="mt-auto pt-4">
              <Separator className="mb-4" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 p-4 rounded-lg hover:bg-destructive/10 transition-colors text-destructive w-full"
              >
                <LogOut className="w-5 h-5" />
                <div className="flex flex-col">
                  <span className="font-semibold">Logout</span>
                  <span className="text-sm text-muted-foreground">
                    Sign out of your account
                  </span>
                </div>
              </button>
            </div>
          )}
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