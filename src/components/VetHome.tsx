import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, Download, Users, Calendar, Zap, Moon, ChevronRight, Check, X, MapPin, Wifi, Key, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { RepData } from "@/hooks/useRepData";
import { RecruitingFlowCarousel } from "@/components/RecruitingFlowCarousel";
import { useBlitzes } from "@/hooks/useBlitzes";
import { useBlitzAttendanceLogger } from "@/hooks/useBlitzAttendanceLogger";
import { VetBlitzCard } from "@/components/VetBlitzCard";
import { PendingInstallAlertCard } from "@/components/PendingInstallAlertCard";
import { VetAlertCard } from "@/components/VetAlertCard";
import { PreseasonStandardsCard } from "@/components/PreseasonStandardsCard";
import { LeaderPreseasonPrepLeaderboard } from "@/components/LeaderPreseasonPrepLeaderboard";
import { WeeklyProgressPromptCard } from "@/components/WeeklyProgressPromptCard";
import { RecapCTACard } from "@/components/recap/RecapCTACard";
import { LeaderRookieReviewCard } from "@/components/LeaderRookieReviewCard";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useYTDPRMR } from "@/hooks/useYTDPRMR";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { getDaysUntilBlitz, getTodayDateString, parseDateAsLocal } from "@/utils/blitzDateUtils";
import { useMondayNightLightsEvent } from "@/hooks/useMondayNightLightsEvent";

import confetti from "canvas-confetti";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";

interface VetHomeProps {
  repData: RepData;
  onSync: () => void;
  isSyncing: boolean;
  syncSuccess: boolean;
}

// Pay scale documents
const PAY_SCALES = [
  { label: "Leader Pay Scale", file: "/documents/2025_Leader_Payscale.pdf" },
  { label: "Recruiter Pay Scale", file: "/documents/2025_Recruiter_Pay_Scale.pdf" },
  { label: "Sales Rep Pay Scale", file: "/documents/2025_Sales_Rep_Payscale.pdf" },
  { label: "Sales Rules", file: "/documents/2025_Sales_Rules.pdf" },
];

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  blitzReady: boolean;
  committedBlitzes: string[];
  ipadAssigned: boolean;
  year: string | null;
  stage: string | null;
  onboardingStatus: string | null;
}

export const VetHome = ({ repData, onSync, isSyncing, syncSuccess }: VetHomeProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasMnlEventToday } = useMondayNightLightsEvent();
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const { allBlitzes, allBlitzesIncludingPast, loading: blitzesLoading } = useBlitzes();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [teamLoading, setTeamLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [locallyRespondedBlitzIds, setLocallyRespondedBlitzIds] = useState<string[]>([]);
  const [hasRespondedToRsvpThisSession, setHasRespondedToRsvpThisSession] = useState(false);
  const [weatherSheetOpen, setWeatherSheetOpen] = useState(false);
  const [weather, setWeather] = useState<Array<{ date: string; dayName: string; high: number; low: number; weatherCode: number; precipitation: number }>>([]);
  const [loadingWeather, setLoadingWeather] = useState(false);
  
  // Get team access data for passing to VetBlitzCard
  const { data: teamAccessData } = useTeamAccess();
  const isLeader = teamAccessData?.accessLevel && teamAccessData.accessLevel !== 'none';
  
  // Auto-log blitz attendance for leaders
  useBlitzAttendanceLogger(allBlitzesIncludingPast, isLeader);
  
  // Get FP+ from daily entries (preseason only)
  const { totalFP: personalFP, isLoading: loadingFP } = usePreseasonFP();
  const { totalPRMR: ytdPRMR } = useYTDPRMR();
  const { efpModeEnabled } = useEfpMode();
  
  // Auto-refresh on component mount (when PWA reopens)
  useEffect(() => {
    onSync();
  }, []);

  // Get next upcoming blitz from committed blitzes
  const nextBlitz = repData.committed_blitzes && Array.isArray(repData.committed_blitzes) 
    ? (() => {
        const today = parseDateAsLocal(getTodayDateString()) ?? new Date();

        const upcomingBlitzes = repData.committed_blitzes
          .filter((blitz: any) => {
            if (!blitz || typeof blitz !== 'object' || !blitz.date) return false;
            const blitzEndDate = parseDateAsLocal(blitz.endDate ?? blitz.date);
            if (!blitzEndDate) return false;
            return blitzEndDate.getTime() >= today.getTime();
          })
          .sort((a: any, b: any) => {
            const aDate = parseDateAsLocal(a.date);
            const bDate = parseDateAsLocal(b.date);
            if (!aDate || !bDate) return 0;
            return aDate.getTime() - bDate.getTime();
          });

        return upcomingBlitzes[0] || null;
      })()
    : null;

  // Check if vet had past blitzes but no upcoming ones
  const committedBlitzes = (repData.committed_blitzes as any[]) || [];
  const hasPastBlitzes = committedBlitzes.some((blitz: any) => {
    const today = parseDateAsLocal(getTodayDateString()) ?? new Date();
    const endDate = parseDateAsLocal(blitz?.endDate);
    if (!endDate) return false;
    return endDate.getTime() < today.getTime();
  });

  const daysUntilBlitz = nextBlitz ? getDaysUntilBlitz(nextBlitz.date) : null;

  // Fetch weather when blitz is within 8 days OR when weather sheet opens
  useEffect(() => {
    const fetchWeather = async () => {
      if (!nextBlitz || !nextBlitz.location || !nextBlitz.date || !nextBlitz.endDate) {
        console.log("Weather fetch skipped - missing blitz data:", { nextBlitz });
        setWeather([]);
        return;
      }

      const diffDays = getDaysUntilBlitz(nextBlitz.date) ?? -1;

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

  // Fetch team members for team leads
  const fetchTeamMembers = useCallback(async () => {
      if (!repData?.notion_page_id) return;

      setTeamLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('fetch-team-members', {
          body: { leaderNotionPageId: repData.notion_page_id },
        });

        if (error) throw error;

        if (data) {
          setIsTeamLead(data.isTeamLead || false);
          
          if (data.teamMembers) {
            // Filter out the vet themselves from their team list
            const filteredMembers = data.teamMembers.filter(
              (member: TeamMember) => member.id !== repData.id
            );
            setTeamMembers(filteredMembers);
          }
        }
      } catch (error) {
        console.error('Error fetching team members:', error);
        toast({
          title: "Error loading team",
          description: "Could not load team members. Please refresh.",
          variant: "destructive",
        });
      } finally {
        setTeamLoading(false);
      }
  }, [repData?.notion_page_id, toast]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers, refreshTrigger]);
  
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

  const openInMaps = (address: string) => {
    if (!address) return;
    
    const encodedAddress = encodeURIComponent(address);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS) {
      window.location.href = `maps://maps.apple.com/?q=${encodedAddress}`;
    } else if (isAndroid) {
      window.location.href = `geo:0,0?q=${encodedAddress}`;
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  };

  const handleRefresh = async () => {
    onSync();
    setRefreshTrigger(prev => prev + 1);
  };

  const { containerRef, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
    isRefreshing: isSyncing,
    threshold: 80,
  });

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const response = await fetch(filePath);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download started",
        description: `${fileName} is downloading`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Unable to download file",
        variant: "destructive",
      });
    }
  };

  // RSVP Logic - Check if we should show RSVP for next upcoming blitz
  // Shows at 21-14 days (first ask) AND again at 10-0 days (confirmation ask)
  // Tracks per-window acknowledgement so responding in first window doesn't show again until second window
  // Edge case: if user opens app for first time in both windows, only show once (second window takes precedence)
  const declinedBlitzes = (repData.declined_blitz_rsvps as string[]) || [];
  const firstWindowAckBlitzIds = (repData as any).rsvp_first_window_ack_blitz_ids || [];
  const secondWindowAckBlitzIds = (repData as any).rsvp_second_window_ack_blitz_ids || [];
  
  const upcomingBlitzForRsvp = hasRespondedToRsvpThisSession ? null : allBlitzes.find((blitz) => {
    const daysUntil = getDaysUntilBlitz(blitz.date);
    if (daysUntil === null) return false;
    
    // Must be within the RSVP windows: 21-14 days (first ask) OR 10-0 days (confirmation ask)
    const inFirstWindow = daysUntil >= 14 && daysUntil <= 21;
    const inSecondWindow = daysUntil >= 0 && daysUntil <= 10;
    if (!inFirstWindow && !inSecondWindow) return false;
    
    // Skip if already declined or locally responded this session
    if (declinedBlitzes.includes(blitz.id) || locallyRespondedBlitzIds.includes(blitz.id)) return false;
    
    // Per-window acknowledgement logic:
    // - If in second window and already ack'd second window -> skip
    // - If in first window and already ack'd first window -> skip
    // - If in second window and only ack'd first window -> show (double confirmation)
    // - Edge case: if ack'd second window, never show again for this blitz
    if (secondWindowAckBlitzIds.includes(blitz.id)) return false;
    if (inFirstWindow && firstWindowAckBlitzIds.includes(blitz.id)) return false;
    
    return true;
  });
  
  // Determine which window we're in for the RSVP blitz
  const rsvpBlitzDaysUntil = upcomingBlitzForRsvp ? getDaysUntilBlitz(upcomingBlitzForRsvp.date) : null;
  const isInSecondWindow = rsvpBlitzDaysUntil !== null && rsvpBlitzDaysUntil >= 0 && rsvpBlitzDaysUntil <= 10;
  
  // Check if the RSVP blitz is already committed (for different language)
  const isRsvpBlitzCommitted = upcomingBlitzForRsvp 
    ? (repData.committed_blitzes as any[])?.some((b: any) => b.id === upcomingBlitzForRsvp.id) 
    : false;
  
  // Helper to save window acknowledgement to database
  const saveWindowAck = async (blitzId: string, isSecondWindow: boolean) => {
    const columnName = isSecondWindow ? 'rsvp_second_window_ack_blitz_ids' : 'rsvp_first_window_ack_blitz_ids';
    const currentAcks = isSecondWindow ? secondWindowAckBlitzIds : firstWindowAckBlitzIds;
    const newAcks = [...new Set([...currentAcks, blitzId])];
    
    await supabase
      .from('reps')
      .update({ [columnName]: newAcks })
      .eq('id', repData.id);
  };

  const handleRsvpYes = async () => {
    if (!upcomingBlitzForRsvp || !repData.notion_page_id) return;
    
    // Set session flag to prevent any more RSVPs from showing this session
    setHasRespondedToRsvpThisSession(true);
    setLocallyRespondedBlitzIds(prev => [...prev, upcomingBlitzForRsvp.id]); // Optimistic update - hides RSVP immediately
    
    // Save window acknowledgement so it doesn't reappear until next window (or never if second window)
    await saveWindowAck(upcomingBlitzForRsvp.id, isInSecondWindow);
    
    // Commit to the blitz
    const currentCommitments = (repData.committed_blitzes as any[]) || [];
    // Check if already committed (for 10-day confirmation)
    const isAlreadyCommitted = currentCommitments.some((b: any) => b.id === upcomingBlitzForRsvp.id);
    const newCommitments = isAlreadyCommitted ? currentCommitments : [...currentCommitments, upcomingBlitzForRsvp];
    
    try {
      if (!isAlreadyCommitted) {
        const blitzPageIds = newCommitments.map((b: any) => b.id);
        
        const { error } = await supabase.functions.invoke('update-blitz-commitment', {
          body: { 
            repNotionPageId: repData.notion_page_id,
            blitzPageIds 
          },
        });

        if (error) throw error;

        const { error: updateError } = await supabase
          .from('reps')
          .update({ committed_blitzes: newCommitments })
          .eq('id', repData.id);

        if (updateError) throw updateError;
      }
      
      // Clear any previous decline record (in case they changed their mind)
      await supabase.functions.invoke('toggle-blitz-decline', {
        body: {
          blitzId: upcomingBlitzForRsvp.id,
          repNotionPageId: repData.notion_page_id,
          isDeclined: false,
        },
      });

      onSync();

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      toast({
        title: isAlreadyCommitted ? "Confirmed! 🎉" : "Committed! 🎉",
        description: isAlreadyCommitted ? `You've confirmed ${upcomingBlitzForRsvp.name}` : `You're now committed to ${upcomingBlitzForRsvp.name}`,
      });
    } catch (error) {
      console.error("Error committing:", error);
      toast({
        title: "Update failed",
        description: "Could not update your commitment. Please try again.",
        variant: "destructive",
      });
      // Remove the failed ID from optimistic state
      setLocallyRespondedBlitzIds(prev => prev.filter(id => id !== upcomingBlitzForRsvp.id));
    }
  };

  const handleRsvpNo = async () => {
    if (!upcomingBlitzForRsvp) return;
    
    // Set session flag to prevent any more RSVPs from showing this session
    setHasRespondedToRsvpThisSession(true);
    setLocallyRespondedBlitzIds(prev => [...prev, upcomingBlitzForRsvp.id]); // Optimistic update - hides RSVP immediately
    
    // Save window acknowledgement
    await saveWindowAck(upcomingBlitzForRsvp.id, isInSecondWindow);
    
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
        <div className="max-w-4xl mx-auto">
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
            {/* Auto-refresh on mount, no manual button needed */}
          </div>

          {upcomingBlitzForRsvp && (
            <div className="px-6 py-4 rounded-lg bg-primary-foreground/10 mb-3">
              <p className="text-primary-foreground/90 text-base font-medium mb-3">
                {isRsvpBlitzCommitted 
                  ? `📆 Still planning on ${upcomingBlitzForRsvp.location} in ${Math.ceil((new Date(upcomingBlitzForRsvp.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days?`
                  : `📆 ${upcomingBlitzForRsvp.location} in ${Math.ceil((new Date(upcomingBlitzForRsvp.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days — you in?`
                }
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleRsvpYes}
                  className="flex-1 h-11 text-base bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
                >
                  <Check className="w-5 h-5 mr-2" />
                  {isRsvpBlitzCommitted ? "Still in!" : "Yes"}
                </Button>
                <Button
                  onClick={handleRsvpNo}
                  variant="outline"
                  className="flex-1 h-11 text-base bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-primary-foreground/30"
                >
                  <X className="w-5 h-5 mr-2" />
                  {isRsvpBlitzCommitted ? "Can't make it" : "No"}
                </Button>
              </div>
            </div>
          )}

          {/* CTA Card - Show when no RSVP needed */}
          {!upcomingBlitzForRsvp && !nextBlitz && (
            <button
              onClick={() => {
                const blitzCard = document.querySelector('[data-blitz-card]');
                if (blitzCard) {
                  blitzCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="group flex items-center gap-3 text-left w-full px-6 py-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-all mt-4"
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
            
            // Use calendar-day-based calculation for accurate "tomorrow" display
            const diffDays = getDaysUntilBlitz(nextBlitz.date) ?? 0;
            
            // Check if user is currently within the blitz date range
            const blitzStart = new Date(nextBlitz.date);
            blitzStart.setHours(0, 0, 0, 0);
            const blitzEnd = nextBlitz.endDate ? new Date(nextBlitz.endDate) : blitzStart;
            blitzEnd.setHours(23, 59, 59, 999);
            const isWithinBlitz = today >= blitzStart && today <= blitzEnd;
            
            let ctaText = "";
            let ctaIcon = "";
            
            const locationName = nextBlitz.location?.split(',')[0] || 'Your blitz';
            
            if (diffDays < 0) {
              // Currently mid-blitz
              ctaText = `${locationName} this week — you got this!`;
              ctaIcon = "🔥";
            } else if (diffDays === 0) {
              ctaText = `${locationName} today — you got this!`;
              ctaIcon = "🔥";
            } else if (diffDays === 1) {
              ctaText = `${locationName} tomorrow — prep makes perfect`;
              ctaIcon = "⚡";
            } else if (diffDays <= 8) {
              ctaText = `${locationName} in ${diffDays} days — prep makes perfect`;
              ctaIcon = "⚡";
            } else {
              ctaText = `${locationName} in ${diffDays} days — stay sharp and keep training!`;
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
                      {ctaText}
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

      <div className="max-w-4xl mx-auto px-4 -mt-4 pb-32">
        {/* Dynamic Alert Card for Team Leads */}
        {isTeamLead && !teamLoading && (
          <VetAlertCard 
            teamMembers={teamMembers}
            allBlitzes={allBlitzes}
            onTeamMemberUpdate={(id, updates) => {
              setTeamMembers(prev => 
                prev.map(m => 
                  m.id === id 
                    ? { ...m, ...updates }
                    : m
                )
              );
            }}
          />
        )}

        {/* Leader Rookie Review CTA - shows when rookies need phase verification */}
        <LeaderRookieReviewCard />

        {/* Pending Install Alert - shows after 7 PM if pending installs */}
        <PendingInstallAlertCard />

        {/* Weekly/Monthly Recap CTA */}
        <RecapCTACard />

        {/* Monday Night Lights Alert - Shows only on Mondays 9am-8:30pm MST if event exists on calendar, but NOT for team leads (they see VetAlertCard) */}
        {!isTeamLead && hasMnlEventToday && (() => {
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


        {/* Preseason Standards Card */}
        <PreseasonStandardsCard />

        {/* Leader Preseason Prep Leaderboard - shows rookies' progress with team leader attribution */}
        {isLeader && <LeaderPreseasonPrepLeaderboard />}

        {/* Unified Blitz Management - For leaders, show above recruiting flow */}
        {isLeader && (
          <div data-blitz-card>
            <VetBlitzCard 
              repData={repData} 
              allBlitzes={allBlitzes}
              teamMembers={teamMembers}
              isTeamLead={isTeamLead}
              isLoadingBlitzes={blitzesLoading}
              isLoadingTeam={teamLoading}
              accessLevel={teamAccessData?.accessLevel || 'none'}
              mgmtGroups={teamAccessData?.mgmtGroups || []}
              teams={teamAccessData?.teams || []}
              onTeamMemberUpdate={(id, updates) => {
                setTeamMembers(prev => 
                  prev.map(m => 
                    m.id === id 
                      ? { ...m, ...updates }
                      : m
                  )
                );
              }}
              onCommitmentChange={() => {
                // Delayed refresh to allow optimistic state to settle
                setTimeout(() => handleRefresh(), 3000);
              }}
            />
          </div>
        )}

        {/* Recruiting Flow Carousel */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Recruiting Flow</CardTitle>
            <CardDescription>
              Your step-by-step recruiting process
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <RecruitingFlowCarousel />
          </CardContent>
        </Card>

        {/* Blitz Management for non-leaders - show below recruiting flow */}
        {!isLeader && (
          <div data-blitz-card>
            <VetBlitzCard 
              repData={repData} 
              allBlitzes={allBlitzes}
              teamMembers={teamMembers}
              isTeamLead={isTeamLead}
              isLoadingBlitzes={blitzesLoading}
              isLoadingTeam={teamLoading}
              accessLevel={teamAccessData?.accessLevel || 'none'}
              mgmtGroups={teamAccessData?.mgmtGroups || []}
              teams={teamAccessData?.teams || []}
              onTeamMemberUpdate={(id, updates) => {
                setTeamMembers(prev => 
                  prev.map(m => 
                    m.id === id 
                      ? { ...m, ...updates }
                      : m
                  )
                );
              }}
              onCommitmentChange={() => {
                // Delayed refresh to allow optimistic state to settle
                setTimeout(() => handleRefresh(), 3000);
              }}
            />
          </div>
        )}

        {/* 5-5-5 Callout at Bottom */}
        <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20">
                <Target className="h-5 w-5 text-primary" />
                <span className="font-bold text-lg">5-5-5</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Not sure where to start? Make <span className="font-bold text-primary text-base">5</span> cold contacts every day, try and get <span className="font-bold text-primary text-base">5</span> reps with <span className="font-bold text-primary text-base">5</span> FP+ each before summer.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Logout Confirmation Sheet */}
        <Sheet open={logoutSheetOpen} onOpenChange={setLogoutSheetOpen}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Confirm Logout</SheetTitle>
              <SheetDescription>
                Are you sure you want to log out?
              </SheetDescription>
            </SheetHeader>
            <SheetFooter className="flex flex-row gap-2 mt-6">
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
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Weather Details Sheet */}
        <Sheet open={weatherSheetOpen} onOpenChange={setWeatherSheetOpen}>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
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
    </div>
  );
};
