import { CalendarDays, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useGoalPaceCalculator } from "@/hooks/useGoalPaceCalculator";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/utils/haptics";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Planning Nudge Card
 * 
 * Shows below Today's Mission when a rep's daily needed pace is unrealistic
 * relative to their average, suggesting they plan more work days.
 * 
 * Trigger conditions (ALL must be true):
 *  1. Rep has ≥ 5 knocking days completed (enough data)
 *  2. Rep's daily average > 0 (they've actually produced)
 *  3. dailyNeeded > userDailyAvg × 2.0 (pace is unrealistic)
 *  4. Not dismissed this session
 */
export const PlanningNudgeCard = () => {
  const data = useGoalPaceCalculator();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Guard conditions
  const knockingDays = data.knockingDaysCompleted ?? 0;
  const avg = data.userDailyAvg ?? 0;
  const needed = data.dailyNeeded ?? 0;

  const hasEnoughData = knockingDays >= 5;
  const hasProduced = avg > 0;
  const paceIsUnrealistic = needed > avg * 2.0;
  const shouldShow = hasEnoughData && hasProduced && paceIsUnrealistic && !dismissed && data.hasGoals;

  if (!shouldShow) return null;

  const handlePlanDays = () => {
    hapticLight();
    navigate("/calendar?planning=true");
  };

  const handleDismiss = () => {
    hapticLight();
    setDismissed(true);
  };

  const metricLabel = data.metricLabel || "FP+";
  const roundedNeeded = Math.round(needed * 10) / 10;
  const roundedAvg = Math.round(avg * 10) / 10;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
      >
        <Card className={cn(
          "p-4 border-amber-500/30 bg-amber-500/5",
          "relative overflow-hidden"
        )}>
          {/* Subtle background accent */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />

          <div className="relative">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center mt-0.5">
                <CalendarDays className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Your pace looks stretched
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  You need <span className="font-semibold text-amber-500">{roundedNeeded} {metricLabel}/day</span> but 
                  average <span className="font-semibold text-foreground">{roundedAvg}</span>. 
                  Planning more work days will bring that number down.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 ml-11">
              <button
                onClick={handlePlanDays}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold active:scale-[0.97] transition-transform"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Plan My Days
                <ChevronRight className="w-3 h-3" />
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};
