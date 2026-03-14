import { Card } from "@/components/ui/card";
import { Target, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useGoalPaceCalculator } from "@/hooks/useGoalPaceCalculator";
import { useRepData } from "@/hooks/useRepData";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFP } from "@/lib/formatters";
import { useHistoricalComparison } from "@/hooks/useHistoricalComparison";
import { useWeeklyComparison } from "@/hooks/useWeeklyComparison";
import { useMeVsMe } from "@/hooks/useMeVsMe";
import { useEfpMode } from "@/hooks/useEfpMode";
import { getSeasonInfo } from "@/utils/seasonWeekUtils";
import { startOfWeek } from "date-fns";
import { useMemo } from "react";

interface DailyMissionCardProps {
  className?: string;
}

export const DailyMissionCard = ({ className }: DailyMissionCardProps) => {
  const navigate = useNavigate();
  const { repData } = useRepData();
  const data = useGoalPaceCalculator();
  const { isEnabled: meVsMeEnabled } = useMeVsMe();
  const { efpModeEnabled } = useEfpMode();
  const { comparisonData: weeklyData } = useWeeklyComparison();

  const isRookie = repData?.year === 'Rookie';

  // Historical comparison setup
  const now = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(now, { weekStartsOn: 0 }), [now]);
  const seasonInfo = useMemo(() => getSeasonInfo(now), [now]);
  const comparisonYear = seasonInfo ? seasonInfo.year - 1 : now.getFullYear() - 1;

  const { comparisonData: historicalData, hasHistoricalData } = useHistoricalComparison({
    startDate: weekStart,
    endDate: now,
    comparisonYear,
    enabled: meVsMeEnabled && !!seasonInfo,
  });

  // Handle no goals setup
  if (!data.isLoading && !data.hasGoals) {
    return (
      <Card 
        className={`p-4 border-border/50 bg-card/50 ${className}`}
        onClick={() => navigate('/goals')}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Set Up Your Goals</p>
            <p className="text-xs text-muted-foreground">Tap here to get started</p>
          </div>
        </div>
      </Card>
    );
  }

  if (data.isLoading) {
    return (
      <Card className={`p-4 border-border/50 ${className}`}>
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  const dailyGoal = Math.round(data.dailyNeeded * 10) / 10;
  const unitLabel = data.metricLabel;
  const seasonLabel = data.tierLabel + ' pace';

  // Check if pace is unrealistic
  const paceThreshold = isRookie ? 2 : 3;
  const isPaceUnrealistic = dailyGoal >= paceThreshold;

  // Weekly context from unified data
  const weekData = data.week;
  const remainingDaysThisWeek = Math.max(0, weekData.plannedDaysTotal - weekData.plannedDaysElapsed);
  const todayIsPlanned = data.day.plannedDaysTotal > 0;
  const effectiveRemainingDays = remainingDaysThisWeek;

  // Build self-competition nudge line
  const getSelfCompetitionLine = (): { text: string; isAhead: boolean } | null => {
    // Priority 1: Historical year-over-year (MeVsMe)
    if (meVsMeEnabled && hasHistoricalData && historicalData) {
      const d = historicalData.delta;
      let deltaValue: number;
      let label: string;

      if (efpModeEnabled) {
        deltaValue = d.prmr / 85;
        label = 'EFP';
      } else {
        deltaValue = d.fpPlus;
        label = 'FP+';
      }

      if (Math.abs(deltaValue) >= 0.1) {
        const formatted = Math.abs(Math.round(deltaValue * 10) / 10);
        const isAhead = deltaValue > 0;
        return {
          text: isAhead
            ? `+${formatted} ${label} vs same week ${comparisonYear}`
            : `${formatted} ${label} behind same week ${comparisonYear}`,
          isAhead,
        };
      }

      // Fall back to other metrics from historical
      if (d.presentations !== 0) {
        const abs = Math.abs(d.presentations);
        return {
          text: d.presentations > 0
            ? `+${abs} presentation${abs !== 1 ? 's' : ''} vs same week ${comparisonYear}`
            : `${abs} presentation${abs !== 1 ? 's' : ''} behind same week ${comparisonYear}`,
          isAhead: d.presentations > 0,
        };
      }
      if (d.doors !== 0) {
        const abs = Math.abs(d.doors);
        return {
          text: d.doors > 0
            ? `+${abs} door${abs !== 1 ? 's' : ''} vs same week ${comparisonYear}`
            : `${abs} door${abs !== 1 ? 's' : ''} behind same week ${comparisonYear}`,
          isAhead: d.doors > 0,
        };
      }
    }

    // Priority 2: Week-over-week self-competition
    if (weeklyData?.hasLastWeek) {
      const d = weeklyData.delta;
      let deltaValue: number;
      let label: string;

      if (efpModeEnabled) {
        deltaValue = d.prmr / 85;
        label = 'EFP';
      } else {
        deltaValue = d.fpPlus;
        label = 'FP+';
      }

      if (Math.abs(deltaValue) >= 0.1) {
        const formatted = Math.abs(Math.round(deltaValue * 10) / 10);
        const isAhead = deltaValue > 0;
        return {
          text: isAhead
            ? `+${formatted} ${label} vs last week`
            : `${formatted} ${label} behind last week`,
          isAhead,
        };
      }

      if (d.doors !== 0) {
        const abs = Math.abs(d.doors);
        return {
          text: d.doors > 0
            ? `+${abs} door${abs !== 1 ? 's' : ''} vs last week`
            : `${abs} door${abs !== 1 ? 's' : ''} behind last week`,
          isAhead: d.doors > 0,
        };
      }
    }

    return null;
  };

  const selfComp = getSelfCompetitionLine();

  return (
    <Card className={`p-4 border-border/50 overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Today's Mission</span>
      </div>

      {/* Daily goal - Hero display */}
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-foreground mb-1">
          {formatFP(dailyGoal)} {unitLabel}
        </div>
        <p className="text-sm text-muted-foreground">
          {seasonLabel}
        </p>
      </div>

      {/* Unrealistic pace warning */}
      {isPaceUnrealistic && (
        <div 
          className="bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4 cursor-pointer active:scale-[0.98] transition-transform"
          onClick={() => navigate('/goals')}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning-foreground mb-1">
                Pace looks aggressive
              </p>
              <p className="text-xs text-muted-foreground">
                Selling {formatFP(dailyGoal)}+ per day is tough. Consider planning more work days or adjusting your goal.
              </p>
              <p className="text-xs text-primary font-medium mt-2">
                Tap to adjust your plan →
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Weekly context */}
      {effectiveRemainingDays > 0 && (
        <div className="border-t border-border/30 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This Week</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-foreground">
              {formatFP(weekData.remaining)} {unitLabel}
            </span>
            <span className="text-sm text-muted-foreground">
              over {effectiveRemainingDays} day{effectiveRemainingDays !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Self-competition nudge - always show when available */}
      {selfComp && (
        <div className={`${effectiveRemainingDays > 0 ? 'mt-2' : 'border-t border-border/30 pt-4'}`}>
          <div className="flex items-center gap-1.5">
            {selfComp.isAhead ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
            )}
            <span className={`text-xs font-medium ${selfComp.isAhead ? 'text-green-500' : 'text-destructive'}`}>
              {selfComp.text}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};
