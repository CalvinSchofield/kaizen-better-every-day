import { Card } from "@/components/ui/card";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
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
  const seasonLabel = 'to stay on track';


  // Weekly context from unified data
  const weekData = data.week;
  const remainingDaysThisWeek = Math.max(0, weekData.plannedDaysTotal - weekData.plannedDaysElapsed);
  const todayIsPlanned = data.day.plannedDaysTotal > 0;
  const effectiveRemainingDays = remainingDaysThisWeek;

  // Build self-competition nudge line
  // Build a candidate nudge from a delta object
  const buildNudge = (
    delta: { fpPlus: number; prmr: number; presentations: number; doors: number },
    suffix: string,
  ): { text: string; isAhead: boolean; deltaValue: number } | null => {
    const label = efpModeEnabled ? 'EFP' : 'FP+';
    const primaryDelta = efpModeEnabled ? delta.prmr / 85 : delta.fpPlus;

    if (Math.abs(primaryDelta) >= 0.1) {
      const formatted = Math.abs(Math.round(primaryDelta * 10) / 10);
      return {
        text: primaryDelta > 0
          ? `+${formatted} ${label} vs ${suffix}`
          : `${formatted} ${label} behind ${suffix}`,
        isAhead: primaryDelta > 0,
        deltaValue: primaryDelta,
      };
    }
    if (delta.presentations !== 0) {
      const abs = Math.abs(delta.presentations);
      return {
        text: delta.presentations > 0
          ? `+${abs} presentation${abs !== 1 ? 's' : ''} vs ${suffix}`
          : `${abs} presentation${abs !== 1 ? 's' : ''} behind ${suffix}`,
        isAhead: delta.presentations > 0,
        deltaValue: delta.presentations,
      };
    }
    if (delta.doors !== 0) {
      const abs = Math.abs(delta.doors);
      return {
        text: delta.doors > 0
          ? `+${abs} door${abs !== 1 ? 's' : ''} vs ${suffix}`
          : `${abs} door${abs !== 1 ? 's' : ''} behind ${suffix}`,
        isAhead: delta.doors > 0,
        deltaValue: delta.doors,
      };
    }
    return null;
  };

  const getSelfCompetitionLine = (): { text: string; isAhead: boolean } | null => {
    const hasYoY = meVsMeEnabled && hasHistoricalData && historicalData;
    const hasWoW = weeklyData?.hasLastWeek;

    const yoyNudge = hasYoY ? buildNudge(historicalData!.delta, `same week ${comparisonYear}`) : null;
    const wowNudge = hasWoW ? buildNudge(weeklyData!.delta, 'last week') : null;

    // Only one available — use it
    if (yoyNudge && !wowNudge) return yoyNudge;
    if (wowNudge && !yoyNudge) return wowNudge;
    if (!yoyNudge && !wowNudge) return null;

    // Both available — coach picks the most motivating
    const yoy = yoyNudge!;
    const wow = wowNudge!;

    // If one is ahead and the other behind → show the positive one (momentum!)
    if (yoy.isAhead && !wow.isAhead) return yoy;
    if (wow.isAhead && !yoy.isAhead) return wow;

    // Both ahead → show the bigger win (celebrate the larger lead)
    if (yoy.isAhead && wow.isAhead) {
      return yoy.deltaValue >= wow.deltaValue ? yoy : wow;
    }

    // Both behind → show the smaller gap (more catchable, less demoralizing)
    return Math.abs(yoy.deltaValue) <= Math.abs(wow.deltaValue) ? yoy : wow;
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


      {/* Weekly context */}
      {effectiveRemainingDays > 0 && weekData.remaining > 0 && (
        <div className="border-t border-border/30 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rest of Week</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-foreground">
              {formatFP(weekData.remaining)} {unitLabel}
            </span>
            <span className="text-sm text-muted-foreground">
              needed over {effectiveRemainingDays} day{effectiveRemainingDays !== 1 ? 's' : ''}
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
