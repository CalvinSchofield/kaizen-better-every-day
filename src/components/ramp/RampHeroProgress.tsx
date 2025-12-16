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
  goalsSetupComplete?: boolean;
}

// Define all REQUIRED trackable items per phase (excludes BONUS items)
const PHASE_ITEMS = {
  1: {
    total: 4, // 2 required videos + goals reviewed (counts as 1) + blitz (counts as 1)
    getCompleted: (watched: string[], repData: RepData | null, goalsSetupComplete: boolean) => {
      let count = 0;
      // Required videos only (not pay-deep-dive bonus)
      if (watched.includes('what-is-blitz')) count++;
      if (watched.includes('how-pay-works')) count++;
      // Goals sections (Why/What/How) - all 3 must be done to count, OR legacy, OR texted leader, OR setup complete
      const whyReviewed = watched.includes('phase1-goals-why');
      const whatReviewed = watched.includes('phase1-goals-what');
      const howReviewed = watched.includes('phase1-goals-how');
      const allGoalsSectionsReviewed = whyReviewed && whatReviewed && howReviewed;
      // Goals (reviewed via all sections, setup complete, or texted leader)
      if (allGoalsSectionsReviewed || watched.includes('phase1-goals-reviewed') || goalsSetupComplete || watched.includes('phase1-goals-texted-leader')) count++;
      // Blitz commitment or opt-out
      const hasBlitz = repData?.committed_blitzes && Array.isArray(repData.committed_blitzes) && repData.committed_blitzes.length > 0;
      if (hasBlitz || watched.includes('phase1-blitz-opted-out')) count++;
      return count;
    }
  },
  2: {
    total: 5, // product, quiz, upgrades, takeover, pitch
    getCompleted: (watched: string[]) => {
      let count = 0;
      if (watched.includes('phase2-product')) count++;
      if (watched.includes('phase2-quiz-passed')) count++;
      if (watched.includes('phase2-upgrades')) count++;
      if (watched.includes('phase2-takeover')) count++;
      if (watched.includes('phase2-pitch-submitted') || watched.includes('phase2-pitches-sent-waiting')) count++;
      return count;
    }
  },
  3: {
    total: 3, // iPad ready, why written, practice scheduled (StreetGenie videos are BONUS)
    getCompleted: (watched: string[]) => {
      let count = 0;
      if (watched.includes('phase3-ipad-ready')) count++;
      if (watched.includes('phase3-why-written')) count++;
      if (watched.includes('phase3-practice-scheduled')) count++;
      return count;
    }
  },
  4: {
    total: 3, // packing, essentials, playbook
    getCompleted: (watched: string[]) => {
      let count = 0;
      if (watched.includes('phase4-packing-done')) count++;
      if (watched.includes('phase4-essentials-checked')) count++;
      if (watched.includes('phase4-playbook-ready')) count++;
      return count;
    }
  }
};

// Motivational messages based on progress
const getMotivationalMessage = (progressPercent: number, daysUntilBlitz: number | null): string => {
  if (progressPercent >= 100) return "You're blitz ready! Let's go crush it.";
  if (progressPercent >= 75) return "Almost there! Keep pushing.";
  if (progressPercent >= 50) return "Halfway done. Keep the momentum!";
  if (progressPercent >= 25) return "Great start! You're building strong.";
  if (daysUntilBlitz !== null && daysUntilBlitz <= 3) return "Blitz is soon! Let's lock in.";
  return "Let's get you blitz ready.";
};

export const RampHeroProgress = ({ phases, activePhase, repData, onPhaseSelect, goalsSetupComplete = false }: RampHeroProgressProps) => {
  const completedCount = phases.filter(p => p.isComplete).length;
  
  // Calculate granular progress based on individual action items
  const { progressPercent, totalItems, completedItems } = useMemo(() => {
    const watched = (repData?.watched_videos as string[]) || [];
    
    let total = 0;
    let completed = 0;
    
    // For each phase, calculate items
    phases.forEach((phase) => {
      const phaseConfig = PHASE_ITEMS[phase.id];
      if (phase.isComplete) {
        // If phase is complete, count all items as done
        total += phaseConfig.total;
        completed += phaseConfig.total;
      } else if (!phase.isLocked) {
        // If phase is active (not locked, not complete), count actual progress
        total += phaseConfig.total;
        if (phase.id === 1) {
          completed += phaseConfig.getCompleted(watched, repData, goalsSetupComplete);
        } else {
          completed += (phaseConfig.getCompleted as (watched: string[]) => number)(watched);
        }
      } else {
        // If phase is locked, just count the total
        total += phaseConfig.total;
      }
    });
    
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { progressPercent: percent, totalItems: total, completedItems: completed };
  }, [phases, repData?.watched_videos, repData?.committed_blitzes, goalsSetupComplete]);
  
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
              {getMotivationalMessage(progressPercent, daysUntilBlitz)}
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
