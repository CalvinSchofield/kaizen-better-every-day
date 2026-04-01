import { useParams, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings, Camera, Lock, Trophy, Flame, Target, Footprints, Presentation, ArrowRightLeft, Award, Eye, EyeOff, ChevronLeft, AlertCircle, RefreshCw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { YearBadge } from "@/components/leaderboard/YearBadge";
import { ProfilePhotoDrawer } from "@/components/ProfilePhotoDrawer";
import { ProfileSwiper } from "@/components/profile/ProfileSwiper";
import { ProfileContactBar } from "@/components/profile/ProfileContactBar";
import { ProfileSeasonHeatmap } from "@/components/profile/ProfileSeasonHeatmap";
import { useHeader } from "@/contexts/HeaderContext";
import { useUserBadges, useBadgeDefinitions, getTopBadges } from "@/hooks/useUserBadges";
import { BadgeGrid } from "@/components/badges/BadgeGrid";
import { BadgeIcon } from "@/components/badges/BadgeIcon";
import { useCurrentSalesStreak } from "@/hooks/useCurrentSalesStreak";
import { useStreakProtection } from "@/hooks/useStreakProtection";

import { useRepProfile } from "@/hooks/useRepProfile";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useGoalPaceCalculatorForUser } from "@/hooks/useGoalPaceCalculatorForUser";
import { useWatchlist } from "@/hooks/useWatchlist";
import { getInitials } from "@/utils/nameUtils";
import { hapticLight } from "@/utils/haptics";
import { useState, useEffect, useRef, useCallback } from "react";
import { format, parseISO } from "date-fns";

const formatRelativeTime = (isoString: string | null): string | null => {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${diffWeeks}w ago`;
  } catch {
    return null;
  }
};

const Profile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { userId: currentUserId } = useCurrentUserId();
  const normalizedRouteUserId = userId && userId !== 'null' && userId !== 'undefined' ? userId : null;
  const [photoDrawerOpen, setPhotoDrawerOpen] = useState(false);
  const { setCustomRightContent, setCustomLeftContent, setCustomTitle } = useHeader();
  const isOwnProfile = !!currentUserId && normalizedRouteUserId === currentUserId;
  const [hasScrolledPastName, setHasScrolledPastName] = useState(false);
  const [activeTab, setActiveTab] = useState("stats");
  const nameRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const { isWatching, toggleWatchlist } = useWatchlist();

  const { data: profile, isLoading, error, refetch, isRefetching } = useRepProfile(normalizedRouteUserId || currentUserId || null);

  // Safety timeout: force past loading skeleton after 6 seconds
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (!isLoading) { setLoadingTimedOut(false); return; }
    const timer = setTimeout(() => setLoadingTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const { data: teamAccess } = useTeamAccess();
  const isDownline = !isOwnProfile && !!normalizedRouteUserId && !!teamAccess?.accessibleUserIds?.includes(normalizedRouteUserId);
  const downlineGoalPace = useGoalPaceCalculatorForUser(isDownline ? normalizedRouteUserId : null);

  const targetUserId = normalizedRouteUserId || currentUserId || null;
  const { data: earnedBadges } = useUserBadges(targetUserId);
  const { data: allDefinitions } = useBadgeDefinitions();
  const topBadges = earnedBadges ? getTopBadges(earnedBadges, 2) : [];
  const { data: salesStreakData } = useCurrentSalesStreak(targetUserId);

  // Scroll-based header title: show rep name when scrolled past the name
  useEffect(() => {
    if (!nameRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setHasScrolledPastName(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "-60px 0px 0px 0px" }
    );
    observer.observe(nameRef.current);
    return () => observer.disconnect();
  }, [profile?.name]);

  // Update header title based on scroll
  useEffect(() => {
    if (hasScrolledPastName && profile?.name) {
      setCustomTitle(profile.name);
    } else {
      setCustomTitle(null);
    }
  }, [hasScrolledPastName, profile?.name, setCustomTitle]);

  // Set header content
  useEffect(() => {
    if (isOwnProfile) {
      setCustomRightContent(
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} className="h-10 w-10">
          <Settings className="h-5 w-5" />
        </Button>
      );
    } else {
      setCustomLeftContent(
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-10 w-10">
          <ChevronLeft className="h-5 w-5" />
        </Button>
      );
    }
    return () => {
      setCustomRightContent(null);
      setCustomLeftContent(null);
      setCustomTitle(null);
    };
  }, [isOwnProfile]);

  if (!normalizedRouteUserId && currentUserId) {
    return <Navigate to={`/profile/${currentUserId}`} replace />;
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMM d");
    } catch {
      return dateStr;
    }
  };

  if (isLoading && !loadingTimedOut) {
    return (
      <div className="flex flex-col">
        <Skeleton className="w-full aspect-[4/3]" />
        <div className="flex-1 flex flex-col items-center px-6 pt-6 gap-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-6 mt-4">
            <Skeleton className="h-16 w-20" />
            <Skeleton className="h-16 w-20" />
            <Skeleton className="h-16 w-20" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="px-4 py-8">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Couldn't load this profile right now.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            {isRefetching ? 'Retrying...' : 'Try Again'}
          </Button>
        </div>
      </div>
    );
  }

  if (!profile && !isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading profile…</p>
      </div>
    );
  }

  const nameParts = profile.name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");
  const lastActive = formatRelativeTime(profile.lastActiveAt);

  return (
    <div className="bg-background overflow-y-auto pb-8">
      {/* Hero cover photo */}
      <div className="relative w-full aspect-[3/4] max-h-[65vh] overflow-hidden bg-muted">
        {/* Photo */}
        {profile.profilePhotoUrl ? (
          <img
            src={profile.profilePhotoUrl}
            alt={profile.name}
            className="w-full h-full object-cover"
            style={{ imageRendering: 'auto' }}
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <span className="text-6xl font-bold text-muted-foreground/30">
              {getInitials(profile.name)}
            </span>
          </div>
        )}

        {/* Bottom gradient for name readability */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/60 to-transparent" />

        {/* Overlaid name + meta */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 z-10">
          <motion.div
            ref={nameRef}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {firstName && (
              <h2 className="leading-[1.1]">
                <span className="block text-2xl font-medium tracking-wide text-foreground">{firstName}</span>
                {lastName && (
                  <span className="block text-4xl font-black tracking-tight text-foreground">{lastName}</span>
                )}
              </h2>
            )}
            <div className="flex items-center gap-2 mt-2">
              <YearBadge year={profile.year} fullLabel />
              {profile.officeName && (
                <>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-xs text-muted-foreground font-medium">{profile.officeName}</span>
                </>
              )}
            </div>
            {lastActive && (
              <p className="text-[11px] font-semibold mt-1.5" style={{ color: 'hsl(var(--primary))' }}>
                Active {lastActive}
              </p>
            )}
          </motion.div>
        </div>

        {/* Camera button for own profile / Call+Text for others */}
        {isOwnProfile ? (
          <button
            onClick={() => { hapticLight(); setPhotoDrawerOpen(true); }}
            className="absolute bottom-5 right-5 z-20 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-90 transition-transform border-2 border-white/20"
          >
            <Camera className="h-4 w-4" />
          </button>
        ) : normalizedRouteUserId ? (
          <div className="absolute bottom-5 right-5 z-20 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                hapticLight();
                toggleWatchlist(normalizedRouteUserId);
              }}
              className={`h-10 w-10 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform border-2 border-white/20 ${
                isWatching(userId)
                  ? "bg-primary text-primary-foreground"
                  : "bg-black/40 text-white backdrop-blur-sm"
              }`}
            >
              {isWatching(userId) ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </button>
            <ProfileContactBar
              name={profile.name}
              phone={profile.phone}
              userId={normalizedRouteUserId}
              canLog={isDownline}
              variant="overlay"
            />
          </div>
        ) : null}
      </div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="relative z-10 mx-5 -mt-1 mb-5 rounded-2xl bg-card border border-border p-4"
      >
        <div className="grid grid-cols-3 divide-x divide-border">
          <StatCell label="YTD FP+" value={profile.ytdFpPlus.toFixed(1)} />
          <StatCell label="YTD PRMR" value={`$${Math.round(profile.ytdPrmr).toLocaleString()}`} />
          <button
            className="flex flex-col items-center px-2 gap-1 w-full"
            onClick={() => {
              hapticLight();
              setActiveTab("badges");
              setTimeout(() => {
                tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 100);
            }}
          >
            {topBadges.length > 0 ? (
              <>
                <div className="flex gap-1">
                  {topBadges.map((b, i) => (
                    <BadgeIcon key={i} emoji={b.iconEmoji} rarity={b.rarity} size="md" />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  {earnedBadges?.length || 0} Badges
                </span>
              </>
            ) : (
              <>
                <Award className="h-5 w-5 text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">No Badges</span>
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Sales streak pill - always visible */}
      {salesStreakData && salesStreakData.streak > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-5 mt-2 mb-3"
        >
          <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-full px-4 py-2">
            <span className="text-base">🔥</span>
            {(salesStreakData.shieldCount || 0) > 0 && <span className="text-base">🛡️</span>}
            <span className="text-sm font-bold text-foreground">
              {salesStreakData.streak}-Day Sales Streak
              {(salesStreakData.shieldCount || 0) > 0 && (
                <span className="text-xs font-medium text-muted-foreground ml-1">
                  ({salesStreakData.shieldCount} {salesStreakData.shieldCount === 1 ? 'shield' : 'shields'})
                </span>
              )}
            </span>
            {salesStreakData.globalReached > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {salesStreakData.globalReached === 1
                    ? "Only 1 rep has ever gotten this far"
                    : `Only ${salesStreakData.globalReached} reps have ever gotten this far`}
                </span>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Momentum Sparkline / Goal Pace / Heatmap Swiper */}
      <ProfileSwiper
        dailyFp={profile.dailyFpValues}
        isOwnProfile={isOwnProfile}
        goalPaceData={isDownline && downlineGoalPace.hasGoals ? downlineGoalPace : null}
        repName={profile.name}
        extraSlide={
          isDownline && normalizedRouteUserId ? (
            <ProfileSeasonHeatmap userId={normalizedRouteUserId} isOwnProfile={false} />
          ) : undefined
        }
      />

      {/* Tabbed content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="px-5 pb-4"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" ref={tabsRef}>
          <TabsList className="w-full grid grid-cols-3 bg-muted/50">
            <TabsTrigger value="stats" className="text-xs font-semibold">Stats</TabsTrigger>
            <TabsTrigger value="records" className="text-xs font-semibold">Records</TabsTrigger>
            <TabsTrigger value="badges" className="text-xs font-semibold">Badges</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Season Activity</h3>
              <div className="grid grid-cols-3 gap-3">
                <ActivityStat icon={Footprints} label="Doors" value={profile.ytdDoors.toLocaleString()} />
                <ActivityStat icon={Presentation} label="Presentations" value={profile.ytdPresentations.toLocaleString()} />
                <ActivityStat icon={ArrowRightLeft} label="Transitions" value={profile.ytdTransitions.toLocaleString()} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="records" className="mt-4 space-y-4">
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Best FP+</h3>
              <RecordRow icon={Flame} label="Best Day" record={profile.bestDayFp} formatDate={formatDate} unit="FP+" />
              <RecordRow icon={Trophy} label="Best Week" record={profile.bestWeekFp} formatDate={formatDate} unit="FP+" />
              <RecordRow icon={Target} label="Best Month" record={profile.bestMonthFp} formatDate={formatDate} unit="FP+" />
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Best PRMR</h3>
              <RecordRow icon={Flame} label="Best Day" record={profile.bestDayPrmr} formatDate={formatDate} unit="PRMR" />
              <RecordRow icon={Trophy} label="Best Week" record={profile.bestWeekPrmr} formatDate={formatDate} unit="PRMR" />
              <RecordRow icon={Target} label="Best Month" record={profile.bestMonthPrmr} formatDate={formatDate} unit="PRMR" />
            </div>
          </TabsContent>

          <TabsContent value="badges" className="mt-4 space-y-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              {allDefinitions && earnedBadges ? (
                <BadgeGrid
                  earnedBadges={earnedBadges}
                  allDefinitions={allDefinitions}
                  isOwnProfile={isOwnProfile}
                />
              ) : (
                <div className="flex flex-col items-center text-center py-8">
                  <Skeleton className="h-12 w-12 rounded-full mb-4" />
                  <Skeleton className="h-4 w-32" />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {isOwnProfile && (
        <ProfilePhotoDrawer
          open={photoDrawerOpen}
          onOpenChange={setPhotoDrawerOpen}
          currentPhotoUrl={profile.profilePhotoUrl}
          name={profile.name}
          userId={userId}
        />
      )}
    </div>
  );
};

// --- Sub-components ---

const StatCell = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col items-center px-2">
    <span className="text-lg font-bold text-foreground">{value}</span>
    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{label}</span>
  </div>
);

const ActivityStat = ({ icon: Icon, label, value }: { icon: typeof Footprints; label: string; value: string }) => (
  <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/40">
    <Icon className="h-4 w-4 text-primary" />
    <span className="text-base font-bold text-foreground">{value}</span>
    <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
  </div>
);

const RecordRow = ({
  icon: Icon,
  label,
  record,
  formatDate,
  unit = "FP+",
}: {
  icon: typeof Trophy;
  label: string;
  record: { value: number; date: string } | null;
  formatDate: (d: string) => string;
  unit?: string;
}) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div className="flex-1 min-w-0">
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
    {record ? (
      <div className="text-right shrink-0">
        <span className="text-sm font-bold text-foreground">
          {unit === "PRMR" ? `$${Math.round(record.value).toLocaleString()}` : record.value.toFixed(1)} {unit === "PRMR" ? "" : unit}
        </span>
        <span className="block text-[10px] text-muted-foreground">{formatDate(record.date)}</span>
      </div>
    ) : (
      <span className="text-xs text-muted-foreground">—</span>
    )}
  </div>
);

export default Profile;
