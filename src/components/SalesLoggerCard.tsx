import { Card, CardContent } from "@/components/ui/card";
import { Sale } from "@/components/LogSaleSheet";
import { X, Ban } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useFocusTier } from "@/hooks/useFocusTier";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
interface SalesLoggerCardProps {
  salesLog: Sale[];
  onEditSale: (sale: Sale) => void;
  onDeleteSale: (saleId: string) => void;
}

export const SalesLoggerCard = ({
  salesLog,
  onEditSale,
  onDeleteSale,
}: SalesLoggerCardProps) => {
  const { efpModeEnabled } = useEfpMode();
  const { goals } = useRepGoals();
  const { totalFP: cumulativeFP, totalEFP: cumulativeEFP } = usePreseasonFP();
  const { plannedDays } = usePlannedDays();
  
  // Filter funded sales for totals
  const fundedSales = salesLog.filter(s => s.install_status !== 'cancelled');
  const cancelledSales = salesLog.filter(s => s.install_status === 'cancelled');
  
  const fpSales = fundedSales.filter(s => s.type === 'fp');
  const upgradeSales = fundedSales.filter(s => s.type === 'upgrade');
  
  const fpCount = fpSales.length;
  const upgradePrmrTotal = upgradeSales.reduce((sum, s) => sum + s.prmr, 0);
  const upgradeFP = upgradePrmrTotal / 85;
  
  const totalFPPlus = fpCount + upgradeFP;
  const totalPrmr = fundedSales.reduce((sum, s) => sum + s.prmr, 0);
  
  // EFP = Total PRMR / 85
  const totalEFP = totalPrmr / 85;
  
  // Current cumulative progress for focus tier
  const currentProgress = efpModeEnabled ? (cumulativeEFP || 0) : (cumulativeFP || 0);
  
  // Get focus tier daily goal
  const { focusTier, fundedFocusTierGoal, allTiers, isUserSummerStarted } = useFocusTier(currentProgress);
  
  // Check if goals are set up
  const goalsSetUp = goals?.setup_complete === true;
  
  // Calculate daily goal based on total season knocking days
  // For preseason: use preseason goal; for summer: use focus tier goal
  const dailyGoal = (() => {
    if (!goalsSetUp || !plannedDays) return 0;
    
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const seasonEndStr = isUserSummerStarted ? '2026-09-27' : '2026-04-11'; // Summer end or Preseason end
    
    // Future planned days from today forward
    const futurePlanned = plannedDays.filter(d => 
      d.planned_date >= todayStr && d.planned_date <= seasonEndStr
    ).length;
    
    if (futurePlanned === 0) return 0;
    
    if (isUserSummerStarted) {
      return fundedFocusTierGoal / futurePlanned;
    } else {
      // Preseason goal with cancel rate buffer
      const cancelRate = goals?.cancel_rate || 0;
      const preseasonGoal = goals?.preseason_fp_goal || 0;
      const fundedPreseasonGoal = cancelRate > 0 && cancelRate < 1 
        ? preseasonGoal / (1 - cancelRate) 
        : preseasonGoal;
      const conversionFactor = efpModeEnabled ? (goals?.avg_prmr_per_fp || 85) / 85 : 1;
      return (fundedPreseasonGoal * conversionFactor) / futurePlanned;
    }
  })();

  // Calculate must-do daily goal for minimum threshold confetti
  const mustDoDailyGoal = (() => {
    if (!goalsSetUp || !plannedDays || !isUserSummerStarted) return dailyGoal;
    
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const seasonEndStr = '2026-09-27';
    
    const futurePlanned = plannedDays.filter(d => 
      d.planned_date >= todayStr && d.planned_date <= seasonEndStr
    ).length;
    
    if (futurePlanned === 0) return 0;
    
    const mustDoFunded = allTiers?.mustDo?.funded || 0;
    return mustDoFunded / futurePlanned;
  })();

  // Today's progress in the relevant metric
  const todaysProgress = efpModeEnabled ? totalEFP : totalFPPlus;
  const metricLabel = efpModeEnabled ? "EFP" : "FP+";

  // Confetti trigger - track if we've already fired for this session
  const confettiFiredRef = useRef(false);
  
  useEffect(() => {
    if (!goalsSetUp || confettiFiredRef.current) return;
    
    // Check if hitting at least the must-do goal (or focused goal during preseason)
    const thresholdGoal = isUserSummerStarted ? mustDoDailyGoal : dailyGoal;
    
    if (thresholdGoal > 0 && todaysProgress >= thresholdGoal) {
      confettiFiredRef.current = true;
      
      // Fire confetti from both sides
      const fireConfetti = () => {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { x: 0.1, y: 0.6 },
          colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
        });
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { x: 0.9, y: 0.6 },
          colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
        });
      };
      
      // Small delay for visual impact
      setTimeout(fireConfetti, 100);
    }
  }, [todaysProgress, dailyGoal, mustDoDailyGoal, goalsSetUp, isUserSummerStarted]);

  if (salesLog.length === 0) {
    return null; // Don't show card if no sales
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4 space-y-3">
        {/* Header with totals */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="text-lg">💰</span>
            Today's Sales
          </h3>
          <div className="text-right">
            {efpModeEnabled ? (
              <>
                <div className="text-lg font-bold text-primary">
                  {goalsSetUp && dailyGoal > 0 ? (
                    <>
                      {totalEFP.toFixed(2)}
                      <span className="text-muted-foreground font-normal"> / {dailyGoal.toFixed(1)}</span>
                      <span className="text-sm font-normal ml-1">EFP</span>
                    </>
                  ) : (
                    <>{totalEFP.toFixed(2)} EFP</>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fpCount} FP+
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-primary">
                  {goalsSetUp && dailyGoal > 0 ? (
                    <>
                      {totalFPPlus.toFixed(1)}
                      <span className="text-muted-foreground font-normal"> / {dailyGoal.toFixed(1)}</span>
                      <span className="text-sm font-normal ml-1">FP+</span>
                    </>
                  ) : (
                    <>${totalPrmr.toLocaleString()}</>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {goalsSetUp && dailyGoal > 0 ? `$${totalPrmr.toLocaleString()}` : `${totalFPPlus.toFixed(1)} FP+`}
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Progress bar - only show when goals are set up */}
        {goalsSetUp && dailyGoal > 0 && (
          <div className="relative h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <div 
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${
                todaysProgress >= dailyGoal 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-400' 
                  : 'bg-gradient-to-r from-primary to-primary/70'
              }`}
              style={{ width: `${Math.min((todaysProgress / dailyGoal) * 100, 100)}%` }}
            />
          </div>
        )}

        {/* Sales chips - horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {salesLog.map((sale) => (
            <SaleChip
              key={sale.id}
              sale={sale}
              onEdit={() => onEditSale(sale)}
              onDelete={() => onDeleteSale(sale.id)}
            />
          ))}
        </div>

        {/* Breakdown */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
          <span>{fpCount} FP{fpCount !== 1 ? 's' : ''}</span>
          {upgradeSales.length > 0 && (
            <>
              <span>•</span>
              <span>{upgradeSales.length} Upgrade{upgradeSales.length !== 1 ? 's' : ''} (+{upgradeFP.toFixed(2)} FP)</span>
            </>
          )}
          {cancelledSales.length > 0 && (
            <>
              <span>•</span>
              <span className="text-destructive/70">{cancelledSales.length} Cancelled</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface SaleChipProps {
  sale: Sale;
  onEdit: () => void;
  onDelete: () => void;
}

const SaleChip = ({ sale, onEdit, onDelete }: SaleChipProps) => {
  const isFP = sale.type === 'fp';
  const isCancelled = sale.install_status === 'cancelled';
  const timeStr = format(parseISO(sale.timestamp), 'h:mm a');
  const hasCustomerName = sale.customer_name && sale.customer_name.trim().length > 0;

  return (
    <div
      className={`relative flex-shrink-0 rounded-xl p-3 min-w-[90px] cursor-pointer transition-all active:scale-95 ${
        isCancelled
          ? 'bg-destructive/5 border border-destructive/20 opacity-60'
          : isFP
            ? 'bg-primary/10 border border-primary/20'
            : 'bg-emerald-500/10 border border-emerald-500/20'
      }`}
      onClick={onEdit}
    >
      {/* Cancelled indicator */}
      {isCancelled && (
        <div className="absolute top-1 right-1">
          <Ban className="w-3 h-3 text-destructive" />
        </div>
      )}

      {/* Delete button - only show for non-cancelled */}
      {!isCancelled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-muted flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity shadow-sm"
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      )}

      {/* Type badge */}
      <div className={`text-[10px] font-bold mb-1 ${
        isCancelled
          ? 'text-destructive/70'
          : isFP 
            ? 'text-primary' 
            : 'text-emerald-600'
      }`}>
        {isFP ? 'FP' : 'UP'}
      </div>

      {/* Customer name (if available) or PRMR amount */}
      {hasCustomerName ? (
        <>
          <div className={`text-sm font-semibold truncate max-w-[80px] ${
            isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'
          }`}>
            {sale.customer_name}
          </div>
          <div className={`text-xs ${
            isCancelled ? 'line-through text-muted-foreground' : 'text-muted-foreground'
          }`}>
            ${sale.prmr}
          </div>
        </>
      ) : (
        <div className={`text-lg font-bold ${
          isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'
        }`}>
          ${sale.prmr}
        </div>
      )}

      {/* Time */}
      <div className="text-[10px] text-muted-foreground mt-1">
        {timeStr}
      </div>
    </div>
  );
};
