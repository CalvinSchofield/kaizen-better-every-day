import { TrendingUp, TrendingDown, Target, CheckCircle2, Zap, Rocket } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useRepGoals } from '@/hooks/useRepGoals';
import { usePlannedDays } from '@/hooks/usePlannedDays';
import { useEfpMode } from '@/hooks/useEfpMode';
import { useFocusTier, FocusTier } from '@/hooks/useFocusTier';
import { useCumulativeFP } from '@/hooks/useCumulativeFP';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { calculateSalesPace } from '@/utils/salesPaceCalculator';
import { calculatePaceContext, calculateSuggestedStretchGoal } from '@/utils/learningCurveData';
import { parseISO, isAfter } from 'date-fns';

// Preseason ends April 11, 2026
const PRESEASON_END = new Date(2026, 3, 11);

interface InsightsSummaryHeroProps {
  totalFp: number;
  totalEfp: number;
  totalPrmr: number;
  daysWorked: number;
  totalDoors: number;
  totalCloses: number;
  efpModeEnabled: boolean;
  dateRange?: { start: Date; end: Date };
}

export const InsightsSummaryHero = ({
  totalFp,
  totalEfp,
  totalPrmr,
  daysWorked,
  totalCloses,
  totalDoors,
  efpModeEnabled,
  dateRange,
}: InsightsSummaryHeroProps) => {
  const navigate = useNavigate();
  const { goals } = useRepGoals();
  const { plannedDays } = usePlannedDays();
  const { calculateEfp } = useEfpMode();
  const { data: cumulativeData } = useCumulativeFP();
  
  // Check if goals are set up
  const goalsSetUp = goals?.setup_complete === true;
  
  // Get GLOBAL progress from cumulative data (for pace calculation)
  const globalStats = useMemo(() => {
    if (!cumulativeData || cumulativeData.length === 0) {
      return { totalFp: 0, totalPrmr: 0, totalEfp: 0, knockingDays: 0 };
    }
    const latest = cumulativeData[cumulativeData.length - 1];
    return {
      totalFp: latest.cumulativeFp,
      totalPrmr: latest.cumulativePrmr,
      totalEfp: latest.cumulative,
      knockingDays: latest.knockingDayNumber,
    };
  }, [cumulativeData]);
  
  // Get current progress for display (filtered by date range)
  const displayProgress = efpModeEnabled ? totalEfp : totalFp;
  
  // Get GLOBAL progress for pace calculation
  const globalProgress = efpModeEnabled ? globalStats.totalEfp : globalStats.totalFp;
  
  const { focusTier, setFocusTier, allTiers, isUserSummerStarted } = useFocusTier(globalProgress);
  
  const fpPerDay = daysWorked > 0 ? (efpModeEnabled ? totalEfp : totalFp) / daysWorked : 0;
  
  // Determine if the selected date range is in preseason
  // If the date range ends before or on preseason end, it's preseason data
  const isViewingPreseasonData = useMemo(() => {
    if (!dateRange) return !isUserSummerStarted; // Fallback to current season
    return !isAfter(dateRange.end, PRESEASON_END);
  }, [dateRange, isUserSummerStarted]);
  
  // Calculate pace status using centralized calculator with GLOBAL data
  const paceStatus = useMemo(() => {
    if (!goalsSetUp || globalStats.knockingDays === 0) return null;
    
    const result = calculateSalesPace({
      goals,
      plannedDays,
      knockingDays: globalStats.knockingDays, // Use GLOBAL knocking days
      currentFpPlus: globalStats.totalFp,      // Use GLOBAL FP+
      currentPrmr: globalStats.totalPrmr,      // Use GLOBAL PRMR
      efpModeEnabled,
      calculateEfp,
      // Use preseason if viewing preseason data, otherwise use focus tier
      activeTier: isViewingPreseasonData ? 'preseason' : focusTier,
    });
    
    if (!result) return null;
    
    return {
      isOnTrack: result.isOnTrack,
      difference: Math.abs(result.paceVariance),
      targetGoal: result.fundedGoal,
      expectedAtThisPoint: result.expectedAtThisPoint,
      originalDailyGoal: result.dailyGoal,
      remainingDailyNeeded: result.remainingDailyNeeded,
      isInPreseason: isViewingPreseasonData,
      focusTier: isViewingPreseasonData ? null : focusTier,
      projectedFinal: result.projectedFinal,
      currentAverage: globalStats.knockingDays > 0 ? globalProgress / globalStats.knockingDays : 0,
    };
  }, [goals, goalsSetUp, plannedDays, globalStats, efpModeEnabled, calculateEfp, focusTier, isViewingPreseasonData, globalProgress]);
  
  // Calculate stretch goal suggestion
  const stretchSuggestion = useMemo(() => {
    if (!paceStatus || !paceStatus.projectedFinal) return null;
    
    const couldDoGoal = allTiers?.couldDo?.goal || paceStatus.targetGoal;
    return calculateSuggestedStretchGoal(
      paceStatus.projectedFinal,
      couldDoGoal,
      daysWorked >= 18
    );
  }, [paceStatus, allTiers, daysWorked]);
  
  // Tier display config
  const tierConfig: Record<FocusTier, { label: string; color: string }> = {
    mustDo: { label: 'Must Do', color: 'text-amber-600 dark:text-amber-400' },
    willDo: { label: 'Will Do', color: 'text-primary' },
    couldDo: { label: 'Could Do', color: 'text-emerald-600 dark:text-emerald-400' },
  };
  
  return (
    <Card className="p-5 bg-gradient-to-br from-card to-accent/30 border-border/50">
      {/* Goals Not Set Up CTA */}
      {!goalsSetUp && (
        <div 
          className="flex items-center gap-3 p-3 rounded-lg mb-4 bg-primary/10 border border-primary/20 cursor-pointer"
          onClick={() => navigate('/goals')}
        >
          <Target className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-primary">Set Up Your Goals</span>
            <p className="text-xs text-muted-foreground">Track your pace and see how you're doing</p>
          </div>
          <Zap className="w-4 h-4 text-primary" />
        </div>
      )}

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
      
      {/* Projected Finish Badge - Show when ahead and have enough data */}
      {paceStatus && paceStatus.projectedFinal && daysWorked >= 18 && paceStatus.isOnTrack && (
        <div className="flex items-center gap-2 p-3 rounded-lg mb-4 bg-primary/10 border border-primary/20">
          <Rocket className="w-4 h-4 text-primary" />
          <div className="flex-1">
            <span className="text-sm font-medium text-primary">
              Projected finish: {paceStatus.projectedFinal.toFixed(0)} {efpModeEnabled ? 'EFP' : 'FP+'}
            </span>
            {stretchSuggestion && (
              <span className="text-xs text-muted-foreground ml-2">
                — Consider stretching to {stretchSuggestion.toFixed(0)}!
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summer Tier Goals - Only show when viewing summer data and summer has started */}
      {!isViewingPreseasonData && isUserSummerStarted && allTiers && (
        <div className="flex items-center gap-2 mb-4 p-1.5 rounded-xl bg-muted/30">
          {(['mustDo', 'willDo', 'couldDo'] as FocusTier[]).map((tier) => {
            const isActive = focusTier === tier;
            const tierData = allTiers[tier];
            const config = tierConfig[tier];
            const progressPercent = tierData.goal > 0 ? Math.min((globalProgress / tierData.goal) * 100, 100) : 0;
            
            return (
              <button
                key={tier}
                onClick={() => setFocusTier(tier)}
                className={`flex-1 py-2 px-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-card shadow-sm border border-border/50'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className={`text-[10px] font-medium mb-0.5 ${isActive ? config.color : 'text-muted-foreground'}`}>
                  {config.label}
                </div>
                <div className={`text-sm font-bold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {tierData.goal.toFixed(0)}
                </div>
                {/* Mini progress bar */}
                <div className="mt-1.5 h-1 bg-muted/50 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      tierData.complete ? 'bg-green-500' : isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </button>
            );
          })}
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
