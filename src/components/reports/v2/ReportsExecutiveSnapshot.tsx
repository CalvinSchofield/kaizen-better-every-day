import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, AlertTriangle, CheckCircle2, Target, Zap, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConstraintResult, LeaderAction } from "@/utils/constraintAnalysis";
import { TeamGoalStatus, TeamGoalStatusWithDetails } from "./TeamGoalSummary";
import { TeamBaseline } from "@/utils/baselineCalculations";
import { getFirstName } from "@/components/mygroup/recruit-detail/utils";
import { WorkingRepsDrawer } from "./WorkingRepsDrawer";
import { GoalPaceDrawer } from "./GoalPaceDrawer";
import { FunnelProgressIndicator } from "./FunnelProgressIndicator";
import { GoalPaceResult } from "@/utils/goalPaceCalculations";

interface WorkingRepForDrawer {
  userId: string;
  name: string;
  year?: string;
  timezone?: string;
  workStartTime?: string;
  workEndTime?: string;
  hoursWorked: number;
  doors: number;
  transitions: number;
  presentations: number;
  fp: number;
  prmr: number;
  isWorking: boolean;
}

interface ReportsExecutiveSnapshotProps {
  // Team Status
  totalFP: number;
  totalPRMR: number;
  activeReps: number;
  workingCount?: number;
  workingNames?: string[];
  expectedReps?: number;
  periodLabel: string;
  goalPeriodLabel?: string;
  isLiveView?: boolean;
  
  // Funnel data for zero-state
  funnelData?: {
    doors: number;
    decisionMakers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
  };
  
  // Reps data for drawers
  workingRepsData?: WorkingRepForDrawer[];
  goalPaceResults?: GoalPaceResult[];
  
  // Constraint Analysis
  constraint: ConstraintResult;
  
  // Leader Actions
  actions: LeaderAction[];
  
  // Optional comparison
  fpChange?: number;
  
  // Team goal status
  teamGoalStatus?: TeamGoalStatus;
  teamGoalStatusDetails?: TeamGoalStatusWithDetails;
  
  // Team baseline
  teamBaseline?: TeamBaseline;
  
  isLoading?: boolean;
  
  // Drill-down handler
  onRepClick?: (userId: string) => void;
}

export const ReportsExecutiveSnapshot = ({
  totalFP,
  totalPRMR,
  activeReps,
  workingCount,
  workingNames,
  expectedReps,
  periodLabel,
  goalPeriodLabel,
  isLiveView,
  funnelData,
  workingRepsData,
  goalPaceResults,
  constraint,
  actions,
  fpChange,
  teamGoalStatus,
  teamGoalStatusDetails,
  teamBaseline,
  isLoading,
  onRepClick,
}: ReportsExecutiveSnapshotProps) => {
  const [showWorkingDrawer, setShowWorkingDrawer] = useState(false);
  const [showGoalPaceDrawer, setShowGoalPaceDrawer] = useState(false);

  if (isLoading) {
    return (
      <Card className="p-5 space-y-4">
        <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        <div className="h-12 w-48 bg-muted animate-pulse rounded" />
        <div className="h-16 w-full bg-muted animate-pulse rounded" />
      </Card>
    );
  }

  // Determine overall status color
  const getStatusColor = () => {
    if (constraint.severity === 'critical') return 'destructive';
    if (constraint.severity === 'warning') return 'secondary';
    return 'default';
  };

  const getStatusIcon = () => {
    if (constraint.type === 'on_track') return <CheckCircle2 className="w-4 h-4" />;
    if (constraint.severity === 'critical') return <AlertTriangle className="w-4 h-4" />;
    return <Target className="w-4 h-4" />;
  };

  // Calculate goal status counts for compact display
  const goalCounts = teamGoalStatus ? {
    onPace: teamGoalStatus.onPace.length,
    atRisk: teamGoalStatus.atRisk.length,
    behind: teamGoalStatus.behind.length,
    noGoals: teamGoalStatus.noGoals.length,
  } : null;

  const showZeroState = totalFP === 0 && funnelData && (
    funnelData.doors > 0 || funnelData.transitions > 0 || funnelData.presentations > 0
  );

  return (
    <>
      <Card className="relative overflow-hidden">
        {/* Subtle gradient based on status */}
        <div className={cn(
          "absolute inset-0 opacity-5",
          constraint.type === 'on_track' && "bg-gradient-to-br from-green-500 to-transparent",
          constraint.severity === 'warning' && "bg-gradient-to-br from-yellow-500 to-transparent",
          constraint.severity === 'critical' && "bg-gradient-to-br from-red-500 to-transparent",
        )} />

        <div className="relative p-5 space-y-4">
          {/* Period & Status Row */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{periodLabel}</span>
            <Badge variant={getStatusColor()} className="gap-1">
              {getStatusIcon()}
              {constraint.type === 'on_track' ? 'On Track' : constraint.message}
            </Badge>
          </div>

          {/* Primary Metrics or Zero-State */}
          {showZeroState ? (
            <FunnelProgressIndicator
              doors={funnelData!.doors}
              dms={funnelData!.decisionMakers}
              pitches={funnelData!.pitches}
              transitions={funnelData!.transitions}
              presentations={funnelData!.presentations}
              closes={funnelData!.closes}
            />
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {/* FP+ */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight">{totalFP.toFixed(1)}</span>
                  <span className="text-lg text-muted-foreground">FP+</span>
                </div>
                {fpChange !== undefined && fpChange !== 0 && (
                  <div className={cn(
                    "flex items-center gap-1 text-xs mt-1",
                    fpChange > 0 ? "text-green-600 dark:text-green-400" : "text-orange-500"
                  )}>
                    {fpChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(fpChange).toFixed(1)}% vs last period
                  </div>
                )}
                {/* Show funnel context when FP > 0 */}
                {totalFP > 0 && funnelData && funnelData.transitions > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    from {funnelData.transitions} transitions
                  </div>
                )}
              </div>

              {/* PRMR */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight text-green-700 dark:text-green-500">
                    ${totalPRMR.toLocaleString()}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">Total PRMR</span>
              </div>
            </div>
          )}

          {/* Interactive Working Count */}
          <button 
            className={cn(
              "w-full flex items-center justify-between p-2.5 rounded-lg",
              "bg-muted/30 hover:bg-muted/50 active:scale-[0.99] transition-all",
              "cursor-pointer"
            )}
            onClick={() => setShowWorkingDrawer(true)}
          >
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground" />
              {isLiveView && workingCount !== undefined ? (
                <>
                  <span className="font-medium">{workingCount}</span>
                  <span className="text-muted-foreground">
                    working
                    {workingNames && workingNames.length > 0 && workingNames.length <= 3 && (
                      <span className="ml-1 opacity-70">
                        ({workingNames.map(n => getFirstName(n)).join(', ')})
                      </span>
                    )}
                    {workingNames && workingNames.length > 3 && (
                      <span className="ml-1 opacity-70">
                        ({workingNames.slice(0, 2).map(n => getFirstName(n)).join(', ')} +{workingNames.length - 2})
                      </span>
                    )}
                  </span>
                  <div className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                </>
              ) : (
                <>
                  <span className="font-medium">{activeReps}</span>
                  <span className="text-muted-foreground">
                    reps{expectedReps ? ` of ${expectedReps} expected` : ' worked'}
                  </span>
                </>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Primary Constraint Insight */}
          {constraint.type !== 'on_track' && constraint.details && (
            <div className={cn(
              "p-3 rounded-lg border-l-4",
              constraint.severity === 'critical' && "bg-destructive/10 border-destructive",
              constraint.severity === 'warning' && "bg-yellow-500/10 border-yellow-500",
            )}>
              <p className="text-sm font-medium">{constraint.details}</p>
            </div>
          )}

          {/* Interactive Goal Pace Summary */}
          {goalCounts && (goalCounts.onPace + goalCounts.atRisk + goalCounts.behind > 0) && (
            <button
              className={cn(
                "w-full flex items-center justify-between p-2.5 rounded-lg",
                "bg-muted/30 hover:bg-muted/50 active:scale-[0.99] transition-all",
                "cursor-pointer"
              )}
              onClick={() => setShowGoalPaceDrawer(true)}
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Goal Pace</span>
              </div>
              
              <div className="flex items-center gap-2">
                {goalCounts.onPace > 0 && (
                  <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                    <TrendingUp className="w-3 h-3" />
                    {goalCounts.onPace}
                  </Badge>
                )}
                {goalCounts.atRisk > 0 && (
                  <Badge variant="outline" className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-xs">
                    <AlertTriangle className="w-3 h-3" />
                    {goalCounts.atRisk}
                  </Badge>
                )}
                {goalCounts.behind > 0 && (
                  <Badge variant="outline" className="gap-1 bg-red-500/10 text-red-600 border-red-500/30 text-xs">
                    {goalCounts.behind}
                  </Badge>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          )}

          {/* Leader Actions */}
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
              {actions.slice(0, 4).map((action, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className={cn(
                    "gap-1 cursor-pointer hover:bg-muted transition-colors",
                    action.type === 'accountable' && "border-destructive/50 text-destructive",
                    action.type === 'coach' && "border-yellow-500/50 text-yellow-600 dark:text-yellow-400",
                    action.type === 'train' && "border-blue-500/50 text-blue-600 dark:text-blue-400",
                    action.type === 'praise' && "border-green-500/50 text-green-600 dark:text-green-400",
                  )}
                >
                  <Zap className="w-3 h-3" />
                  {action.label}
                  {action.repNames && action.repNames.length > 0 && (
                    <span className="opacity-70">
                      : {action.repNames.map(getFirstName).join(', ')}
                      {action.count && action.count > 3 && ` +${action.count - 3}`}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Working Reps Drawer */}
      <WorkingRepsDrawer
        open={showWorkingDrawer}
        onOpenChange={setShowWorkingDrawer}
        reps={workingRepsData || []}
        periodLabel={periodLabel}
        isLiveView={isLiveView}
        onRepClick={(userId) => {
          setShowWorkingDrawer(false);
          onRepClick?.(userId);
        }}
      />

      {/* Goal Pace Drawer */}
      <GoalPaceDrawer
        open={showGoalPaceDrawer}
        onOpenChange={setShowGoalPaceDrawer}
        paceResults={goalPaceResults || []}
        periodLabel={goalPeriodLabel || periodLabel}
        isLiveView={isLiveView}
        onRepClick={(userId) => {
          setShowGoalPaceDrawer(false);
          onRepClick?.(userId);
        }}
      />
    </>
  );
};
