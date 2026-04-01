import { useState } from "react";
import { 
  Clock, LogOut, ExternalLink, Smartphone, Download, 
  Target, CalendarDays, BarChart3, TrendingUp, Trophy, 
  Flame, Users, BookOpen, ArrowLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clearAllRepCaches } from "@/hooks/useRepData";
import { motion, AnimatePresence } from "framer-motion";
import AboutTeam from "@/pages/AboutTeam";
import KaizenLogo from "@/components/KaizenLogo";

const TESTFLIGHT_URL = "https://testflight.apple.com/join/MGGUFyE7";

const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
};

const isNativeApp = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "capacitor:";
};

const FEATURES = [
  { icon: Target, title: "Set Goals", description: "Daily, weekly & monthly targets to keep you locked in", delay: 0.1 },
  { icon: CalendarDays, title: "Make Plans", description: "Schedule your knocking days and build consistency", delay: 0.15 },
  { icon: BarChart3, title: "Track Inputs", description: "Doors, pitches, closes — all tracked in real time", delay: 0.2 },
  { icon: TrendingUp, title: "Learn & Improve", description: "See your trends and ratios to get better every day", delay: 0.25 },
  { icon: Trophy, title: "Leaderboard", description: "Live rankings — see where you stack up on the team", delay: 0.3 },
  { icon: Flame, title: "Challenges", description: "Compete head-to-head or run group incentives", delay: 0.35 },
  { icon: Users, title: "Recruiting", description: "Full CRM to build, track, and grow your team", delay: 0.4 },
  { icon: BookOpen, title: "Sales Log", description: "Customer CRM to manage every deal from pitch to close", delay: 0.45 },
];

interface PendingApprovalScreenProps {
  repName?: string;
  teamLeader?: string | null;
  teamLeaderPhone?: string | null;
  showTeamInfoLink?: boolean;
}

const FeatureCard = ({ icon: Icon, title, description, delay }: typeof FEATURES[0]) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.35, ease: "easeOut" }}
    className="bg-card border border-border/50 rounded-2xl p-4 flex gap-3.5 items-start shadow-sm"
  >
    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <div className="min-w-0">
      <p className="font-semibold text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{description}</p>
    </div>
  </motion.div>
);

const PendingApprovalScreen = ({ repName, teamLeader, teamLeaderPhone, showTeamInfoLink }: PendingApprovalScreenProps) => {
  const [view, setView] = useState<'features' | 'about'>('features');

  const handleLogout = async () => {
    clearAllRepCaches();
    await supabase.auth.signOut();
  };

  const firstName = repName?.split(' ')[0] || 'there';
  const showAppDownload = isIOS() && !isNativeApp();
  const isDirectOrg = !showTeamInfoLink;

  // About Team view for direct org recruits
  if (view === 'about') {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/50 px-4 py-3">
          <button
            onClick={() => setView('features')}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
        <AboutTeam />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Scrollable content */}
      <div className="max-w-lg mx-auto px-5 py-8 pb-12">

        {/* Pending status badge — quiet, top of page */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex justify-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Account under review</span>
          </div>
        </motion.div>

        {/* Hero — Kaizen branding + welcome */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="text-center mb-8"
        >
          <KaizenLogo />
          <h1 className="text-2xl font-bold text-foreground mt-5 mb-2">
            Welcome, {firstName}! 🎉
          </h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
            Your account is being reviewed. While you wait, here's a look at everything you'll unlock.
          </p>
        </motion.div>

        {/* Team leader contact */}
        {teamLeader && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.35 }}
            className="bg-muted/50 rounded-xl p-4 mb-8 text-center"
          >
            <p className="text-xs text-muted-foreground mb-1">Reviewing your signup</p>
            <p className="font-semibold text-foreground">{teamLeader}</p>
            {teamLeaderPhone && (
              <a href={`tel:${teamLeaderPhone}`} className="text-sm text-primary hover:underline">
                {teamLeaderPhone}
              </a>
            )}
          </motion.div>
        )}

        {/* Section label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1"
        >
          What you'll get access to
        </motion.p>

        {/* Feature cards grid */}
        <div className="grid grid-cols-1 gap-3 mb-8">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>

        {/* Meet the Team button for direct org */}
        {isDirectOrg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.35 }}
            className="mb-4"
          >
            <button
              onClick={() => setView('about')}
              className="w-full flex items-center justify-between bg-card border border-border/50 rounded-2xl p-4 shadow-sm hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-foreground">Meet the Team</p>
                  <p className="text-xs text-muted-foreground">Learn about who you'll be working with</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </motion.div>
        )}

        {/* External link for non-direct org */}
        {showTeamInfoLink && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.35 }}
            className="mb-4"
          >
            <a
              href="https://www.smarthomepros.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between bg-card border border-border/50 rounded-2xl p-4 shadow-sm hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ExternalLink className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-foreground">Learn About the Team</p>
                  <p className="text-xs text-muted-foreground">Visit our website to learn more</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          </motion.div>
        )}

        {/* iOS app download */}
        {showAppDownload && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.35 }}
            className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-foreground">Get the Kaizen App</p>
                <p className="text-xs text-muted-foreground">Faster, smoother, with push notifications</p>
              </div>
            </div>
            <Button
              onClick={() => window.open(TESTFLIGHT_URL, "_blank", "noopener,noreferrer")}
              size="sm"
              className="w-full gap-2"
            >
              <Download className="h-4 w-4" />
              Download via TestFlight
            </Button>
          </motion.div>
        )}

        {/* Sign out */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.3 }}
          className="flex justify-center pt-4"
        >
          <Button variant="ghost" onClick={handleLogout} className="gap-2 text-muted-foreground">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default PendingApprovalScreen;
