import { motion } from "framer-motion";
import { Lightbulb, Clock, Timer, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseISO, format, differenceInMinutes } from "date-fns";
import { detectBulkEntry } from "@/utils/bulkEntryDetector";

interface CoachingCardProps {
  workStartTime?: string | null;
  workEndTime?: string | null;
  breakPeriods?: Array<{ start: string; end: string }> | null;
  counterTimestamps?: Record<string, string[]>;
  dayOfWeek?: number;
  className?: string;
}

const formatNaturalDuration = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  return `${hours}h ${mins}m`;
};

export const CoachingCard = ({
  workStartTime,
  workEndTime,
  breakPeriods,
  counterTimestamps = {},
  dayOfWeek = new Date().getDay(),
  className,
}: CoachingCardProps) => {
  const tips: Array<{ icon: React.ReactNode; text: string; type: 'tip' | 'warning' }> = [];

  // Check for bulk entry
  const bulkStats = detectBulkEntry(counterTimestamps);
  if (bulkStats.bulkEntryDetected) {
    tips.push({
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      text: `Real-time logging = better coaching insights! ${bulkStats.batchedEventsPercent}% of your counts were logged in bursts.`,
      type: 'warning',
    });
  }

  // Analyze start time
  if (workStartTime) {
    const startTime = parseISO(workStartTime);
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    
    // Weekend (Sat) - ideal start is before 10 AM
    if (dayOfWeek === 6 && startHour >= 10) {
      tips.push({
        icon: <Clock className="w-4 h-4 text-primary" />,
        text: `Tomorrow try starting before 10 AM! You started at ${format(startTime, 'h:mm a')} today.`,
        type: 'tip',
      });
    }
    // Weekday - ideal start is before 1 PM
    else if (dayOfWeek >= 1 && dayOfWeek <= 5 && startHour >= 13) {
      tips.push({
        icon: <Clock className="w-4 h-4 text-primary" />,
        text: `Get out earlier tomorrow! Starting before 1 PM = more doors = more money 💰`,
        type: 'tip',
      });
    }
  }

  // Analyze end time
  if (workEndTime) {
    const endTime = parseISO(workEndTime);
    const endHour = endTime.getHours();
    
    // Ending before 7 PM is early
    if (endHour < 19) {
      tips.push({
        icon: <Timer className="w-4 h-4 text-primary" />,
        text: `The last hour is the magic hour! Try pushing to 8 PM tomorrow - that's when decision makers are home.`,
        type: 'tip',
      });
    }
  }

  // Analyze breaks
  if (breakPeriods && breakPeriods.length > 0) {
    let totalBreakMinutes = 0;
    breakPeriods.forEach(bp => {
      if (bp.start && bp.end) {
        const bStart = parseISO(bp.start);
        const bEnd = parseISO(bp.end);
        totalBreakMinutes += differenceInMinutes(bEnd, bStart);
      }
    });
    
    if (totalBreakMinutes > 45) {
      tips.push({
        icon: <Timer className="w-4 h-4 text-primary" />,
        text: `${formatNaturalDuration(totalBreakMinutes)} in breaks today. Every 30 mins knocking = ~$50 in your pocket!`,
        type: 'tip',
      });
    }
  }

  // If no issues found, show encouragement
  if (tips.length === 0) {
    tips.push({
      icon: <Lightbulb className="w-4 h-4 text-green-500" />,
      text: "Great work today! Keep up the momentum tomorrow 🔥",
      type: 'tip',
    });
  }

  return (
    <motion.div
      className={cn(
        "p-4 rounded-xl border bg-muted/30 border-border/30",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-primary" />
        <span className="font-semibold text-foreground">Tips for Tomorrow</span>
      </div>

      <div className="space-y-3">
        {tips.map((tip, idx) => (
          <div key={idx} className="flex items-start gap-2">
            {tip.icon}
            <p className="text-sm text-muted-foreground flex-1">{tip.text}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
