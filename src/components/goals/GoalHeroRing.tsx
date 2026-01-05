import { useMemo } from "react";
import { Check, Target, Zap, Trophy, TrendingUp } from "lucide-react";
import { formatCurrency, calculateTakeHome } from "@/utils/payscaleCalculator";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { PayEstimateDisclaimer } from "@/components/PayEstimateDisclaimer";

export type GoalTier = 'preseason' | 'mustDo' | 'willDo' | 'couldDo';

interface GoalHeroRingProps {
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
}

const tierConfig: Record<GoalTier, { 
  label: string; 
  shortLabel: string;
  icon: typeof Target; 
  gradient: string;
  glowColor: string;
}> = {
  preseason: {
    label: 'Preseason',
    shortLabel: 'Preseason',
    icon: Target,
    gradient: 'from-blue-400 to-blue-600',
    glowColor: 'shadow-blue-500/30',
  },
  mustDo: { 
    label: 'Must Do', 
    shortLabel: 'Must',
    icon: Target, 
    gradient: 'from-amber-400 to-orange-500',
    glowColor: 'shadow-amber-500/30',
  },
  willDo: { 
    label: 'Will Do', 
    shortLabel: 'Will',
    icon: Zap, 
    gradient: 'from-primary to-primary-dark',
    glowColor: 'shadow-primary/30',
  },
  couldDo: { 
    label: 'Could Do', 
    shortLabel: 'Could',
    icon: Trophy, 
    gradient: 'from-emerald-400 to-green-600',
    glowColor: 'shadow-emerald-500/30',
  },
};

export const GoalHeroRing = ({
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
  const preseasonUpfrontPay = preseasonPrmr * 4; // Upfront is 4x PRMR
  
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

  // Progress calculations
  const progress = fpGoal > 0 ? Math.min((currentProgress / fpGoal) * 100, 100) : 0;
  const remaining = Math.max(fpGoal - currentProgress, 0);
  const isComplete = currentProgress >= fpGoal && fpGoal > 0;

  // Today's pace calculation
  const todayPaceDiff = dailyGoal > 0 ? todayProgress - dailyGoal : 0;
  const isTodayAhead = todayPaceDiff >= 0.1;
  const isTodayBehind = todayPaceDiff <= -0.1;

  // SVG Arc calculations
  const size = 220;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  // Funded progress arc (if different from total)
  const showFunded = fundedProgress !== undefined && fundedProgress < currentProgress;
  const fundedPercent = showFunded && fpGoal > 0 ? Math.min((fundedProgress / fpGoal) * 100, 100) : 0;
  const fundedDashoffset = circumference - (fundedPercent / 100) * circumference;

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
          
          {/* Funded progress (if showing) */}
          {showFunded && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(120 30% 45%)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={fundedDashoffset}
              className="transition-all duration-700 ease-out"
            />
          )}
          
          {/* Main progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isComplete ? "hsl(120 50% 50%)" : "url(#progressGradient)"}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              "transition-all duration-700 ease-out",
              showFunded && "opacity-40"
            )}
          />
          
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
                    {currentProgress.toFixed(1)}
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
                  {/* Today's pace indicator - only show when pace tracking is relevant */}
                  {showPaceTracking && dailyGoal > 0 && (
                    <div className={cn(
                      "mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium",
                      isTodayAhead && "bg-emerald-500/10 text-emerald-600",
                      isTodayBehind && "bg-amber-500/10 text-amber-600",
                      !isTodayAhead && !isTodayBehind && "bg-blue-500/10 text-blue-600"
                    )}>
                      {isTodayAhead && `+${todayPaceDiff.toFixed(1)} ahead today`}
                      {isTodayBehind && `${Math.abs(todayPaceDiff).toFixed(1)} behind today`}
                      {!isTodayAhead && !isTodayBehind && "On pace today"}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Earnings Badge */}
      <motion.div 
        className={cn(
          "mt-4 px-5 py-2.5 rounded-2xl backdrop-blur-sm",
          "bg-gradient-to-r from-card/80 to-card/60",
          "border border-border/50",
          "shadow-lg",
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
          <div>
            <p className="text-2xl font-bold tracking-tight">
              {formatCurrency(displayedPay)}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPreseasonTier ? 'Upfront pay · $4/PRMR' : `Projected take-home · $${displayedRate}/PRMR`}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Remaining daily needed - only show when pace tracking is relevant AND we have planned days */}
      {showPaceTracking && remainingDailyNeeded !== undefined && remainingDailyNeeded > 0 && remainingDailyNeeded !== Infinity && !isComplete && (
        <motion.p 
          className="mt-2 text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Need <span className="font-semibold text-foreground">{remainingDailyNeeded.toFixed(2)}</span> {metricLabel}/day
        </motion.p>
      )}
      
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
      <div id="goals-tier-selector" className="flex gap-2 mt-6">
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

      {/* Preseason Overall Pace Status - show when preseason tier selected and has knocking days */}
      {activeTier === 'preseason' && preseasonPaceStatus && preseasonPaceStatus.knockingDays > 0 && !isComplete && (
        <motion.div
          className={cn(
            "mt-4 px-4 py-2 rounded-xl text-sm font-medium",
            preseasonPaceStatus.paceVariance >= 0.1 && "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
            preseasonPaceStatus.paceVariance <= -0.1 && "bg-amber-500/10 text-amber-600 border border-amber-500/20",
            Math.abs(preseasonPaceStatus.paceVariance) < 0.1 && "bg-blue-500/10 text-blue-600 border border-blue-500/20"
          )}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {preseasonPaceStatus.paceVariance >= 0.1 && (
            <span>+{preseasonPaceStatus.paceVariance.toFixed(1)} {metricLabel} ahead of pace after {preseasonPaceStatus.knockingDays} knocking days</span>
          )}
          {preseasonPaceStatus.paceVariance <= -0.1 && (
            <span>{Math.abs(preseasonPaceStatus.paceVariance).toFixed(1)} {metricLabel} behind pace after {preseasonPaceStatus.knockingDays} knocking days</span>
          )}
          {Math.abs(preseasonPaceStatus.paceVariance) < 0.1 && (
            <span>On pace after {preseasonPaceStatus.knockingDays} knocking days</span>
          )}
        </motion.div>
      )}

      {/* Enhanced Pace Context Messaging - Summer tiers with 18+ knocking days */}
      {activeTier !== 'preseason' && isUserSummerStarted && !isComplete && paceContext && paceContext !== 'insufficient-data' && hasEnoughData && (
        <motion.div
          className="mt-4 space-y-2"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Pace context badge */}
          <div className={cn(
            "px-4 py-2 rounded-xl text-sm font-medium text-center",
            (paceContext === 'building-momentum' || paceContext === 'on-track') && "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
            paceContext === 'stretch' && "bg-amber-500/10 text-amber-600 border border-amber-500/20",
            paceContext === 'very-ambitious' && "bg-blue-500/10 text-blue-600 border border-blue-500/20",
            paceContext === 'early-season' && "bg-primary/10 text-primary border border-primary/20"
          )}>
            {(paceContext === 'building-momentum') && (
              <span>You're crushing it! Projected to hit {projectedFinal.toFixed(0)} {metricLabel}</span>
            )}
            {paceContext === 'on-track' && (
              <span>On pace at {currentAverage.toFixed(2)}/day · need {remainingDailyNeeded?.toFixed(2)}/day</span>
            )}
            {paceContext === 'stretch' && (
              <span>Push time: need {remainingDailyNeeded?.toFixed(2)}/day (avg: {currentAverage.toFixed(2)})</span>
            )}
            {paceContext === 'very-ambitious' && (
              <span>Need {remainingDailyNeeded?.toFixed(2)}/day · best day: {bestDay.toFixed(1)}</span>
            )}
            {paceContext === 'early-season' && (
              <span>Building momentum · week {weekInSummer} of summer</span>
            )}
          </div>

          {/* Suggestion for very ambitious: add more days if possible */}
          {paceContext === 'very-ambitious' && canAddMoreDays && availableDaysToAdd > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Consider adding {Math.min(availableDaysToAdd, 10)} more knocking days to make this more achievable
            </p>
          )}

          {/* Learning curve principle message for rookies */}
          {learningCurveMessage && isRookie && (paceContext === 'stretch' || paceContext === 'very-ambitious' || paceContext === 'early-season') && (
            <p className="text-xs text-muted-foreground text-center italic">
              {learningCurveMessage}
            </p>
          )}

          {/* Stretch goal suggestion when ahead */}
          {suggestStretchGoal && (paceContext === 'building-momentum' || paceContext === 'on-track') && (
            <p className="text-xs text-primary text-center font-medium">
              Consider stretching your Could Do to {suggestStretchGoal} {metricLabel}!
            </p>
          )}
        </motion.div>
      )}

      {/* Early season message - before 18 knocking days */}
      {activeTier !== 'preseason' && isUserSummerStarted && !isComplete && !hasEnoughData && knockingDaysCompleted > 0 && (
        <motion.div
          className="mt-4 px-4 py-2 rounded-xl text-sm text-center bg-primary/10 text-primary border border-primary/20"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <span>Building momentum · {knockingDaysCompleted} knocking days so far</span>
          {learningCurveMessage && isRookie && (
            <p className="text-xs text-muted-foreground mt-1 italic">{learningCurveMessage}</p>
          )}
        </motion.div>
      )}

      {/* Funded vs Unfunded legend */}
      {showFunded && (
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            {fundedProgress?.toFixed(1)} funded
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary/40" />
            {(currentProgress - (fundedProgress || 0)).toFixed(1)} unfunded
          </span>
        </div>
      )}

      {/* Pay estimate disclaimer */}
      <PayEstimateDisclaimer className="mt-4 text-center" />
    </div>
  );
};