import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, LogOut, Calendar, Zap, Target, Moon, Users, Edit2, HelpCircle, MessageSquare, Calculator, CheckCircle2 } from "lucide-react";
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
  const [helpSheetOpen, setHelpSheetOpen] = useState(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [blitzDetailsOpen, setBlitzDetailsOpen] = useState(false);
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

  // Handle blitz commitment toggle
  const handleBlitzToggle = async (blitzId: string) => {
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
    
    let newCommitments;
    if (isCurrentlyCommitted) {
      // Uncommit
      newCommitments = currentCommitments.filter((b: any) => b.id !== blitzId);
    } else {
      // Commit - trigger confetti
      const blitz = allBlitzes.find(b => b.id === blitzId);
      if (blitz) {
        newCommitments = [...currentCommitments, blitz];
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else {
        newCommitments = currentCommitments;
      }
    }

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

      toast({
        title: isCurrentlyCommitted ? "Uncommitted" : "Committed!",
        description: isCurrentlyCommitted 
          ? "You've been removed from this blitz" 
          : "You're now committed to this blitz",
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
          <div className="flex items-start justify-between mb-3">
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
                  <h1 className="text-3xl font-bold tracking-tight">
                    {greeting}, {firstName}
                  </h1>
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
        {/* FP+ Progress Card */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Progress</CardTitle>
              <div className="flex items-center gap-2">
                <Sheet open={helpSheetOpen} onOpenChange={setHelpSheetOpen}>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setHelpSheetOpen(true)}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                  <SheetContent side="bottom" className="rounded-t-3xl">
                    <SheetHeader>
                      <SheetTitle>Need help setting goals?</SheetTitle>
                      <SheetDescription>
                        Get with your leaders to set preseason goals that push you but are attainable.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        This online preseason calculator also is super helpful in determining what recruiting work needs to be done in order to hit goals on the year.
                      </p>
                      <div className="space-y-3">
                        <Button 
                          variant="outline"
                          className="w-full h-12 text-base"
                          onClick={() => {
                            openLink("https://vivintevolution.com/2026-season-calculator/");
                            setHelpSheetOpen(false);
                          }}
                        >
                          <Calculator className="h-5 w-5 mr-2" />
                          Recruiting Calculator
                        </Button>
                        <Button 
                          className="w-full h-12 text-base"
                          onClick={() => {
                            const phone = repData.team_leader_phone;
                            if (phone) {
                              window.location.href = `sms:${phone}`;
                              setHelpSheetOpen(false);
                            } else {
                              toast({
                                title: "No phone number",
                                description: "Team leader phone number not available",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <MessageSquare className="h-5 w-5 mr-2" />
                          Message Leader
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
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
                      onChange={(e) => setPersonalFP(Number(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-16 h-8 text-center"
                    />
                    <span className="text-muted-foreground">/</span>
                    <span className="text-lg font-bold">{personalFPGoal}</span>
                  </div>
                ) : (
                  <span className="text-lg font-bold">
                    {personalFP} / {personalFPGoal}
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

        {/* Dynamic Blitz CTA */}
        {!nextBlitz ? (
          <Card 
            className="mb-6 shadow-sm cursor-pointer hover:shadow-md transition-all bg-card border-2 border-border/50"
            onClick={() => setCalendarModalOpen(true)}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base mb-0.5">Pick your next blitz trip</h3>
                  <p className="text-sm text-muted-foreground">
                    Commit to attending another blitz
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : daysUntilBlitz !== null && daysUntilBlitz < 7 ? (
          <Card 
            className="mb-6 shadow-sm cursor-pointer hover:shadow-md transition-all bg-card border-2 border-accent/30"
            onClick={() => setBlitzDetailsOpen(true)}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base mb-0.5">
                    {daysUntilBlitz} {daysUntilBlitz === 1 ? 'day' : 'days'} until {nextBlitz.location}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Tap to view weather and packing list
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card 
            className="mb-6 shadow-sm cursor-pointer hover:shadow-md transition-all bg-card border-2 border-border/50"
            onClick={() => setBlitzDetailsOpen(true)}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base mb-0.5">
                    {daysUntilBlitz} days until {nextBlitz.location}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Tap to view details
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Blitzes Card */}
        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Upcoming Blitzes
            </CardTitle>
            <CardDescription>Browse and commit to preseason trips</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {blitzesLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading blitzes...</p>
            ) : allBlitzes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming blitzes available</p>
            ) : (
              allBlitzes.map((blitz) => {
                const committedBlitzes = (repData.committed_blitzes as any[]) || [];
                const isCommitted = committedBlitzes.some((b: any) => b.id === blitz.id);
                return (
                  <div
                    key={blitz.id}
                    onClick={() => handleBlitzToggle(blitz.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isCommitted
                        ? 'bg-accent/10 border-accent/50 hover:bg-accent/15'
                        : 'bg-muted/30 border-border/30 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {isCommitted && <CheckCircle2 className="h-5 w-5 text-accent" />}
                          <p className="font-semibold">{blitz.name}</p>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(blitz.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {blitz.endDate && ` - ${new Date(blitz.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                          {blitz.location && ` • ${blitz.location}`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Monday Night Lights Card */}
        <Card className="mb-6 shadow-sm bg-gradient-to-br from-card to-secondary/20 border-2 border-border/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Moon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Monday Night Lights</h3>
                <p className="text-sm text-muted-foreground">
                  Every Monday at <strong>6pm MST</strong> — watch Slack for the link!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bring a Friend Callout Card */}
        <Card className="mb-6 shadow-sm bg-gradient-to-br from-accent/5 to-accent/10 border-2 border-accent/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Bring a Friend</h3>
                <p className="text-sm text-muted-foreground">
                  Talk to your friends about Vivint. The more people you bring out to summer, the more fun it'll be! Get them in a group chat with your leader.
                </p>
              </div>
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

      {/* Calendar Modal */}
      <TeamCalendarModal 
        open={calendarModalOpen}
        onOpenChange={setCalendarModalOpen}
        teamLeaderPhone={repData.team_leader_phone || ""}
      />

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
    </div>
  );
};
