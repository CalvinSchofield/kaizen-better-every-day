import { useParams, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings, Camera, ArrowLeft, Lock, Trophy, Flame, Target, Footprints, Presentation, ArrowRightLeft, Award } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { YearBadge } from "@/components/leaderboard/YearBadge";
import { ProfilePhotoDrawer } from "@/components/ProfilePhotoDrawer";
import { MomentumSparkline } from "@/components/profile/MomentumSparkline";
import { useRepProfile } from "@/hooks/useRepProfile";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { getInitials } from "@/utils/nameUtils";
import { hapticLight } from "@/utils/haptics";
import { useState } from "react";
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
  const [photoDrawerOpen, setPhotoDrawerOpen] = useState(false);

  if (!userId && currentUserId) {
    return <Navigate to={`/profile/${currentUserId}`} replace />;
  }

  const { data: profile, isLoading } = useRepProfile(userId || null);
  const isOwnProfile = currentUserId === userId;

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMM d");
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="pt-safe" />
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

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  const nameParts = profile.name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");
  const lastActive = formatRelativeTime(profile.lastActiveAt);

  return (
    <div className="min-h-screen bg-background overflow-y-auto pb-28">
      {/* Hero cover photo with overlaid name */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-muted">
        {/* Back button + settings - floating over image */}
        <div className="absolute top-0 left-0 right-0 z-20">
          <div className="pt-safe" />
          <div className="flex items-center justify-between px-4 pt-2 pb-1">
            <button
              onClick={() => { hapticLight(); navigate(-1); }}
              className="p-2 -ml-2 rounded-full bg-black/30 backdrop-blur-sm active:scale-95 transition-transform"
            >
              <ArrowLeft className="h-5 w-5 text-white drop-shadow-md" />
            </button>
            {isOwnProfile ? (
              <button
                onClick={() => { hapticLight(); navigate("/settings"); }}
                className="p-2 -mr-2 rounded-full bg-black/30 backdrop-blur-sm active:scale-95 transition-transform"
              >
                <Settings className="h-5 w-5 text-white drop-shadow-md" />
              </button>
            ) : (
              <div className="w-9" />
            )}
          </div>
        </div>

        {/* Photo - high quality rendering */}
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
            <span className="text-5xl font-bold text-muted-foreground/40">
              {getInitials(profile.name)}
            </span>
          </div>
        )}

        {/* Gradient overlay at bottom - stronger for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

        {/* Overlaid name + last active */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 z-10">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {firstName && (
              <h1 className="leading-tight drop-shadow-lg" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                <span className="block text-2xl font-medium tracking-wide text-white">{firstName}</span>
                {lastName && (
                  <span className="block text-3xl font-black tracking-tight text-white">{lastName}</span>
                )}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <YearBadge year={profile.year} fullLabel />
              {profile.officeName && (
                <span className="text-xs text-white/80 font-medium drop-shadow-md">{profile.officeName}</span>
              )}
            </div>
            {lastActive && (
              <p className="text-xs font-semibold mt-1 drop-shadow-md" style={{ color: 'hsl(var(--primary))' }}>
                Last Active: {lastActive}
              </p>
            )}
          </motion.div>
        </div>

        {/* Camera button for own profile */}
        {isOwnProfile && (
          <button
            onClick={() => { hapticLight(); setPhotoDrawerOpen(true); }}
            className="absolute bottom-4 right-4 z-20 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-90 transition-transform border-2 border-white/20"
          >
            <Camera className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="mx-4 mt-4 mb-6 rounded-2xl bg-card border border-border p-4"
      >
        <div className="grid grid-cols-3 divide-x divide-border">
          <StatCell label="YTD FP+" value={profile.ytdFpPlus.toFixed(1)} />
          <StatCell label="YTD PRMR" value={`$${Math.round(profile.ytdPrmr).toLocaleString()}`} />
          <div className="flex flex-col items-center px-2 gap-1">
            <Award className="h-5 w-5 text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Coming Soon</span>
          </div>
        </div>
      </motion.div>

      {/* Momentum Sparkline */}
      <MomentumSparkline
        dailyFp={profile.dailyFpValues}
        isOwnProfile={isOwnProfile}
        efpMode={isOwnProfile && profile.efpModeEnabled}
      />

      {/* Tabbed content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="px-4 pb-4"
      >
        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-muted/50">
            <TabsTrigger value="stats" className="text-xs font-semibold">Stats</TabsTrigger>
            <TabsTrigger value="records" className="text-xs font-semibold">Records</TabsTrigger>
            <TabsTrigger value="badges" className="text-xs font-semibold">Badges</TabsTrigger>
          </TabsList>

          {/* Stats Tab */}
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

          <TabsContent value="badges" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <Lock className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Badges Coming Soon</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Earn badges for selling streaks, personal records, and milestones. Stay tuned!
              </p>
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
