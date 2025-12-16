import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useRepData } from "@/hooks/useRepData";
import { useRepGoals } from "@/hooks/useRepGoals";
import { useHeader } from "@/contexts/HeaderContext";
import { RampPhaseProgress } from "@/components/ramp/RampPhaseProgress";
import { RampPhaseContent } from "@/components/ramp/RampPhaseContent";
import { TakeoverPitchGuide } from "@/components/training/TakeoverPitchGuide";
import { UpgradePitchGuide } from "@/components/training/UpgradePitchGuide";

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

  useEffect(() => {
    setCustomTitle("Ramp to Blitz");
    return () => {
      setCustomTitle(null);
    };
  }, [setCustomTitle]);

  // Check if user is a vet or sophomore - they can navigate freely without blockers
  const isVetOrSophomore = repData?.year === 'Vet' || repData?.year === 'Sophomore';

  // Phase 1 completion is currently driven by in-app tasks (videos, goals set, blitz committed).
  // If leaders also mark ramp_phase_1_complete, that still counts.
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
  const phase1AutoComplete =
    requiredPhase1VideosWatched && goalsSetupComplete && hasCommittedBlitz;

  const phase1Complete = (repData?.ramp_phase_1_complete ?? false) || phase1AutoComplete;

  // Determine phase completion and lock status
  // Vets and sophomores can access all phases without blockers
  const phases: PhaseData[] = [
    {
      id: 1,
      title: "Set Goals",
      subtitle: "Onboard and get ready",
      isComplete: phase1Complete,
      isLocked: false, // Phase 1 is never locked
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

  // Auto-select the current active phase (first incomplete, unlocked phase)
  useEffect(() => {
    const currentPhase = phases.find((p) => !p.isComplete && !p.isLocked);
    if (currentPhase) {
      setActivePhase(currentPhase.id);
    } else if (phases.every((p) => p.isComplete)) {
      // All complete, show phase 4
      setActivePhase(4);
    }
  }, [
    phase1Complete,
    repData?.ramp_phase_2_complete,
    repData?.ramp_phase_3_complete,
    repData?.ramp_phase_4_complete,
  ]);

  const currentPhase = phases.find(p => p.id === activePhase)!;
  const completedCount = phases.filter(p => p.isComplete).length;

  // Handle pitch guide display
  if (activePitchGuide === "takeover") {
    return <TakeoverPitchGuide onBack={() => setActivePitchGuide(null)} />;
  }
  if (activePitchGuide === "upgrade") {
    return <UpgradePitchGuide onBack={() => setActivePitchGuide(null)} />;
  }

  return (
    <div className="min-h-screen bg-background pt-[max(0.5rem,env(safe-area-inset-top))]">
      {/* Back Button Header */}
      <div className="px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 -ml-2">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      {/* Progress Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <RampPhaseProgress
            phases={phases} 
            activePhase={activePhase} 
            onPhaseSelect={setActivePhase} 
          />
        </div>
      </div>

      {/* Phase Content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <RampPhaseContent 
          phase={currentPhase}
          repData={repData}
          onOpenPitchGuide={setActivePitchGuide}
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
          
          <span className="text-sm text-muted-foreground">
            {completedCount}/4 Complete
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
    </div>
  );
};

export default RampToBlitz;
