import { cn } from "@/lib/utils";
import { Target, TrendingUp, AlertTriangle, XCircle, HelpCircle, Users, ChevronDown, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { TeamBaseline } from "@/utils/baselineCalculations";
import { GoalPaceResult, isPreseason } from "@/utils/goalPaceCalculations";
import { getFirstName } from "@/components/mygroup/recruit-detail/utils";

export interface TeamGoalStatus {
  onPace: string[];      // Rep names on pace
  atRisk: string[];      // Rep names at risk
  behind: string[];      // Rep names behind
  noGoals: string[];     // Rep names with no goals configured
}

export interface TeamGoalStatusWithDetails {
  onPace: GoalPaceResult[];
  atRisk: GoalPaceResult[];
  behind: GoalPaceResult[];
  noGoals: GoalPaceResult[];
}

interface TeamGoalSummaryProps {
  status: TeamGoalStatus;
  statusDetails?: TeamGoalStatusWithDetails; // Enhanced data for tier breakdown
  baseline?: TeamBaseline;
  isLiveView?: boolean; // True for "today" view - shows daily goals
  className?: string;
}

interface TierBreakdown {
  tierName: string;
  tierColor: string;
  onPace: number;
  atRisk: number;
  behind: number;
  reps: { name: string; status: string; progress: number; goal: number; percent: number }[];
}

export const TeamGoalSummary = ({ status, statusDetails, baseline, isLiveView, className }: TeamGoalSummaryProps) => {
  const [expandedSection, setExpandedSection] = useState<keyof TeamGoalStatus | null>(null);
  const [showBaselineDetails, setShowBaselineDetails] = useState(false);
  const [showTierBreakdown, setShowTierBreakdown] = useState(false);

  const inPreseason = isPreseason();
  const totalReps = status.onPace.length + status.atRisk.length + status.behind.length + status.noGoals.length;
  
  if (totalReps === 0 && !baseline) {
    return null;
  }

  // Calculate tier breakdown from statusDetails
  const getTierBreakdowns = (): TierBreakdown[] => {
    if (!statusDetails) return [];

    const allResults = [
      ...statusDetails.onPace,
      ...statusDetails.atRisk,
      ...statusDetails.behind,
    ];

    // For live view, show "Daily Goal" instead of "Preseason"
    if (isLiveView) {
      return [{
        tierName: 'Daily Goal',
        tierColor: 'border-primary',
        onPace: statusDetails.onPace.length,
        atRisk: statusDetails.atRisk.length,
        behind: statusDetails.behind.length,
        reps: allResults.map(r => ({
          name: r.name,
          status: r.status,
          progress: r.currentProgress,
          goal: r.activeGoal,
          percent: r.percentOfExpected,
        })),
      }];
    }

    if (inPreseason) {
      // During preseason, all reps are on preseason goals
      return [{
        tierName: 'Preseason',
        tierColor: 'border-blue-400',
        onPace: statusDetails.onPace.length,
        atRisk: statusDetails.atRisk.length,
        behind: statusDetails.behind.length,
        reps: allResults.map(r => ({
          name: r.name,
          status: r.status,
          progress: r.currentProgress,
          goal: r.activeGoal,
          percent: r.percentOfExpected,
        })),
      }];
    }

    // During summer, group by focus_tier (Must Do, Will Do, Could Do)
    const tierConfig = [
      { key: 'mustDo', name: 'Must Do', color: 'border-red-400' },
      { key: 'willDo', name: 'Will Do', color: 'border-blue-400' },
      { key: 'couldDo', name: 'Could Do', color: 'border-green-400' },
    ] as const;

    const breakdowns: TierBreakdown[] = [];

    for (const tier of tierConfig) {
      const tierOnPace = statusDetails.onPace.filter(r => r.focusTier === tier.key);
      const tierAtRisk = statusDetails.atRisk.filter(r => r.focusTier === tier.key);
      const tierBehind = statusDetails.behind.filter(r => r.focusTier === tier.key);
      const tierReps = [...tierOnPace, ...tierAtRisk, ...tierBehind];

      if (tierReps.length > 0) {
        breakdowns.push({
          tierName: tier.name,
          tierColor: tier.color,
          onPace: tierOnPace.length,
          atRisk: tierAtRisk.length,
          behind: tierBehind.length,
          reps: tierReps.map(r => ({
            name: r.name,
            status: r.status,
            progress: r.currentProgress,
            goal: r.activeGoal,
            percent: r.percentOfExpected,
          })),
        });
      }
    }

    return breakdowns;
  };

  const tierBreakdowns = getTierBreakdowns();

  const sections = [
    {
      key: 'onPace' as const,
      label: 'On Pace',
      count: status.onPace.length,
      names: status.onPace,
      details: statusDetails?.onPace,
      icon: <TrendingUp className="w-3 h-3" />,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500/10 border-green-500/30',
    },
    {
      key: 'atRisk' as const,
      label: 'At Risk',
      count: status.atRisk.length,
      names: status.atRisk,
      details: statusDetails?.atRisk,
      icon: <AlertTriangle className="w-3 h-3" />,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-500/10 border-yellow-500/30',
    },
    {
      key: 'behind' as const,
      label: 'Behind',
      count: status.behind.length,
      names: status.behind,
      details: statusDetails?.behind,
      icon: <XCircle className="w-3 h-3" />,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-500/10 border-red-500/30',
    },
    {
      key: 'noGoals' as const,
      label: 'No Goals',
      count: status.noGoals.length,
      names: status.noGoals,
      details: statusDetails?.noGoals,
      icon: <HelpCircle className="w-3 h-3" />,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50 border-muted',
    },
  ].filter(s => s.count > 0);

  const toggleSection = (key: keyof TeamGoalStatus) => {
    setExpandedSection(expandedSection === key ? null : key);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Goal Pace Section */}
      {sections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Goal Pace</span>
            </div>
            {statusDetails && tierBreakdowns.length > 0 && (
              <button
                onClick={() => setShowTierBreakdown(!showTierBreakdown)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Layers className="w-3 h-3" />
                {showTierBreakdown ? 'Hide' : 'Show'} Breakdown
                <ChevronDown className={cn(
                  "w-3 h-3 transition-transform",
                  showTierBreakdown && "rotate-180"
                )} />
              </button>
            )}
          </div>

          {/* Tier Breakdown Panel */}
          {showTierBreakdown && tierBreakdowns.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-3">
              {tierBreakdowns.map((tier, idx) => (
                <div key={idx} className={cn("border-l-2 pl-3", tier.tierColor)}>
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    {tier.tierName}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-2">
                    <div className="bg-green-500/10 rounded p-1.5">
                      <div className="text-sm font-bold text-green-600 dark:text-green-400">{tier.onPace}</div>
                      <div className="text-[10px] text-green-600/70">On Pace</div>
                    </div>
                    <div className="bg-yellow-500/10 rounded p-1.5">
                      <div className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{tier.atRisk}</div>
                      <div className="text-[10px] text-yellow-600/70">At Risk</div>
                    </div>
                    <div className="bg-red-500/10 rounded p-1.5">
                      <div className="text-sm font-bold text-red-600 dark:text-red-400">{tier.behind}</div>
                      <div className="text-[10px] text-red-600/70">Behind</div>
                    </div>
                  </div>
                  {/* Rep details within tier */}
                  <div className="space-y-1">
                    {tier.reps.slice(0, 5).map((rep, repIdx) => (
                      <div key={repIdx} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{getFirstName(rep.name)}</span>
                        <span className={cn(
                          "font-medium",
                          rep.status === 'on_pace' && "text-green-600 dark:text-green-400",
                          rep.status === 'at_risk' && "text-yellow-600 dark:text-yellow-400",
                          rep.status === 'behind' && "text-red-600 dark:text-red-400",
                        )}>
                          {rep.progress.toFixed(1)}/{rep.goal} ({rep.percent.toFixed(0)}%)
                        </span>
                      </div>
                    ))}
                    {tier.reps.length > 5 && (
                      <div className="text-[10px] text-muted-foreground text-center pt-1">
                        +{tier.reps.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {status.noGoals.length > 0 && (
                <div className="text-xs text-muted-foreground pt-1 border-t border-muted">
                  {status.noGoals.length} rep{status.noGoals.length !== 1 ? 's' : ''} without goals set
                </div>
              )}
            </div>
          )}

          {/* Compact badge row */}
          <div className="flex flex-wrap gap-2">
            {sections.map(section => (
              <Badge
                key={section.key}
                variant="outline"
                className={cn(
                  "gap-1.5 cursor-pointer transition-all",
                  section.color,
                  section.bgColor,
                  expandedSection === section.key && "ring-1 ring-offset-1"
                )}
                onClick={() => toggleSection(section.key)}
              >
                {section.icon}
                <span className="font-medium">{section.count}</span>
                <span className="opacity-70">{section.label}</span>
              </Badge>
            ))}
          </div>

          {/* Expanded name list with progress */}
          {expandedSection && (
            <div className="p-2 rounded-lg bg-muted/30 text-sm space-y-1">
              {sections.find(s => s.key === expandedSection)?.details ? (
                // Show detailed progress if available
                sections.find(s => s.key === expandedSection)?.details?.map((rep, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{getFirstName(rep.name)}</span>
                    {rep.activeGoal > 0 && (
                      <span className="text-xs font-medium">
                        {rep.currentProgress.toFixed(1)}/{rep.activeGoal} FP+
                        <span className="text-muted-foreground/60 ml-1">
                          ({rep.percentOfExpected.toFixed(0)}%)
                        </span>
                      </span>
                    )}
                  </div>
                ))
              ) : (
                // Fallback to just names
                <div className="flex flex-wrap gap-1">
                  {sections.find(s => s.key === expandedSection)?.names.map((name, idx) => (
                    <span key={idx} className="text-muted-foreground">
                      {getFirstName(name)}
                      {idx < (sections.find(s => s.key === expandedSection)?.names.length ?? 0) - 1 && ','}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Team Baseline Section */}
      {baseline && baseline.workingTodayCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Team Baseline</span>
            <span className="text-xs text-muted-foreground">
              ({baseline.workingTodayCount} working)
            </span>
          </div>

          <div 
            className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 cursor-pointer"
            onClick={() => setShowBaselineDetails(!showBaselineDetails)}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Expected: {baseline.teamExpectedFPToday.toFixed(1)} FP+ today
                </span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Based on 2-week rolling averages
                </p>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                showBaselineDetails && "rotate-180"
              )} />
            </div>

            {showBaselineDetails && (
              <div className="mt-2 pt-2 border-t border-blue-500/20 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">This week</span>
                  <span className="font-medium">~{baseline.teamExpectedFPThisWeek.toFixed(0)} FP+</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">This month</span>
                  <span className="font-medium">~{baseline.teamExpectedFPThisMonth.toFixed(0)} FP+</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Avg per rep</span>
                  <span className="font-medium">{baseline.avgFPPerWorkingRep.toFixed(1)} FP+/day</span>
                </div>
                {baseline.workingTodayNames.length > 0 && (
                  <div className="pt-1 mt-1 border-t border-blue-500/10">
                    <span className="text-[10px] text-muted-foreground">
                      Working: {baseline.workingTodayNames.map(getFirstName).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
