import { TrendingUp, TrendingDown, Target, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useRepGoals } from '@/hooks/useRepGoals';
import { usePlannedDays } from '@/hooks/usePlannedDays';
import { useMemo } from 'react';
import { format } from 'date-fns';

interface InsightsSummaryHeroProps {
  totalFp: number;
  totalEfp: number;
  totalPrmr: number;
  daysWorked: number;
  totalDoors: number;
  totalCloses: number;
  efpModeEnabled: boolean;
}

// Season boundaries
const PRESEASON_END = '2026-04-11';
const SUMMER_END = '2026-09-27';

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
  
  const fpPerDay = daysWorked > 0 ? (efpModeEnabled ? totalEfp : totalFp) / daysWorked : 0;
  
  // Calculate pace status based on goals
  const paceStatus = useMemo(() => {
    if (!goals?.setup_complete || !plannedDays) return null;
    
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const preseasonEndDate = new Date(PRESEASON_END);
    const isInPreseason = today <= preseasonEndDate;
    
    // Get the correct goal based on season
    const seasonEndStr = isInPreseason ? PRESEASON_END : SUMMER_END;
    const seasonStartStr = isInPreseason ? '2025-09-28' : '2026-04-12';
    
    // Use preseason goal in preseason, summer goal otherwise
    const targetGoal = isInPreseason 
      ? (goals.preseason_fp_goal || 0)
      : (goals.will_do_fp_goal || goals.must_do_fp_goal || 0);
    
    if (targetGoal === 0) return null;
    
    // Convert to EFP if needed
    const conversionFactor = (goals.avg_prmr_per_fp || 85) / 85;
    const displayTargetGoal = efpModeEnabled ? targetGoal * conversionFactor : targetGoal;
    
    // Count total planned days for the season
    const totalPlannedDays = plannedDays.filter(d => 
      d.planned_date >= seasonStartStr && d.planned_date <= seasonEndStr
    ).length;
    
    // Count elapsed planned days (up to today)
    const elapsedPlannedDays = plannedDays.filter(d => 
      d.planned_date >= seasonStartStr && d.planned_date <= todayStr
    ).length;
    
    if (elapsedPlannedDays === 0 || totalPlannedDays === 0) return null;
    
    // ORIGINAL daily goal (what was committed at start)
    const originalDailyGoal = displayTargetGoal / totalPlannedDays;
    
    // Expected progress by now (based on elapsed planned days × original daily goal)
    const expectedAtThisPoint = originalDailyGoal * elapsedPlannedDays;
    
    const currentProgress = efpModeEnabled ? totalEfp : totalFp;
    const difference = currentProgress - expectedAtThisPoint;
    
    // Calculate remaining pace (what's needed per day going forward)
    const remainingGoal = Math.max(0, displayTargetGoal - currentProgress);
    const remainingDays = totalPlannedDays - elapsedPlannedDays;
    const remainingDailyNeeded = remainingDays > 0 ? remainingGoal / remainingDays : 0;
    
    return {
      isOnTrack: difference >= 0,
      difference: Math.abs(difference),
      targetGoal: displayTargetGoal,
      expectedAtThisPoint,
      originalDailyGoal,
      remainingDailyNeeded,
      isInPreseason
    };
  }, [goals, plannedDays, totalFp, totalEfp, efpModeEnabled]);
  
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
            <span>{paceStatus.isInPreseason ? 'Preseason' : 'Season'}: {paceStatus.targetGoal.toFixed(0)}</span>
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
