import { useMemo } from "react";
import { Flame, Calendar, Sparkles, Trophy, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays, parseISO } from "date-fns";
import type { PhaseData, PhaseId } from "@/pages/RampToBlitz";
import type { RepData } from "@/hooks/useRepData";

interface RampHeroProgressProps {
  phases: PhaseData[];
  activePhase: PhaseId;
  repData: RepData | null;
  onPhaseSelect: (phase: PhaseId) => void;
}

// Motivational messages based on progress
const getMotivationalMessage = (completedCount: number, daysUntilBlitz: number | null): string => {
  if (completedCount === 4) return "You're blitz ready! Let's go crush it.";
  if (completedCount === 3) return "Almost there! One more phase to go.";
  if (completedCount === 2) return "Halfway done. Keep the momentum!";
  if (completedCount === 1) return "Great start! You're building strong.";
  if (daysUntilBlitz !== null && daysUntilBlitz <= 3) return "Blitz is soon! Let's lock in.";
  return "Let's get you blitz ready.";
};

export const RampHeroProgress = ({ phases, activePhase, repData, onPhaseSelect }: RampHeroProgressProps) => {
  const completedCount = phases.filter(p => p.isComplete).length;
  const progressPercent = (completedCount / 4) * 100;
  
  // Calculate days until blitz
  const daysUntilBlitz = useMemo(() => {
    if (!repData?.blitz_trip_date) return null;
    try {
      const blitzDate = parseISO(repData.blitz_trip_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      blitzDate.setHours(0, 0, 0, 0);
      const days = differenceInDays(blitzDate, today);
      return days >= 0 ? days : null;
    } catch {
      return null;
    }
  }, [repData?.blitz_trip_date]);

  const currentPhase = phases.find(p => p.id === activePhase);
  const allComplete = completedCount === 4;

  // SVG progress ring calculations
  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="relative">
      {/* Main Hero Card */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-primary/5 rounded-3xl p-6 border border-primary/20">
        <div className="flex items-center gap-6">
          {/* Progress Ring */}
          <div className="relative shrink-0">
            <svg width={size} height={size} className="transform -rotate-90">
              {/* Background circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-muted/30"
              />
              {/* Progress circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="text-primary transition-all duration-700 ease-out"
              />
            </svg>
            
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {allComplete ? (
                <Trophy className="w-8 h-8 text-primary mb-1" />
              ) : (
                <>
                  <span className="text-3xl font-bold text-foreground">
                    {Math.round(progressPercent)}%
                  </span>
                  <span className="text-xs text-muted-foreground">ready</span>
                </>
              )}
            </div>
          </div>

          {/* Info Section */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Blitz Countdown */}
            {daysUntilBlitz !== null && (
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                  daysUntilBlitz <= 3 
                    ? "bg-destructive/15 text-destructive" 
                    : daysUntilBlitz <= 7 
                      ? "bg-orange-500/15 text-orange-600"
                      : "bg-primary/15 text-primary"
                )}>
                  <Flame className="w-4 h-4" />
                  {daysUntilBlitz === 0 
                    ? "Blitz is today!" 
                    : daysUntilBlitz === 1 
                      ? "Blitz tomorrow!" 
                      : `${daysUntilBlitz} days to blitz`
                  }
                </div>
              </div>
            )}

            {/* Motivational Message */}
            <p className="text-base font-medium text-foreground">
              {getMotivationalMessage(completedCount, daysUntilBlitz)}
            </p>

            {/* Current Phase Indicator */}
            {!allComplete && currentPhase && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Rocket className="w-4 h-4 text-primary" />
                <span>
                  Now: <span className="text-foreground font-medium">{currentPhase.title}</span>
                </span>
              </div>
            )}

            {allComplete && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <Sparkles className="w-4 h-4" />
                <span className="font-medium">All phases complete!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase Pills */}
      <div className="flex justify-center gap-2 mt-4">
        {phases.map((phase) => (
          <button
            key={phase.id}
            onClick={() => !phase.isLocked && onPhaseSelect(phase.id)}
            disabled={phase.isLocked}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all",
              phase.isComplete && "bg-primary/20 text-primary",
              !phase.isComplete && !phase.isLocked && phase.id === activePhase && "bg-foreground text-background",
              !phase.isComplete && !phase.isLocked && phase.id !== activePhase && "bg-muted/50 text-muted-foreground hover:bg-muted",
              phase.isLocked && "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            {phase.isComplete ? (
              <span className="w-4 h-4 rounded-full bg-primary/30 flex items-center justify-center text-[10px]">✓</span>
            ) : (
              <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px]">{phase.id}</span>
            )}
            <span className="hidden sm:inline">{phase.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
