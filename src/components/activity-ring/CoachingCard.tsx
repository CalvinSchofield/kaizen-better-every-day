import { motion } from "framer-motion";
import { Lightbulb, Clock, Timer, AlertTriangle, TrendingUp, Target, Zap } from "lucide-react";
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
  doors?: number;
  pitches?: number;
  transitions?: number;
  presentations?: number;
  closes?: number;
  salesLog?: any[];
  fp?: number;
  prmr?: number;
}

const formatNaturalDuration = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  return `${hours}h ${mins}m`;
};

const SEASON_START = '2025-09-28';

interface Tip {
  icon: React.ReactNode;
  text: string;
  type: 'tip' | 'warning';
  priority: number; // lower = higher priority
}

export const CoachingCard = ({
  workStartTime,
  workEndTime,
  breakPeriods,
  counterTimestamps = {},
  dayOfWeek = new Date().getDay(),
  className,
  doors = 0,
  pitches = 0,
  transitions = 0,
  presentations = 0,
  closes = 0,
  salesLog = [],
  fp = 0,
  prmr = 0,
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

  // Fetch late-hour performance data
  const { data: lateHourData } = useQuery({
    queryKey: ['late-hour-perf', userId],
    queryFn: async () => {
      if (!userId) return null;
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

      return {
        lateAvgFP: Math.round((lateDaysFP / lateDaysCount) * 10) / 10,
        earlyAvgFP: Math.round((earlyDaysFP / earlyDaysCount) * 10) / 10,
        fpLift: Math.round(((lateDaysFP / lateDaysCount) - (earlyDaysFP / earlyDaysCount)) * 10) / 10,
        presLift: Math.round((lateDaysPres / lateDaysCount) - (earlyDaysPres / earlyDaysCount)),
        lateDaysCount,
        earlyDaysCount,
      };
    },
    enabled: !!userId,
    staleTime: 30 * 60 * 1000,
  });

  // Fetch season funnel averages for comparison tips
  const { data: seasonAverages } = useQuery({
    queryKey: ['season-funnel-averages', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data: entries } = await supabase
        .from('daily_entries')
        .select('doors_knocked, decision_makers, pitches, transitions, presentations, closes, fp_plus, prmr, sales_log, work_start_time, work_end_time, break_periods')
        .eq('user_id', userId)
        .gte('entry_date', SEASON_START)
        .eq('is_finalized', true);

      if (!entries || entries.length < 3) return null;

      let totalDoors = 0, totalDMs = 0, totalPitches = 0, totalTransitions = 0;
      let totalPres = 0, totalCloses = 0, totalSales = 0, totalSalePRMR = 0;
      let totalWorkMinutes = 0;
      const daysCount = entries.length;

      for (const e of entries) {
        totalDoors += e.doors_knocked || 0;
        totalDMs += e.decision_makers || 0;
        totalPitches += e.pitches || 0;
        totalTransitions += e.transitions || 0;
        totalPres += e.presentations || 0;
        totalCloses += e.closes || 0;

        const log = e.sales_log as any[] | null;
        if (log && Array.isArray(log)) {
          for (const s of log) {
            if (s.install_status !== 'never_installed' && s.install_status !== 'pending') {
              totalSales++;
              totalSalePRMR += Number(s.prmr) || 0;
            }
          }
        }

        if (e.work_start_time && e.work_end_time) {
          try {
            let mins = differenceInMinutes(parseISO(e.work_end_time), parseISO(e.work_start_time));
            const breaks = e.break_periods as Array<{ start: string; end: string }> | null;
            if (breaks && Array.isArray(breaks)) {
              for (const bp of breaks) {
                if (bp.start && bp.end) mins -= differenceInMinutes(parseISO(bp.end), parseISO(bp.start));
              }
            }
            if (mins > 0) totalWorkMinutes += mins;
          } catch { /* skip */ }
        }
      }

      return {
        avgDoors: totalDoors / daysCount,
        avgDMs: totalDMs / daysCount,
        avgPitches: totalPitches / daysCount,
        avgTransitions: totalTransitions / daysCount,
        avgPres: totalPres / daysCount,
        avgCloses: totalCloses / daysCount,
        pitchToTransition: totalPitches > 0 ? (totalTransitions / totalPitches) * 100 : 0,
        presToClose: totalPres > 0 ? (totalCloses / totalPres) * 100 : 0,
        dmToDoor: totalDoors > 0 ? (totalDMs / totalDoors) * 100 : 0,
        avgDoorsPerHour: totalWorkMinutes > 0 ? (totalDoors / (totalWorkMinutes / 60)) : 0,
        avgPrmrPerSale: totalSales > 0 ? totalSalePRMR / totalSales : 85,
        totalSales,
        daysCount,
      };
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch best sales hour from historical sales_log timestamps
  const { data: bestSalesHour } = useQuery({
    queryKey: ['best-sales-hour', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data: entries } = await supabase
        .from('daily_entries')
        .select('sales_log')
        .eq('user_id', userId)
        .gte('entry_date', SEASON_START)
        .eq('is_finalized', true);

      if (!entries) return null;

      const hourCounts: Record<number, number> = {};
      for (const e of entries) {
        const log = e.sales_log as any[] | null;
        if (!log || !Array.isArray(log)) continue;
        for (const s of log) {
          if (s.install_status === 'never_installed' || s.install_status === 'pending') continue;
          const ts = s.created_at || s.timestamp;
          if (!ts) continue;
          try {
            const hour = parseISO(ts).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          } catch { /* skip */ }
        }
      }

      const hours = Object.entries(hourCounts);
      if (hours.length < 2) return null;

      hours.sort((a, b) => Number(b[1]) - Number(a[1]));
      const peakHour = Number(hours[0][0]);
      const totalSales = hours.reduce((sum, [, c]) => sum + Number(c), 0);
      const peakCount = Number(hours[0][1]);

      return { peakHour, peakCount, totalSales };
    },
    enabled: !!userId,
    staleTime: 30 * 60 * 1000,
  });

  // Calculate actual hourly earnings
  const fpForTier = goals?.custom_payscale_fp || totalFP;
  const tier = getTier(fpForTier);

  const hourlyEarnings = (() => {
    if (!seasonHours || seasonHours.totalMinutes <= 0 || totalPRMR <= 0) return null;
    const totalEarnings = totalPRMR * tier.rate;
    const hoursWorked = seasonHours.totalMinutes / 60;
    return Math.round(totalEarnings / hoursWorked);
  })();

  // Calculate today's hours worked
  const todayHoursWorked = (() => {
    if (!workStartTime || !workEndTime) return 0;
    try {
      let mins = differenceInMinutes(parseISO(workEndTime), parseISO(workStartTime));
      if (breakPeriods) {
        for (const bp of breakPeriods) {
          if (bp.start && bp.end) mins -= differenceInMinutes(parseISO(bp.end), parseISO(bp.start));
        }
      }
      return mins > 0 ? mins / 60 : 0;
    } catch { return 0; }
  })();

  const tips: Tip[] = [];

  // --- BULK ENTRY WARNING ---
  const bulkStats = detectBulkEntry(counterTimestamps);
  if (bulkStats.bulkEntryDetected) {
    tips.push({
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      text: `Real-time logging = better coaching insights! ${bulkStats.batchedEventsPercent}% of your counts were logged in bursts.`,
      type: 'warning',
      priority: 0,
    });
  }

  // --- START TIME TIP ---
  if (workStartTime) {
    const startTime = parseISO(workStartTime);
    const startHour = startTime.getHours();
    if (dayOfWeek === 6 && startHour >= 10) {
      tips.push({
        icon: <Clock className="w-4 h-4 text-primary" />,
        text: `Tomorrow try starting before 10 AM! You started at ${format(startTime, 'h:mm a')} today.`,
        type: 'tip',
        priority: 5,
      });
    } else if (dayOfWeek >= 1 && dayOfWeek <= 5 && startHour >= 13) {
      tips.push({
        icon: <Clock className="w-4 h-4 text-primary" />,
        text: `Get out earlier tomorrow! Starting before 1 PM = more doors = more money 💰`,
        type: 'tip',
        priority: 5,
      });
    }
  }

  // --- END TIME TIP (always encourage working late) ---
  if (workEndTime) {
    const endTime = parseISO(workEndTime);
    const endHour = endTime.getHours();
    if (endHour < 19) {
      if (lateHourData && lateHourData.fpLift > 0) {
        tips.push({
          icon: <Timer className="w-4 h-4 text-primary" />,
          text: `When you work past 7 PM, you average ${lateHourData.lateAvgFP} FP+ vs ${lateHourData.earlyAvgFP} on early days — that's +${lateHourData.fpLift} FP+! Push through tomorrow 💪`,
          type: 'tip',
          priority: 3,
        });
      } else if (lateHourData && lateHourData.presLift > 0) {
        tips.push({
          icon: <Timer className="w-4 h-4 text-primary" />,
          text: `You get ~${lateHourData.presLift} more presentations on days you work past 7 PM. More at-bats = more opportunities!`,
          type: 'tip',
          priority: 3,
        });
      } else {
        // Always encourage working late — just don't claim false stats
        tips.push({
          icon: <Timer className="w-4 h-4 text-primary" />,
          text: `You ended at ${format(endTime, 'h:mm a')} — the best reps push until the sun goes down. More time on doors = more chances 💪`,
          type: 'tip',
          priority: 4,
        });
      }
    }
  }

  // --- BREAK TIP (with earnings threshold fix) ---
  if (breakPeriods && breakPeriods.length > 0) {
    let totalBreakMinutes = 0;
    breakPeriods.forEach(bp => {
      if (bp.start && bp.end) {
        totalBreakMinutes += differenceInMinutes(parseISO(bp.end), parseISO(bp.start));
      }
    });
    if (totalBreakMinutes > 45) {
      if (hourlyEarnings && hourlyEarnings >= 25) {
        const per30 = Math.round(hourlyEarnings / 2);
        tips.push({
          icon: <Timer className="w-4 h-4 text-primary" />,
          text: `${formatNaturalDuration(totalBreakMinutes)} in breaks today. Based on your season, every 30 mins knocking = ~$${per30} earned!`,
          type: 'tip',
          priority: 6,
        });
      } else {
        // Low hourly rate — frame as "one sale could earn you $X"
        const avgPrmr = seasonAverages?.avgPrmrPerSale || 85;
        const potentialSaleValue = Math.round(avgPrmr * tier.rate);
        tips.push({
          icon: <Timer className="w-4 h-4 text-primary" />,
          text: `${formatNaturalDuration(totalBreakMinutes)} in breaks today. One sale could earn you ~$${potentialSaleValue} — that's worth an extra 30 mins knocking!`,
          type: 'tip',
          priority: 6,
        });
      }
    }
  }

  // --- FUNNEL BOTTLENECK: Pitch → Transition ---
  if (seasonAverages && pitches >= 3 && transitions === 0 && seasonAverages.pitchToTransition > 10) {
    tips.push({
      icon: <Target className="w-4 h-4 text-primary" />,
      text: `You pitched ${pitches} times but got 0 transitions — your season avg is ${Math.round(seasonAverages.pitchToTransition)}%. Focus on building curiosity tomorrow.`,
      type: 'tip',
      priority: 2,
    });
  }

  // --- FUNNEL BOTTLENECK: Presentation → Close ---
  if (seasonAverages && presentations >= 2 && closes === 0 && seasonAverages.presToClose > 10) {
    tips.push({
      icon: <Target className="w-4 h-4 text-primary" />,
      text: `${presentations} presentations, 0 closes — your season close rate is ${Math.round(seasonAverages.presToClose)}%. Review your closing approach.`,
      type: 'tip',
      priority: 2,
    });
  }

  // --- DOORS-PER-HOUR PACE ---
  if (seasonAverages && doors >= 10 && todayHoursWorked >= 1 && seasonAverages.avgDoorsPerHour > 0) {
    const todayPace = Math.round(doors / todayHoursWorked);
    const seasonPace = Math.round(seasonAverages.avgDoorsPerHour);
    if (todayPace < seasonPace * 0.8) {
      tips.push({
        icon: <Zap className="w-4 h-4 text-primary" />,
        text: `You averaged ${todayPace} doors/hr today vs your season avg of ${seasonPace}. Picking up the pace = more at-bats!`,
        type: 'tip',
        priority: 7,
      });
    } else if (todayPace > seasonPace * 1.15) {
      tips.push({
        icon: <Zap className="w-4 h-4 text-green-500" />,
        text: `Great pace today! ${todayPace} doors/hr, above your ${seasonPace} season avg 🔥`,
        type: 'tip',
        priority: 8,
      });
    }
  }

  // --- BEST SALES HOUR ---
  if (bestSalesHour && bestSalesHour.totalSales >= 5) {
    const h = bestSalesHour.peakHour;
    const pct = Math.round((bestSalesHour.peakCount / bestSalesHour.totalSales) * 100);
    const timeLabel = h >= 12 ? `${h === 12 ? 12 : h - 12}-${h === 12 ? 1 : h - 11} PM` : `${h}-${h + 1} AM`;
    tips.push({
      icon: <TrendingUp className="w-4 h-4 text-primary" />,
      text: `${pct}% of your sales happen around ${timeLabel}. Make sure you're in your rhythm by then tomorrow!`,
      type: 'tip',
      priority: 9,
    });
  }

  // --- AVG PRMR PER SALE ---
  if (seasonAverages && salesLog.length > 0 && seasonAverages.totalSales >= 3) {
    const validSales = salesLog.filter(s => s.install_status !== 'never_installed' && s.install_status !== 'pending');
    if (validSales.length > 0) {
      const todayAvgPrmr = validSales.reduce((sum: number, s: any) => sum + (Number(s.prmr) || 0), 0) / validSales.length;
      const diff = todayAvgPrmr - seasonAverages.avgPrmrPerSale;
      if (diff > 15) {
        tips.push({
          icon: <TrendingUp className="w-4 h-4 text-green-500" />,
          text: `Your avg deal today was $${Math.round(todayAvgPrmr)} PRMR vs your season avg of $${Math.round(seasonAverages.avgPrmrPerSale)}. Nice upselling! 🎯`,
          type: 'tip',
          priority: 8,
        });
      } else if (diff < -15) {
        tips.push({
          icon: <Target className="w-4 h-4 text-primary" />,
          text: `Your avg deal today was $${Math.round(todayAvgPrmr)} PRMR (season avg: $${Math.round(seasonAverages.avgPrmrPerSale)}). Focus on bigger packages tomorrow.`,
          type: 'tip',
          priority: 7,
        });
      }
    }
  }

  // --- DECISION MAKER RATIO ---
  if (seasonAverages && doors >= 15 && seasonAverages.dmToDoor > 0) {
    const todayDMRate = doors > 0 ? ((pitches > 0 ? pitches : 0) / doors) * 100 : 0; // use DMs if available
    const todayActualDMRate = doors > 0 ? (Math.max(pitches, 0) / doors) * 100 : 0;
    // Only show if we have DM data from the entry
    const entryDMs = counterTimestamps?.decision_makers?.length || 0;
    if (entryDMs > 0 && doors > 0) {
      const dmRate = (entryDMs / doors) * 100;
      if (dmRate < seasonAverages.dmToDoor * 0.7 && seasonAverages.dmToDoor > 15) {
        tips.push({
          icon: <Target className="w-4 h-4 text-primary" />,
          text: `Only ${Math.round(dmRate)}% DM rate today (season avg: ${Math.round(seasonAverages.dmToDoor)}%). Try to qualify better and spend time with the right people.`,
          type: 'tip',
          priority: 6,
        });
      }
    }
  }

  // Sort by priority and take top 4
  tips.sort((a, b) => a.priority - b.priority);
  const displayTips = tips.slice(0, 4);

  // If no tips, show encouragement
  if (displayTips.length === 0) {
    displayTips.push({
      icon: <Lightbulb className="w-4 h-4 text-green-500" />,
      text: "Great work today! Keep up the momentum tomorrow 🔥",
      type: 'tip',
      priority: 99,
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
        {displayTips.map((tip, idx) => (
          <div key={idx} className="flex items-start gap-2">
            {tip.icon}
            <p className="text-sm text-muted-foreground flex-1">{tip.text}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
