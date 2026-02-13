import { useParams, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings, Camera, ArrowLeft, Lock, Trophy, Flame, Target, Footprints, Presentation, ArrowRightLeft } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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

const Profile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { userId: currentUserId } = useCurrentUserId();
  const [photoDrawerOpen, setPhotoDrawerOpen] = useState(false);

  // If /profile with no userId, redirect to own profile
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
        <div className="flex-1 flex flex-col items-center px-6 pt-6 gap-4">
          <Skeleton className="h-28 w-28 rounded-full" />
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

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="pt-safe" />
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={() => { hapticLight(); navigate(-1); }}
            className="p-2 -ml-2 rounded-full active:scale-95 transition-transform"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <span className="font-semibold text-sm">Profile</span>
          {isOwnProfile ? (
            <button
              onClick={() => { hapticLight(); navigate("/settings"); }}
              className="p-2 -mr-2 rounded-full active:scale-95 transition-transform"
            >
              <Settings className="h-5 w-5 text-foreground" />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>
      </div>

      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center px-6 pt-4 pb-6"
      >
        {/* Avatar with gradient ring */}
        <div className="relative mb-4">
          <div className="h-28 w-28 rounded-full p-[3px] bg-gradient-to-br from-primary via-primary-light to-warning">
            <Avatar className="h-full w-full border-[3px] border-background">
              <AvatarImage src={profile.profilePhotoUrl || undefined} alt={profile.name} />
              <AvatarFallback className="bg-muted text-muted-foreground text-2xl font-bold">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
          </div>
          {isOwnProfile && (
            <button
              onClick={() => { hapticLight(); setPhotoDrawerOpen(true); }}
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-90 transition-transform border-2 border-background"
            >
              <Camera className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Name + Year badge + Team */}
        <h1 className="text-xl font-bold text-foreground">{profile.name}</h1>
        <div className="flex items-center gap-2 mt-1">
          <YearBadge year={profile.year} fullLabel />
          {profile.teamName && (
            <span className="text-sm text-muted-foreground">{profile.teamName}</span>
          )}
        </div>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="mx-4 mb-6 rounded-2xl bg-card border border-border p-4"
      >
        <div className="grid grid-cols-3 divide-x divide-border">
          <StatCell label="YTD FP+" value={profile.ytdFpPlus.toFixed(1)} />
          <StatCell label="PRMR" value={`$${Math.round(profile.ytdPrmr).toLocaleString()}`} />
          <StatCell label="Upgrade FP+" value={profile.ytdUpgradeFpPlus.toFixed(1)} />
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
        className="px-4 pb-24"
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

          {/* Records Tab */}
          <TabsContent value="records" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Personal Bests</h3>
              <RecordRow
                icon={Flame}
                label="Top FP+ Day"
                record={profile.bestDayFp}
                suffix="FP+"
                formatDate={formatDate}
              />
              <RecordRow
                icon={Trophy}
                label="Top PRMR Day"
                record={profile.bestDayPrmr}
                suffix="PRMR"
                formatDate={formatDate}
              />
            </div>
          </TabsContent>

          {/* Badges Tab (Coming Soon) */}
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

      {/* Photo Drawer */}
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
  suffix,
  formatDate,
}: {
  icon: typeof Trophy;
  label: string;
  record: { value: number; date: string } | null;
  suffix: string;
  formatDate: (d: string) => string;
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
          {suffix === 'PRMR' ? `$${record.value.toFixed(0)}` : record.value.toFixed(1)} {suffix}
        </span>
        <span className="block text-[10px] text-muted-foreground">{formatDate(record.date)}</span>
      </div>
    ) : (
      <span className="text-xs text-muted-foreground">—</span>
    )}
  </div>
);

export default Profile;
