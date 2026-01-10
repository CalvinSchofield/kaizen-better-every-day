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

      const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }); // Sunday
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 0 }); // Saturday

      const { data, error } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', repData.user_id)
        .gte('entry_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('entry_date', format(weekEnd, 'yyyy-MM-dd'))
        .eq('is_finalized', true);

      if (error) throw error;

      const totals = data?.reduce((acc, entry) => {
        acc.transitions += entry.transitions || 0;
        acc.fp += Number(entry.fp_plus) || 0;
        acc.prmr += Number(entry.prmr) || 0;
        acc.days += 1;
        
        // Parse sales_log to get FP count, PRMR breakdown, and money spent
        // Fall back to column values for entries without sales_log (pre-feature entries)
        const salesLog = entry.sales_log || [];
        const fundedSales = Array.isArray(salesLog) 
          ? (salesLog as any[]).filter((sale: any) => sale.install_status !== 'cancelled' && sale.install_status !== 'never_installed')
          : [];
        
        // Always count money spent from all sales (regardless of install status)
        if (Array.isArray(salesLog)) {
          (salesLog as any[]).forEach((sale: any) => {
            acc.moneySpent += Number(sale.money_spent) || 0;
          });
        }
        
        if (fundedSales.length > 0) {
          // Use sales_log data
          fundedSales.forEach((sale: any) => {
            if (sale.type === 'fp') {
              acc.fpCount += 1;
              acc.fpPrmrTotal += sale.prmr || 0;
            } else if (sale.type === 'upgrade') {
              acc.upgradeCount += 1;
              acc.upgradePrmrTotal += sale.prmr || 0;
            }
          });
        } else if ((entry.fp_plus || 0) > 0 || (entry.prmr || 0) > 0) {
          // Fallback for pre-sales_log entries: derive from column values
          const upgradeFp = (entry.upgrade_prmr || 0) / 85;
          const newFp = (entry.fp_plus || 0) - upgradeFp;
          const newPrmr = Number(entry.prmr || 0) - Number(entry.upgrade_prmr || 0);
          
          if (newFp > 0) {
            acc.fpCount += Math.round(newFp);
            acc.fpPrmrTotal += newPrmr;
          }
          if ((entry.upgrade_prmr || 0) > 0) {
            acc.upgradeCount += Math.round(upgradeFp);
            acc.upgradePrmrTotal += Number(entry.upgrade_prmr) || 0;
          }
        }
        
        return acc;
      }, { transitions: 0, fp: 0, prmr: 0, days: 0, fpCount: 0, fpPrmrTotal: 0, upgradeCount: 0, upgradePrmrTotal: 0, moneySpent: 0 }) || { transitions: 0, fp: 0, prmr: 0, days: 0, fpCount: 0, fpPrmrTotal: 0, upgradeCount: 0, upgradePrmrTotal: 0, moneySpent: 0 };

      return totals;
    },
    enabled: !!repData?.user_id,
  });

  // Fetch last week's data for comparison
  const { data: lastWeekData } = useQuery({
    queryKey: ['last-week-summary', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return null;

      const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 0 });
      const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 0 });

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

  const thisWeek = thisWeekData || { transitions: 0, fp: 0, prmr: 0, days: 0, fpCount: 0, fpPrmrTotal: 0, upgradeCount: 0, upgradePrmrTotal: 0, moneySpent: 0 };
  const lastWeek = lastWeekData || { fp: 0 };
  const fpChange = thisWeek.fp - lastWeek.fp;
  const isImproving = fpChange >= 0;
  const upfrontPay = thisWeek.prmr * 4;
  const netPay = upfrontPay - thisWeek.moneySpent;

  // Calculate averages from sales_log data
  const avgPrmrPerFp = thisWeek.fpCount > 0 ? Math.round(thisWeek.fpPrmrTotal / thisWeek.fpCount) : 0;
  const avgPrmrPerUpgrade = thisWeek.upgradeCount > 0 ? Math.round(thisWeek.upgradePrmrTotal / thisWeek.upgradeCount) : 0;

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
            <p className="text-2xl font-bold text-primary">{thisWeek.fpCount}</p>
            <p className="text-xs text-muted-foreground">FP</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">${Math.round(thisWeek.prmr)}</p>
            <p className="text-xs text-muted-foreground">PRMR</p>
          </div>
        </div>

        {/* FP+ Breakdown */}
        {(thisWeek.fpCount > 0 || thisWeek.upgradeCount > 0) && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm font-semibold text-foreground mb-2">FP+ Breakdown</p>
            <div className="grid grid-cols-2 gap-4">
              {thisWeek.fpCount > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">${avgPrmrPerFp}</p>
                  <p className="text-xs text-muted-foreground">Avg PRMR per FP</p>
                </div>
              )}
              {thisWeek.upgradeCount > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">${avgPrmrPerUpgrade}</p>
                  <p className="text-xs text-muted-foreground">Avg PRMR per Upgrade</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upfront Pay Calculation */}
        <div className="mt-4 text-center">
          <p className="text-sm font-semibold text-muted-foreground">
            Anticipated Upfront Pay: <span className="text-base text-green-800 dark:text-green-500">${upfrontPay.toLocaleString()}</span>
          </p>
          {thisWeek.moneySpent > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Spent: <span className="text-destructive">${thisWeek.moneySpent.toLocaleString()}</span>
              {" → "}Net: <span className="text-green-700 dark:text-green-400 font-medium">
                ${netPay.toLocaleString()}
              </span>
            </p>
          )}
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
