import { motion } from "framer-motion";
import { Lightbulb, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseISO, format } from "date-fns";

interface TimingInsight {
  icon: typeof Clock | typeof TrendingUp | typeof Lightbulb;
  message: string;
  tip: string;
}

interface SelfTimingInsightsProps {
  workStartTime?: string | null;
  workEndTime?: string | null;
  breakMinutes?: number;
  dayOfWeek?: number; // 0 = Sunday, 6 = Saturday
  className?: string;
}

/**
 * Rep-facing, encouraging version of timing insights.
 * Frames the same data as actionable self-improvement tips
 * rather than punitive "concerns."
 */
export const SelfTimingInsights = ({
  workStartTime,
  workEndTime,
  breakMinutes = 0,
  dayOfWeek,
  className,
}: SelfTimingInsightsProps) => {
  const insights: TimingInsight[] = [];

  // Parse times if available
  const startDate = workStartTime ? parseISO(workStartTime) : null;
  const endDate = workEndTime ? parseISO(workEndTime) : null;
  
  // Determine what day it is
  const currentDayOfWeek = dayOfWeek ?? (startDate ? startDate.getDay() : new Date().getDay());
  const isSaturday = currentDayOfWeek === 6;
  const isWeekday = currentDayOfWeek >= 1 && currentDayOfWeek <= 5;

  // Late Start Insight - encouraging tone
  if (startDate) {
    const startHour = startDate.getHours();
    const startMinute = startDate.getMinutes();
    const startInMinutes = startHour * 60 + startMinute;
    
    // Thresholds: Mon-Fri after 1pm (780 min), Sat after 10am (600 min)
    const lateThresholdWeekday = 780; // 1:00 PM
    const lateThresholdSaturday = 600; // 10:00 AM
    
    if (isWeekday && startInMinutes > lateThresholdWeekday) {
      insights.push({
        icon: Clock,
        message: `Started at ${format(startDate, 'h:mm a')}`,
        tip: "Starting before 1pm often means more doors and more opportunities",
      });
    } else if (isSaturday && startInMinutes > lateThresholdSaturday) {
      insights.push({
        icon: Clock,
        message: `Started at ${format(startDate, 'h:mm a')}`,
        tip: "Saturday mornings before 10am tend to have great catch rates",
      });
    }
  }

  // Early End Insight - encouraging tone
  if (endDate) {
    const endHour = endDate.getHours();
    const endMinute = endDate.getMinutes();
    const endInMinutes = endHour * 60 + endMinute;
    
    const earlyThreshold = 1140; // 7:00 PM
    const isWorkday = currentDayOfWeek >= 1 && currentDayOfWeek <= 6;
    
    if (isWorkday && endInMinutes < earlyThreshold && endInMinutes > 600) {
      const earlyBy = earlyThreshold - endInMinutes;
      if (earlyBy > 45) { // Only flag if significantly early
        insights.push({
          icon: TrendingUp,
          message: `Wrapped up at ${format(endDate, 'h:mm a')}`,
          tip: "The 6-8pm window is often when people are home from work",
        });
      }
    }
  }

  // Break time insight - only if substantial
  if (breakMinutes >= 45) {
    insights.push({
      icon: Lightbulb,
      message: `${Math.round(breakMinutes)} min of break time`,
      tip: "Shorter, strategic breaks can help maintain momentum",
    });
  }

  // Don't render if no insights
  if (insights.length === 0) {
    return null;
  }

  return (
    <motion.div
      className={cn(
        "p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-2",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2 text-primary">
        <Lightbulb className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">
          Tips for Tomorrow
        </span>
      </div>
      
      <div className="space-y-2">
        {insights.map((insight, idx) => {
          const Icon = insight.icon;
          
          return (
            <motion.div
              key={idx}
              className="flex items-start gap-2 text-sm"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: 0.05 * idx }}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-primary/70" />
              <div>
                <span className="text-foreground/80">{insight.message}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{insight.tip}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};
