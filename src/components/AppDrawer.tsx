import { Link, useNavigate } from "react-router-dom";
import { Calendar, Settings, Lock, BarChart3, BookOpen, Wrench, LogOut, Users, Target, Trophy, UserPlus, Contact, Sparkles, Swords, RefreshCw, type LucideIcon } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAppMode } from "@/hooks/useAppMode";
import { useRepData } from "@/hooks/useRepData";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useMyActiveChallenges } from "@/hooks/useChallenges";
import { useRookieUnlockStatus } from "@/hooks/useRookieUnlockStatus";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearPersistedCache, clearCachedLayoutState } from "@/lib/queryPersister";
import { hapticSelection, hapticLight } from "@/utils/haptics";
import { getInitials } from "@/utils/nameUtils";

// ── Reusable sub-components ──

const DrawerSection = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <span className="block px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
      {label}
    </span>
    <div className="bg-muted/30 rounded-xl overflow-hidden divide-y divide-border/40">
      {children}
    </div>
  </div>
);

const DrawerItem = ({
  to,
  icon: Icon,
  label,
  locked,
  badge,
  onClick,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  locked?: boolean;
  badge?: number;
  onClick?: () => void;
}) => {
  const content = (
    <>
      <div className="relative flex-shrink-0">
        <Icon className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={1.8} />
        {locked && (
          <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full">
            <Lock className="w-2.5 h-2.5 text-muted-foreground" />
          </div>
        )}
      </div>
      <span className="text-[13px] font-medium flex items-center gap-2">
        {label}
        {typeof badge === "number" && badge > 0 && (
          <Badge variant="destructive" className="h-4 min-w-4 flex items-center justify-center p-0 text-[10px]">
            {badge}
          </Badge>
        )}
      </span>
      {locked && (
        <span className="ml-auto text-[10px] text-muted-foreground/60">Locked</span>
      )}
    </>
  );

  if (locked) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 opacity-50">{content}</div>
    );
  }

  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 active:bg-accent/50 transition-colors"
    >
      {content}
    </Link>
  );
};

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { data: challenges } = useMyActiveChallenges();
  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';
  
  // Count pending challenges that require action (received, not yet responded)
  const pendingActionCount = challenges?.filter(c => {
    if (c.status !== 'pending') return false;
    const myParticipant = c.participants?.find(p => p.accepted === null && p.role === 'captain_b');
    return !!myParticipant;
  }).length || 0;

  // Check if user is a pre-blitz rookie - use centralized hook
  const year = repData?.year || "Rookie";
  const isVetOrSoph = year === "Vet" || year === "Sophomore";
  const { isPreBlitzRookie, isRookie } = useRookieUnlockStatus(repData);
  const isCalendarLocked = isPreBlitzRookie;

  // Strip emojis from firstName
  const cleanFirstName = firstName?.replace(/[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]/gu, '').trim();


  const handleToggle = (checked: boolean) => {
    hapticSelection();
    toggleMode(checked);
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    hapticLight();
    try {
      // Clear ALL caches
      clearPersistedCache();
      clearCachedLayoutState();
      
      // Clear all localStorage caches
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('rep-data-cache') || 
            key?.startsWith('competitors-cache') ||
            key?.startsWith('blitzes-cache') ||
            key?.startsWith('team-access-cache') ||
            key?.startsWith('season-config-cache') ||
            key?.startsWith('group-recruits-cache')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear React Query cache and refetch all queries
      queryClient.clear();
      await queryClient.invalidateQueries();
      
      toast({
        title: "Data refreshed",
        description: "All cached data has been cleared and reloaded.",
      });
      setOpen(false);
    } catch (error) {
      console.error("Refresh error:", error);
      toast({
        title: "Refresh failed",
        description: "Please try again or log out and back in.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = () => {
    setOpen(false);
    setLogoutSheetOpen(true);
  };

  const confirmLogout = async () => {
    try {
      // Clear ALL caches before signing out
      clearPersistedCache();
      clearCachedLayoutState();
      
      // Clear all rep-data caches (user-specific)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('rep-data-cache') || 
            key?.startsWith('competitors-cache') ||
            key?.startsWith('blitzes-cache') ||
            key?.startsWith('team-access-cache') ||
            key?.startsWith('kaizen-') ||
            key?.startsWith('season-config-cache') ||
            key?.startsWith('group-recruits-cache')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
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


  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] flex flex-col">
        <SheetHeader className="pb-2 pt-2">
          <button
            onClick={() => {
              hapticLight();
              setOpen(false);
              if (repData?.user_id) {
                navigate(`/profile/${repData.user_id}`);
              }
            }}
            className="flex flex-col items-center gap-1.5 w-full active:scale-[0.97] transition-transform"
          >
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarImage src={repData?.profile_photo_url || undefined} alt={cleanFirstName || "Profile"} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {cleanFirstName ? getInitials(cleanFirstName) : "?"}
              </AvatarFallback>
            </Avatar>
            <SheetTitle>
              {cleanFirstName ? `Hey, ${cleanFirstName}` : "Menu"}
            </SheetTitle>
            <span className="text-[10px] text-muted-foreground font-medium -mt-1">View Profile →</span>
          </button>
        </SheetHeader>
        
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="flex flex-col gap-4 py-4">
            {/* Knocking Mode Toggle */}
            {canAccessKnockingToggle && (
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="knocking-mode" className="text-sm font-semibold cursor-pointer">
                      🚪 Knocking Mode
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
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
              </div>
            )}

            {/* ── PERFORMANCE ── */}
            <DrawerSection label="Performance">
              {isCalendarLocked ? (
                <>
                  <DrawerItem to="/track" icon={Target} label="Track" locked onClick={() => setOpen(false)} />
                  <DrawerItem to="/calendar" icon={Calendar} label="Calendar" locked onClick={() => setOpen(false)} />
                  <DrawerItem to="/insights" icon={BarChart3} label="Insights" locked onClick={() => setOpen(false)} />
                </>
              ) : (
                <>
                  <DrawerItem to="/track" icon={Target} label="Track" onClick={() => setOpen(false)} />
                  {isKnockingMode && (
                    <DrawerItem to="/calendar" icon={Calendar} label="Calendar" onClick={() => setOpen(false)} />
                  )}
                  <DrawerItem to="/insights" icon={BarChart3} label="Insights" onClick={() => setOpen(false)} />
                </>
              )}
            </DrawerSection>

            {/* ── GROWTH ── */}
            <DrawerSection label="Growth">
              <DrawerItem to="/training" icon={BookOpen} label="Training" onClick={() => setOpen(false)} />
              <DrawerItem to="/goals" icon={Target} label="Goals" onClick={() => setOpen(false)} />
            </DrawerSection>

            {/* ── TEAM ── */}
            {(() => {
              const teamItems: React.ReactNode[] = [];
              
              // Leaderboard - in drawer during preseason only (nav bar during knocking)
              if (!isKnockingMode && !isCalendarLocked) {
                teamItems.push(
                  <DrawerItem key="lb" to="/leaderboard" icon={Trophy} label="Leaderboard" onClick={() => { hapticLight(); setOpen(false); }} />
                );
              }
              
              // Compete
              if (!isKnockingMode) {
                teamItems.push(
                  <DrawerItem
                    key="compete"
                    to="/compete"
                    icon={Swords}
                    label="Compete"
                    locked={isPreBlitzRookie}
                    badge={!isPreBlitzRookie && pendingActionCount > 0 ? pendingActionCount : undefined}
                    onClick={() => { hapticLight(); setOpen(false); }}
                  />
                );
              }
              
              // Reports - leaders only, preseason
              if (isLeader && !isKnockingMode && !isCalendarLocked) {
                teamItems.push(
                  <DrawerItem key="reports" to="/reports-v2" icon={Users} label="Reports" onClick={() => setOpen(false)} />
                );
              }
              
              // My Group
              if (!(isLeader && !isKnockingMode && !isCalendarLocked)) {
                teamItems.push(
                  <DrawerItem key="group" to="/my-group" icon={UserPlus} label="My Group" onClick={() => setOpen(false)} />
                );
              }
              
              return teamItems.length > 0 ? (
                <DrawerSection label="Team">{teamItems}</DrawerSection>
              ) : null;
            })()}

            {/* ── CLIENTS ── */}
            <DrawerSection label="Clients">
              <DrawerItem
                to="/customers"
                icon={Contact}
                label="Customers"
                locked={isPreBlitzRookie}
                onClick={() => setOpen(false)}
              />
            </DrawerSection>

            {/* ── ACCOUNT ── */}
            <DrawerSection label="Account">
              <DrawerItem to="/settings" icon={Settings} label="Settings" onClick={() => setOpen(false)} />
              <button
                onClick={handleRefreshData}
                disabled={isRefreshing}
                className="flex items-center gap-3 px-3 py-2.5 w-full text-left disabled:opacity-50 active:bg-accent/50 transition-colors"
              >
                <RefreshCw className={`w-[18px] h-[18px] text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-[13px] font-medium">{isRefreshing ? 'Refreshing…' : 'Refresh Data'}</span>
              </button>
            </DrawerSection>

          </div>
        </div>

        {/* Logout - Fixed at bottom */}
        <div className="pt-3 border-t border-border/50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 transition-colors text-destructive w-full"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span className="text-[13px] font-medium">Logout</span>
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