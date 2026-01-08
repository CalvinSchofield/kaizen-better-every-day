import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useRepData } from "@/hooks/useRepData";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useHeader } from "@/contexts/HeaderContext";
import { RampHeroProgress } from "@/components/ramp/RampHeroProgress";
import { RampNextStep } from "@/components/ramp/RampNextStep";
import { RampPhaseContent } from "@/components/ramp/RampPhaseContent";
import { TakeoverPitchGuide } from "@/components/training/TakeoverPitchGuide";
import { UpgradePitchGuide } from "@/components/training/UpgradePitchGuide";
import { EdgeSwipeContainer } from "@/components/EdgeSwipeContainer";
import confetti from "canvas-confetti";
export type PhaseId = 1 | 2 | 3 | 4;
export type PitchGuideType = "takeover" | "upgrade" | null;

export interface PhaseData {
  id: PhaseId;
  title: string;
  subtitle: string;
  isComplete: boolean;
  isLocked: boolean;
}

const RampToBlitz = () => {
  const navigate = useNavigate();
  const { repData } = useRepData();
  const { goals } = useRepGoals();
  const { setCustomTitle } = useHeader();
  const [activePhase, setActivePhase] = useState<PhaseId>(1);
  const [activePitchGuide, setActivePitchGuide] = useState<PitchGuideType>(null);
  const [scrollToStepKey, setScrollToStepKey] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevCompletedPhasesRef = useRef<number>(0);

  useEffect(() => {
    setCustomTitle("Ramp to Blitz");
    return () => {
      setCustomTitle(null);
    };
  }, [setCustomTitle]);

  // Check if user is a vet or sophomore - they can navigate freely without blockers
  const isVetOrSophomore = repData?.year === 'Vet' || repData?.year === 'Sophomore';

  // Phase 1 completion - ALL phases require leader verification (no auto-complete)
  const watchedVideoIds = Array.isArray(repData?.watched_videos)
    ? (repData!.watched_videos as string[])
    : [];

  const requiredPhase1VideosWatched = ["what-is-blitz", "how-pay-works"].every((id) =>
    watchedVideoIds.includes(id)
  );

  const hasCommittedBlitz =
    Array.isArray(repData?.committed_blitzes) &&
    (repData!.committed_blitzes as unknown[]).length > 0;

  const goalsSetupComplete = goals?.setup_complete === true;
  
  // Leader verification is required for all phases - no auto-complete
  const phase1Complete = repData?.ramp_phase_1_complete ?? false;

  // Phase 2-4 progress tracking
  const phase2Progress = {
    productStudied: watchedVideoIds.includes('phase2-product'),
    quizPassed: watchedVideoIds.includes('phase2-quiz-passed'),
    upgradesStudied: watchedVideoIds.includes('phase2-upgrades'),
    takeoverStudied: watchedVideoIds.includes('phase2-takeover'),
    pitchSubmitted: watchedVideoIds.includes('phase2-pitch-submitted'),
  };

  const phase3Progress = {
    ipadReady: watchedVideoIds.includes('phase3-ipad-ready'),
    whyWritten: watchedVideoIds.includes('phase3-why-written'),
    practiceScheduled: watchedVideoIds.includes('phase3-practice-scheduled'),
  };

  const phase4Progress = {
    packingDone: watchedVideoIds.includes('phase4-packing-done'),
    essentialsChecked: watchedVideoIds.includes('phase4-essentials-checked'),
    playbookReady: watchedVideoIds.includes('phase4-playbook-ready'),
  };

  // Determine phase completion and lock status
  const phases: PhaseData[] = [
    {
      id: 1,
      title: "Set Goals",
      subtitle: "Onboard and get ready",
      isComplete: phase1Complete,
      isLocked: false,
    },
    {
      id: 2,
      title: "Start Trainings",
      subtitle: "Learn the fundamentals",
      isComplete: repData?.ramp_phase_2_complete || false,
      isLocked: isVetOrSophomore ? false : !phase1Complete,
    },
    {
      id: 3,
      title: "Practice",
      subtitle: "Sharpen your skills",
      isComplete: repData?.ramp_phase_3_complete || false,
      isLocked: isVetOrSophomore ? false : !repData?.ramp_phase_2_complete,
    },
    {
      id: 4,
      title: "Saddle Up!",
      subtitle: "Final preparations",
      isComplete: repData?.ramp_phase_4_complete || false,
      isLocked: isVetOrSophomore ? false : !repData?.ramp_phase_3_complete,
    },
  ];

  const completedCount = phases.filter(p => p.isComplete).length;

  // Confetti celebration when a phase completes
  useEffect(() => {
    if (completedCount > prevCompletedPhasesRef.current && completedCount > 0) {
      // A phase just completed - fire confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f97316', '#fb923c', '#fdba74', '#22c55e', '#4ade80']
      });
    }
    prevCompletedPhasesRef.current = completedCount;
  }, [completedCount]);

  // Auto-select the current active phase (first incomplete, unlocked phase)
  useEffect(() => {
    const currentPhase = phases.find((p) => !p.isComplete && !p.isLocked);
    if (currentPhase) {
      setActivePhase(currentPhase.id);
    } else if (phases.every((p) => p.isComplete)) {
      setActivePhase(4);
    }
  }, [
    phase1Complete,
    repData?.ramp_phase_2_complete,
    repData?.ramp_phase_3_complete,
    repData?.ramp_phase_4_complete,
  ]);

  // Clear scrollToStepKey after it's been processed
  const clearScrollToStep = useCallback(() => {
    setScrollToStepKey(null);
  }, []);

  // Handle scroll to specific step
  const handleScrollToStep = useCallback((stepKey: string) => {
    setScrollToStepKey(stepKey);
    // Scroll to content area after a short delay to allow expansion
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  // Handle pitch guide display
  if (activePitchGuide === "takeover") {
    return <TakeoverPitchGuide onBack={() => setActivePitchGuide(null)} />;
  }
  if (activePitchGuide === "upgrade") {
    return <UpgradePitchGuide onBack={() => setActivePitchGuide(null)} />;
  }

  return (
    <EdgeSwipeContainer className="bg-background pt-[max(0.5rem,env(safe-area-inset-top))]">
      {/* Back Button Header */}
      <div className="px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 -ml-2">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      {/* Hero Progress Section */}
      <div className="max-w-lg mx-auto px-4 pb-4">
        <RampHeroProgress
          phases={phases}
          activePhase={activePhase}
          repData={repData}
          onPhaseSelect={setActivePhase}
          goalsSetupComplete={goalsSetupComplete}
        />
      </div>

      {/* Next Step Hero */}
      <div className="max-w-lg mx-auto px-4 pb-4">
        <RampNextStep
          activePhase={activePhase}
          watchedVideos={watchedVideoIds}
          goalsSetupComplete={goalsSetupComplete}
          hasCommittedBlitz={hasCommittedBlitz}
          phase2Progress={phase2Progress}
          phase3Progress={phase3Progress}
          phase4Progress={phase4Progress}
          phase1LeaderVerified={repData?.ramp_phase_1_complete ?? false}
          phase2LeaderVerified={repData?.ramp_phase_2_complete ?? false}
          phase3LeaderVerified={repData?.ramp_phase_3_complete ?? false}
          phase4LeaderVerified={repData?.ramp_phase_4_complete ?? false}
          onScrollToStep={handleScrollToStep}
          teamLeaderPhone={repData?.team_leader_phone}
        />
      </div>

      {/* Phase Content */}
      <div ref={contentRef} className="max-w-lg mx-auto px-4 py-4">
        <RampPhaseContent 
          phase={phases.find(p => p.id === activePhase)!}
          repData={repData}
          onOpenPitchGuide={setActivePitchGuide}
          scrollToStepKey={scrollToStepKey}
          onScrollComplete={clearScrollToStep}
        />
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/50 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActivePhase(prev => Math.max(1, prev - 1) as PhaseId)}
            disabled={activePhase === 1}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          <span className="text-sm text-muted-foreground font-medium">
            Phase {activePhase} of 4
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActivePhase(prev => Math.min(4, prev + 1) as PhaseId)}
            disabled={activePhase === 4 || phases[activePhase]?.isLocked}
            className="gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </EdgeSwipeContainer>
  );
};

export default RampToBlitz;
