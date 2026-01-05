import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, AlertTriangle, CheckCircle2, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConstraintResult, LeaderAction } from "@/utils/constraintAnalysis";

interface ReportsExecutiveSnapshotProps {
  // Team Status
  totalFP: number;
  totalPRMR: number;
  activeReps: number;
  expectedReps?: number;
  periodLabel: string;
  
  // Constraint Analysis
  constraint: ConstraintResult;
  
  // Leader Actions
  actions: LeaderAction[];
  
  // Optional comparison
  fpChange?: number;
  
  isLoading?: boolean;
}

export const ReportsExecutiveSnapshot = ({
  totalFP,
  totalPRMR,
  activeReps,
  expectedReps,
  periodLabel,
  constraint,
  actions,
  fpChange,
  isLoading,
}: ReportsExecutiveSnapshotProps) => {
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

  const getFirstName = (name: string) => name.split(' ')[0];

  return (
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

        {/* Primary Metrics Row */}
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

        {/* Reps Count */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{activeReps}</span>
          <span className="text-muted-foreground">
            reps{expectedReps ? ` of ${expectedReps} expected` : ''}
          </span>
        </div>

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
  );
};
