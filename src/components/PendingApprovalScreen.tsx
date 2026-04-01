import { useState, useEffect } from "react";
import { Clock, LogOut, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clearAllRepCaches } from "@/hooks/useRepData";
import { motion, AnimatePresence } from "framer-motion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Target, CalendarDays, BarChart3, TrendingUp, Trophy, Flame, Users, BookOpen } from "lucide-react";

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
  { icon: Target, title: "Set & Crush Goals", description: "Daily, weekly & monthly targets that keep you accountable and locked in.", color: "from-orange-500 to-amber-500" },
  { icon: BarChart3, title: "Track Every Door", description: "Doors, pitches, closes — tracked in real time so you always know your numbers.", color: "from-blue-500 to-cyan-500" },
  { icon: TrendingUp, title: "See Your Growth", description: "Ratios, trends & insights that show you exactly where to improve.", color: "from-emerald-500 to-green-500" },
  { icon: Trophy, title: "Live Leaderboard", description: "See where you rank against the team — updated in real time.", color: "from-yellow-500 to-orange-500" },
  { icon: Flame, title: "Compete & Win", description: "Head-to-head challenges and group incentives to push your limits.", color: "from-red-500 to-rose-500" },
  { icon: CalendarDays, title: "Plan Your Days", description: "Schedule knocking days and build the consistency that wins.", color: "from-violet-500 to-purple-500" },
  { icon: Users, title: "Build Your Team", description: "Full recruiting CRM to track, manage, and grow your downline.", color: "from-pink-500 to-fuchsia-500" },
  { icon: BookOpen, title: "Sales CRM", description: "Manage every deal from pitch to close — never lose track of a customer.", color: "from-teal-500 to-cyan-500" },
];

interface PendingApprovalScreenProps {
  repName?: string;
  teamLeader?: string | null;
  teamLeaderPhone?: string | null;
  showTeamInfoLink?: boolean;
}

const FeatureSlide = ({ icon: Icon, title, description, color }: typeof FEATURES[0]) => (
  <div className="h-full flex flex-col items-center text-center px-2 py-6">
    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg`}>
      <Icon className="w-7 h-7 text-white" />
    </div>
    <h3 className="font-bold text-base text-foreground mb-1.5">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px]">{description}</p>
  </div>
);

const PendingApprovalScreen = ({ repName }: PendingApprovalScreenProps) => {
  const handleLogout = async () => {
    clearAllRepCaches();
    await supabase.auth.signOut();
  };

  const firstName = repName?.split(' ')[0] || 'there';
  const showAppDownload = isIOS() && !isNativeApp();

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col fixed inset-0 z-[100]">
      {/* Top section */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pt-10 pb-4">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-3"
        >
          <h1 className="text-2xl font-bold text-foreground">
            Welcome, {firstName}! 🎉
          </h1>
        </motion.div>

        {/* Pending badge + explanation */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-3">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Pending Approval</span>
          </div>
          <p className="text-muted-foreground text-sm max-w-[280px] mx-auto leading-relaxed">
            Your upline needs to approve your account before you can get started. Hang tight!
          </p>
        </motion.div>

        {/* Feature carousel */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="w-full max-w-lg"
        >
          <Carousel
            opts={{
              align: "center",
              loop: true,
            }}
            plugins={[
              Autoplay({ delay: 3000, stopOnInteraction: false }),
            ]}
            className="w-full"
          >
            <CarouselContent>
              {FEATURES.map((feature) => (
                <CarouselItem key={feature.title} className="basis-[75%] sm:basis-[60%]">
                  <FeatureSlide {...feature} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </motion.div>
      </div>

      {/* Bottom actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.35 }}
        className="px-5 pb-8 space-y-3 max-w-lg mx-auto w-full"
      >
        {/* iOS download - always show on iOS web */}
        {showAppDownload && (
          <Button
            onClick={() => window.open(TESTFLIGHT_URL, "_blank", "noopener,noreferrer")}
            className="w-full gap-2"
            size="lg"
          >
            <Download className="h-4 w-4" />
            Download the App (TestFlight)
          </Button>
        )}

        {/* Non-iOS: just show a note about the app */}
        {!showAppDownload && !isNativeApp() && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              📱 Download Kaizen on iOS via{" "}
              <a href={TESTFLIGHT_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                TestFlight
              </a>
            </p>
          </div>
        )}

        <Button variant="ghost" onClick={handleLogout} className="w-full gap-2 text-muted-foreground">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </motion.div>
    </div>
  );
};

export default PendingApprovalScreen;
