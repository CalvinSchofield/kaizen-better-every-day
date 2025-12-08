import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Calendar, Moon, Users, CheckCircle2, Check, ChevronRight, X, MapPin, Wifi, Key } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { RepData } from "@/hooks/useRepData";
import { useBlitzes } from "@/hooks/useBlitzes";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { YourProgressCard } from "@/components/YourProgressCard";
import { useYTDPRMR } from "@/hooks/useYTDPRMR";
import TeamCalendarModal from "@/components/TeamCalendarModal";
import { PendingInstallAlertCard } from "@/components/PendingInstallAlertCard";
import { PreseasonStandardsCard } from "@/components/PreseasonStandardsCard";
import { WeeklyProgressPromptCard } from "@/components/WeeklyProgressPromptCard";
import confetti from "canvas-confetti";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [blitzDetailsOpen, setBlitzDetailsOpen] = useState(false);
  const [uncommitSheetOpen, setUncommitSheetOpen] = useState(false);
  const [blitzToUncommit, setBlitzToUncommit] = useState<{ id: string; name: string } | null>(null);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [locallyRespondedBlitzIds, setLocallyRespondedBlitzIds] = useState<string[]>([]);
  const [weatherSheetOpen, setWeatherSheetOpen] = useState(false);
  const [weather, setWeather] = useState<Array<{ date: string; dayName: string; high: number; low: number; weatherCode: number; precipitation: number }>>([]);
  const [loadingWeather, setLoadingWeather] = useState(false);

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
  const { efpModeEnabled } = useEfpMode();
  
  // Auto-refresh on component mount (when PWA reopens)
  useEffect(() => {
    onSync();
  }, []);

  const firstName = repData.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim().split(' ')[0];

  const handleLogout = () => {
    setLogoutSheetOpen(true);
  };

  const confirmLogout = async () => {
    try {
      // Clear all caches before signing out
      localStorage.removeItem('rep-data-cache');
      queryClient.clear();
      
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

  const openInMaps = (address: string) => {
    if (!address) return;
    
    // Encode address for URL
    const encodedAddress = encodeURIComponent(address);
    
    // Try to detect platform and use appropriate maps URL
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS) {
      // Apple Maps
      window.location.href = `maps://maps.apple.com/?q=${encodedAddress}`;
    } else if (isAndroid) {
      // Google Maps intent
      window.location.href = `geo:0,0?q=${encodedAddress}`;
    } else {
      // Fallback to Google Maps web
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  };

  const copyToClipboard = async (text: string, successMessage: string) => {
    if (!text) return;
    
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: successMessage,
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
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

  // Fetch weather when blitz is within 8 days AND weather sheet opens
  useEffect(() => {
    const fetchWeather = async () => {
      if (!nextBlitz || !nextBlitz.location || !nextBlitz.date || !nextBlitz.endDate) {
        console.log("Weather fetch skipped - missing blitz data:", { nextBlitz });
        setWeather([]);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tripDate = new Date(nextBlitz.date);
      tripDate.setHours(0, 0, 0, 0);
      const diffTime = tripDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      console.log("Weather check:", { diffDays, location: nextBlitz.location, weatherSheetOpen });

      // Skip if blitz is in the past or more than 8 days away (allow 0-8 days)
      if (diffDays < 0 || diffDays > 8) {
        console.log("Weather fetch skipped - blitz not in range");
        setWeather([]);
        return;
      }

      // Only fetch if sheet is open to avoid unnecessary calls
      if (!weatherSheetOpen) {
        return;
      }

      console.log("Fetching weather for:", nextBlitz.location);
      setLoadingWeather(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-blitz-weather", {
          body: {
            location: nextBlitz.location,
            startDate: nextBlitz.date,
            endDate: nextBlitz.endDate,
          },
        });

        console.log("Weather response:", { data, error });

        if (error) {
          console.error("Weather API error:", error);
          toast({
            title: "Weather unavailable",
            description: "Could not load weather forecast. Please try again.",
            variant: "destructive",
          });
          return;
        }

        if (data?.forecasts) {
          console.log("Setting weather data:", data.forecasts);
          setWeather(data.forecasts);
        } else {
          console.log("No forecast data in response");
        }
      } catch (error) {
        console.error("Error fetching weather:", error);
        toast({
          title: "Weather error",
          description: "Failed to fetch weather forecast.",
          variant: "destructive",
        });
      } finally {
        setLoadingWeather(false);
      }
    };

    fetchWeather();
  }, [nextBlitz, weatherSheetOpen, toast]);

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
      
      // Clear any previous decline record (in case they changed their mind)
      await supabase.functions.invoke('toggle-blitz-decline', {
        body: {
          blitzId,
          repNotionPageId: repData.notion_page_id,
          isDeclined: false,
        },
      });

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
  // Shows at 21 days (first ask) AND again at 10 days (confirmation)
  const declinedBlitzes = (repData.declined_blitz_rsvps as string[]) || [];
  const upcomingBlitzForRsvp = allBlitzes.find((blitz) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const blitzDate = new Date(blitz.date);
    blitzDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((blitzDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Must be within the RSVP windows: 21-14 days (first ask) OR 10-0 days (confirmation ask)
    const inFirstWindow = daysUntil >= 14 && daysUntil <= 21;
    const inSecondWindow = daysUntil >= 0 && daysUntil <= 10;
    if (!inFirstWindow && !inSecondWindow) return false;
    
    // Must not be already committed
    const isCommitted = (repData.committed_blitzes as any[])?.some((b: any) => b.id === blitz.id);
    
    // For 10-day window, show even if committed (reconfirm) but not if declined
    if (inSecondWindow) {
      if (declinedBlitzes.includes(blitz.id) || locallyRespondedBlitzIds.includes(blitz.id)) return false;
      return true; // Show for confirmation even if committed
    }
    
    // For 21-day window, don't show if committed or declined
    if (isCommitted) return false;
    if (declinedBlitzes.includes(blitz.id) || locallyRespondedBlitzIds.includes(blitz.id)) return false;
    
    return true;
  });
  
  // Clear optimistic state when data updates from DB
  useEffect(() => {
    if (locallyRespondedBlitzIds.length > 0) {
      // Remove any blitz IDs that are now in the DB (either committed or declined)
      const updatedIds = locallyRespondedBlitzIds.filter(id => {
        const isCommitted = (repData.committed_blitzes as any[])?.some((b: any) => b.id === id);
        const isDeclined = declinedBlitzes.includes(id);
        return !isCommitted && !isDeclined;
      });
      
      if (updatedIds.length !== locallyRespondedBlitzIds.length) {
        setLocallyRespondedBlitzIds(updatedIds);
      }
    }
  }, [repData.committed_blitzes, declinedBlitzes, locallyRespondedBlitzIds]);

  const handleRsvpYes = async () => {
    if (!upcomingBlitzForRsvp) return;
    
    setLocallyRespondedBlitzIds(prev => [...prev, upcomingBlitzForRsvp.id]); // Optimistic update - hides RSVP immediately
    
    // Check if already committed (for 10-day confirmation)
    const currentCommitments = (repData.committed_blitzes as any[]) || [];
    const isAlreadyCommitted = currentCommitments.some((b: any) => b.id === upcomingBlitzForRsvp.id);
    
    if (isAlreadyCommitted) {
      // Just confirming - clear any decline and show confirmation
      await supabase.functions.invoke('toggle-blitz-decline', {
        body: {
          blitzId: upcomingBlitzForRsvp.id,
          repNotionPageId: repData.notion_page_id,
          isDeclined: false,
        },
      });
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      toast({
        title: "Confirmed! 🎉",
        description: `You've confirmed ${upcomingBlitzForRsvp.name}`,
      });
    } else {
      // Commit to the blitz
      await handleBlitzToggle(upcomingBlitzForRsvp.id, upcomingBlitzForRsvp.name);
    }
  };

  const handleRsvpNo = async () => {
    if (!upcomingBlitzForRsvp) return;
    
    setLocallyRespondedBlitzIds(prev => [...prev, upcomingBlitzForRsvp.id]); // Optimistic update - hides RSVP immediately
    
    // Add to declined list in rep's record
    const newDeclined = [...declinedBlitzes, upcomingBlitzForRsvp.id];
    
    try {
      // Save to local rep record for RSVP tracking
      const { error } = await supabase
        .from('reps')
        .update({ declined_blitz_rsvps: newDeclined })
        .eq('id', repData.id);
      
      if (error) throw error;
      
      // Also save to shared blitz_declines table so leaders can see who declined
      await supabase.functions.invoke('toggle-blitz-decline', {
        body: {
          blitzId: upcomingBlitzForRsvp.id,
          repNotionPageId: repData.notion_page_id,
          isDeclined: true,
        },
      });
    } catch (error) {
      console.error("Error declining RSVP:", error);
      toast({
        title: "Error",
        description: "Could not save your response. Please try again.",
        variant: "destructive",
      });
      // Remove the failed ID from optimistic state
      setLocallyRespondedBlitzIds(prev => prev.filter(id => id !== upcomingBlitzForRsvp.id));
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
            </div>
          </div>

          {/* RSVP Card - Shows when blitz is within 2 weeks and not committed */}
          {upcomingBlitzForRsvp && (
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

          {/* CTA Card - Show when no RSVP needed */}
          {!upcomingBlitzForRsvp && !nextBlitz && (
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
          {!upcomingBlitzForRsvp && nextBlitz && (() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tripDate = new Date(nextBlitz.date);
            const diffTime = tripDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // Check if user is currently within the blitz date range
            const blitzStart = new Date(nextBlitz.date);
            blitzStart.setHours(0, 0, 0, 0);
            const blitzEnd = nextBlitz.endDate ? new Date(nextBlitz.endDate) : blitzStart;
            blitzEnd.setHours(23, 59, 59, 999);
            const isWithinBlitz = today >= blitzStart && today <= blitzEnd;
            
            let ctaText = "";
            let ctaIcon = "";
            
            if (diffDays === 0) {
              ctaText = `${nextBlitz.location || 'Your blitz'} today — you got this!`;
              ctaIcon = "🔥";
            } else if (diffDays === 1) {
              ctaText = `1 day until ${nextBlitz.location || 'your blitz'} — prep makes perfect`;
              ctaIcon = "⚡";
            } else if (diffDays <= 8) {
              ctaText = `${diffDays} days until ${nextBlitz.location || 'your blitz'} — prep makes perfect`;
              ctaIcon = "⚡";
            } else {
              ctaText = `${nextBlitz.location || 'Your blitz'} in ${diffDays} days — stay sharp and keep training!`;
              ctaIcon = "🎯";
            }
            
            // Show Airbnb actions when within blitz date range
            if (isWithinBlitz) {
              // Only show action buttons if at least one field is available
              const hasAirbnbData = nextBlitz.address1 || nextBlitz.wifi1 || nextBlitz.code1;
              
              return (
                <div className="flex flex-col gap-2 w-full px-6 py-3 rounded-lg bg-primary-foreground/10 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">{ctaIcon}</span>
                    <p className="text-primary-foreground/90 text-base font-medium leading-snug flex-1">
                      {diffDays === 0 ? ctaText : `${nextBlitz.location} this week — you got this!`}
                    </p>
                  </div>
                  
                  {/* Airbnb Action Buttons - pill style inside card */}
                  {hasAirbnbData && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {nextBlitz.address1 && (
                        <button 
                          onClick={() => openInMaps(nextBlitz.address1!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-primary/30 bg-background/50 hover:bg-background/70 transition-all text-sm font-medium"
                        >
                          <MapPin className="w-4 h-4" />
                          <span>Map</span>
                        </button>
                      )}
                      
                      {nextBlitz.wifi1 && (
                        <button 
                          onClick={() => copyToClipboard(nextBlitz.wifi1!, 'WiFi password copied!')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-primary/30 bg-background/50 hover:bg-background/70 transition-all text-sm font-medium"
                        >
                          <Wifi className="w-4 h-4" />
                          <span>Password</span>
                        </button>
                      )}
                      
                      {nextBlitz.code1 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-primary/30 bg-background/50 text-sm font-medium">
                          <Key className="w-4 h-4" />
                          <span className="font-mono">{nextBlitz.code1}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            } else if (diffDays <= 8) {
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
            }
            
            return (
              <div className="flex items-center gap-3 text-left w-full px-6 py-3 rounded-lg bg-primary-foreground/10 transition-all mb-3">
                <span className="text-2xl flex-shrink-0">{ctaIcon}</span>
                <p className="text-primary-foreground/90 text-base font-medium leading-snug flex-1">
                  {ctaText}
                </p>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 pb-32">
        {/* Pending Install Alert - shows after 7 PM if pending installs */}
        <PendingInstallAlertCard />

        {/* Monday Night Lights Alert - Shows only on Mondays 9am-8:30pm MST */}
        {(() => {
          const now = new Date();
          const mstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
          const dayOfWeek = mstTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
          const hour = mstTime.getHours();
          const minutes = mstTime.getMinutes();
          const totalMinutes = hour * 60 + minutes;
          
          // Show only on Mondays (1) between 9am (540 minutes) and 8:30pm (1230 minutes)
          const shouldShowMondayNights = dayOfWeek === 1 && totalMinutes >= 540 && totalMinutes <= 1230;
          
          // MNL starts at 6pm MST (1080 minutes), "Happening Now" = within 1 hour of start (5pm+) or after start
          const mnlStartMinutes = 18 * 60; // 6pm = 1080 minutes
          const isWithinOneHourOfStart = totalMinutes >= mnlStartMinutes - 60; // 5pm or later
          const statusText = isWithinOneHourOfStart ? "Happening Now!" : "Later Today";
          
          // Calculate countdown to 6pm MST
          const minutesUntilStart = mnlStartMinutes - totalMinutes;
          const hoursUntil = Math.floor(minutesUntilStart / 60);
          const minsUntil = minutesUntilStart % 60;
          const countdownText = hoursUntil > 0 
            ? `${hoursUntil}h ${minsUntil}m` 
            : `${minsUntil}m`;
          
          return shouldShowMondayNights ? (
            <Card className="mb-6 shadow-sm border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Moon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Monday Night Lights — {statusText}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isWithinOneHourOfStart 
                        ? "Watch Slack for the link!" 
                        : <>Starts in <strong>{countdownText}</strong> — watch Slack for the link!</>
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null;
        })()}

        {/* Weekly Progress Prompt - Monday evenings */}
        <WeeklyProgressPromptCard />

        {/* Your Progress Card */}
        <YourProgressCard 
          repData={repData}
          personalFP={personalFP}
          ytdPRMR={ytdPRMR}
          efpModeEnabled={efpModeEnabled}
          loadingFP={loadingFP}
        />

        {/* Preseason Standards Card */}
        <PreseasonStandardsCard />

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

      {/* Weather Details Sheet */}
      <Sheet open={weatherSheetOpen} onOpenChange={setWeatherSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Weather for {nextBlitz?.location}</SheetTitle>
            <SheetDescription>
              {nextBlitz?.name}
            </SheetDescription>
          </SheetHeader>
          
          {loadingWeather && (
            <div className="text-center text-sm text-muted-foreground py-8">
              <div className="animate-pulse">Loading weather forecast...</div>
            </div>
          )}
          
          {!loadingWeather && weather.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              <p>Weather forecast unavailable for this location.</p>
              <p className="text-xs mt-2">Try refreshing or check back later.</p>
            </div>
          )}
          
          {!loadingWeather && weather.length > 0 && (
            <>
              {/* Horizontal scrollable weather cards */}
              <div className="overflow-x-auto -mx-6 px-6 mt-4">
                <div className="flex gap-3 pb-2">
                  {weather.map((day) => {
                    const getWeatherIcon = (code: number) => {
                      if (code === 0) return "☀️";
                      if (code >= 1 && code <= 3) return "⛅";
                      if (code >= 45 && code <= 48) return "🌫️";
                      if (code >= 51 && code <= 67) return "🌧️";
                      if (code >= 71 && code <= 77) return "❄️";
                      if (code >= 80 && code <= 82) return "🌦️";
                      if (code >= 85 && code <= 86) return "🌨️";
                      if (code >= 95 && code <= 99) return "⛈️";
                      return "☀️";
                    };

                    return (
                      <div key={day.date} className="flex-shrink-0 w-24 p-3 bg-muted/30 rounded-lg text-center border border-border">
                        <p className="text-xs font-medium mb-2">{day.dayName}</p>
                        <div className="text-2xl mb-2">
                          {getWeatherIcon(day.weatherCode)}
                        </div>
                        <p className="text-sm font-semibold mb-1">{day.high}°</p>
                        <p className="text-xs text-muted-foreground">{day.low}°</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Weather Tip */}
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground italic text-center">
                  {(() => {
                    const avgHigh = weather.reduce((sum, day) => sum + day.high, 0) / weather.length;
                    const avgLow = weather.reduce((sum, day) => sum + day.low, 0) / weather.length;
                    
                    if (avgHigh > 85) {
                      return "Pack light and bring sunscreen — it's going to be hot out there!";
                    } else if (avgHigh < 60) {
                      return "Pack warm — it gets colder than you think when you're outside all day. Pants are probably the move not shorts.";
                    } else if (avgLow < 50) {
                      return "Days are nice but mornings are cold — bring layers you can adjust throughout the day.";
                    }
                    return "Perfect knocking weather — prep your pitch and pack smart!";
                  })()}
                </p>
              </div>

              {/* Packing List Button */}
              <div className="mt-4">
                <Button
                  className="w-full"
                  onClick={() => {
                    setWeatherSheetOpen(false);
                    window.open('https://www.notion.so/Packing-List-Blitz-Trips-63bbc6dd1afd4340a9c9ca5533c838b4', '_blank');
                  }}
                >
                  View Packing List
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Team Calendar Modal */}
      <TeamCalendarModal
        open={calendarModalOpen}
        onOpenChange={setCalendarModalOpen}
      />
      
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
