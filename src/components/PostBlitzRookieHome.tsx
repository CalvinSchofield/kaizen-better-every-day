import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, LogOut, Calendar, Moon, Users, Edit2, CheckCircle2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { RepData } from "@/hooks/useRepData";
import { useBlitzes } from "@/hooks/useBlitzes";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { BlitzCountdown } from "@/components/BlitzCountdown";
import TeamCalendarModal from "@/components/TeamCalendarModal";
import confetti from "canvas-confetti";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface PostBlitzRookieHomeProps {
  repData: RepData;
  onSync: () => void;
  isSyncing: boolean;
  syncSuccess: boolean;
}

export const PostBlitzRookieHome = ({ repData, onSync, isSyncing, syncSuccess }: PostBlitzRookieHomeProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [isEditingStats, setIsEditingStats] = useState(false);
  const [blitzDetailsOpen, setBlitzDetailsOpen] = useState(false);
  const [uncommitSheetOpen, setUncommitSheetOpen] = useState(false);
  const [blitzToUncommit, setBlitzToUncommit] = useState<{ id: string; name: string } | null>(null);
  const { allBlitzes, loading: blitzesLoading } = useBlitzes();
  
  // Auto-refresh on component mount (when PWA reopens)
  useEffect(() => {
    onSync();
  }, []);

  // Local state for editable FP+ stat - initialize from repData
  const [personalFP, setPersonalFP] = useState(repData.personal_fp ?? 0);
  const personalFPGoal = 5; // Fixed goal for rookies

  // Sync local state with repData changes
  useEffect(() => {
    setPersonalFP(repData.personal_fp ?? 0);
  }, [repData.personal_fp]);

  const firstName = repData.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim().split(' ')[0];
  const personalFPProgress = personalFPGoal > 0 ? (personalFP / personalFPGoal) * 100 : 0;

  const saveGoals = async () => {
    try {
      const { error } = await supabase
        .from('reps')
        .update({
          personal_fp: personalFP,
        })
        .eq('id', repData.id);

      if (error) throw error;

      toast({
        title: "Progress saved",
        description: "Your FP+ has been updated successfully",
      });
      setIsEditingStats(false);
    } catch (error) {
      console.error("Error saving goals:", error);
      toast({
        title: "Save failed",
        description: "Could not save your progress. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    setLogoutSheetOpen(true);
  };

  const confirmLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const openLink = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleRefresh = async () => {
    onSync();
  };

  const { containerRef, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
    isRefreshing: isSyncing,
    threshold: 80,
  });

  // Get next upcoming blitz from committed blitzes
  const nextBlitz = repData.committed_blitzes && Array.isArray(repData.committed_blitzes) 
    ? (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcomingBlitzes = repData.committed_blitzes
          .filter((blitz: any) => {
            if (!blitz || typeof blitz !== 'object' || !blitz.date) return false;
            const blitzEndDate = blitz.endDate ? new Date(blitz.endDate) : new Date(blitz.date);
            blitzEndDate.setHours(0, 0, 0, 0);
            return blitzEndDate >= today;
          })
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        return upcomingBlitzes[0] || null;
      })()
    : null;

  const daysUntilBlitz = nextBlitz ? Math.ceil((new Date(nextBlitz.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

  // Check if rookie had past blitzes but no upcoming ones
  const committedBlitzes = (repData.committed_blitzes as any[]) || [];
  const hasPastBlitzes = committedBlitzes.some((blitz: any) => {
    if (!blitz?.endDate) return false;
    const endDate = new Date(blitz.endDate);
    return endDate < new Date();
  });

  // Handle blitz commitment toggle
  const handleBlitzToggle = async (blitzId: string, blitzName: string) => {
    if (!repData.notion_page_id) {
      toast({
        title: "Error",
        description: "Unable to update commitment. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    const currentCommitments = (repData.committed_blitzes as any[]) || [];
    const isCurrentlyCommitted = currentCommitments.some((b: any) => b.id === blitzId);
    
    if (isCurrentlyCommitted) {
      // Show confirmation sheet for uncommit
      setBlitzToUncommit({ id: blitzId, name: blitzName });
      setUncommitSheetOpen(true);
      return;
    }

    // Commit - trigger confetti
    const blitz = allBlitzes.find(b => b.id === blitzId);
    if (!blitz) return;

    const newCommitments = [...currentCommitments, blitz];

    try {
      const blitzPageIds = newCommitments.map((b: any) => b.id);
      
      const { error } = await supabase.functions.invoke('update-blitz-commitment', {
        body: { 
          repNotionPageId: repData.notion_page_id,
          blitzPageIds 
        },
      });

      if (error) throw error;

      // Update local state optimistically
      const { error: updateError } = await supabase
        .from('reps')
        .update({ committed_blitzes: newCommitments })
        .eq('id', repData.id);

      if (updateError) throw updateError;

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      toast({
        title: "Committed! 🎉",
        description: `You're now committed to ${blitzName}`,
      });
    } catch (error) {
      console.error("Error updating commitment:", error);
      toast({
        title: "Update failed",
        description: "Could not update your commitment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const confirmUncommit = async () => {
    if (!blitzToUncommit) return;

    const currentCommitments = (repData.committed_blitzes as any[]) || [];
    const newCommitments = currentCommitments.filter((b: any) => b.id !== blitzToUncommit.id);

    try {
      const blitzPageIds = newCommitments.map((b: any) => b.id);
      
      const { error } = await supabase.functions.invoke('update-blitz-commitment', {
        body: { 
          repNotionPageId: repData.notion_page_id,
          blitzPageIds 
        },
      });

      if (error) throw error;

      // Update local state
      const { error: updateError } = await supabase
        .from('reps')
        .update({ committed_blitzes: newCommitments })
        .eq('id', repData.id);

      if (updateError) throw updateError;

      toast({
        title: "Uncommitted",
        description: `Removed from ${blitzToUncommit.name}`,
      });
    } catch (error) {
      console.error("Error updating commitment:", error);
      toast({
        title: "Update failed",
        description: "Could not update your commitment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUncommitSheetOpen(false);
      setBlitzToUncommit(null);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-b from-background to-secondary/30 overflow-y-auto">
      {/* Pull to refresh hint */}
      <div 
        className="fixed top-0 left-0 right-0 flex justify-center pt-2 z-50 transition-opacity duration-200 pointer-events-none"
        style={{ opacity: pullDistance > 0 ? Math.min(pullDistance / 80, 0.6) : 0 }}
      >
        <p className="text-xs text-muted-foreground">Pull down to refresh</p>
      </div>
      
      {/* Header with colored background */}
      <div className="bg-primary text-primary-foreground p-6 pb-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0 pr-4">
              {(() => {
                const hour = new Date().getHours();
                let greeting = "Good evening";
                if (hour < 12) {
                  greeting = "Good morning";
                } else if (hour < 18) {
                  greeting = "Good afternoon";
                }
                
                return (
                  <>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">
                      {greeting}, {firstName}
                    </h1>
                    {!nextBlitz && hasPastBlitzes && (
                      <p className="text-sm text-primary-foreground/80">
                        🔥 Keep the momentum rolling — commit to another blitz below
                      </p>
                    )}
                    {!nextBlitz && !hasPastBlitzes && (
                      <p className="text-sm text-primary-foreground/80">
                        📅 Pick a blitz trip and commit to making your next sale
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex gap-2 flex-shrink-0 self-start">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
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
                onClick={handleLogout}
                className="rounded-full text-primary-foreground hover:bg-primary-foreground/10"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 pb-32">
        {/* Monday Night Lights Alert - Shows only on Mondays 5am-8pm MST */}
        {(() => {
          const now = new Date();
          const mstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
          const dayOfWeek = mstTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
          const hour = mstTime.getHours();
          
          // Show only on Mondays (1) between 5am (5) and 8pm (20)
          const shouldShowMondayNights = dayOfWeek === 1 && hour >= 5 && hour < 20;
          
          return shouldShowMondayNights ? (
            <Card className="mb-6 shadow-sm border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Moon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Monday Night Lights</h3>
                    <p className="text-sm text-muted-foreground">
                      Happening now at <strong>6pm MST</strong> — watch Slack for the link!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null;
        })()}

        {/* FP+ Progress Card */}
        <Card className="mb-6 shadow-lg border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Progress</CardTitle>
              <div className="flex items-center gap-2">
                {isEditingStats ? (
                  <Button
                    size="sm"
                    onClick={saveGoals}
                  >
                    Save
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingStats(true)}
                  >
                    <Edit2 className="h-4 w-4 mr-1.5" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Personal FP+ */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Personal FP+</Label>
                {isEditingStats ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="done"
                      value={personalFP}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Allow typing decimal point and numbers
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setPersonalFP(val === '' ? 0 : parseFloat(val) || 0);
                        }
                      }}
                      onBlur={(e) => {
                        // Round to 1 decimal place on blur
                        const val = parseFloat(e.target.value) || 0;
                        setPersonalFP(Math.round(val * 10) / 10);
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-16 h-8 text-center"
                    />
                    <span className="text-muted-foreground">/</span>
                    <span className="text-lg font-bold">{personalFPGoal}</span>
                  </div>
                ) : (
                  <span className="text-lg font-bold">
                    {personalFP % 1 === 0 ? personalFP : personalFP.toFixed(1)} / {personalFPGoal}
                  </span>
                )}
              </div>
              <Progress value={personalFPProgress} className="h-3" />
              <p className="text-sm text-muted-foreground">
                {Math.round(personalFPProgress)}% towards your first 5 FP+
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Blitzes Card */}
        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Your Blitz Commitments
            </CardTitle>
            <CardDescription>Manage which blitzes you're attending</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {blitzesLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading blitzes...</p>
            ) : allBlitzes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming blitzes available</p>
            ) : (
              allBlitzes.map((blitz) => {
                const committedBlitzes = (repData.committed_blitzes as any[]) || [];
                const isCommitted = committedBlitzes.some((b: any) => b.id === blitz.id);
                const startDate = new Date(blitz.date);
                const endDate = blitz.endDate ? new Date(blitz.endDate) : startDate;
                const dateStr =
                  startDate.toDateString() === endDate.toDateString()
                    ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

                return (
                  <div
                    key={blitz.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{blitz.name}</h3>
                          {isCommitted && (
                            <Badge className="bg-green-500 text-white border-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Committed
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <Calendar className="h-4 w-4" />
                          <span>{dateStr}</span>
                          {blitz.location && <span>• {blitz.location}</span>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isCommitted ? "destructive" : "default"}
                        onClick={() => handleBlitzToggle(blitz.id, blitz.name)}
                      >
                        {isCommitted ? "Uncommit" : "Commit"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Bring a Friend Callout */}
        <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-bold text-lg">Bring a Friend</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Talk to your friends about Vivint. The more people you bring out to summer, the more fun it'll be! Get them in a group chat with your leader.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logout Confirmation Sheet */}
      <Sheet open={logoutSheetOpen} onOpenChange={setLogoutSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Are you sure you want to log out?</SheetTitle>
            <SheetDescription>
              You'll need to sign in again to access your journey.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <Button 
              className="w-full h-12 text-base"
              variant="destructive"
              onClick={confirmLogout}
            >
              Yes, Log Out
            </Button>
            <Button 
              className="w-full h-12 text-base"
              variant="outline"
              onClick={() => setLogoutSheetOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Blitz Details Sheet */}
      {nextBlitz && (
        <Sheet open={blitzDetailsOpen} onOpenChange={setBlitzDetailsOpen}>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <BlitzCountdown
              tripName={nextBlitz.name}
              tripDate={nextBlitz.date}
              tripEndDate={nextBlitz.endDate}
              tripLocation={nextBlitz.location}
              isVet={false}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Uncommit Confirmation Sheet */}
      <Sheet open={uncommitSheetOpen} onOpenChange={setUncommitSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Uncommit from Blitz?</SheetTitle>
            <SheetDescription>
              Are you sure you want to uncommit from {blitzToUncommit?.name}? You can always commit again later.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <Button 
              className="w-full h-12 text-base"
              variant="destructive"
              onClick={confirmUncommit}
            >
              Yes, Uncommit
            </Button>
            <Button 
              className="w-full h-12 text-base"
              variant="outline"
              onClick={() => setUncommitSheetOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
