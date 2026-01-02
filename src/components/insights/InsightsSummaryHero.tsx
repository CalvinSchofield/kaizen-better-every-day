import { TrendingUp, TrendingDown, Target, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useRepGoals } from '@/hooks/useRepGoals';
import { usePlannedDays } from '@/hooks/usePlannedDays';
import { useEfpMode } from '@/hooks/useEfpMode';
import { useFocusTier } from '@/hooks/useFocusTier';
import { useMemo } from 'react';
import { calculateSalesPace } from '@/utils/salesPaceCalculator';

interface InsightsSummaryHeroProps {
  totalFp: number;
  totalEfp: number;
  totalPrmr: number;
  daysWorked: number;
  totalDoors: number;
  totalCloses: number;
  efpModeEnabled: boolean;
}

export const InsightsSummaryHero = ({
  totalFp,
  totalEfp,
  totalPrmr,
  daysWorked,
  totalCloses,
  totalDoors,
  efpModeEnabled
}: InsightsSummaryHeroProps) => {
  const { goals } = useRepGoals();
  const { plannedDays } = usePlannedDays();
  const { calculateEfp } = useEfpMode();
  
  // Get current progress and focus tier
  const currentProgress = efpModeEnabled ? totalEfp : totalFp;
  const { focusTier, isUserSummerStarted } = useFocusTier(currentProgress);
  
  const fpPerDay = daysWorked > 0 ? (efpModeEnabled ? totalEfp : totalFp) / daysWorked : 0;
  
  // Calculate pace status using centralized calculator with focus tier
  const paceStatus = useMemo(() => {
    const result = calculateSalesPace({
      goals,
      plannedDays,
      knockingDays: daysWorked,
      currentFpPlus: totalFp,
      currentPrmr: totalPrmr,
      efpModeEnabled,
      calculateEfp,
      // Use focus tier when user's summer has started
      activeTier: isUserSummerStarted ? focusTier : 'preseason',
    });
    
    if (!result) return null;
    
    return {
      isOnTrack: result.isOnTrack,
      difference: Math.abs(result.paceVariance),
      targetGoal: result.fundedGoal,
      expectedAtThisPoint: result.expectedAtThisPoint,
      originalDailyGoal: result.dailyGoal,
      remainingDailyNeeded: result.remainingDailyNeeded,
      isInPreseason: result.isInPreseason,
      focusTier: isUserSummerStarted ? focusTier : null,
    };
  }, [goals, plannedDays, totalFp, totalPrmr, totalEfp, efpModeEnabled, daysWorked, calculateEfp, focusTier, isUserSummerStarted]);
  
  return (
    <Card className="p-5 bg-gradient-to-br from-card to-accent/30 border-border/50">
      {/* Goal Pace Indicator */}
      {paceStatus && (
        <div className={`flex items-center justify-between p-3 rounded-lg mb-4 ${
          paceStatus.isOnTrack 
            ? 'bg-green-500/10 border border-green-500/20' 
            : 'bg-amber-500/10 border border-amber-500/20'
        }`}>
          <div className="flex items-center gap-2">
            {paceStatus.isOnTrack ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <div>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">On Pace</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    +{paceStatus.difference.toFixed(1)} ahead
                  </span>
                </div>
              </>
            ) : (
              <>
                <TrendingDown className="w-5 h-5 text-amber-500" />
                <div>
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Behind Pace</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {paceStatus.difference.toFixed(1)} behind · Need {paceStatus.remainingDailyNeeded.toFixed(1)}/day
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Target className="w-3 h-3" />
            <span>
              {paceStatus.isInPreseason 
                ? 'Preseason' 
                : paceStatus.focusTier === 'mustDo' 
                  ? 'Must Do' 
                  : paceStatus.focusTier === 'willDo' 
                    ? 'Will Do' 
                    : 'Could Do'
              }: {paceStatus.targetGoal.toFixed(0)}
            </span>
          </div>
        </div>
      )}

      {/* Primary metrics row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-3xl font-bold text-primary">
            {efpModeEnabled ? totalEfp.toFixed(2) : totalFp.toFixed(1)}
          </div>
          <div className="text-sm text-muted-foreground">
            Total {efpModeEnabled ? 'EFP' : 'FP+'}
          </div>
        </div>
        <div className="text-right">
          {efpModeEnabled ? (
            <>
              <div className="text-2xl font-bold text-foreground">
                {totalFp.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground">Total FP+</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-foreground">
                ${totalPrmr.toFixed(0)}
              </div>
              <div className="text-sm text-muted-foreground">Total PRMR</div>
            </>
          )}
        </div>
      </div>

      {/* Secondary metrics row */}
      <div className="grid grid-cols-4 gap-3 pt-4 border-t border-border/50">
        <div className="text-center">
          <div className="text-lg font-semibold">{daysWorked}</div>
          <div className="text-xs text-muted-foreground">Days</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{totalDoors}</div>
          <div className="text-xs text-muted-foreground">Doors</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{totalCloses}</div>
          <div className="text-xs text-muted-foreground">Closes</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3 text-success" />
            {fpPerDay.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground">/Day</div>
        </div>
      </div>
    </Card>
  );
};
