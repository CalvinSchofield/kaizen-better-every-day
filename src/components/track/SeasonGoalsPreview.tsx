/**
 * SeasonGoalsPreview - Collapsible goal progress for Track pre-working state
 * 
 * Collapsed: Minimal bar with progress numbers (e.g. 67.0 / 105.0 FP+)
 * Expanded: Full UnifiedGoalProgress with D/W/M/Y toggle (same as Calendar page)
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UnifiedGoalProgress } from '@/components/goals/UnifiedGoalProgress';
import { useGoalPaceCalculator } from '@/hooks/useGoalPaceCalculator';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticLight } from '@/utils/haptics';
import { Target, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFP } from '@/lib/formatters';
import { GOAL_TIER_CONFIG } from '@/config/goalTiers';

interface SeasonGoalsPreviewProps {
  className?: string;
}

export const SeasonGoalsPreview = ({ className }: SeasonGoalsPreviewProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const data = useGoalPaceCalculator();

  if (data.isLoading) {
    return (
      <Card className={`p-4 border-border/50 ${className}`}>
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  if (!data.hasGoals) return null;

  const season = data.season;
  const totalProgress = season.actual + season.live;
  const pct = season.goal > 0 ? Math.min(100, (totalProgress / season.goal) * 100) : 0;
  const fundedPct = season.goal > 0 ? Math.min(100, (season.funded / season.goal) * 100) : 0;
  const unfundedAmount = Math.max(0, season.actual - season.funded);
  const unfundedPct = season.goal > 0 ? Math.min(pct - fundedPct, (unfundedAmount / season.goal) * 100) : 0;
  const livePct = season.goal > 0 ? Math.min(100 - fundedPct - unfundedPct, (season.live / season.goal) * 100) : 0;
  const pendingPct = season.goal > 0 ? Math.min(100 - fundedPct - unfundedPct - livePct, (season.pending / season.goal) * 100) : 0;

  const tierKey = data.isPreseason ? 'preseason' : data.focusTier;
  const tierConfig = GOAL_TIER_CONFIG[tierKey as keyof typeof GOAL_TIER_CONFIG] || GOAL_TIER_CONFIG.willDo;
  const TierIcon = tierConfig.icon;

  return (
    <Card className={`border-border/50 overflow-hidden ${className}`}>
      {/* Collapsed summary — always visible */}
      <button
        onClick={() => { hapticLight(); setIsExpanded(!isExpanded); }}
        className="w-full text-left p-4"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Goal Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              <TierIcon className={cn("w-3 h-3", tierConfig.color)} />
              {data.tierLabel}
            </span>
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-180"
            )} />
          </div>
        </div>

        {/* Progress numbers */}
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatFP(totalProgress)}
            {season.live > 0 && <span className="text-emerald-500 text-xs font-normal"> +{formatFP(season.live)}</span>}
            {season.pending > 0 && <span className="text-warning text-xs font-normal"> +{formatFP(season.pending)}</span>}
          </span>
          <span className="text-sm text-muted-foreground">
            / {formatFP(season.goal)} {data.metricLabel}
          </span>
        </div>

        {/* Mini segmented bar */}
        <div className="h-2 bg-muted/50 rounded-full overflow-hidden border border-border/30">
          {fundedPct > 0 && (
            <motion.div
              className="h-full float-left bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${fundedPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          )}
          {unfundedPct > 0 && (
            <motion.div
              className="h-full float-left bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${unfundedPct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
            />
          )}
          {livePct > 0 && (
            <motion.div
              className="h-full float-left bg-emerald-500 animate-pulse"
              initial={{ width: 0 }}
              animate={{ width: `${livePct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
            />
          )}
          {pendingPct > 0 && (
            <motion.div
              className="h-full float-left bg-warning"
              initial={{ width: 0 }}
              animate={{ width: `${pendingPct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
            />
          )}
        </div>
      </button>

      {/* Expanded: Full goal progress with D/W/M/Y toggle */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30">
              <UnifiedGoalProgress
                data={data}
                mode="full"
                showTierSelector
                showPaceContext
                showTimeframeToggle
                cardless
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};
