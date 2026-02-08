import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Calendar, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeVsMe } from "@/hooks/useMeVsMe";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";

interface MeVsMeCardProps {
  currentFP: number;
  currentDoors: number;
  entryDate?: string;
  className?: string;
}

export const MeVsMeCard = ({
  currentFP,
  currentDoors,
  entryDate,
  className,
}: MeVsMeCardProps) => {
  const { isEnabled, dataSummary } = useMeVsMe();

  // Fetch historical comparison data
  const { data: comparison } = useQuery({
    queryKey: ['historical-comparison', entryDate],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const today = entryDate ? parseISO(entryDate) : new Date();
      const dayOfWeek = today.getDay();
      
      // Get same day of week from last year
      const lastYearDate = new Date(today);
      lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
      const lastYearDateStr = format(lastYearDate, 'yyyy-MM-dd');

      // Get week-to-date stats for this year and last year
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
      
      // Last year same week
      const lastYearWeekStart = new Date(weekStart);
      lastYearWeekStart.setFullYear(lastYearWeekStart.getFullYear() - 1);
      const lastYearWeekEnd = new Date(weekEnd);
      lastYearWeekEnd.setFullYear(lastYearWeekEnd.getFullYear() - 1);

      // Query historical entries
      const { data: sameDay } = await supabase
        .from('historical_entries')
        .select('fp_plus, doors_knocked')
        .eq('user_id', user.id)
        .eq('original_date', lastYearDateStr)
        .maybeSingle();

      const { data: lastYearWeek } = await supabase
        .from('historical_entries')
        .select('fp_plus, doors_knocked')
        .eq('user_id', user.id)
        .gte('original_date', format(lastYearWeekStart, 'yyyy-MM-dd'))
        .lte('original_date', format(lastYearWeekEnd, 'yyyy-MM-dd'));

      // Get current year week-to-date from daily_entries
      const { data: thisYearWeek } = await supabase
        .from('daily_entries')
        .select('fp_plus, doors_knocked, sales_log')
        .eq('user_id', user.id)
        .gte('entry_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('entry_date', format(weekEnd, 'yyyy-MM-dd'));

      // Calculate week totals
      const lastYearWeekFP = lastYearWeek?.reduce((sum, e) => sum + (e.fp_plus || 0), 0) || 0;
      const thisYearWeekFP = thisYearWeek?.reduce((sum, e) => sum + (e.fp_plus || 0), 0) || 0;

      return {
        sameDayLastYear: sameDay ? {
          fp: sameDay.fp_plus || 0,
          doors: sameDay.doors_knocked || 0,
        } : null,
        weekToDate: {
          lastYear: lastYearWeekFP,
          thisYear: thisYearWeekFP,
          diff: thisYearWeekFP - lastYearWeekFP,
        },
      };
    },
    enabled: isEnabled && !!dataSummary,
    staleTime: 5 * 60 * 1000,
  });

  if (!isEnabled || !dataSummary || !comparison) return null;

  const hasComparison = comparison.sameDayLastYear || comparison.weekToDate.lastYear > 0;
  if (!hasComparison) return null;

  const weekDiff = comparison.weekToDate.diff;
  const isAhead = weekDiff > 0;
  const isBehind = weekDiff < 0;

  return (
    <motion.div
      className={cn(
        "p-4 rounded-xl border bg-muted/30 border-border/30",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-primary" />
        <span className="font-semibold text-foreground">Me vs. Me</span>
      </div>

      <div className="space-y-3">
        {/* Week to date comparison */}
        {comparison.weekToDate.lastYear > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">This week vs. last year</span>
            <div className={cn(
              "flex items-center gap-1 text-sm font-semibold",
              isAhead ? "text-green-500" : isBehind ? "text-red-500" : "text-muted-foreground"
            )}>
              {isAhead ? (
                <TrendingUp className="w-4 h-4" />
              ) : isBehind ? (
                <TrendingDown className="w-4 h-4" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
              <span>
                {isAhead ? '+' : ''}{weekDiff.toFixed(1)} FP
              </span>
            </div>
          </div>
        )}

        {/* Same day last year */}
        {comparison.sameDayLastYear && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Same day last year</span>
            <div className="text-sm font-medium tabular-nums">
              {comparison.sameDayLastYear.fp.toFixed(1)} FP • {comparison.sameDayLastYear.doors} doors
            </div>
          </div>
        )}

        {/* Encouragement message */}
        <div className="pt-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground italic">
            {isAhead 
              ? "You're beating your 2025 self! Keep the momentum 💪"
              : isBehind
              ? "Time to step it up! You've got this 🔥"
              : "On pace with last year - let's make this year better!"}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
