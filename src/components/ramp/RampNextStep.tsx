import { ArrowRight, Play, Target, BookOpen, Tablet, PackageCheck, CheckCircle2, Clock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  // Leader verification status
  phase1LeaderVerified?: boolean;
  phase2LeaderVerified?: boolean;
  phase3LeaderVerified?: boolean;
  phase4LeaderVerified?: boolean;
  onScrollToStep: (stepKey: string) => void;
  teamLeaderPhone?: string | null;
}

// Check if self-service items are complete for a phase
// This determines if the user has done THEIR part (not leader verification)
const isSelfServiceComplete = (
  phaseId: PhaseId,
  watchedVideos: string[],
  goalsSetupComplete: boolean,
  hasCommittedBlitz: boolean,
  phase2Progress: RampNextStepProps['phase2Progress'],
  phase3Progress: RampNextStepProps['phase3Progress'],
  phase4Progress: RampNextStepProps['phase4Progress']
): boolean => {
  const requiredVideos = ["what-is-blitz", "how-pay-works"];
  const requiredWatched = requiredVideos.every(v => watchedVideos.includes(v));

  if (phaseId === 1) {
    // Phase 1 self-service: videos, goals reviewed/texted leader, blitz committed/opted out
    const goalsReviewed = watchedVideos.includes('phase1-goals-reviewed') ||
      (watchedVideos.includes('phase1-goals-why') && 
       watchedVideos.includes('phase1-goals-what') && 
       watchedVideos.includes('phase1-goals-how'));
    const hasTextedLeaderGoals = watchedVideos.includes('phase1-goals-texted-leader');
    const hasOptedOutOfBlitz = watchedVideos.includes('phase1-blitz-opted-out');
    
    // Rep's self-service is complete if:
    // - Watched required videos
    // - Goals setup complete OR has reviewed goals and texted leader
    // - Has committed to blitz OR opted out
    const goalsPartDone = goalsSetupComplete || goalsReviewed || hasTextedLeaderGoals;
    const blitzPartDone = hasCommittedBlitz || hasOptedOutOfBlitz;
    
    return requiredWatched && goalsPartDone && blitzPartDone;
  }
  if (phaseId === 2) {
    // Also consider "waiting on leader" as self-service complete
    const pitchesDone = phase2Progress.pitchSubmitted || watchedVideos.includes('phase2-pitches-sent-waiting');
    return phase2Progress.productStudied && 
           phase2Progress.quizPassed && 
           phase2Progress.upgradesStudied && 
           phase2Progress.takeoverStudied && 
           pitchesDone;
  }
  if (phaseId === 3) {
    return phase3Progress.ipadReady && 
           phase3Progress.whyWritten && 
           phase3Progress.practiceScheduled;
  }
  if (phaseId === 4) {
    return phase4Progress.packingDone && 
           phase4Progress.essentialsChecked && 
           phase4Progress.playbookReady;
  }
  return false;
};

// Determine the next step based on progress
const getNextStep = (
  activePhase: PhaseId,
  watchedVideos: string[],
  goalsSetupComplete: boolean,
  hasCommittedBlitz: boolean,
  phase2Progress: RampNextStepProps['phase2Progress'],
  phase3Progress: RampNextStepProps['phase3Progress'],
  phase4Progress: RampNextStepProps['phase4Progress'],
  isPhaseLeaderVerified: boolean
): NextStepInfo | null => {
  
  // If the phase is already leader verified, no next step needed
  if (isPhaseLeaderVerified) {
    return null;
  }
  
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
    
    // Check if user has done their part for goals
    const goalsReviewed = watchedVideos.includes('phase1-goals-reviewed') ||
      (watchedVideos.includes('phase1-goals-why') && 
       watchedVideos.includes('phase1-goals-what') && 
       watchedVideos.includes('phase1-goals-how'));
    const hasTextedLeaderGoals = watchedVideos.includes('phase1-goals-texted-leader');
    const goalsSelfServiceDone = goalsSetupComplete || goalsReviewed || hasTextedLeaderGoals;
    
    if (!goalsSelfServiceDone) {
      return {
        phaseId: 1,
        stepKey: "goals",
        title: "Set your goals with your leader",
        description: "Schedule a goals call to set your targets",
        icon: <Target className="w-5 h-5" />,
        actionLabel: "Review Goals"
      };
    }
    
    const hasOptedOutOfBlitz = watchedVideos.includes('phase1-blitz-opted-out');
    if (!hasCommittedBlitz && !hasOptedOutOfBlitz) {
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
  phase1LeaderVerified = false,
  phase2LeaderVerified = false,
  phase3LeaderVerified = false,
  phase4LeaderVerified = false,
  onScrollToStep,
  teamLeaderPhone
}: RampNextStepProps) => {
  // Check if current phase's self-service is complete
  const selfServiceComplete = isSelfServiceComplete(
    activePhase,
    watchedVideos,
    goalsSetupComplete,
    hasCommittedBlitz,
    phase2Progress,
    phase3Progress,
    phase4Progress
  );

  // Check if current phase is leader verified
  const isLeaderVerified = 
    (activePhase === 1 && phase1LeaderVerified) ||
    (activePhase === 2 && phase2LeaderVerified) ||
    (activePhase === 3 && phase3LeaderVerified) ||
    (activePhase === 4 && phase4LeaderVerified);

  // If self-service complete but not leader verified - show waiting state
  if (selfServiceComplete && !isLeaderVerified) {
    const handleTextLeader = () => {
      if (teamLeaderPhone) {
        window.open(`sms:${teamLeaderPhone}`, "_self");
      } else {
        window.open("sms:", "_self");
      }
    };

    return (
      <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Phase {activePhase} Complete!
          </p>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          You've finished everything in this phase. Your leader will verify and unlock the next phase.
        </p>
        
        <Button 
          onClick={handleTextLeader}
          variant="outline"
          className="w-full rounded-xl gap-2 border-emerald-500/30 hover:bg-emerald-500/10"
        >
          <MessageCircle className="w-4 h-4" />
          Text Your Leader
        </Button>
      </div>
    );
  }

  const nextStep = getNextStep(
    activePhase,
    watchedVideos,
    goalsSetupComplete,
    hasCommittedBlitz,
    phase2Progress,
    phase3Progress,
    phase4Progress,
    isLeaderVerified
  );

  if (!nextStep) {
    // All done in current phase (and verified)
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
