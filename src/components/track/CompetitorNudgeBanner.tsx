import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, ChevronRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { hapticLight } from "@/utils/haptics";

interface CompetitorNudge {
  name: string;
  metric: 'presentations' | 'pitches' | 'fp_plus' | 'prmr' | 'decision_makers' | 'doors_knocked';
  metricLabel: string;
  timeframe: 'today' | 'this week';
  gap: number;
  userValue: number;
  competitorValue: number;
}

interface CompetitorNudgeBannerProps {
  competitor: CompetitorNudge | null;
  loading?: boolean;
}

const getMetricUnit = (metric: CompetitorNudge['metric'], gap: number): string => {
  switch (metric) {
    case 'presentations': return gap === 1 ? 'presentation' : 'presentations';
    case 'pitches': return gap === 1 ? 'pitch' : 'pitches';
    case 'fp_plus': return 'FP+';
    case 'prmr': return 'PRMR';
    case 'decision_makers': return gap === 1 ? 'DM' : 'DMs';
    case 'doors_knocked': return gap === 1 ? 'door' : 'doors';
    default: return '';
  }
};

const getNudgeMessage = (c: CompetitorNudge): string => {
  const unit = getMetricUnit(c.metric, c.gap);
  const gapDisplay = c.metric === 'prmr' ? `$${c.gap}` : c.gap;
  return `${c.name} is ${gapDisplay} ${unit} ahead — catch them! 🚀`;
};

export const CompetitorNudgeBanner = ({ competitor, loading }: CompetitorNudgeBannerProps) => {
  const navigate = useNavigate();

  if (loading || !competitor) return null;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
        onClick={() => {
          hapticLight();
          navigate('/leaderboard');
        }}
        className="w-full flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-sm"
      >
        <Trophy className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
        <span className="flex-1 text-left text-foreground/80 truncate">
          {getNudgeMessage(competitor)}
        </span>
        <ChevronRight className="h-4 w-4 text-amber-500 flex-shrink-0" />
      </motion.button>
    </AnimatePresence>
  );
};
