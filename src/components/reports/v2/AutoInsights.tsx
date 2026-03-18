import { cn } from "@/lib/utils";
import { Lightbulb, TrendingDown, Clock, Target } from "lucide-react";
import { motion } from "framer-motion";
import { ConstraintResult, FunnelStage } from "@/utils/constraintAnalysis";
import { TeamEffortSummary } from "@/utils/effortScore";
import { TeamBaseline } from "@/utils/baselineCalculations";

interface AutoInsightsProps {
  constraint: ConstraintResult;
  effortSummary: TeamEffortSummary;
  skillBottleneck: FunnelStage | null;
  impactPotential: string | null;
  teamBaseline?: TeamBaseline;
  totalFP: number;
  totalDoors: number;
  activeReps: number;
  isLiveView?: boolean;
  isLoading?: boolean;
}

interface InsightCard {
  icon: React.ReactNode;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export const AutoInsights = ({
  constraint, effortSummary, skillBottleneck, impactPotential,
  teamBaseline, totalFP, totalDoors, activeReps, isLiveView, isLoading,
}: AutoInsightsProps) => {
  if (isLoading) return null;

  const insights: InsightCard[] = [];

  // Primary constraint insight
  if (constraint.type !== 'on_track' && constraint.details) {
    insights.push({
      icon: constraint.type === 'effort' 
        ? <Clock className="w-4 h-4" /> 
        : constraint.type === 'skill' 
        ? <Target className="w-4 h-4" /> 
        : <TrendingDown className="w-4 h-4" />,
      message: constraint.details,
      severity: constraint.severity === 'critical' ? 'critical' : 'warning',
    });
  }

  // Baseline comparison insight (live view)
  if (isLiveView && teamBaseline && teamBaseline.teamExpectedFPToday > 0) {
    const expectedFP = teamBaseline.teamExpectedFPToday;
    const pctOfExpected = (totalFP / expectedFP) * 100;
    
    if (pctOfExpected < 70) {
      insights.push({
        icon: <TrendingDown className="w-4 h-4" />,
        message: `Production is ${(100 - pctOfExpected).toFixed(0)}% below the 14-day baseline. Expected ~${expectedFP.toFixed(1)} FP+ from ${teamBaseline.workingTodayCount} reps.`,
        severity: 'warning',
      });
    }
  }

  // Skill bottleneck insight — uses baseline comparison, not hardcoded benchmark
  if (skillBottleneck && !insights.some(i => i.message.includes(skillBottleneck.fromLabel))) {
    const actualPct = (skillBottleneck.rate * 100).toFixed(0);
    const baselinePct = (skillBottleneck.benchmark * 100).toFixed(0);
    insights.push({
      icon: <Target className="w-4 h-4" />,
      message: `${skillBottleneck.fromLabel} → ${skillBottleneck.toLabel} conversion is ${actualPct}% (team baseline: ${baselinePct}%). Consider focused training on this stage.`,
      severity: 'warning',
    });
  }

  // Impact potential
  if (impactPotential) {
    insights.push({
      icon: <Lightbulb className="w-4 h-4" />,
      message: impactPotential,
      severity: 'info',
    });
  }

  // Positive insight if on track
  if (constraint.type === 'on_track' && totalFP > 0) {
    insights.push({
      icon: <Lightbulb className="w-4 h-4" />,
      message: `Team is performing well — effort and skill metrics are within baseline ranges. ${activeReps} reps producing ${totalFP.toFixed(1)} FP+.`,
      severity: 'info',
    });
  }

  if (insights.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground px-1">Insights</h3>
      <div className="space-y-2">
        {insights.slice(0, 3).map((insight, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={cn(
              "rounded-xl border-l-4 px-4 py-3 flex items-start gap-3",
              "bg-card",
              insight.severity === 'critical' && "border-l-destructive",
              insight.severity === 'warning' && "border-l-warning",
              insight.severity === 'info' && "border-l-primary",
            )}
          >
            <div className={cn(
              "mt-0.5 flex-shrink-0",
              insight.severity === 'critical' && "text-destructive",
              insight.severity === 'warning' && "text-warning",
              insight.severity === 'info' && "text-primary",
            )}>
              {insight.icon}
            </div>
            <p className="text-sm text-foreground leading-relaxed">{insight.message}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
