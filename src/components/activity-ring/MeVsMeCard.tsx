import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Calendar, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeVsMe } from "@/hooks/useMeVsMe";
import { useEfpMode } from "@/hooks/useEfpMode";
import { calculateEfp } from "@/utils/efp";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, startOfMonth, parseISO, startOfYear } from "date-fns";

interface MeVsMeCardProps {
  currentFP: number;
  currentPRMR?: number;
  currentDoors: number;
  entryDate?: string;
  className?: string;
}

interface ComparisonRow {
  label: string;
  thisYear: number;
  lastYear: number;
  diff: number;
}

export const MeVsMeCard = ({
  currentFP,
  currentPRMR = 0,
  currentDoors,
  entryDate,
  className,
}: MeVsMeCardProps) => {
  const { isEnabled, dataSummary } = useMeVsMe();
  const { efpModeEnabled } = useEfpMode();

  // Fetch comprehensive historical comparison data
  const { data: comparison } = useQuery({
    queryKey: ['historical-comparison-full', entryDate, efpModeEnabled],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const today = entryDate ? parseISO(entryDate) : new Date();
      
      // Get same day last year
      const lastYearDate = new Date(today);
      lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
      const lastYearDateStr = format(lastYearDate, 'yyyy-MM-dd');

      // Date ranges for this year
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const monthStart = startOfMonth(today);
      // YTD starts from season start (Sept 28, 2025 for 2026 season) - simplified to Jan 1 for now
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const todayStr = format(today, 'yyyy-MM-dd');
      
      // Last year date ranges
      const lastYearWeekStart = new Date(weekStart);
      lastYearWeekStart.setFullYear(lastYearWeekStart.getFullYear() - 1);
      const lastYearMonthStart = new Date(monthStart);
      lastYearMonthStart.setFullYear(lastYearMonthStart.getFullYear() - 1);
      const lastYearYearStart = new Date(yearStart);
      lastYearYearStart.setFullYear(lastYearYearStart.getFullYear() - 1);
      
      // Calculate the "same point in year" for YTD comparison
      const dayOfYear = Math.floor((today.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
      const lastYearSamePoint = new Date(lastYearYearStart);
      lastYearSamePoint.setDate(lastYearSamePoint.getDate() + dayOfYear);

      // Query historical entries
      const [sameDayResult, lastYearWTDResult, lastYearMTDResult, lastYearYTDResult, thisYearWTDResult, thisYearMTDResult, thisYearYTDResult] = await Promise.all([
        // Same day last year
        supabase
          .from('historical_entries')
          .select('fp_plus, prmr, doors_knocked')
          .eq('user_id', user.id)
          .eq('original_date', lastYearDateStr)
          .maybeSingle(),
        // Last year WTD
        supabase
          .from('historical_entries')
          .select('fp_plus, prmr, doors_knocked')
          .eq('user_id', user.id)
          .gte('original_date', format(lastYearWeekStart, 'yyyy-MM-dd'))
          .lte('original_date', format(new Date(lastYearWeekStart.getTime() + (today.getTime() - weekStart.getTime())), 'yyyy-MM-dd')),
        // Last year MTD
        supabase
          .from('historical_entries')
          .select('fp_plus, prmr, doors_knocked')
          .eq('user_id', user.id)
          .gte('original_date', format(lastYearMonthStart, 'yyyy-MM-dd'))
          .lte('original_date', format(new Date(lastYearMonthStart.getTime() + (today.getTime() - monthStart.getTime())), 'yyyy-MM-dd')),
        // Last year YTD
        supabase
          .from('historical_entries')
          .select('fp_plus, prmr, doors_knocked')
          .eq('user_id', user.id)
          .gte('original_date', format(lastYearYearStart, 'yyyy-MM-dd'))
          .lte('original_date', format(lastYearSamePoint, 'yyyy-MM-dd')),
        // This year WTD
        supabase
          .from('daily_entries')
          .select('fp_plus, prmr, doors_knocked, sales_log')
          .eq('user_id', user.id)
          .gte('entry_date', format(weekStart, 'yyyy-MM-dd'))
          .lte('entry_date', todayStr),
        // This year MTD
        supabase
          .from('daily_entries')
          .select('fp_plus, prmr, doors_knocked, sales_log')
          .eq('user_id', user.id)
          .gte('entry_date', format(monthStart, 'yyyy-MM-dd'))
          .lte('entry_date', todayStr),
        // This year YTD
        supabase
          .from('daily_entries')
          .select('fp_plus, prmr, doors_knocked, sales_log')
          .eq('user_id', user.id)
          .gte('entry_date', format(yearStart, 'yyyy-MM-dd'))
          .lte('entry_date', todayStr),
      ]);

      // Helper to sum entries
      const sumEntries = (entries: any[] | null, field: 'fp_plus' | 'prmr') => {
        if (!entries) return 0;
        return entries.reduce((sum, e) => sum + (e[field] || 0), 0);
      };

      const lastYearSameDay = sameDayResult.data;
      
      return {
        sameDayLastYear: lastYearSameDay ? {
          fp: lastYearSameDay.fp_plus || 0,
          prmr: lastYearSameDay.prmr || 0,
          doors: lastYearSameDay.doors_knocked || 0,
        } : null,
        weekToDate: {
          thisYear: { fp: sumEntries(thisYearWTDResult.data, 'fp_plus'), prmr: sumEntries(thisYearWTDResult.data, 'prmr') },
          lastYear: { fp: sumEntries(lastYearWTDResult.data, 'fp_plus'), prmr: sumEntries(lastYearWTDResult.data, 'prmr') },
        },
        monthToDate: {
          thisYear: { fp: sumEntries(thisYearMTDResult.data, 'fp_plus'), prmr: sumEntries(thisYearMTDResult.data, 'prmr') },
          lastYear: { fp: sumEntries(lastYearMTDResult.data, 'fp_plus'), prmr: sumEntries(lastYearMTDResult.data, 'prmr') },
        },
        yearToDate: {
          thisYear: { fp: sumEntries(thisYearYTDResult.data, 'fp_plus'), prmr: sumEntries(thisYearYTDResult.data, 'prmr') },
          lastYear: { fp: sumEntries(lastYearYTDResult.data, 'fp_plus'), prmr: sumEntries(lastYearYTDResult.data, 'prmr') },
        },
      };
    },
    enabled: isEnabled && !!dataSummary,
    staleTime: 5 * 60 * 1000,
  });

  if (!isEnabled || !dataSummary || !comparison) return null;

  // Build comparison rows
  const rows: ComparisonRow[] = [];
  const getValue = (data: { fp: number; prmr: number }) => 
    efpModeEnabled ? calculateEfp(data.prmr) : data.fp;

  // Day vs Day (same day last year)
  if (comparison.sameDayLastYear) {
    const thisYearValue = efpModeEnabled ? calculateEfp(currentPRMR) : currentFP;
    const lastYearValue = getValue(comparison.sameDayLastYear);
    rows.push({
      label: 'Day vs. Day',
      thisYear: thisYearValue,
      lastYear: lastYearValue,
      diff: thisYearValue - lastYearValue,
    });
  }

  // WTD vs WTD
  if (comparison.weekToDate.lastYear.fp > 0 || comparison.weekToDate.lastYear.prmr > 0) {
    const thisYearValue = getValue(comparison.weekToDate.thisYear);
    const lastYearValue = getValue(comparison.weekToDate.lastYear);
    rows.push({
      label: 'WTD vs. WTD',
      thisYear: thisYearValue,
      lastYear: lastYearValue,
      diff: thisYearValue - lastYearValue,
    });
  }

  // MTD vs MTD
  if (comparison.monthToDate.lastYear.fp > 0 || comparison.monthToDate.lastYear.prmr > 0) {
    const thisYearValue = getValue(comparison.monthToDate.thisYear);
    const lastYearValue = getValue(comparison.monthToDate.lastYear);
    rows.push({
      label: 'MTD vs. MTD',
      thisYear: thisYearValue,
      lastYear: lastYearValue,
      diff: thisYearValue - lastYearValue,
    });
  }

  // YTD vs YTD
  if (comparison.yearToDate.lastYear.fp > 0 || comparison.yearToDate.lastYear.prmr > 0) {
    const thisYearValue = getValue(comparison.yearToDate.thisYear);
    const lastYearValue = getValue(comparison.yearToDate.lastYear);
    rows.push({
      label: 'YTD vs. YTD',
      thisYear: thisYearValue,
      lastYear: lastYearValue,
      diff: thisYearValue - lastYearValue,
    });
  }

  if (rows.length === 0) return null;

  const metricLabel = efpModeEnabled ? 'EFP' : 'FP';
  const overallAhead = rows.filter(r => r.diff > 0).length > rows.length / 2;

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

      <div className="space-y-2">
        {rows.map((row) => {
          const isAhead = row.diff > 0;
          const isBehind = row.diff < 0;
          
          return (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <div className={cn(
                "flex items-center gap-1 text-sm font-semibold",
                isAhead ? "text-green-500" : isBehind ? "text-red-500" : "text-muted-foreground"
              )}>
                {isAhead ? (
                  <TrendingUp className="w-3 h-3" />
                ) : isBehind ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                <span>
                  {isAhead ? '+' : ''}{row.diff.toFixed(1)} {metricLabel}
                </span>
              </div>
            </div>
          );
        })}

        {/* Encouragement message */}
        <div className="pt-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground italic">
            {overallAhead 
              ? "You're beating your 2025 self! Keep the momentum 💪"
              : "Time to step it up! You've got this 🔥"}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
