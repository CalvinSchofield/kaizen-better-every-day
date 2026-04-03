import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Zap,
  Target,
  BarChart3,
  Users,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface FeatureSlide {
  icon: typeof TrendingUp;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  previewLines: { label: string; value: string; accent?: boolean }[];
}

const FEATURES: FeatureSlide[] = [
  {
    icon: Zap,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-500/10",
    title: "Live Pulse",
    description: "See who's working right now and how the day is tracking vs your team's typical pace.",
    previewLines: [
      { label: "Working Now", value: "4 reps", accent: true },
      { label: "Doors", value: "142 vs 128 expected" },
      { label: "FP+", value: "2.1 — ahead of pace", accent: true },
    ],
  },
  {
    icon: BarChart3,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    title: "Funnel Breakdown",
    description: "Pinpoint exactly where deals are dropping — doors to DMs, pitches to presentations.",
    previewLines: [
      { label: "Doors → DMs", value: "32%" },
      { label: "DMs → Pitches", value: "78%" },
      { label: "Bottleneck", value: "Transition rate", accent: true },
    ],
  },
  {
    icon: Target,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
    title: "Goal Pacing",
    description: "Track every rep's progress toward their season goal — who's on pace, at risk, or behind.",
    previewLines: [
      { label: "On Pace", value: "6 reps", accent: true },
      { label: "At Risk", value: "2 reps" },
      { label: "Behind", value: "1 rep" },
    ],
  },
  {
    icon: Users,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-500/10",
    title: "Coaching Alerts",
    description: "Auto-detect effort-without-skill gaps, late starts, early ends, and reps who need attention.",
    previewLines: [
      { label: "High doors, 0 trans", value: "Train pitch →" },
      { label: "Late start 3 days", value: "Accountable →" },
      { label: "PR broken today!", value: "Praise →", accent: true },
    ],
  },
  {
    icon: Trophy,
    iconColor: "text-yellow-500",
    iconBg: "bg-yellow-500/10",
    title: "Top Performers & Records",
    description: "Celebrate wins — team records, personal bests, and daily MVPs are tracked automatically.",
    previewLines: [
      { label: "Team Record", value: "🔥 Most doors: 247" },
      { label: "Daily MVP", value: "Calvin — 3.2 FP+" },
      { label: "PR Broken", value: "Sarah — 14 trans", accent: true },
    ],
  },
];

export const ReportsFeaturePreview = () => {
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoPlay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % FEATURES.length);
    }, 4500);
  };

  useEffect(() => {
    startAutoPlay();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const goTo = (idx: number) => {
    setCurrent(idx);
    startAutoPlay();
  };

  const slide = FEATURES[current];
  const Icon = slide.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wider">
          Coming to life as your team tracks
        </span>
      </div>

      {/* Slide content */}
      <div className="relative px-4 pb-3 min-h-[180px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {/* Icon + Title */}
            <div className="flex items-center gap-2.5">
              <div className={cn("p-2 rounded-lg", slide.iconBg)}>
                <Icon className={cn("w-4 h-4", slide.iconColor)} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">{slide.title}</h3>
                <p className="text-[11px] text-muted-foreground leading-tight max-w-[260px]">
                  {slide.description}
                </p>
              </div>
            </div>

            {/* Mock preview card */}
            <div className="rounded-lg bg-muted/30 border border-border/40 p-3 space-y-1.5">
              {slide.previewLines.map((line, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className={cn(
                    "font-medium tabular-nums",
                    line.accent ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {line.value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Nav arrows */}
        <button
          onClick={() => goTo((current - 1 + FEATURES.length) % FEATURES.length)}
          className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-background/80 border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => goTo((current + 1) % FEATURES.length)}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-background/80 border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dots + CTA */}
      <div className="flex items-center justify-between px-4 pb-4">
        <div className="flex gap-1.5">
          {FEATURES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                i === current ? "bg-primary w-4" : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          Encourage your team to track daily for full insights ✨
        </p>
      </div>
    </motion.div>
  );
};
