import { ArrowRight, Play, Target, BookOpen, Tablet, PackageCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PhaseId } from "@/pages/RampToBlitz";

interface NextStepInfo {
  phaseId: PhaseId;
  stepKey: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  actionLabel: string;
}

interface RampNextStepProps {
  activePhase: PhaseId;
  watchedVideos: string[];
  goalsSetupComplete: boolean;
  hasCommittedBlitz: boolean;
  phase2Progress: {
    productStudied: boolean;
    quizPassed: boolean;
    upgradesStudied: boolean;
    takeoverStudied: boolean;
    pitchSubmitted: boolean;
  };
  phase3Progress: {
    ipadReady: boolean;
    whyWritten: boolean;
    practiceScheduled: boolean;
  };
  phase4Progress: {
    packingDone: boolean;
    essentialsChecked: boolean;
    playbookReady: boolean;
  };
  onScrollToStep: (stepKey: string) => void;
}

// Determine the next step based on progress
const getNextStep = (
  activePhase: PhaseId,
  watchedVideos: string[],
  goalsSetupComplete: boolean,
  hasCommittedBlitz: boolean,
  phase2Progress: RampNextStepProps['phase2Progress'],
  phase3Progress: RampNextStepProps['phase3Progress'],
  phase4Progress: RampNextStepProps['phase4Progress']
): NextStepInfo | null => {
  
  // Phase 1 steps
  if (activePhase === 1) {
    const requiredVideos = ["what-is-blitz", "how-pay-works"];
    const requiredWatched = requiredVideos.every(v => watchedVideos.includes(v));
    
    if (!requiredWatched) {
      return {
        phaseId: 1,
        stepKey: "videos",
        title: "Watch the intro videos",
        description: "Learn what blitzes are and how you get paid",
        icon: <Play className="w-5 h-5" />,
        actionLabel: "Watch Now"
      };
    }
    
    if (!goalsSetupComplete) {
      return {
        phaseId: 1,
        stepKey: "goals",
        title: "Set your goals with your leader",
        description: "Schedule a goals call to set your targets",
        icon: <Target className="w-5 h-5" />,
        actionLabel: "Review Goals"
      };
    }
    
    if (!hasCommittedBlitz) {
      return {
        phaseId: 1,
        stepKey: "blitz",
        title: "Commit to your first blitz",
        description: "Pick a blitz trip to get on the doors",
        icon: <Target className="w-5 h-5" />,
        actionLabel: "Choose Blitz"
      };
    }
  }
  
  // Phase 2 steps
  if (activePhase === 2) {
    if (!phase2Progress.productStudied) {
      return {
        phaseId: 2,
        stepKey: "product",
        title: "Study the Vivint products",
        description: "Learn what you'll be selling on the doors",
        icon: <BookOpen className="w-5 h-5" />,
        actionLabel: "Start Learning"
      };
    }
    if (!phase2Progress.quizPassed) {
      return {
        phaseId: 2,
        stepKey: "quiz",
        title: "Take the product quiz",
        description: "Test your knowledge before moving on",
        icon: <Target className="w-5 h-5" />,
        actionLabel: "Take Quiz"
      };
    }
    if (!phase2Progress.upgradesStudied) {
      return {
        phaseId: 2,
        stepKey: "upgrades",
        title: "Learn about upgrades",
        description: "Fastest path to your first commission",
        icon: <BookOpen className="w-5 h-5" />,
        actionLabel: "Learn Upgrades"
      };
    }
    if (!phase2Progress.takeoverStudied) {
      return {
        phaseId: 2,
        stepKey: "takeover",
        title: "Master the takeover approach",
        description: "Handle existing system homes like a pro",
        icon: <BookOpen className="w-5 h-5" />,
        actionLabel: "Learn Approach"
      };
    }
    if (!phase2Progress.pitchSubmitted) {
      return {
        phaseId: 2,
        stepKey: "pitch",
        title: "Submit your pitch recording",
        description: "Record and send your pitch for feedback",
        icon: <Target className="w-5 h-5" />,
        actionLabel: "Submit Pitch"
      };
    }
  }
  
  // Phase 3 steps
  if (activePhase === 3) {
    if (!phase3Progress.ipadReady) {
      return {
        phaseId: 3,
        stepKey: "ipad",
        title: "Set up your iPad",
        description: "Get your selling tools ready",
        icon: <Tablet className="w-5 h-5" />,
        actionLabel: "Set Up iPad"
      };
    }
    if (!phase3Progress.whyWritten) {
      return {
        phaseId: 3,
        stepKey: "why",
        title: "Write your 'Why'",
        description: "Define your purpose for the blitz",
        icon: <Target className="w-5 h-5" />,
        actionLabel: "Write Why"
      };
    }
    if (!phase3Progress.practiceScheduled) {
      return {
        phaseId: 3,
        stepKey: "practice",
        title: "Schedule pitch practice",
        description: "1-on-1 practice with a vet or leader",
        icon: <Target className="w-5 h-5" />,
        actionLabel: "Schedule"
      };
    }
  }
  
  // Phase 4 steps
  if (activePhase === 4) {
    if (!phase4Progress.packingDone) {
      return {
        phaseId: 4,
        stepKey: "packing",
        title: "Pack your bags",
        description: "Everything you need for the trip",
        icon: <PackageCheck className="w-5 h-5" />,
        actionLabel: "View List"
      };
    }
    if (!phase4Progress.essentialsChecked) {
      return {
        phaseId: 4,
        stepKey: "essentials",
        title: "Check your essentials",
        description: "Triple-check your must-haves",
        icon: <Tablet className="w-5 h-5" />,
        actionLabel: "Check Items"
      };
    }
    if (!phase4Progress.playbookReady) {
      return {
        phaseId: 4,
        stepKey: "playbook",
        title: "Review the tough-times playbook",
        description: "Be ready for anything",
        icon: <BookOpen className="w-5 h-5" />,
        actionLabel: "Read Playbook"
      };
    }
  }
  
  return null;
};

export const RampNextStep = ({
  activePhase,
  watchedVideos,
  goalsSetupComplete,
  hasCommittedBlitz,
  phase2Progress,
  phase3Progress,
  phase4Progress,
  onScrollToStep
}: RampNextStepProps) => {
  const nextStep = getNextStep(
    activePhase,
    watchedVideos,
    goalsSetupComplete,
    hasCommittedBlitz,
    phase2Progress,
    phase3Progress,
    phase4Progress
  );

  if (!nextStep) {
    // All done in current phase
    return (
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-green-700 dark:text-green-400">Phase complete!</p>
            <p className="text-sm text-muted-foreground">
              Great work. Move to the next phase to continue.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-5">
      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
        Your Next Step
      </p>
      
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0 text-primary">
          {nextStep.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">{nextStep.title}</p>
          <p className="text-sm text-muted-foreground">{nextStep.description}</p>
        </div>
        
        <Button 
          onClick={() => onScrollToStep(nextStep.stepKey)}
          className="shrink-0 rounded-xl gap-2"
        >
          {nextStep.actionLabel}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
