import { useMemo } from "react";
import { Check, TrendingUp } from "lucide-react";
import { formatCurrency, calculateTakeHome } from "@/utils/payscaleCalculator";
import { calculateUpfrontPay } from "@/utils/roiCalculations";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { PayEstimateDisclaimer } from "@/components/PayEstimateDisclaimer";
import { GOAL_TIER_CONFIG } from "@/config/goalTiers";

export type GoalTier = 'preseason' | 'mustDo' | 'willDo' | 'couldDo';

interface GoalHeroRingProps {
  pendingPipeline?: number;
  liveFP?: number;
  activeTier: GoalTier;
  fpGoal: number;
  currentProgress: number;
  fundedProgress?: number;
  avgPrmrPerFp: number;
  upgradeFpGoal?: number;
  rentType: string;
  weeksWorking: number;
  efpMode?: boolean;
  onTierChange: (tier: GoalTier) => void;
  onEarningsClick?: () => void;
  tiers: {
    preseason: { goal: number; complete: boolean };
    mustDo: { goal: number; complete: boolean };
    willDo: { goal: number; complete: boolean };
    couldDo: { goal: number; complete: boolean };
  };
  // Dynamic pace tracking props - only show when relevant to active tier
  dailyGoal?: number;
  todayProgress?: number;
  remainingDailyNeeded?: number;
  isSummer?: boolean; // Whether summer season has started
  isTodayPlanned?: boolean; // Whether today is a planned knocking day
  hasAnyPlannedDays?: boolean; // Whether user has any planned days at all
  isUserSummerStarted?: boolean; // Whether user's personal summer has started (hides preseason tier)
  // Overall preseason pace status
  preseasonPaceStatus?: {
    knockingDays: number;
    expectedFp: number;
    actualFp: number;
    paceVariance: number; // positive = ahead, negative = behind
  };
  // NEW: Enhanced pace context props
  paceContext?: 'insufficient-data' | 'early-season' | 'building-momentum' | 'on-track' | 'stretch' | 'very-ambitious';
  knockingDaysCompleted?: number;
  currentAverage?: number;
  bestDay?: number;
  projectedFinal?: number;
  suggestStretchGoal?: number;
  canAddMoreDays?: boolean;
  availableDaysToAdd?: number;
  isRookie?: boolean;
  weekInSummer?: number;
  learningCurveMessage?: string;
  // Expected progress marker
  expectedPercent?: number;
  showExpectedMarker?: boolean;
}

const tierConfig = GOAL_TIER_CONFIG;

export const GoalHeroRing = ({
  pendingPipeline = 0,
  liveFP = 0,
  activeTier,
  fpGoal,
  currentProgress,
  fundedProgress,
  avgPrmrPerFp,
  upgradeFpGoal = 0,
  rentType,
  weeksWorking,
  efpMode = false,
  onTierChange,
  onEarningsClick,
  tiers,
  dailyGoal = 0,
  todayProgress = 0,
  remainingDailyNeeded,
  isSummer = false,
  isTodayPlanned = false,
  hasAnyPlannedDays = true,
  isUserSummerStarted = false,
  preseasonPaceStatus,
  // NEW: Enhanced pace context props
  paceContext,
  knockingDaysCompleted = 0,
  currentAverage = 0,
  bestDay = 0,
  projectedFinal = 0,
  suggestStretchGoal,
  canAddMoreDays = false,
  availableDaysToAdd = 0,
  isRookie = false,
  weekInSummer = 0,
  learningCurveMessage,
  expectedPercent,
  showExpectedMarker = false,
}: GoalHeroRingProps) => {
  const config = tierConfig[activeTier];
  const Icon = config.icon;
  const metricLabel = efpMode ? 'EFP' : 'FP+';
  
  // Determine if we should show enhanced pace messaging (18+ knocking days)
  const hasEnoughData = knockingDaysCompleted >= 18;
  
  // Only show pace tracking for: preseason tier during preseason, OR summer tiers during summer
  // AND only if today is a planned knocking day
  const showPaceTracking = (activeTier === 'preseason' ? !isSummer : isSummer) && isTodayPlanned;
  
  // Calculate earnings - for preseason, just show upfront pay (4x PRMR)
  const isPreseasonTier = activeTier === 'preseason';
  const preseasonPrmr = fpGoal * avgPrmrPerFp;
  const preseasonUpfrontPay = calculateUpfrontPay(preseasonPrmr);
  
  const result = calculateTakeHome({
    fpGoal,
    avgPrmrPerFp,
    upgradeFpGoal,
    rentType,
    weeksWorking,
  });
  
  // Use preseason upfront pay for preseason tier, otherwise use full take-home calculation
  // Never show negative numbers
  const displayedPay = isPreseasonTier ? preseasonUpfrontPay : Math.max(0, result.takeHomePay);
  const displayedRate = isPreseasonTier ? 4 : result.rate;

  // Progress calculations - center display is based on funded progress
  const fundedDisplay = fundedProgress ?? currentProgress;
  const progress = fpGoal > 0 ? Math.min((currentProgress / fpGoal) * 100, 100) : 0;
  const livePercent = fpGoal > 0 ? Math.min(((currentProgress + liveFP) / fpGoal) * 100, 100) : 0;
  const totalWithPendingProgress = currentProgress + liveFP + pendingPipeline;
  const totalWithPendingPercent = fpGoal > 0 ? Math.min((totalWithPendingProgress / fpGoal) * 100, 100) : 0;
  const remaining = Math.max(fpGoal - fundedDisplay, 0);
  const isComplete = fundedDisplay >= fpGoal && fpGoal > 0;

  // Today's pace calculation
  const todayPaceDiff = dailyGoal > 0 ? todayProgress - dailyGoal : 0;
  const isTodayAhead = todayPaceDiff >= 0.1;
  const isTodayBehind = todayPaceDiff <= -0.1;

  // SVG Arc calculations
  const size = 220;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const toDashOffset = (percent: number) => circumference - (percent / 100) * circumference;

  const totalWithPendingDashoffset = toDashOffset(totalWithPendingPercent);
  const liveDashoffset = toDashOffset(livePercent);
  const totalDashoffset = toDashOffset(progress);

  // Funded progress arc (if different from total)
  const showFunded = fundedProgress !== undefined && fundedProgress < currentProgress;
  const fundedPercent = showFunded && fpGoal > 0 ? Math.min((fundedProgress / fpGoal) * 100, 100) : 0;
  const fundedDashoffset = toDashOffset(fundedPercent);
  
  // Determine if funded arc needs a flat end (when live or unfunded extends beyond it)
  const hasSegmentAfterFunded = showFunded || liveFP > 0;

  // Available tiers (only show tiers with goals > 0, hide preseason after user's summer starts)
  const availableTiers = useMemo(() => {
    return (['preseason', 'mustDo', 'willDo', 'couldDo'] as GoalTier[]).filter(
      tier => {
        // Hide preseason tier once user's personal summer has started
        if (tier === 'preseason' && isUserSummerStarted) return false;
        return tiers[tier].goal > 0;
      }
    );
  }, [tiers, isUserSummerStarted]);

  return (
    <div className="relative flex flex-col items-center">
      {/* Main Ring Container */}
      <div className="relative">
        {/* Glow effect */}
        <div 
          className={cn(
            "absolute inset-0 rounded-full blur-2xl opacity-40 transition-all duration-500",
            isComplete ? "bg-emerald-500" : `bg-gradient-to-br ${config.gradient}`
          )}
          style={{ transform: 'scale(0.85)' }}
        />
        
        {/* SVG Progress Ring */}
        <svg 
          width={size} 
          height={size} 
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            className="opacity-40"
          />
          
          {/* Bottom layer: pending (yellow) */}
          {pendingPipeline > 0 && !isComplete && totalWithPendingPercent > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--warning))"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={totalWithPendingDashoffset}
              className="transition-all duration-700 ease-out"
            />
          )}

          {/* Live layer: green with pulse (between unfunded and pending) */}
          {liveFP > 0 && !isComplete && livePercent > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--success))"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={liveDashoffset}
              className="transition-all duration-700 ease-out animate-pulse"
            />
          )}

          {/* Middle layer: funded + unfunded (blue) */}
          {progress > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={showFunded ? "hsl(var(--primary))" : isComplete ? "hsl(var(--success))" : "url(#progressGradient)"}
              strokeWidth={strokeWidth}
              strokeLinecap={hasSegmentAfterFunded ? "butt" : "round"}
              strokeDasharray={circumference}
              strokeDashoffset={totalDashoffset}
              className="transition-all duration-700 ease-out"
            />
          )}

          {/* Top layer: funded only (green) — flat end so next segment is flush */}
          {showFunded && fundedPercent > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--success))"
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              strokeDasharray={circumference}
              strokeDashoffset={fundedDashoffset}
              className="transition-all duration-700 ease-out"
            />
          )}

          {/* Expected By Now tick mark */}
          {showExpectedMarker && expectedPercent != null && expectedPercent > 0 && expectedPercent < 100 && (
            <g 
              style={{ 
                transform: `rotate(${(expectedPercent / 100) * 360 - 90}deg)`,
                transformOrigin: `${size / 2}px ${size / 2}px`,
                transition: 'transform 0.5s ease-out',
              }}
            >
              <line
                x1={size / 2}
                y1={strokeWidth / 2 - 2}
                x2={size / 2}
                y2={strokeWidth + 4}
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.5}
              />
            </g>
          )}

          {/* Gradient definition */}
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--primary-dark))" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTier}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center"
            >
              {isComplete ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-1">
                    <Check className="h-6 w-6 text-emerald-500" />
                  </div>
                  <span className="text-sm font-medium text-emerald-500">Complete!</span>
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold tracking-tight">
                    {fundedDisplay.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    of {fpGoal.toFixed(0)} {metricLabel}
                  </span>
                  <div className="flex items-center gap-1 mt-1 text-xs">
                    <TrendingUp className="h-3 w-3 text-primary" />
                    <span className="text-primary font-medium">
                      {remaining.toFixed(1)} to go
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Earnings Badge */}
      <motion.button
        onClick={onEarningsClick}
        className={cn(
          "mt-4 px-5 py-2.5 rounded-2xl backdrop-blur-sm",
          "bg-gradient-to-r from-card/80 to-card/60",
          "border border-border/50",
          "shadow-lg",
          "active:scale-95 transition-transform",
          config.glowColor
        )}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-xl bg-gradient-to-br",
            config.gradient,
            "text-white"
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-2xl font-bold tracking-tight">
              {formatCurrency(displayedPay)}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPreseasonTier ? 'Upfront pay · $4/PRMR' : `Projected take-home · $${displayedRate}/PRMR`}
            </p>
          </div>
        </div>
      </motion.button>

      
      {/* Show CTA to plan days when no days are planned */}
      {!hasAnyPlannedDays && !isComplete && fpGoal > 0 && (
        <motion.p 
          className="mt-2 text-xs text-amber-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Plan your work days below to track daily pace
        </motion.p>
      )}

      {/* Tier Pills */}
      <div id="goals-tier-selector" data-tour="goals-tier-selector" className="flex gap-2 mt-6">
        {availableTiers.map((tier) => {
          const tierConf = tierConfig[tier];
          const TierIcon = tierConf.icon;
          const isActive = tier === activeTier;
          const tierComplete = tiers[tier].complete;
          
          return (
            <button
              key={tier}
              onClick={() => onTierChange(tier)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium",
                "transition-all duration-200",
                isActive
                  ? cn("bg-gradient-to-r text-white shadow-lg", tierConf.gradient, tierConf.glowColor)
                  : tierComplete
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {tierComplete ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <TierIcon className="h-3.5 w-3.5" />
              )}
              <span>{tierConf.shortLabel}</span>
            </button>
          );
        })}
      </div>


      {/* Funded vs Unfunded legend (+ pending when applicable) */}
      {(showFunded || liveFP > 0 || (pendingPipeline > 0 && !isComplete)) && (
        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {showFunded && (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-success" />
                  {fundedProgress?.toFixed(1)} funded
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  {(currentProgress - (fundedProgress || 0)).toFixed(1)} unfunded
                </span>
              </>
            )}
            {liveFP > 0 && !isComplete && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                {liveFP.toFixed(1)} live
              </span>
            )}
            {pendingPipeline > 0 && !isComplete && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-warning" />
                {pendingPipeline.toFixed(1)} pending
              </span>
            )}
          </div>
        </div>
      )}

      {/* Pay estimate disclaimer */}
      <PayEstimateDisclaimer className="mt-4 text-center" />
    </div>
  );
};