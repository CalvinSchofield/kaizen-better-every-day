import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, LogOut, Calendar, Moon, Users, Edit2, CheckCircle2, Check, ChevronRight, Info, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { RepData } from "@/hooks/useRepData";
import { useBlitzes } from "@/hooks/useBlitzes";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useYTDPRMR } from "@/hooks/useYTDPRMR";
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
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [weatherSheetOpen, setWeatherSheetOpen] = useState(false);
  const [weather, setWeather] = useState<Array<{ date: string; high: number; low: number; weatherCode: number; precipitation: number }>>([]);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [rsvpResponse, setRsvpResponse] = useState<'yes' | 'no' | null>(null);
  const [locallyRespondedBlitzId, setLocallyRespondedBlitzId] = useState<string | null>(null);

  // Get weather icon based on WMO weather code
  const getWeatherIcon = (code: number) => {
    if (code === 0) return "☀️"; // Clear sky
    if (code <= 3) return "⛅"; // Partly cloudy
    if (code <= 48) return "🌫️"; // Fog
    if (code <= 57) return "🌦️"; // Drizzle
    if (code <= 67) return "🌧️"; // Rain
    if (code <= 77) return "❄️"; // Snow
    if (code <= 82) return "🌧️"; // Rain showers
    if (code <= 86) return "🌨️"; // Snow showers
    return "⛈️"; // Thunderstorm
  };

  // Check if weather code indicates rain
  const isRainy = (code: number) => {
    return code >= 51 && code <= 82; // Drizzle, rain, and rain showers
  };
  const { allBlitzes, loading: blitzesLoading } = useBlitzes();
  
  // Get FP+ from daily entries (preseason only)
  const { totalFP: personalFP, isLoading: loadingFP } = usePreseasonFP();
  const { totalPRMR: ytdPRMR } = useYTDPRMR();
  
  // Auto-refresh on component mount (when PWA reopens)
  useEffect(() => {
    onSync();
  }, []);

  // Local state for editable FP+ goal - initialize from repData
  const [personalFPGoal, setPersonalFPGoal] = useState(repData.personal_fp_goal ?? 5);
  const [personalFPGoalInput, setPersonalFPGoalInput] = useState(String(repData.personal_fp_goal ?? 5));

  // Sync local state with repData changes
  useEffect(() => {
    setPersonalFPGoal(repData.personal_fp_goal ?? 5);
    setPersonalFPGoalInput(String(repData.personal_fp_goal ?? 5));
  }, [repData.personal_fp_goal]);

  const firstName = repData.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim().split(' ')[0];
  const personalFPProgress = personalFPGoal > 0 ? (personalFP / personalFPGoal) * 100 : 0;

  const saveGoals = async () => {
    try {
      // Convert input to number and round to 1 decimal place
      const fpGoalValue = Math.round(parseFloat(personalFPGoalInput) * 10) / 10 || 0;
      
      const { error } = await supabase
        .from('reps')
        .update({
          personal_fp_goal: fpGoalValue,
        })
        .eq('id', repData.id);

      if (error) throw error;

      // Update local state with the saved value
      setPersonalFPGoal(fpGoalValue);
      setPersonalFPGoalInput(String(fpGoalValue));

      toast({
        title: "Goal saved",
        description: "Your FP+ goal has been updated successfully",
      });
      setIsEditingStats(false);
    } catch (error) {
      console.error("Error saving goals:", error);
      toast({
        title: "Save failed",
        description: "Could not save your goal. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    setLogoutSheetOpen(true);
  };

  const confirmLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout failed",
        description: "Could not log out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLogoutSheetOpen(false);
    }
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

  // Fetch weather when blitz is within 7 days
  useEffect(() => {
    const fetchWeather = async () => {
      if (!nextBlitz || !nextBlitz.location || !nextBlitz.date || !nextBlitz.endDate) {
        setWeather([]);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tripDate = new Date(nextBlitz.date);
      tripDate.setHours(0, 0, 0, 0);
      const diffTime = tripDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Only fetch weather if blitz is within 7 days and in the future
      if (diffDays <= 0 || diffDays > 7) {
        setWeather([]);
        return;
      }

      setLoadingWeather(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-blitz-weather", {
          body: {
            location: nextBlitz.location,
            startDate: nextBlitz.date,
            endDate: nextBlitz.endDate,
          },
        });

        if (!error && data?.forecasts) {
          setWeather(data.forecasts);
        }
      } catch (error) {
        console.error("Error fetching weather:", error);
      } finally {
        setLoadingWeather(false);
      }
    };

    fetchWeather();
  }, [nextBlitz]);

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

      // Refetch to update next blitz and UI
      onSync();

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

      // Refetch to update next blitz and UI
      onSync();

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

  // RSVP Logic - Check if we should show RSVP for next upcoming blitz
  const declinedBlitzes = (repData.declined_blitz_rsvps as string[]) || [];
  const upcomingBlitzForRsvp = allBlitzes.find((blitz) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const blitzDate = new Date(blitz.date);
    blitzDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((blitzDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Must be within 14 days and not yet started
    if (daysUntil < 0 || daysUntil > 14) return false;
    
    // Must not be already committed
    const isCommitted = (repData.committed_blitzes as any[])?.some((b: any) => b.id === blitz.id);
    if (isCommitted) return false;
    
    // Must not be declined
    if (declinedBlitzes.includes(blitz.id)) return false;
    
    // Must not be the one we just responded to (optimistic state)
    if (locallyRespondedBlitzId === blitz.id) return false;
    
    return true;
  });
  
  // Clear optimistic state when data updates
  useEffect(() => {
    if (locallyRespondedBlitzId) {
      // Check if the blitz we responded to is no longer in the "needs RSVP" state
      const stillNeedsRsvp = allBlitzes.some(blitz => {
        const isCommitted = (repData.committed_blitzes as any[])?.some((b: any) => b.id === blitz.id);
        const isDeclined = declinedBlitzes.includes(blitz.id);
        return blitz.id === locallyRespondedBlitzId && !isCommitted && !isDeclined;
      });
      
      if (!stillNeedsRsvp) {
        setLocallyRespondedBlitzId(null);
      }
    }
  }, [repData.committed_blitzes, declinedBlitzes, locallyRespondedBlitzId, allBlitzes]);

  const handleRsvpYes = async () => {
    if (!upcomingBlitzForRsvp) return;
    
    setRsvpResponse('yes');
    setLocallyRespondedBlitzId(upcomingBlitzForRsvp.id); // Optimistic update
    
    // Commit to the blitz
    await handleBlitzToggle(upcomingBlitzForRsvp.id, upcomingBlitzForRsvp.name);
    
    setTimeout(() => setRsvpResponse(null), 1500);
  };

  const handleRsvpNo = async () => {
    if (!upcomingBlitzForRsvp) return;
    
    setRsvpResponse('no');
    setLocallyRespondedBlitzId(upcomingBlitzForRsvp.id); // Optimistic update
    
    // Add to declined list
    const newDeclined = [...declinedBlitzes, upcomingBlitzForRsvp.id];
    
    try {
      const { error } = await supabase
        .from('reps')
        .update({ declined_blitz_rsvps: newDeclined })
        .eq('id', repData.id);
      
      if (error) throw error;
      
      setTimeout(() => setRsvpResponse(null), 1500);
    } catch (error) {
      console.error("Error declining RSVP:", error);
      toast({
        title: "Error",
        description: "Could not save your response. Please try again.",
        variant: "destructive",
      });
      setRsvpResponse(null);
      setLocallyRespondedBlitzId(null); // Reset on error
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

          {/* RSVP Card - Shows when blitz is within 2 weeks and not committed */}
          {upcomingBlitzForRsvp && !rsvpResponse && (
            <div className="px-6 py-4 rounded-lg bg-primary-foreground/10 mb-3">
              <p className="text-primary-foreground/90 text-base font-medium mb-3">
                📆 {upcomingBlitzForRsvp.location} in {Math.ceil((new Date(upcomingBlitzForRsvp.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days — you in?
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleRsvpYes}
                  className="flex-1 h-11 text-base bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Yes
                </Button>
                <Button
                  onClick={handleRsvpNo}
                  variant="outline"
                  className="flex-1 h-11 text-base bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-primary-foreground/30"
                >
                  <X className="w-5 h-5 mr-2" />
                  No
                </Button>
              </div>
            </div>
          )}

          {/* Animated RSVP Response */}
          {rsvpResponse === 'yes' && (
            <div className="px-6 py-4 rounded-lg bg-green-500 text-white mb-3 animate-scale-in">
              <p className="text-base font-medium text-center">
                <Check className="w-5 h-5 inline mr-2" />
                Great! Committing you now...
              </p>
            </div>
          )}
          {rsvpResponse === 'no' && (
            <div className="px-6 py-4 rounded-lg bg-red-500 text-white mb-3 animate-scale-in">
              <p className="text-base font-medium text-center">
                <X className="w-5 h-5 inline mr-2" />
                No problem, pick another blitz below
              </p>
            </div>
          )}

          {/* CTA Card - Show when no RSVP needed */}
          {!upcomingBlitzForRsvp && !rsvpResponse && !nextBlitz && (
            <button
              onClick={() => setCalendarModalOpen(true)}
              className="group flex items-center gap-3 text-left w-full px-6 py-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-all mb-3"
            >
              <span className="text-2xl flex-shrink-0">📆</span>
              <p className="text-primary-foreground/90 text-base font-medium leading-snug flex-1">
                {hasPastBlitzes 
                  ? "Pick a blitz trip and commit to making your next sale"
                  : "Pick a blitz trip and commit to making your first sale"}
              </p>
              <ChevronRight className="w-5 h-5 text-primary-foreground/60 group-hover:translate-x-1 transition-transform flex-shrink-0" />
            </button>
          )}
          {!upcomingBlitzForRsvp && !rsvpResponse && nextBlitz && (() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tripDate = new Date(nextBlitz.date);
            const diffTime = tripDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let ctaText = "";
            let ctaIcon = "";
            
            if (diffDays <= 7) {
              ctaText = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} until ${nextBlitz.location || 'your blitz'} — prep makes perfect`;
              ctaIcon = "⚡";
            } else {
              ctaText = `${nextBlitz.location || 'Your blitz'} in ${diffDays} days — stay sharp and keep training!`;
              ctaIcon = "🎯";
            }
            
            return (
              <button
                onClick={() => setWeatherSheetOpen(true)}
                className="group flex items-center gap-3 text-left w-full px-6 py-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-all mb-3"
              >
                <span className="text-2xl flex-shrink-0">{ctaIcon}</span>
                <p className="text-primary-foreground/90 text-base font-medium leading-snug flex-1">
                  {ctaText}
                </p>
                <ChevronRight className="w-5 h-5 text-primary-foreground/60 group-hover:translate-x-1 transition-transform flex-shrink-0" />
              </button>
            );
          })()}
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
                <div className="flex items-center gap-2">
                  <Label className="text-base font-medium">Personal FP+</Label>
                  {isEditingStats && (
                    <button
                      onClick={() => {
                        navigate('/calendar');
                        toast({
                          title: "Track daily",
                          description: "Add your daily entries here to see your FP+ grow automatically",
                        });
                      }}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Track numbers info"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {isEditingStats ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">
                      {personalFP % 1 === 0 ? personalFP : personalFP.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">/</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="done"
                      value={personalFPGoalInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Allow typing decimal point and numbers
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setPersonalFPGoalInput(val);
                        }
                      }}
                      onBlur={(e) => {
                        // Round to 1 decimal place and update actual value
                        const val = parseFloat(e.target.value) || 0;
                        const rounded = Math.round(val * 10) / 10;
                        setPersonalFPGoal(rounded);
                        setPersonalFPGoalInput(String(rounded));
                      }}
                      onFocus={(e) => {
                        e.target.select();
                        setPersonalFPGoalInput(String(personalFPGoal));
                      }}
                      disabled={personalFP < 5}
                      className="w-16 h-8 text-center disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Goal"
                    />
                  </div>
                ) : (
                  <span className="text-lg font-bold">
                    {personalFP % 1 === 0 ? personalFP : personalFP.toFixed(1)} / {personalFPGoal % 1 === 0 ? personalFPGoal : personalFPGoal.toFixed(1)}
                  </span>
                )}
              </div>
              <Progress value={personalFPProgress} className="h-3" />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {Math.round(personalFPProgress)}% towards your first 5 FP+
                </p>
                <p className="text-xs text-muted-foreground">
                  YTD: ${ytdPRMR.toLocaleString()}
                </p>
              </div>
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

      {/* Team Calendar Modal */}
      <TeamCalendarModal
        open={calendarModalOpen}
        onOpenChange={setCalendarModalOpen}
      />

      {/* Weather Sheet */}
      <Sheet open={weatherSheetOpen} onOpenChange={setWeatherSheetOpen}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-center">
              {nextBlitz?.location || 'Blitz'} Weather
            </SheetTitle>
          </SheetHeader>
          
          <div className="relative">
            <div className="overflow-x-auto pb-3 scrollbar-hide">
              <div className="flex gap-3 px-1">
                {weather.map((day) => {
                    // Parse date in UTC to avoid timezone issues
                    const [year, month, dayNum] = day.date.split('-').map(Number);
                    const date = new Date(year, month - 1, dayNum);
                    const hasRain = isRainy(day.weatherCode);
                    
                    return (
                      <div
                        key={day.date}
                        className={`flex-shrink-0 w-20 p-3 rounded-xl bg-secondary/30 border transition-colors text-center ${
                          hasRain ? 'border-blue-400/50 bg-blue-50/5' : 'border-border/50'
                        }`}
                      >
                        <div className="text-xs text-muted-foreground font-semibold mb-1">
                          {date.toLocaleDateString("en-US", { weekday: "short" })}
                        </div>
                        <div className="text-[10px] text-muted-foreground/70 mb-2">
                          {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                        <div className="text-3xl mb-2">{getWeatherIcon(day.weatherCode)}</div>
                        <div className="text-base font-bold">{day.high}°</div>
                        <div className="text-[10px] text-muted-foreground/70">{day.low}°</div>
                      </div>
                    );
                  })}
              </div>
            </div>
            
            {/* Subtle scroll gradient indicators */}
            {weather.length > 4 && (
              <>
                <div className="absolute left-0 top-0 bottom-3 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-3 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
              </>
            )}
          </div>

          {/* Cold/Rain Warning */}
          {(() => {
            const hasColdDay = weather.some(day => day.high < 65);
            const hasRainDay = weather.some(day => isRainy(day.weatherCode));
            
            return (hasColdDay || hasRainDay) && (
              <div className="mt-3 mb-4">
                <p className="text-xs text-muted-foreground italic text-center leading-relaxed">
                  Pack warm — it gets colder than you think when you're outside all day. Pants are probably the move not shorts.
                </p>
              </div>
            );
          })()}

          {/* Packing List Button */}
          {(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tripDate = nextBlitz ? new Date(nextBlitz.date) : null;
            const diffTime = tripDate ? tripDate.getTime() - today.getTime() : 0;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            return diffDays <= 4 && (
              <div className="mt-4 pt-4 border-t">
                <Button
                  onClick={() => {
                    const url = "https://calvinschofield.notion.site/Packing-List-Blitz-Trips-63bbc6dd1afd4340a9c9ca5533c838b4";
                    const notionMatch = url.match(/([a-f0-9]{32}|[a-f0-9-]{36})/);
                    if (notionMatch) {
                      const pageId = notionMatch[1].replace(/-/g, '');
                      window.location.href = `notion://${pageId}`;
                      setTimeout(() => {
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }, 500);
                    }
                    setWeatherSheetOpen(false);
                  }}
                  className="w-full"
                  size="lg"
                >
                  View Packing List
                </Button>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
      
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};
