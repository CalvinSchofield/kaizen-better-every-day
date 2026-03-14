import { motion } from "framer-motion";
import { Lightbulb, Clock, Timer, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseISO, format, differenceInMinutes } from "date-fns";
import { detectBulkEntry } from "@/utils/bulkEntryDetector";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useRepGoals } from "@/hooks/useRepGoals";
import { getTier } from "@/utils/payscaleCalculator";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";

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

const SEASON_START = '2025-09-28';

export const CoachingCard = ({
  workStartTime,
  workEndTime,
  breakPeriods,
  counterTimestamps = {},
  dayOfWeek = new Date().getDay(),
  className,
}: CoachingCardProps) => {
  const { totalFP, totalPRMR } = usePreseasonFP();
  const { goals } = useRepGoals();
  const { userId } = useCurrentUserId();

  // Fetch total hours worked this season for hourly earnings calc
  const { data: seasonHours } = useQuery({
    queryKey: ['season-hours-worked', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data: entries } = await supabase
        .from('daily_entries')
        .select('work_start_time, work_end_time, break_periods')
        .eq('user_id', userId)
        .gte('entry_date', SEASON_START)
        .eq('is_finalized', true)
        .not('work_start_time', 'is', null)
        .not('work_end_time', 'is', null);

      if (!entries || entries.length === 0) return { totalMinutes: 0, days: 0 };

      let totalMinutes = 0;
      let days = 0;
      for (const e of entries) {
        if (!e.work_start_time || !e.work_end_time) continue;
        try {
          const start = parseISO(e.work_start_time);
          const end = parseISO(e.work_end_time);
          let workMinutes = differenceInMinutes(end, start);
          
          // Subtract breaks
          const breaks = e.break_periods as Array<{ start: string; end: string }> | null;
          if (breaks && Array.isArray(breaks)) {
            for (const bp of breaks) {
              if (bp.start && bp.end) {
                workMinutes -= differenceInMinutes(parseISO(bp.end), parseISO(bp.start));
              }
            }
          }
          
          if (workMinutes > 0) {
            totalMinutes += workMinutes;
            days++;
          }
        } catch { /* skip invalid */ }
      }
      return { totalMinutes, days };
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch late-hour performance data to validate "push to 8 PM" tip
  const { data: lateHourData } = useQuery({
    queryKey: ['late-hour-perf', userId],
    queryFn: async () => {
      if (!userId) return null;
      // Get entries where user worked past 7 PM vs stopped before 7 PM
      const { data: entries } = await supabase
        .from('daily_entries')
        .select('work_end_time, fp_plus, sales_log, presentations')
        .eq('user_id', userId)
        .gte('entry_date', SEASON_START)
        .eq('is_finalized', true)
        .not('work_end_time', 'is', null);

      if (!entries || entries.length < 5) return null;

      let lateDaysFP = 0, lateDaysCount = 0;
      let earlyDaysFP = 0, earlyDaysCount = 0;
      let lateDaysPres = 0, earlyDaysPres = 0;

      for (const e of entries) {
        if (!e.work_end_time) continue;
        try {
          const endTime = parseISO(e.work_end_time);
          const endHour = endTime.getHours();
          const fp = e.fp_plus || 0;
          const pres = e.presentations || 0;

          if (endHour >= 19) {
            lateDaysFP += fp;
            lateDaysPres += pres;
            lateDaysCount++;
          } else {
            earlyDaysFP += fp;
            earlyDaysPres += pres;
            earlyDaysCount++;
          }
        } catch { /* skip */ }
      }

      if (lateDaysCount === 0 || earlyDaysCount === 0) return null;

      const lateAvgFP = lateDaysFP / lateDaysCount;
      const earlyAvgFP = earlyDaysFP / earlyDaysCount;
      const lateAvgPres = lateDaysPres / lateDaysCount;
      const earlyAvgPres = earlyDaysPres / earlyDaysCount;

      return {
        lateAvgFP: Math.round(lateAvgFP * 10) / 10,
        earlyAvgFP: Math.round(earlyAvgFP * 10) / 10,
        fpLift: Math.round((lateAvgFP - earlyAvgFP) * 10) / 10,
        presLift: Math.round(lateAvgPres - earlyAvgPres),
        lateDaysCount,
        earlyDaysCount,
      };
    },
    enabled: !!userId,
    staleTime: 30 * 60 * 1000,
  });

  // Calculate actual hourly earnings
  const hourlyEarnings = (() => {
    if (!seasonHours || seasonHours.totalMinutes <= 0 || totalPRMR <= 0) return null;
    
    // Use custom payscale FP if set, otherwise use actual total FP
    const fpForTier = goals?.custom_payscale_fp || totalFP;
    const tier = getTier(fpForTier);
    const totalEarnings = totalPRMR * tier.rate;
    const hoursWorked = seasonHours.totalMinutes / 60;
    
    return Math.round(totalEarnings / hoursWorked);
  })();

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

  // Analyze end time — use actual data to back up the claim
  if (workEndTime) {
    const endTime = parseISO(workEndTime);
    const endHour = endTime.getHours();
    
    if (endHour < 19) {
      if (lateHourData && lateHourData.fpLift > 0) {
        // Data backs up the claim — show personalized stat
        tips.push({
          icon: <Timer className="w-4 h-4 text-primary" />,
          text: `When you work past 7 PM, you average ${lateHourData.lateAvgFP} FP+ vs ${lateHourData.earlyAvgFP} on early days — that's +${lateHourData.fpLift} FP+! Push through tomorrow 💪`,
          type: 'tip',
        });
      } else if (lateHourData && lateHourData.fpLift <= 0) {
        // Data doesn't support the "push late" narrative — use presentations instead or skip
        if (lateHourData.presLift > 0) {
          tips.push({
            icon: <Timer className="w-4 h-4 text-primary" />,
            text: `You get ~${lateHourData.presLift} more presentations on days you work past 7 PM. More at-bats = more opportunities!`,
            type: 'tip',
          });
        }
        // If neither metric supports it, don't push the tip — it's not true for this user
      } else {
        // No historical data yet — generic but honest
        tips.push({
          icon: <Timer className="w-4 h-4 text-primary" />,
          text: `You ended at ${format(endTime, 'h:mm a')} — try pushing a bit later tomorrow to catch more decision makers.`,
          type: 'tip',
        });
      }
    }
  }

  // Analyze breaks — use actual hourly earnings
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
      if (hourlyEarnings && hourlyEarnings > 0) {
        const per30 = Math.round(hourlyEarnings / 2);
        tips.push({
          icon: <Timer className="w-4 h-4 text-primary" />,
          text: `${formatNaturalDuration(totalBreakMinutes)} in breaks today. Based on your season, every 30 mins knocking = ~$${per30} earned!`,
          type: 'tip',
        });
      } else {
        tips.push({
          icon: <Timer className="w-4 h-4 text-primary" />,
          text: `${formatNaturalDuration(totalBreakMinutes)} in breaks today. Less break time = more doors = more money!`,
          type: 'tip',
        });
      }
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
