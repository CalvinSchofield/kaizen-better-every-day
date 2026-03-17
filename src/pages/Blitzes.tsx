import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Check, X, MapPin, Wifi, Key, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRepData } from "@/hooks/useRepData";
import { useBlitzes } from "@/hooks/useBlitzes";
import { useBlitzAttendanceLogger } from "@/hooks/useBlitzAttendanceLogger";
import { VetBlitzCard } from "@/components/VetBlitzCard";
import { PendingInstallAlertCard } from "@/components/PendingInstallAlertCard";
import { VetAlertCard } from "@/components/VetAlertCard";

import { LeaderRookieReviewCard } from "@/components/LeaderRookieReviewCard";
import { ActiveChallengesCard } from "@/components/ActiveChallengesCard";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { getDaysUntilBlitz, getTodayDateString, parseDateAsLocal } from "@/utils/blitzDateUtils";
import { useMondayNightLightsEvent } from "@/hooks/useMondayNightLightsEvent";
import confetti from "canvas-confetti";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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

const Blitzes = () => {
  const { repData, refetch } = useRepData();
  const { toast } = useToast();
  const { hasMnlEventToday } = useMondayNightLightsEvent();
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
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: teamAccessData } = useTeamAccess();
  const isLeader = teamAccessData?.accessLevel && teamAccessData.accessLevel !== 'none';

  // Auto-log blitz attendance for leaders
  useBlitzAttendanceLogger(allBlitzesIncludingPast, isLeader);

  // Get next upcoming blitz from committed blitzes
  const nextBlitz: { date: string; endDate?: string | null; location?: string | null; name: string; address1?: string | null; wifi1?: string | null; code1?: string | null; id: string } | null = repData?.committed_blitzes && Array.isArray(repData.committed_blitzes)
    ? (() => {
        const today = parseDateAsLocal(getTodayDateString()) ?? new Date();
        const upcomingBlitzes = (repData.committed_blitzes as any[])
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

  const committedBlitzesArr = (repData?.committed_blitzes as any[]) || [];
  const hasPastBlitzes = committedBlitzesArr.some((blitz: any) => {
    const today = parseDateAsLocal(getTodayDateString()) ?? new Date();
    const endDate = parseDateAsLocal(blitz?.endDate);
    if (!endDate) return false;
    return endDate.getTime() < today.getTime();
  });

  const daysUntilBlitz = nextBlitz ? getDaysUntilBlitz(nextBlitz.date) : null;

  // Fetch weather when sheet opens
  useEffect(() => {
    const fetchWeather = async () => {
      if (!nextBlitz || !nextBlitz.location || !nextBlitz.date || !nextBlitz.endDate) {
        setWeather([]);
        return;
      }
      const diffDays = getDaysUntilBlitz(nextBlitz.date) ?? -1;
      if (diffDays < 0 || diffDays > 8 || !weatherSheetOpen) {
        if (!weatherSheetOpen) return;
        setWeather([]);
        return;
      }
      setLoadingWeather(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-blitz-weather", {
          body: { location: nextBlitz.location, startDate: nextBlitz.date, endDate: nextBlitz.endDate },
        });
        if (error) {
          toast({ title: "Weather unavailable", description: "Could not load weather forecast.", variant: "destructive" });
          return;
        }
        if (data?.forecasts) setWeather(data.forecasts);
      } catch {
        toast({ title: "Weather error", description: "Failed to fetch weather forecast.", variant: "destructive" });
      } finally {
        setLoadingWeather(false);
      }
    };
    fetchWeather();
  }, [nextBlitz, weatherSheetOpen, toast]);

  // Fetch team members for team leads
  const fetchTeamMembers = useCallback(async () => {
    if (!repData?.id) return;
    setTeamLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-team-members', {
        body: { leaderId: repData.id },
      });
      if (error) throw error;
      if (data) {
        setIsTeamLead(data.isTeamLead || false);
        if (data.teamMembers) {
          setTeamMembers(data.teamMembers.filter((m: TeamMember) => m.id !== repData.id));
        }
      }
    } catch {
      // Silent fail - team data is supplementary
    } finally {
      setTeamLoading(false);
    }
  }, [repData?.id]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers, refreshTrigger]);

  const firstName = repData?.name?.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim().split(' ')[0] || '';

  const copyToClipboard = async (text: string, successMessage: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: successMessage, duration: 2000 });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard", variant: "destructive" });
    }
  };

  const openInMaps = (address: string) => {
    if (!address) return;
    const encodedAddress = encodeURIComponent(address);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    if (isIOS) window.location.href = `maps://maps.apple.com/?q=${encodedAddress}`;
    else if (isAndroid) window.location.href = `geo:0,0?q=${encodedAddress}`;
    else window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  };

  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
      await refetch();
    } finally {
      setIsSyncing(false);
    }
    setRefreshTrigger(prev => prev + 1);
  };

  // RSVP Logic
  const declinedBlitzes = (repData?.declined_blitz_rsvps as string[]) || [];
  const firstWindowAckBlitzIds = (repData as any)?.rsvp_first_window_ack_blitz_ids || [];
  const secondWindowAckBlitzIds = (repData as any)?.rsvp_second_window_ack_blitz_ids || [];

  const upcomingBlitzForRsvp = hasRespondedToRsvpThisSession ? null : allBlitzes.find((blitz) => {
    const daysUntil = getDaysUntilBlitz(blitz.date);
    if (daysUntil === null) return false;
    const inFirstWindow = daysUntil >= 14 && daysUntil <= 21;
    const inSecondWindow = daysUntil >= 0 && daysUntil <= 10;
    if (!inFirstWindow && !inSecondWindow) return false;
    if (declinedBlitzes.includes(blitz.id) || locallyRespondedBlitzIds.includes(blitz.id)) return false;
    if (secondWindowAckBlitzIds.includes(blitz.id)) return false;
    if (inFirstWindow && firstWindowAckBlitzIds.includes(blitz.id)) return false;
    return true;
  });

  const rsvpBlitzDaysUntil = upcomingBlitzForRsvp ? getDaysUntilBlitz(upcomingBlitzForRsvp.date) : null;
  const isInSecondWindow = rsvpBlitzDaysUntil !== null && rsvpBlitzDaysUntil >= 0 && rsvpBlitzDaysUntil <= 10;
  const isRsvpBlitzCommitted = upcomingBlitzForRsvp
    ? (repData?.committed_blitzes as any[])?.some((b: any) => b.id === upcomingBlitzForRsvp.id)
    : false;

  const saveWindowAck = async (blitzId: string, isSecondWindowAck: boolean) => {
    const columnName = isSecondWindowAck ? 'rsvp_second_window_ack_blitz_ids' : 'rsvp_first_window_ack_blitz_ids';
    const currentAcks = isSecondWindowAck ? secondWindowAckBlitzIds : firstWindowAckBlitzIds;
    const newAcks = [...new Set([...currentAcks, blitzId])];
    await supabase.from('reps').update({ [columnName]: newAcks }).eq('id', repData!.id);
  };

  const handleRsvpYes = async () => {
    if (!upcomingBlitzForRsvp || !repData?.id) return;
    setHasRespondedToRsvpThisSession(true);
    setLocallyRespondedBlitzIds(prev => [...prev, upcomingBlitzForRsvp.id]);
    await saveWindowAck(upcomingBlitzForRsvp.id, isInSecondWindow);

    const currentCommitments = (repData.committed_blitzes as any[]) || [];
    const isAlreadyCommitted = currentCommitments.some((b: any) => b.id === upcomingBlitzForRsvp.id);
    const newCommitments = isAlreadyCommitted ? currentCommitments : [...currentCommitments, upcomingBlitzForRsvp];

    try {
      if (!isAlreadyCommitted) {
        const blitzPageIds = newCommitments.map((b: any) => b.id);
        const { error } = await supabase.functions.invoke('update-blitz-commitment', {
          body: { repId: repData.id, blitzPageIds },
        });
        if (error) throw error;
        const { error: updateError } = await supabase.from('reps').update({ committed_blitzes: newCommitments }).eq('id', repData.id);
        if (updateError) throw updateError;
      }
      await supabase.functions.invoke('toggle-blitz-decline', {
        body: { blitzId: upcomingBlitzForRsvp.id, repId: repData.id, isDeclined: false },
      });
      handleRefresh();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      toast({
        title: isAlreadyCommitted ? "Confirmed! 🎉" : "Committed! 🎉",
        description: isAlreadyCommitted ? `You've confirmed ${upcomingBlitzForRsvp.name}` : `You're now committed to ${upcomingBlitzForRsvp.name}`,
      });
    } catch {
      toast({ title: "Update failed", description: "Could not update your commitment.", variant: "destructive" });
      setLocallyRespondedBlitzIds(prev => prev.filter(id => id !== upcomingBlitzForRsvp.id));
    }
  };

  const handleRsvpNo = async () => {
    if (!upcomingBlitzForRsvp || !repData?.id) return;
    setHasRespondedToRsvpThisSession(true);
    setLocallyRespondedBlitzIds(prev => [...prev, upcomingBlitzForRsvp.id]);
    await saveWindowAck(upcomingBlitzForRsvp.id, isInSecondWindow);
    const newDeclined = [...declinedBlitzes, upcomingBlitzForRsvp.id];
    try {
      const { error } = await supabase.from('reps').update({ declined_blitz_rsvps: newDeclined }).eq('id', repData.id);
      if (error) throw error;
      await supabase.functions.invoke('toggle-blitz-decline', {
        body: { blitzId: upcomingBlitzForRsvp.id, repId: repData.id, isDeclined: true },
      });
    } catch {
      toast({ title: "Error", description: "Could not save your response.", variant: "destructive" });
      setLocallyRespondedBlitzIds(prev => prev.filter(id => id !== upcomingBlitzForRsvp.id));
    }
  };

  if (!repData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      {/* Hero Section */}
      <div className="bg-primary text-primary-foreground p-6 pb-10 -mt-[1px]">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-4">
              {(() => {
                const hour = new Date().getHours();
                let greeting = "Good evening";
                if (hour < 12) greeting = "Good morning";
                else if (hour < 18) greeting = "Good afternoon";
                return (
                  <h2 className="text-3xl font-bold tracking-tight">
                    {greeting}, {firstName}
                  </h2>
                );
              })()}
            </div>
          </div>

          {/* RSVP Card */}
          {upcomingBlitzForRsvp && (
            <div className="px-6 py-4 rounded-lg bg-primary-foreground/10 mb-3">
              <p className="text-primary-foreground/90 text-base font-medium mb-3">
                {isRsvpBlitzCommitted
                  ? `📆 Still planning on ${upcomingBlitzForRsvp.location} in ${rsvpBlitzDaysUntil} days?`
                  : `📆 ${upcomingBlitzForRsvp.location} in ${rsvpBlitzDaysUntil} days — you in?`}
              </p>
              <div className="flex gap-3">
                <Button onClick={handleRsvpYes} className="flex-1 h-11 text-base bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground">
                  <Check className="w-5 h-5 mr-2" />
                  {isRsvpBlitzCommitted ? "Still in!" : "Yes"}
                </Button>
                <Button onClick={handleRsvpNo} variant="outline" className="flex-1 h-11 text-base bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-primary-foreground/30">
                  <X className="w-5 h-5 mr-2" />
                  {isRsvpBlitzCommitted ? "Can't make it" : "No"}
                </Button>
              </div>
            </div>
          )}

          {/* Blitz CTA when no RSVP */}
          {!upcomingBlitzForRsvp && !nextBlitz && (
            <button
              onClick={() => {
                const blitzCard = document.querySelector('[data-blitz-card]');
                if (blitzCard) blitzCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="group flex items-center gap-3 text-left w-full px-6 py-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-all mt-4"
            >
              <span className="text-2xl flex-shrink-0">📆</span>
              <p className="text-primary-foreground/90 text-base font-medium leading-snug flex-1">
                {hasPastBlitzes ? "Pick a blitz trip and commit to making your next sale" : "Pick a blitz trip and commit to making your first sale"}
              </p>
              <ChevronRight className="w-5 h-5 text-primary-foreground/60 group-hover:translate-x-1 transition-transform flex-shrink-0" />
            </button>
          )}

          {!upcomingBlitzForRsvp && nextBlitz && (() => {
            const today = parseDateAsLocal(getTodayDateString()) ?? new Date();
            const diffDays = getDaysUntilBlitz(nextBlitz.date) ?? 0;
            const blitzStart = parseDateAsLocal(nextBlitz.date);
            const blitzEnd = parseDateAsLocal(nextBlitz.endDate ?? nextBlitz.date);
            if (!blitzStart || !blitzEnd) return null;
            const isWithinBlitz = today >= blitzStart && today <= blitzEnd;

            let ctaText = "";
            let ctaIcon = "";
            const locationName = nextBlitz.location?.split(',')[0] || 'Your blitz';

            if (diffDays < 0) { ctaText = `${locationName} this week — you got this!`; ctaIcon = "🔥"; }
            else if (diffDays === 0) { ctaText = `${locationName} today — you got this!`; ctaIcon = "🔥"; }
            else if (diffDays === 1) { ctaText = `${locationName} tomorrow — prep makes perfect`; ctaIcon = "⚡"; }
            else if (diffDays <= 8) { ctaText = `${locationName} in ${diffDays} days — prep makes perfect`; ctaIcon = "⚡"; }
            else { ctaText = `${locationName} in ${diffDays} days — stay sharp and keep training!`; ctaIcon = "🎯"; }

            if (isWithinBlitz) {
              const hasAirbnbData = nextBlitz.address1 || nextBlitz.wifi1 || nextBlitz.code1;
              return (
                <div className="flex flex-col gap-2 w-full px-6 py-3 rounded-lg bg-primary-foreground/10 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">{ctaIcon}</span>
                    <p className="text-primary-foreground/90 text-base font-medium leading-snug flex-1">{ctaText}</p>
                  </div>
                  {hasAirbnbData && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {nextBlitz.address1 && (
                        <button onClick={() => openInMaps(nextBlitz.address1!)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-primary/30 bg-background/50 hover:bg-background/70 transition-all text-sm font-medium">
                          <MapPin className="w-4 h-4" /><span>Map</span>
                        </button>
                      )}
                      {nextBlitz.wifi1 && (
                        <button onClick={() => copyToClipboard(nextBlitz.wifi1!, 'WiFi password copied!')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-primary/30 bg-background/50 hover:bg-background/70 transition-all text-sm font-medium">
                          <Wifi className="w-4 h-4" /><span>Password</span>
                        </button>
                      )}
                      {nextBlitz.code1 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-primary/30 bg-background/50 text-sm font-medium">
                          <Key className="w-4 h-4" /><span className="font-mono">{nextBlitz.code1}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            } else if (diffDays <= 8) {
              return (
                <button onClick={() => setWeatherSheetOpen(true)} className="group flex items-center gap-3 text-left w-full px-6 py-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-all mb-3">
                  <span className="text-2xl flex-shrink-0">{ctaIcon}</span>
                  <p className="text-primary-foreground/90 text-base font-medium leading-snug flex-1">{ctaText}</p>
                  <ChevronRight className="w-5 h-5 text-primary-foreground/60 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                </button>
              );
            }
            return (
              <div className="flex items-center gap-3 text-left w-full px-6 py-3 rounded-lg bg-primary-foreground/10 transition-all mb-3">
                <span className="text-2xl flex-shrink-0">{ctaIcon}</span>
                <p className="text-primary-foreground/90 text-base font-medium leading-snug flex-1">{ctaText}</p>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Content Cards */}
      <div className="max-w-4xl mx-auto px-4 -mt-4 pb-32 home-card-container">
        {/* Leader-specific alerts */}
        {isTeamLead && !teamLoading && (
          <VetAlertCard
            teamMembers={teamMembers}
            allBlitzes={allBlitzes}
            onTeamMemberUpdate={(id, updates) => {
              setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
            }}
          />
        )}
        <LeaderRookieReviewCard />

        {/* Universal alerts */}
        <PendingInstallAlertCard />
        

        {/* Monday Night Lights Alert */}
        {!isTeamLead && hasMnlEventToday && (() => {
          const now = new Date();
          const mstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
          const dayOfWeek = mstTime.getDay();
          const hour = mstTime.getHours();
          const minutes = mstTime.getMinutes();
          const totalMinutes = hour * 60 + minutes;
          const shouldShow = dayOfWeek === 1 && totalMinutes >= 540 && totalMinutes <= 1230;
          const mnlStartMinutes = 18 * 60;
          const isWithinOneHourOfStart = totalMinutes >= mnlStartMinutes - 60;
          const statusText = isWithinOneHourOfStart ? "Happening Now!" : "Later Today";
          const minutesUntilStart = mnlStartMinutes - totalMinutes;
          const hoursUntil = Math.floor(minutesUntilStart / 60);
          const minsUntil = minutesUntilStart % 60;
          const countdownText = hoursUntil > 0 ? `${hoursUntil}h ${minsUntil}m` : `${minsUntil}m`;

          return shouldShow ? (
            <Card className="home-card-spacing shadow-sm border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Moon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Monday Night Lights — {statusText}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isWithinOneHourOfStart ? "Watch Slack for the link!" : <>Starts in <strong>{countdownText}</strong> — watch Slack for the link!</>}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null;
        })()}

        {/* Active Challenges */}
        <ActiveChallengesCard hideCta={true} />

        {/* Blitz Management Card */}
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
              setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
            }}
            onCommitmentChange={() => {
              setTimeout(() => handleRefresh(), 3000);
            }}
          />
        </div>
      </div>

      {/* Weather Sheet */}
      <Sheet open={weatherSheetOpen} onOpenChange={setWeatherSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Weather for {nextBlitz?.location}</SheetTitle>
            <SheetDescription>{nextBlitz?.name}</SheetDescription>
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
                        <div className="text-2xl mb-2">{getWeatherIcon(day.weatherCode)}</div>
                        <p className="text-sm font-semibold mb-1">{day.high}°</p>
                        <p className="text-xs text-muted-foreground">{day.low}°</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground italic text-center">
                  {(() => {
                    const avgHigh = weather.reduce((sum, day) => sum + day.high, 0) / weather.length;
                    const avgLow = weather.reduce((sum, day) => sum + day.low, 0) / weather.length;
                    if (avgHigh > 85) return "Pack light and bring sunscreen — it's going to be hot out there!";
                    if (avgHigh < 60) return "Pack warm — it gets colder than you think when you're outside all day.";
                    if (avgLow < 50) return "Days are nice but mornings are cold — bring layers you can adjust throughout the day.";
                    return "Perfect knocking weather — prep your pitch and pack smart!";
                  })()}
                </p>
              </div>
              <div className="mt-4">
                <Button className="w-full" onClick={() => {
                  setWeatherSheetOpen(false);
                  window.open('https://www.notion.so/Packing-List-Blitz-Trips-63bbc6dd1afd4340a9c9ca5533c838b4', '_blank');
                }}>
                  View Packing List
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Blitzes;
