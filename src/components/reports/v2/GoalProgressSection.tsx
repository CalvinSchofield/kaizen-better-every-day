import { useState } from "react";
import { motion } from "framer-motion";
import { Target, ChevronDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { hapticLight } from "@/utils/haptics";
import { formatFP } from "@/lib/formatters";

type GoalTimeframe = 'D' | 'W' | 'M' | 'Y';

interface GoalPaceInfo {
  daysElapsed: number;
  totalPlannedDays: number;
  expectedAtThisPoint: number;
  current: number;
  goal: number;
  pacePercent: number;
  status: 'on_pace' | 'at_risk' | 'behind';
}

interface GoalProgressSectionProps {
  // Day progress
  todayFP: number;
  dailyGoal: number;
  
  // Week-to-date
  weekFP: number;
  weekExpected: number; // Expected by today based on pace
  weekGoal: number; // Full week goal
  
  // Month-to-date
  monthFP: number;
  monthExpected: number;
  monthGoal: number;
  
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
  
  className?: string;
}

const timeframeLabels: Record<GoalTimeframe, string> = {
  D: 'Day',
  W: 'Week',
  M: 'Month',
  Y: 'Season',
};

export const GoalProgressSection = ({
  todayFP,
  dailyGoal,
  weekFP,
  weekExpected,
  weekGoal,
  monthFP,
  monthExpected,
  monthGoal,
  seasonFP,
  seasonExpected,
  seasonGoal,
  seasonDaysElapsed,
  seasonTotalDays,
  isPreseason = false,
  focusTier,
  availableTiers,
  onTierChange,
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
  
  // Calculate progress for each timeframe
  const getTimeframeData = (tf: GoalTimeframe) => {
    switch (tf) {
      case 'D':
        return {
          current: todayFP,
          expected: dailyGoal,
          goal: dailyGoal,
          label: 'Today',
          showPace: false,
        };
      case 'W':
        return {
          current: weekFP,
          expected: weekExpected,
          goal: weekGoal,
          label: 'Week to Date',
          showPace: true,
        };
      case 'M':
        return {
          current: monthFP,
          expected: monthExpected,
          goal: monthGoal,
          label: 'Month to Date',
          showPace: true,
        };
      case 'Y':
        return {
          current: seasonFP,
          expected: seasonExpected,
          goal: seasonGoal,
          label: isPreseason ? 'Preseason' : 'Season to Date',
          showPace: true,
        };
    }
  };
  
  const currentData = getTimeframeData(selectedTimeframe);
  const progressPercent = currentData.goal > 0 
    ? Math.min(100, (currentData.current / currentData.goal) * 100) 
    : 0;
  const paceDiff = currentData.current - currentData.expected;
  const isAhead = paceDiff >= 0;
  
  // Status color - use semantic tokens
  const getStatusColor = () => {
    if (!currentData.showPace) return 'bg-primary';
    const pacePercent = currentData.expected > 0 
      ? (currentData.current / currentData.expected) * 100
      : 100;
    if (pacePercent >= 90) return 'bg-green-500';
    if (pacePercent >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

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
              {formatFP(currentData.current)} / {formatFP(currentData.goal)}
            </span>
          </div>
          
          <div className="h-3 bg-muted/50 rounded-full overflow-hidden border border-border/30">
            <motion.div
              className={cn("h-full rounded-full", getStatusColor())}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          
          {/* Pace indicator (not for Day) */}
          {currentData.showPace && currentData.expected > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {selectedTimeframe === 'Y' && `Day ${seasonDaysElapsed} of ${seasonTotalDays}`}
                {selectedTimeframe !== 'Y' && `Expected: ${formatFP(currentData.expected)}`}
              </span>
              <div className={cn(
                "flex items-center gap-1 font-medium",
                isAhead ? "text-green-600" : "text-red-600"
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
                    <Progress value={progressPercent} className="h-2" />
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
                        <Progress value={tierProgress} className="h-2" />
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
