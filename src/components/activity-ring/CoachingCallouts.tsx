import { motion } from "framer-motion";
import { AlertTriangle, Clock, TrendingDown, Target, Lightbulb, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoachingInsight {
  type: 'warning' | 'info' | 'success';
  icon: 'time' | 'doors' | 'funnel' | 'tip' | 'break' | 'general';
  message: string;
  priority: number;
}

interface CoachingCalloutsProps {
  doors: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  hoursWorked: number;
  workStartTime?: string | null;
  workEndTime?: string | null;
  breakMinutes?: number;
  gapMinutes?: number;
  isRookie?: boolean;
  doorsPerHourTarget?: number;
  className?: string;
}

const generateInsights = (props: CoachingCalloutsProps): CoachingInsight[] => {
  const {
    doors,
    pitches,
    transitions,
    presentations,
    closes,
    hoursWorked,
    workStartTime,
    workEndTime,
    breakMinutes = 0,
    gapMinutes = 0,
    isRookie = false,
    doorsPerHourTarget = isRookie ? 12 : 15,
  } = props;

  const insights: CoachingInsight[] = [];
  
  // Time-based insights
  if (workStartTime) {
    const startHour = new Date(workStartTime).getHours();
    const startMinute = new Date(workStartTime).getMinutes();
    const startInMinutes = startHour * 60 + startMinute;
    
    // Late start check (after 10:30 AM = 630 minutes)
    if (startInMinutes > 630) {
      const lateBy = startInMinutes - 630;
      insights.push({
        type: 'warning',
        icon: 'time',
        message: `Late start: ${new Date(workStartTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (${Math.round(lateBy)} min behind schedule)`,
        priority: 1,
      });
    }
  }
  
  if (workEndTime) {
    const endHour = new Date(workEndTime).getHours();
    const endMinute = new Date(workEndTime).getMinutes();
    const endInMinutes = endHour * 60 + endMinute;
    
    // Early end check (before 7:00 PM = 1140 minutes)
    if (endInMinutes < 1140 && endInMinutes > 600) { // Only if they worked during day hours
      const earlyBy = 1140 - endInMinutes;
      if (earlyBy > 30) { // Only flag if more than 30 min early
        insights.push({
          type: 'warning',
          icon: 'time',
          message: `Ended early: ${new Date(workEndTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (${Math.round(earlyBy)} min before target)`,
          priority: 2,
        });
      }
    }
  }
  
  // Gap/break time insights
  if (gapMinutes > 20 && hoursWorked > 0) {
    const gapPercent = Math.round((gapMinutes / (hoursWorked * 60)) * 100);
    if (gapPercent > 10) {
      insights.push({
        type: 'warning',
        icon: 'break',
        message: `${gapMinutes} min gap time (${gapPercent}% of shift)`,
        priority: 3,
      });
    }
  }
  
  // Doors per hour insight
  if (hoursWorked > 0.5) {
    const doorsPerHour = doors / hoursWorked;
    
    if (doorsPerHour < doorsPerHourTarget * 0.6) {
      insights.push({
        type: 'warning',
        icon: 'doors',
        message: `${doorsPerHour.toFixed(1)} doors/hr (target: ${doorsPerHourTarget})`,
        priority: 4,
      });
    } else if (doorsPerHour >= doorsPerHourTarget) {
      insights.push({
        type: 'success',
        icon: 'doors',
        message: `Great pace: ${doorsPerHour.toFixed(1)} doors/hr`,
        priority: 10,
      });
    }
  }
  
  // Funnel conversion insights
  if (pitches > 2 && transitions === 0) {
    insights.push({
      type: 'warning',
      icon: 'funnel',
      message: `${pitches} pitches but no transitions - work on creating curiosity`,
      priority: 5,
    });
  }
  
  if (transitions > 0 && presentations === 0) {
    insights.push({
      type: 'info',
      icon: 'funnel',
      message: `${transitions} transitions but no presentations - focus on getting inside`,
      priority: 6,
    });
  }
  
  if (presentations > 0 && closes === 0) {
    insights.push({
      type: 'info',
      icon: 'funnel',
      message: `${presentations} presentations, no closes - review closing techniques`,
      priority: 7,
    });
  }
  
  // Positive reinforcement
  if (closes > 0) {
    insights.push({
      type: 'success',
      icon: 'tip',
      message: closes === 1 
        ? 'Nice! Got a sale today 🎉'
        : `Crushing it! ${closes} sales today 🔥`,
      priority: 9,
    });
  }
  
  // Sort by priority and limit
  return insights
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);
};

const IconMap = {
  time: Clock,
  doors: TrendingDown,
  funnel: Target,
  tip: Lightbulb,
  break: Coffee,
  general: AlertTriangle,
};

export const CoachingCallouts = (props: CoachingCalloutsProps) => {
  const { className, ...insightProps } = props;
  const insights = generateInsights(insightProps);
  
  if (insights.length === 0) {
    return null;
  }
  
  return (
    <motion.div
      className={cn(
        "mx-4 p-4 rounded-xl bg-muted/30 border border-border/30 space-y-3",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <div className="flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-primary" />
        <h4 className="font-semibold text-sm">Coaching Insights</h4>
      </div>
      
      <div className="space-y-2">
        {insights.map((insight, idx) => {
          const Icon = IconMap[insight.icon];
          
          return (
            <motion.div
              key={idx}
            className={cn(
              "flex items-start gap-2 text-sm p-2 rounded-lg",
              insight.type === 'warning' && "bg-destructive/10 text-destructive",
              insight.type === 'info' && "bg-primary/10 text-primary",
              insight.type === 'success' && "bg-accent/50 text-accent-foreground"
              )}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 * idx }}
            >
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{insight.message}</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};
