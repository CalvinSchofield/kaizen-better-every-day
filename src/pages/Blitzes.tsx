import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Check, X, MapPin, Wifi, Key, Moon, AlertTriangle, Swords, Users, CloudSun, Pencil } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EditSummerDatesDrawer } from "@/components/mygroup/EditSummerDatesDrawer";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { formatBlitzDate } from "@/utils/blitzDateUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRepData } from "@/hooks/useRepData";
import { useBlitzes } from "@/hooks/useBlitzes";
import { useBlitzAttendanceLogger } from "@/hooks/useBlitzAttendanceLogger";
import { useBlitzRecapStats } from "@/hooks/useBlitzRecapStats";
import { BlitzRecapCard } from "@/components/BlitzRecapCard";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { formatBlitzDateRange as formatBlitzDateRangeUtil } from "@/utils/blitzDateUtils";
import { VetBlitzCard } from "@/components/VetBlitzCard";
import { PendingInstallAlertCard } from "@/components/PendingInstallAlertCard";
import { VetAlertCard } from "@/components/VetAlertCard";
import { LeaderRookieReviewCard } from "@/components/LeaderRookieReviewCard";
import { ActiveChallengesCard } from "@/components/ActiveChallengesCard";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { getDaysUntilBlitz, getTodayDateString, parseDateAsLocal, formatBlitzDateRange } from "@/utils/blitzDateUtils";
import { useMondayNightLightsEvent } from "@/hooks/useMondayNightLightsEvent";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
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
  const navigate = useNavigate();
  const { repData, refetch } = useRepData();
  const { toast } = useToast();
  const { hasMnlEventToday } = useMondayNightLightsEvent();
  const { allBlitzes, pastBlitzes: allPastBlitzes, allBlitzesIncludingPast, loading: blitzesLoading } = useBlitzes();
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
  const [showAlerts, setShowAlerts] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [editSummerDatesOpen, setEditSummerDatesOpen] = useState(false);

  const { userId } = useCurrentUserId();
  const queryClient = useQueryClient();

  // Fetch user's personal summer dates
  const { data: summerConfig } = useQuery({
    queryKey: ['blitz-page-summer-config', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: teamAccessData } = useTeamAccess();
  const isLeader = teamAccessData?.accessLevel && teamAccessData.accessLevel !== 'none';

  useBlitzAttendanceLogger(allBlitzesIncludingPast, isLeader);

  // Blitz recap stats for past committed blitzes
  const { data: recapStats } = useBlitzRecapStats(repData?.committed_blitzes as any[] | null);

  // Get next upcoming blitz from committed blitzes
  const nextBlitz: { date: string; endDate?: string | null; location?: string | null; name: string; address1?: string | null; wifi1?: string | null; code1?: string | null; id: string; accommodations?: any[] } | null = repData?.committed_blitzes && Array.isArray(repData.committed_blitzes)
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
      // Silent fail
    } finally {
      setTeamLoading(false);
    }
  }, [repData?.id]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers, refreshTrigger]);

  // Redirect to leaderboard if summer has started
  const summerStarted = useMemo(() => {
    const effectiveStart = summerConfig?.personal_summer_start || '2026-04-12';
    const startDate = parseDateAsLocal(effectiveStart);
    if (!startDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today >= startDate;
  }, [summerConfig?.personal_summer_start]);

  useEffect(() => {
    if (summerStarted) {
      navigate('/leaderboard', { replace: true });
    }
  }, [summerStarted, navigate]);

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

  // Compute hero state
  const today = parseDateAsLocal(getTodayDateString()) ?? new Date();
  const blitzStart = nextBlitz ? parseDateAsLocal(nextBlitz.date) : null;
  const blitzEnd = nextBlitz ? parseDateAsLocal(nextBlitz.endDate ?? nextBlitz.date) : null;
  const isWithinBlitz = blitzStart && blitzEnd && today >= blitzStart && today <= blitzEnd;
  const canShowWeather = daysUntilBlitz !== null && daysUntilBlitz >= 0 && daysUntilBlitz <= 8;
  const locationName = nextBlitz?.location?.split(',')[0] || nextBlitz?.name || '';

  // MNL check
  const mnlInfo = (() => {
    if (!hasMnlEventToday || isTeamLead) return null;
    const now = new Date();
    const mstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
    const dayOfWeek = mstTime.getDay();
    const hour = mstTime.getHours();
    const minutes = mstTime.getMinutes();
    const totalMinutes = hour * 60 + minutes;
    if (dayOfWeek !== 1 || totalMinutes < 540 || totalMinutes > 1230) return null;
    const mnlStartMinutes = 18 * 60;
    const isWithinOneHourOfStart = totalMinutes >= mnlStartMinutes - 60;
    const minutesUntilStart = mnlStartMinutes - totalMinutes;
    const hoursUntil = Math.floor(minutesUntilStart / 60);
    const minsUntil = minutesUntilStart % 60;
    return {
      statusText: isWithinOneHourOfStart ? "Happening Now!" : "Later Today",
      countdown: isWithinOneHourOfStart ? null : (hoursUntil > 0 ? `${hoursUntil}h ${minsUntil}m` : `${minsUntil}m`),
    };
  })();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Immersive Hero ── */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-primary" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary-light)/0.3)_0%,_transparent_60%)]" />
        
        <div className="relative px-5 pt-5 pb-8">
          {/* Greeting */}
          <p className="text-primary-foreground/70 text-sm font-medium mb-1">
            {(() => {
              const hour = new Date().getHours();
              if (hour < 12) return "Good morning";
              if (hour < 18) return "Good afternoon";
              return "Good evening";
            })()}, {firstName}
          </p>

          {/* RSVP takes over hero */}
          {upcomingBlitzForRsvp && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-2"
            >
              <h1 className="text-3xl font-bold text-primary-foreground tracking-tight mb-1">
                {upcomingBlitzForRsvp.location?.split(',')[0] || upcomingBlitzForRsvp.name}
              </h1>
              <p className="text-primary-foreground/80 text-base mb-5">
                {isRsvpBlitzCommitted
                  ? `Still planning on going in ${rsvpBlitzDaysUntil} days?`
                  : `${rsvpBlitzDaysUntil} days away — you in?`}
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleRsvpYes}
                  className="flex-1 h-12 text-base font-semibold rounded-xl bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-lg"
                >
                  <Check className="w-5 h-5 mr-2" />
                  {isRsvpBlitzCommitted ? "Still in!" : "I'm in"}
                </Button>
                <Button
                  onClick={handleRsvpNo}
                  variant="outline"
                  className="flex-1 h-12 text-base font-semibold rounded-xl bg-transparent border-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <X className="w-5 h-5 mr-2" />
                  Can't make it
                </Button>
              </div>
            </motion.div>
          )}

          {/* Next blitz hero (no RSVP) */}
          {!upcomingBlitzForRsvp && nextBlitz && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2"
            >
              <h1 className="text-3xl font-bold text-primary-foreground tracking-tight mb-1">
                {locationName}
              </h1>
              <p className="text-primary-foreground/70 text-sm mb-4">
                {formatBlitzDateRange(nextBlitz.date, nextBlitz.endDate)}
              </p>

              {/* Countdown + Weather pills */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {daysUntilBlitz !== null && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-foreground/15 backdrop-blur-sm">
                    <span className="text-lg">
                      {isWithinBlitz ? '🔥' : daysUntilBlitz <= 1 ? '⚡' : '🎯'}
                    </span>
                    <span className="text-sm font-semibold text-primary-foreground">
                      {isWithinBlitz ? 'Happening now' : daysUntilBlitz === 0 ? 'Today' : daysUntilBlitz === 1 ? 'Tomorrow' : `${daysUntilBlitz} days`}
                    </span>
                  </div>
                )}
                {canShowWeather && (
                  <button
                    onClick={() => setWeatherSheetOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-foreground/15 backdrop-blur-sm hover:bg-primary-foreground/25 transition-colors"
                  >
                    <CloudSun className="h-4 w-4 text-primary-foreground" />
                    <span className="text-sm font-medium text-primary-foreground">Weather</span>
                  </button>
                )}
              </div>

              {/* Quick actions when at blitz */}
              {isWithinBlitz && (nextBlitz.address1 || nextBlitz.wifi1 || nextBlitz.code1) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {nextBlitz.address1 && (
                    <button onClick={() => openInMaps(nextBlitz.address1!)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-foreground/15 hover:bg-primary-foreground/25 transition-all text-sm font-medium text-primary-foreground backdrop-blur-sm">
                      <MapPin className="w-4 h-4" /><span>Map</span>
                    </button>
                  )}
                  {nextBlitz.wifi1 && (
                    <button onClick={() => copyToClipboard(nextBlitz.wifi1!, 'WiFi password copied!')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-foreground/15 hover:bg-primary-foreground/25 transition-all text-sm font-medium text-primary-foreground backdrop-blur-sm">
                      <Wifi className="w-4 h-4" /><span>WiFi</span>
                    </button>
                  )}
                  {nextBlitz.code1 && (
                    <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-foreground/15 text-sm font-medium text-primary-foreground backdrop-blur-sm">
                      <Key className="w-4 h-4" /><span className="font-mono">{nextBlitz.code1}</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* No committed blitz — Summer countdown OR pick-a-blitz CTA */}
          {!upcomingBlitzForRsvp && !nextBlitz && (() => {
            const hasRemainingBlitzes = allBlitzes.length > 0;
            const hasAnyCommittedBlitzes = committedBlitzesArr.length > 0;
            const GLOBAL_SUMMER_START = '2026-04-12';
            const hasPersonalDates = !!summerConfig?.personal_summer_start;
            const effectiveSummerStart = summerConfig?.personal_summer_start || GLOBAL_SUMMER_START;
            const summerStartDate = parseDateAsLocal(effectiveSummerStart);
            const daysUntilSummer = summerStartDate ? Math.ceil((summerStartDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
            const summerHasStarted = daysUntilSummer <= 0;

            // Preseason recap stats
            const pastBlitzCount = committedBlitzesArr.filter((blitz: any) => {
              const endDate = parseDateAsLocal(blitz?.endDate);
              if (!endDate) return false;
              return endDate.getTime() < today.getTime();
            }).length;

            // If rep has no committed blitzes at all, show summer countdown (skip blitz cards)
            // If there are blitzes to pick AND the rep has committed before, show the pick CTA
            if (hasRemainingBlitzes && hasAnyCommittedBlitzes) {
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2"
                >
                  <h1 className="text-3xl font-bold text-primary-foreground tracking-tight mb-2">
                    Your Blitzes
                  </h1>
                  <button
                    onClick={() => {
                      const blitzCard = document.querySelector('[data-blitz-card]');
                      if (blitzCard) blitzCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="group flex items-center gap-3 text-left w-full px-4 py-3.5 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-all"
                  >
                    <span className="text-2xl flex-shrink-0">📆</span>
                    <p className="text-primary-foreground/90 text-sm font-medium leading-snug flex-1">
                      {hasPastBlitzes ? "Pick a blitz and commit to your next sale" : "Pick a blitz and make your first sale"}
                    </p>
                    <ChevronRight className="w-5 h-5 text-primary-foreground/50 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                  </button>
                </motion.div>
              );
            }

            // No more blitzes — show summer countdown + preseason recap
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2"
              >
                {/* Summer countdown headline */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{summerHasStarted ? '☀️' : '🌅'}</span>
                  <h1 className="text-3xl font-bold text-primary-foreground tracking-tight">
                    {summerHasStarted ? 'Summer Is Here' : hasPersonalDates ? 'Your Summer Starts Soon' : 'Summer Starts Soon'}
                  </h1>
                </div>

                {!summerHasStarted && daysUntilSummer > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-foreground/15 backdrop-blur-sm mb-3">
                    <span className="text-sm font-semibold text-primary-foreground">
                      {daysUntilSummer === 1 ? 'Tomorrow' : `${daysUntilSummer} days away`}
                    </span>
                  </div>
                )}

                {/* Summer date range + edit */}
                <button
                  onClick={() => setEditSummerDatesOpen(true)}
                  className="flex items-center gap-2 mb-4 group"
                >
                  <span className="text-sm text-primary-foreground/70">
                    {formatBlitzDate(effectiveSummerStart, 'MMM d')}
                    {summerConfig?.personal_summer_end && ` – ${formatBlitzDate(summerConfig.personal_summer_end, 'MMM d')}`}
                  </span>
                  <Pencil className="w-3.5 h-3.5 text-primary-foreground/40 group-hover:text-primary-foreground/70 transition-colors" />
                </button>

                {/* Preseason Blitz Recap */}
                {pastBlitzCount > 0 && (
                  <div className="px-4 py-3 rounded-xl bg-primary-foreground/10 border border-primary-foreground/10">
                    <p className="text-xs font-medium text-primary-foreground/60 uppercase tracking-wider mb-2">Preseason Recap</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-primary-foreground">{pastBlitzCount}</span>
                      <span className="text-sm text-primary-foreground/80">
                        {pastBlitzCount === 1 ? 'blitz attended' : 'blitzes attended'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Vivint Sync CTA */}
                <button
                  onClick={() => navigate('/goals', { state: { openSync: true } })}
                  className="group flex items-center gap-3 text-left w-full mt-4 px-4 py-3.5 rounded-xl bg-primary-foreground/15 hover:bg-primary-foreground/20 transition-all border border-primary-foreground/10"
                >
                  <span className="text-xl flex-shrink-0">📊</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary-foreground leading-snug">
                      Sync your numbers with Vivint
                    </p>
                    <p className="text-xs text-primary-foreground/60 mt-0.5">
                      Set your baseline before summer kicks off
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary-foreground/50 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                </button>
              </motion.div>
            );
          })()}
        </div>
      </div>

      {/* ── Content ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-4 -mt-3 pb-32 space-y-3"
      >
        {/* Compact Alert Banners */}
        {/* MNL Banner */}
        {mnlInfo && (
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-primary/30 bg-primary/5">
              <Moon className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="flex-1 text-sm font-medium text-foreground">
                Monday Night Lights — {mnlInfo.statusText}
              </span>
              {mnlInfo.countdown && (
                <span className="text-xs font-semibold text-primary">{mnlInfo.countdown}</span>
              )}
            </div>
          </motion.div>
        )}

        {/* Leader alerts — compact banners that expand inline */}
        {isTeamLead && !teamLoading && (
          <motion.div variants={itemVariants}>
            <VetAlertCard
              teamMembers={teamMembers}
              allBlitzes={allBlitzes}
              onTeamMemberUpdate={(id, updates) => {
                setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
              }}
            />
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <LeaderRookieReviewCard />
        </motion.div>

        {/* Pending install alerts */}
        <motion.div variants={itemVariants}>
          <PendingInstallAlertCard />
        </motion.div>

        {/* Active Challenges — compact */}
        <motion.div variants={itemVariants}>
          <ActiveChallengesCard hideCta={true} />
        </motion.div>

        {/* ── Blitz Management — hide for reps with no committed blitzes ── */}
        {committedBlitzesArr.length > 0 && (
          <motion.div variants={itemVariants}>
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
          </motion.div>
        )}
      </motion.div>

      {/* Weather Sheet */}
      <Sheet open={weatherSheetOpen} onOpenChange={setWeatherSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Weather — {nextBlitz?.location}</SheetTitle>
            <SheetDescription>{nextBlitz?.name}</SheetDescription>
          </SheetHeader>
          {loadingWeather && (
            <div className="text-center text-sm text-muted-foreground py-8">
              <div className="animate-pulse">Loading weather forecast...</div>
            </div>
          )}
          {!loadingWeather && weather.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              <p>Weather forecast unavailable.</p>
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
                      <div key={day.date} className="flex-shrink-0 w-[72px] p-3 bg-muted/30 rounded-xl text-center border border-border">
                        <p className="text-xs font-medium mb-2 text-muted-foreground">{day.dayName}</p>
                        <div className="text-2xl mb-2">{getWeatherIcon(day.weatherCode)}</div>
                        <p className="text-sm font-bold">{day.high}°</p>
                        <p className="text-xs text-muted-foreground">{day.low}°</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 p-4 bg-muted/50 rounded-xl border border-border">
                <p className="text-sm text-muted-foreground italic text-center">
                  {(() => {
                    const avgHigh = weather.reduce((sum, day) => sum + day.high, 0) / weather.length;
                    const avgLow = weather.reduce((sum, day) => sum + day.low, 0) / weather.length;
                    if (avgHigh > 85) return "Pack light and bring sunscreen — it's going to be hot out there!";
                    if (avgHigh < 60) return "Pack warm — it gets colder than you think when you're outside all day.";
                    if (avgLow < 50) return "Days are nice but mornings are cold — bring layers.";
                    return "Perfect knocking weather — prep your pitch and pack smart!";
                  })()}
                </p>
              </div>
              <div className="mt-4">
                <Button className="w-full rounded-xl h-12" onClick={() => {
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

      {/* Edit Summer Dates Drawer */}
      {userId && repData && (
        <EditSummerDatesDrawer
          open={editSummerDatesOpen}
          onOpenChange={setEditSummerDatesOpen}
          person={{
            userId,
            name: repData.name || 'You',
            personalSummerStart: summerConfig?.personal_summer_start || null,
            personalSummerEnd: summerConfig?.personal_summer_end || null,
          }}
        />
      )}
    </div>
  );
};

export default Blitzes;
