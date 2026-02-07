import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Target, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { hapticLight } from "@/utils/haptics";
import { formatFP } from "@/lib/formatters";
import { format, isToday as isDateToday } from "date-fns";

type GoalTimeframe = 'D' | 'W' | 'M' | 'Y';

interface GoalProgressSectionProps {
  // Day progress
  todayFP: number;
  dailyGoal: number;
  
  // Live/unfinalized FP (rep actively working)
  liveFP?: number;
  
  // Week-to-date
  weekFP: number;
  weekExpected: number; // Expected by today based on planned days
  weekGoal: number; // Full week goal
  weekPlannedDays?: number; // Planned work days for the week
  weekElapsedPlannedDays?: number; // How many of those are elapsed
  
  // Month-to-date
  monthFP: number;
  monthExpected: number;
  monthGoal: number;
  monthPlannedDays?: number;
  monthElapsedPlannedDays?: number;
  
  // Year/Season-to-date
  seasonFP: number;
  seasonExpected: number;
  seasonGoal: number;
  seasonDaysElapsed: number;
  seasonTotalDays: number;
  
  // Tier info
  isPreseason?: boolean;
  focusTier?: string | null;
  availableTiers?: { label: string; goal: number; key: string }[];
  onTierChange?: (tierKey: string) => void;
  
  // The selected date being viewed (for day label)
  selectedDate?: Date;
  
  className?: string;
}

const timeframeLabels: Record<GoalTimeframe, string> = {
  D: 'Day',
  W: 'Week',
  M: 'Month',
  Y: 'Season',
};

// Segmented progress bar component
const SegmentedProgressBar = ({
  finalized,
  live,
  goal,
  expected,
  className,
}: {
  finalized: number;
  live: number;
  goal: number;
  expected: number;
  className?: string;
}) => {
  if (goal <= 0) return null;
  
  const finalizedPercent = Math.min(100, (finalized / goal) * 100);
  const livePercent = Math.min(100 - finalizedPercent, (live / goal) * 100);
  const expectedPercent = Math.min(100, (expected / goal) * 100);
  const totalPercent = finalizedPercent + livePercent;
  
  // Determine color based on progress vs expected
  const isAhead = totalPercent >= expectedPercent;
  
  return (
    <div className={cn("relative", className)}>
      <div className="h-3 bg-muted/50 rounded-full overflow-hidden border border-border/30">
        {/* Finalized progress (solid) */}
        <motion.div
          className={cn(
            "h-full absolute left-0 top-0 rounded-l-full",
            isAhead ? "bg-amber-400" : "bg-amber-400"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${finalizedPercent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        
        {/* Live/unfinalized progress (lighter shade) */}
        {livePercent > 0 && (
          <motion.div
            className="h-full absolute top-0 bg-rose-400/80"
            style={{ left: `${finalizedPercent}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${livePercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          />
        )}
      </div>
      
      {/* Expected marker (dashed line) */}
      {expected > 0 && expectedPercent < 100 && (
        <div 
          className="absolute top-0 h-3 w-0.5 border-l-2 border-dashed border-muted-foreground/60"
          style={{ left: `${expectedPercent}%` }}
        />
      )}
    </div>
  );
};

export const GoalProgressSection = ({
  todayFP,
  dailyGoal,
  liveFP = 0,
  weekFP,
  weekExpected,
  weekGoal,
  weekPlannedDays,
  weekElapsedPlannedDays,
  monthFP,
  monthExpected,
  monthGoal,
  monthPlannedDays,
  monthElapsedPlannedDays,
  seasonFP,
  seasonExpected,
  seasonGoal,
  seasonDaysElapsed,
  seasonTotalDays,
  isPreseason = false,
  focusTier,
  availableTiers,
  onTierChange,
  selectedDate,
  className,
}: GoalProgressSectionProps) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<GoalTimeframe>('D');
  const [showTierDrawer, setShowTierDrawer] = useState(false);
  
  // Get current tier label
  const tierLabel = isPreseason 
    ? 'Preseason' 
    : focusTier === 'couldDo' 
      ? 'Could Do' 
      : focusTier === 'willDo' 
        ? 'Will Do' 
        : 'Must Do';
  
  // Get the day label for the Day tab
  const dayLabel = useMemo(() => {
    if (!selectedDate) return 'Today';
    if (isDateToday(selectedDate)) return 'Today';
    
    // Show day name (e.g., "Wednesday")
    return format(selectedDate, 'EEEE');
  }, [selectedDate]);
  
  // Calculate progress for each timeframe
  const getTimeframeData = (tf: GoalTimeframe) => {
    switch (tf) {
      case 'D':
        return {
          finalized: todayFP,
          live: liveFP,
          expected: dailyGoal,
          goal: dailyGoal,
          label: dayLabel,
          showPace: false,
          showLiveSegment: liveFP > 0,
          daysContext: null as string | null,
        };
      case 'W':
        return {
          finalized: weekFP,
          live: liveFP,
          expected: weekExpected,
          goal: weekGoal,
          label: 'Week to Date',
          showPace: true,
          showLiveSegment: liveFP > 0,
          daysContext: weekPlannedDays && weekElapsedPlannedDays !== undefined
            ? `${weekElapsedPlannedDays} of ${weekPlannedDays} work days`
            : null,
        };
      case 'M':
        return {
          finalized: monthFP,
          live: liveFP,
          expected: monthExpected,
          goal: monthGoal,
          label: 'Month to Date',
          showPace: true,
          showLiveSegment: liveFP > 0,
          daysContext: monthPlannedDays && monthElapsedPlannedDays !== undefined
            ? `${monthElapsedPlannedDays} of ${monthPlannedDays} work days`
            : null,
        };
      case 'Y':
        return {
          finalized: seasonFP,
          live: liveFP,
          expected: seasonExpected,
          goal: seasonGoal,
          label: isPreseason ? 'Preseason' : 'Season to Date',
          showPace: true,
          showLiveSegment: liveFP > 0,
          daysContext: `Day ${seasonDaysElapsed} of ${seasonTotalDays}`,
        };
    }
  };
  
  const currentData = getTimeframeData(selectedTimeframe);
  const totalProgress = currentData.finalized + currentData.live;
  const progressPercent = currentData.goal > 0 
    ? Math.min(100, (totalProgress / currentData.goal) * 100) 
    : 0;
  const paceDiff = totalProgress - currentData.expected;
  const isAhead = paceDiff >= 0;

  return (
    <motion.div
      className={cn("space-y-3", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      {/* Header with tier selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold">Goal Progress</h4>
        </div>
        
        {/* Tier selector button */}
        <button
          onClick={() => {
            hapticLight();
            setShowTierDrawer(true);
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 hover:bg-muted transition-colors"
        >
          <span className="text-xs font-medium">{tierLabel}</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
      
      {/* Progress Card */}
      <div className="p-3 rounded-xl bg-muted/30 border border-border/30 space-y-3">
        {/* Main progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{currentData.label}</span>
            <span className="font-medium tabular-nums">
              {formatFP(totalProgress)}
              {currentData.showLiveSegment && (
                <span className="text-rose-500/80"> (+{formatFP(currentData.live)} live)</span>
              )}
              {' / '}{formatFP(currentData.goal)}
            </span>
          </div>
          
          {/* Segmented progress bar */}
          <SegmentedProgressBar
            finalized={currentData.finalized}
            live={currentData.live}
            goal={currentData.goal}
            expected={currentData.expected}
          />
          
          {/* Pace indicator (not for Day) */}
          {currentData.showPace && currentData.expected > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {currentData.daysContext || `Expected: ${formatFP(currentData.expected)}`}
              </span>
              <div className={cn(
                "flex items-center gap-1 font-medium",
                isAhead ? "text-green-600" : "text-destructive"
              )}>
                {isAhead ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span className="tabular-nums">
                  {isAhead ? '+' : ''}{formatFP(paceDiff)} vs pace
                </span>
              </div>
            </div>
          )}
          
          {/* Legend for bar segments */}
          {currentData.showLiveSegment && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Logged</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-400/80" />
                <span>Live</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0 border-t-2 border-dashed border-muted-foreground/60" />
                <span>Expected</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Timeframe Toggle */}
      <div className="flex items-center justify-center gap-1 p-1 bg-muted/40 rounded-full">
        {(['D', 'W', 'M', 'Y'] as GoalTimeframe[]).map((tf) => (
          <button
            key={tf}
            onClick={() => {
              hapticLight();
              setSelectedTimeframe(tf);
            }}
            className={cn(
              "relative px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors",
              selectedTimeframe === tf
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/70"
            )}
          >
            {selectedTimeframe === tf && (
              <motion.div
                layoutId="goal-timeframe-pill-section"
                className="absolute inset-0 bg-background shadow-sm rounded-full"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{timeframeLabels[tf]}</span>
          </button>
        ))}
      </div>
      
      {/* Tier Selection Drawer */}
      <Drawer open={showTierDrawer} onOpenChange={setShowTierDrawer}>
        <DrawerContent className="z-[70]">
          <DrawerHeader>
            <DrawerTitle>Select Goal Tier</DrawerTitle>
          </DrawerHeader>
          
          <div className="p-4 space-y-4">
            {/* Preseason vs Summer indicator */}
            <div className="flex justify-center">
              <Badge variant="outline">
                {isPreseason ? 'Preseason Mode' : 'Summer Mode'}
              </Badge>
            </div>
            
            {/* Tier options */}
            <div className="space-y-3">
              {isPreseason ? (
                // Preseason - just show preseason goal
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">Preseason Goal</h4>
                      <p className="text-sm text-muted-foreground">
                        Current target
                      </p>
                    </div>
                    <span className="text-2xl font-bold tabular-nums">
                      {formatFP(seasonGoal)}
                    </span>
                  </div>
                  
                  <div className="mt-3">
                    <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{formatFP(seasonFP)} earned</span>
                      <span>{Math.round(progressPercent)}%</span>
                    </div>
                  </div>
                </div>
              ) : (
                // Summer - show tier options
                availableTiers?.map((tier) => {
                  const isSelected = focusTier === tier.key;
                  const tierProgress = tier.goal > 0 
                    ? Math.min(100, (seasonFP / tier.goal) * 100) 
                    : 0;
                  
                  return (
                    <button
                      key={tier.key}
                      onClick={() => {
                        hapticLight();
                        onTierChange?.(tier.key);
                        setShowTierDrawer(false);
                      }}
                      className={cn(
                        "w-full p-4 rounded-xl border text-left transition-colors",
                        isSelected 
                          ? "bg-primary/10 border-primary/30" 
                          : "bg-muted/30 border-border/30 hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className={cn(
                            "font-semibold",
                            isSelected && "text-primary"
                          )}>
                            {tier.label}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {isSelected ? 'Current focus' : 'Tap to select'}
                          </p>
                        </div>
                        <span className={cn(
                          "text-2xl font-bold tabular-nums",
                          isSelected && "text-primary"
                        )}>
                          {formatFP(tier.goal)}
                        </span>
                      </div>
                      
                      <div className="mt-3">
                        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${tierProgress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>{formatFP(seasonFP)} earned</span>
                          <span>{Math.round(tierProgress)}%</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </motion.div>
  );
};
