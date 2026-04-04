import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PhaseData, PhaseId } from "@/pages/RampToBlitz";

interface RampPhaseProgressProps {
  phases: PhaseData[];
  activePhase: PhaseId;
  onPhaseSelect: (phase: PhaseId) => void;
}

export const RampPhaseProgress = ({ phases, activePhase, onPhaseSelect }: RampPhaseProgressProps) => {
  return (
    <div className="space-y-3">
      {/* Phase Dots */}
      <div className="flex items-center justify-between">
        {phases.map((phase, index) => (
          <div key={phase.id} className="flex items-center flex-1">
            {/* Phase Circle */}
            <button
              onClick={() => !phase.isLocked && onPhaseSelect(phase.id)}
              disabled={phase.isLocked}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                "border-2 text-sm font-semibold",
                phase.isComplete && "bg-primary border-primary text-primary-foreground",
                !phase.isComplete && !phase.isLocked && phase.id === activePhase && "border-primary bg-primary/10 text-primary",
                !phase.isComplete && !phase.isLocked && phase.id !== activePhase && "border-border bg-background text-muted-foreground hover:border-primary/50",
                phase.isLocked && "border-border/50 bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              {phase.isComplete ? (
                <Check className="w-5 h-5" />
              ) : phase.isLocked ? (
                <Lock className="w-4 h-4" />
              ) : (
                phase.id
              )}
            </button>
            
            {/* Connector Line */}
            {index < phases.length - 1 && (
              <div 
                className={cn(
                  "flex-1 h-0.5 mx-2 transition-colors duration-300",
                  phase.isComplete ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Active Phase Title */}
      <div className="text-center">
        <h2 className="text-lg font-semibold">
          Phase {activePhase}: {phases.find(p => p.id === activePhase)?.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {phases.find(p => p.id === activePhase)?.subtitle}
        </p>
      </div>
    </div>
  );
};
