import { cn } from "@/lib/utils";
import { Clock, Footprints, Target, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { TeamEffortSummary } from "@/utils/effortScore";
import { FunnelStage } from "@/utils/constraintAnalysis";

interface EffortSkillDiagnosisProps {
  effortSummary: TeamEffortSummary;
  skillBottleneck: FunnelStage | null;
  funnelData: {
    doors: number;
    decisionMakers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
  };
  totalReps: number;
  isLoading?: boolean;
}

const ScoreRing = ({ score, label, color }: { score: number; label: string; color: string }) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32" cy="32" r={radius}
            className="fill-none stroke-muted"
            strokeWidth="5"
          />
          <motion.circle
            cx="32" cy="32" r={radius}
            className={cn("fill-none", color)}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold">{score}</span>
        </div>
      </div>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
};

const DiagnosticItem = ({ label, value, status }: { label: string; value: string; status: 'good' | 'warn' | 'bad' | 'neutral' }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={cn(
      "text-xs font-semibold",
      status === 'good' && "text-green-600 dark:text-green-400",
      status === 'warn' && "text-warning",
      status === 'bad' && "text-destructive",
      status === 'neutral' && "text-foreground",
    )}>{value}</span>
  </div>
);

export const EffortSkillDiagnosis = ({
  effortSummary, skillBottleneck, funnelData, totalReps, isLoading,
}: EffortSkillDiagnosisProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="h-44 bg-muted animate-pulse rounded-xl" />
        <div className="h-44 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  const effortScore = Math.round(effortSummary.avgScore);
  
  // Calculate skill score from conversion rates
  const convRates = [];
  if (funnelData.pitches > 0 && funnelData.transitions > 0)
    convRates.push((funnelData.transitions / funnelData.pitches));
  if (funnelData.transitions > 0 && funnelData.presentations > 0)
    convRates.push((funnelData.presentations / funnelData.transitions));
  if (funnelData.presentations > 0 && funnelData.closes > 0)
    convRates.push((funnelData.closes / funnelData.presentations));
  
  const avgConvRate = convRates.length > 0 ? convRates.reduce((a, b) => a + b, 0) / convRates.length : 0;
  const skillScore = Math.min(100, Math.round(avgConvRate * 200)); // Normalize to 0-100

  const effortColor = effortScore >= 70 ? "stroke-green-500" : effortScore >= 40 ? "stroke-warning" : "stroke-destructive";
  const skillColor = skillScore >= 60 ? "stroke-green-500" : skillScore >= 30 ? "stroke-warning" : "stroke-destructive";

  // Effort diagnostics
  const doorsPerHour = effortSummary.avgDoorsPerHour;
  const needsImprovement = effortSummary.needsImprovementCount;

  // Skill diagnostics
  const pitchToTrans = funnelData.pitches > 0 ? ((funnelData.transitions / funnelData.pitches) * 100).toFixed(0) : '—';
  const transToPres = funnelData.transitions > 0 ? ((funnelData.presentations / funnelData.transitions) * 100).toFixed(0) : '—';
  const presToClose = funnelData.presentations > 0 ? ((funnelData.closes / funnelData.presentations) * 100).toFixed(0) : '—';

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Effort Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-border/50 bg-card p-3.5 space-y-3"
      >
        <div className="flex items-center gap-1.5">
          <Footprints className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Effort</span>
        </div>
        
        <div className="flex justify-center">
          <ScoreRing score={effortScore} label="Score" color={effortColor} />
        </div>

        <div className="space-y-0">
          <DiagnosticItem 
            label="Doors/hr" 
            value={doorsPerHour.toFixed(1)} 
            status={doorsPerHour >= 13 ? 'good' : doorsPerHour >= 10 ? 'warn' : 'bad'} 
          />
          <DiagnosticItem 
            label="Outstanding" 
            value={`${effortSummary.outstandingCount}`} 
            status={effortSummary.outstandingCount > 0 ? 'good' : 'neutral'} 
          />
          <DiagnosticItem 
            label="Needs Work" 
            value={`${needsImprovement}`} 
            status={needsImprovement === 0 ? 'good' : needsImprovement > totalReps * 0.3 ? 'bad' : 'warn'} 
          />
        </div>
      </motion.div>

      {/* Skill Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl border border-border/50 bg-card p-3.5 space-y-3"
      >
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skill</span>
        </div>
        
        <div className="flex justify-center">
          <ScoreRing score={skillScore} label="Score" color={skillColor} />
        </div>

        <div className="space-y-0">
          <DiagnosticItem 
            label="Pitch→Trans" 
            value={`${pitchToTrans}%`} 
            status={Number(pitchToTrans) >= 50 ? 'good' : Number(pitchToTrans) >= 30 ? 'warn' : 'bad'} 
          />
          <DiagnosticItem 
            label="Trans→Pres" 
            value={`${transToPres}%`} 
            status={Number(transToPres) >= 65 ? 'good' : Number(transToPres) >= 40 ? 'warn' : 'bad'} 
          />
          <DiagnosticItem 
            label="Pres→Close" 
            value={`${presToClose}%`} 
            status={Number(presToClose) >= 40 ? 'good' : Number(presToClose) >= 25 ? 'warn' : 'bad'} 
          />
        </div>

        {skillBottleneck && (
          <div className="px-2 py-1.5 rounded-md bg-destructive/5 border border-destructive/20">
            <p className="text-[10px] text-destructive font-medium">
              Gap: {skillBottleneck.fromLabel} → {skillBottleneck.toLabel}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
