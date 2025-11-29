import { Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";

interface WeekSummaryCardProps {
  repData: any;
}

export const WeekSummaryCard = ({ repData }: WeekSummaryCardProps) => {
  // Fetch this week's data
  const { data: thisWeekData } = useQuery({
    queryKey: ['week-summary', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return null;

      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 }); // Sunday

      const { data, error } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', repData.user_id)
        .gte('entry_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('entry_date', format(weekEnd, 'yyyy-MM-dd'))
        .eq('is_finalized', true);

      if (error) throw error;

      const totals = data?.reduce((acc, entry) => ({
        transitions: acc.transitions + (entry.transitions || 0),
        fp: acc.fp + (Number(entry.fp_plus) || 0),
        prmr: acc.prmr + (Number(entry.prmr) || 0),
        days: acc.days + 1,
      }), { transitions: 0, fp: 0, prmr: 0, days: 0 }) || { transitions: 0, fp: 0, prmr: 0, days: 0 };

      return totals;
    },
    enabled: !!repData?.user_id,
  });

  // Fetch last week's data for comparison
  const { data: lastWeekData } = useQuery({
    queryKey: ['last-week-summary', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return null;

      const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });

      const { data, error } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', repData.user_id)
        .gte('entry_date', format(lastWeekStart, 'yyyy-MM-dd'))
        .lte('entry_date', format(lastWeekEnd, 'yyyy-MM-dd'))
        .eq('is_finalized', true);

      if (error) throw error;

      const totals = data?.reduce((acc, entry) => ({
        fp: acc.fp + (Number(entry.fp_plus) || 0),
      }), { fp: 0 }) || { fp: 0 };

      return totals;
    },
    enabled: !!repData?.user_id,
  });

  const thisWeek = thisWeekData || { transitions: 0, fp: 0, prmr: 0, days: 0 };
  const lastWeek = lastWeekData || { fp: 0 };
  const fpChange = thisWeek.fp - lastWeek.fp;
  const isImproving = fpChange >= 0;
  const upfrontPay = thisWeek.prmr * 4;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle>This Week</CardTitle>
        </div>
        <CardDescription>{thisWeek.days} days worked</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{thisWeek.transitions}</p>
            <p className="text-xs text-muted-foreground">Transitions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{thisWeek.fp.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">FP+</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">${thisWeek.prmr}</p>
            <p className="text-xs text-muted-foreground">PRMR</p>
          </div>
        </div>

        {/* Upfront Pay Calculation */}
        <div className="mt-4 text-center">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">
            Anticipated Upfront Pay: <span className="text-base">${upfrontPay.toLocaleString()}</span>
          </p>
        </div>

        {lastWeek.fp > 0 && (
          <div className={`mt-4 flex items-center gap-2 justify-center text-sm ${
            isImproving ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
          }`}>
            {isImproving ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>
              {isImproving ? "+" : ""}{fpChange.toFixed(1)} FP+ vs last week
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
