import { motion } from "framer-motion";
import { AlertTriangle, Clock, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseISO, format } from "date-fns";

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
  gapMinutes?: number;
  totalBreakMinutes?: number; // Total break time from break_periods
  dayOfWeek?: number; // 0 = Sunday, 6 = Saturday
  repAverageStartMinutes?: number; // Rep's average start time in minutes from midnight
  repAverageEndMinutes?: number; // Rep's average end time in minutes from midnight
  className?: string;
}

export const EffortCoachingCallouts = ({
  workStartTime,
  workEndTime,
  breakMinutes = 0,
  gapMinutes = 0,
  totalBreakMinutes,
  dayOfWeek,
  repAverageStartMinutes,
  repAverageEndMinutes,
  className,
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
    const startHour = startDate.getHours();
    const startMinute = startDate.getMinutes();
    const startInMinutes = startHour * 60 + startMinute;
    
    // Thresholds: Mon-Fri after 1pm (780 min), Sat after 10am (600 min)
    // OR later than rep's average + 30 mins
    const lateThresholdWeekday = 780; // 1:00 PM
    const lateThresholdSaturday = 600; // 10:00 AM
    
    let isLate = false;
    let lateReason = '';
    
    if (isWeekday && startInMinutes > lateThresholdWeekday) {
      isLate = true;
      const lateBy = startInMinutes - lateThresholdWeekday;
      lateReason = `Started at ${format(startDate, 'h:mm a')} (${Math.round(lateBy)} min after 1pm)`;
    } else if (isSaturday && startInMinutes > lateThresholdSaturday) {
      isLate = true;
      const lateBy = startInMinutes - lateThresholdSaturday;
      lateReason = `Started at ${format(startDate, 'h:mm a')} (${Math.round(lateBy)} min after 10am)`;
    } else if (repAverageStartMinutes !== undefined && startInMinutes > repAverageStartMinutes + 30) {
      isLate = true;
      const lateBy = startInMinutes - repAverageStartMinutes;
      lateReason = `Started at ${format(startDate, 'h:mm a')} (${Math.round(lateBy)} min later than average)`;
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

  // Early End Logic
  if (endDate) {
    const endHour = endDate.getHours();
    const endMinute = endDate.getMinutes();
    const endInMinutes = endHour * 60 + endMinute;
    
    // Threshold: before 7pm (1140 min) Mon-Sat
    // OR 30 min earlier than rep's average
    const earlyThreshold = 1140; // 7:00 PM
    
    let isEarly = false;
    let earlyReason = '';
    
    // Only apply early end check for Mon-Sat, and only if they worked during normal hours
    const isWorkday = currentDayOfWeek >= 1 && currentDayOfWeek <= 6;
    
    if (isWorkday && endInMinutes < earlyThreshold && endInMinutes > 600) {
      const earlyBy = earlyThreshold - endInMinutes;
      if (earlyBy > 30) { // Only flag if more than 30 min early
        isEarly = true;
        earlyReason = `Ended at ${format(endDate, 'h:mm a')} (${Math.round(earlyBy)} min before 7pm)`;
      }
    }
    
    // Also check against rep's average
    if (!isEarly && repAverageEndMinutes !== undefined && endInMinutes < repAverageEndMinutes - 30) {
      const earlyBy = repAverageEndMinutes - endInMinutes;
      isEarly = true;
      earlyReason = `Ended at ${format(endDate, 'h:mm a')} (${Math.round(earlyBy)} min earlier than average)`;
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

  // Excessive Break Time Logic (breaks from break_periods > 30 minutes)
  const actualBreakMinutes = totalBreakMinutes ?? breakMinutes ?? 0;
  
  if (actualBreakMinutes >= 30) {
    issues.push({
      type: 'excessive_break',
      icon: Coffee,
      message: `${Math.round(actualBreakMinutes)} min of break time`,
      severity: actualBreakMinutes > 60 ? 'critical' : 'warning',
    });
  }

  // Excessive Gap/Idle Time Logic (separate from breaks, > 30 minutes)
  // Only add if we have gap data and it's substantial
  if (gapMinutes !== undefined && gapMinutes >= 30) {
    issues.push({
      type: 'excessive_break',
      icon: AlertTriangle,
      message: `${Math.round(gapMinutes)} min of idle gaps during work`,
      severity: gapMinutes > 60 ? 'critical' : 'warning',
    });
  }

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
