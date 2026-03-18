import { motion } from "framer-motion";
import { AlertTriangle, Clock, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseISO } from "date-fns";
import { getTimeInTimezone, formatTimeInTz } from "@/utils/timezoneUtils";

interface EffortIssue {
  type: 'late_start' | 'early_end' | 'excessive_break';
  icon: typeof Clock | typeof Coffee | typeof AlertTriangle;
  message: string;
  severity: 'warning' | 'critical';
}

interface EffortCoachingCalloutsProps {
  workStartTime?: string | null;
  workEndTime?: string | null;
  breakMinutes?: number;
  totalBreakMinutes?: number;
  dayOfWeek?: number;
  repAverageStartMinutes?: number;
  repAverageEndMinutes?: number;
  className?: string;
  timezone?: string | null;
}

// Format minutes into natural language (e.g., "2 hours" instead of "120 min")
const formatDurationNatural = (minutes: number): string => {
  const rounded = Math.round(minutes);
  if (rounded < 60) {
    return `${rounded} min`;
  }
  const hours = Math.floor(rounded / 60);
  const remainingMins = rounded % 60;
  
  if (remainingMins === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  if (remainingMins <= 10) {
    // Round to nearest hour if close
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  if (remainingMins >= 50) {
    // Round up
    const roundedHours = hours + 1;
    return roundedHours === 1 ? '1 hour' : `${roundedHours} hours`;
  }
  // Show hours and minutes for in-between values
  if (hours === 0) {
    return `${remainingMins} min`;
  }
  return `${hours}h ${remainingMins}m`;
};

export const EffortCoachingCallouts = ({
  workStartTime,
  workEndTime,
  breakMinutes = 0,
  totalBreakMinutes,
  dayOfWeek,
  repAverageStartMinutes,
  repAverageEndMinutes,
  className,
  timezone,
}: EffortCoachingCalloutsProps) => {
  const issues: EffortIssue[] = [];

  // Parse times if available
  const startDate = workStartTime ? parseISO(workStartTime) : null;
  const endDate = workEndTime ? parseISO(workEndTime) : null;
  
  // Determine what day it is (0 = Sunday, 6 = Saturday)
  const currentDayOfWeek = dayOfWeek ?? (startDate ? startDate.getDay() : new Date().getDay());
  const isSaturday = currentDayOfWeek === 6;
  const isWeekday = currentDayOfWeek >= 1 && currentDayOfWeek <= 5;

  // Late Start Logic
  if (startDate) {
    const startTime = getTimeInTimezone(workStartTime!, timezone);
    if (startTime) {
      const startInMinutes = startTime.hours * 60 + startTime.minutes;
      const timeLabel = formatTimeInTz(workStartTime!, timezone) || 'Unknown';
      
      const lateThresholdWeekday = 780;
      const lateThresholdSaturday = 600;
      
      let isLate = false;
      let lateReason = '';
      
      if (isWeekday && startInMinutes > lateThresholdWeekday) {
        isLate = true;
        const lateBy = startInMinutes - lateThresholdWeekday;
        lateReason = `Started at ${timeLabel} (${formatDurationNatural(lateBy)} after 1pm)`;
      } else if (isSaturday && startInMinutes > lateThresholdSaturday) {
        isLate = true;
        const lateBy = startInMinutes - lateThresholdSaturday;
        lateReason = `Started at ${timeLabel} (${formatDurationNatural(lateBy)} after 10am)`;
      } else if (repAverageStartMinutes !== undefined && startInMinutes > repAverageStartMinutes + 30) {
        isLate = true;
        const lateBy = startInMinutes - repAverageStartMinutes;
        lateReason = `Started at ${timeLabel} (${formatDurationNatural(lateBy)} later than usual)`;
      }
    
      if (isLate) {
        issues.push({
          type: 'late_start',
          icon: Clock,
          message: lateReason,
          severity: 'warning',
        });
      }
    }
  }

  // Early End Logic
  if (endDate) {
    const endTime = getTimeInTimezone(workEndTime!, timezone);
    if (endTime) {
      const endInMinutes = endTime.hours * 60 + endTime.minutes;
      const timeLabel = formatTimeInTz(workEndTime!, timezone) || 'Unknown';
      
      const earlyThreshold = 1140;
      
      let isEarly = false;
      let earlyReason = '';
      
      const isWorkday = currentDayOfWeek >= 1 && currentDayOfWeek <= 6;
      
      if (isWorkday && endInMinutes < earlyThreshold && endInMinutes > 600) {
        const earlyBy = earlyThreshold - endInMinutes;
        if (earlyBy > 30) {
          isEarly = true;
          earlyReason = `Ended at ${timeLabel} (${formatDurationNatural(earlyBy)} before 7pm)`;
        }
      }
      
      if (!isEarly && repAverageEndMinutes !== undefined && endInMinutes < repAverageEndMinutes - 30) {
        const earlyBy = repAverageEndMinutes - endInMinutes;
        isEarly = true;
        earlyReason = `Ended at ${timeLabel} (${formatDurationNatural(earlyBy)} earlier than usual)`;
      }
    
      if (isEarly) {
        issues.push({
          type: 'early_end',
          icon: Clock,
          message: earlyReason,
          severity: 'warning',
        });
      }
    }
  }

  // Excessive Break Time Logic (breaks from break_periods > 30 minutes)
  const actualBreakMinutes = totalBreakMinutes ?? breakMinutes ?? 0;
  
  if (actualBreakMinutes >= 30) {
    issues.push({
      type: 'excessive_break',
      icon: Coffee,
      message: `${formatDurationNatural(actualBreakMinutes)} of break time`,
      severity: actualBreakMinutes > 60 ? 'critical' : 'warning',
    });
  }

  // Note: Gap/idle time is shown in the Activity Ring legend instead
  // The old gapMinutes calculation was inaccurate - it counted ALL gaps > 20 min
  // which double-counted doorstep conversations, presentations, and sales time

  // Don't render if no issues
  if (issues.length === 0) {
    return null;
  }

  return (
    <motion.div
      className={cn(
        "p-3 rounded-xl bg-destructive/5 border border-destructive/20 space-y-2",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">
          Effort Concerns
        </span>
      </div>
      
      <div className="space-y-1.5">
        {issues.map((issue, idx) => {
          const Icon = issue.icon;
          
          return (
            <motion.div
              key={idx}
              className={cn(
                "flex items-center gap-2 text-sm",
                issue.severity === 'critical' 
                  ? "text-destructive font-medium" 
                  : "text-destructive/80"
              )}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: 0.05 * idx }}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{issue.message}</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};
