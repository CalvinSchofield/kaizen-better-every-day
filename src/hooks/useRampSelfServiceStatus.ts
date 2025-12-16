import { useMemo } from "react";
import { RepData } from "@/hooks/useRepData";

export interface SelfServiceStatus {
  phase1: {
    videosWatched: boolean;
    goalsSetupComplete: boolean;
    blitzCommitted: boolean;
    allComplete: boolean;
  };
  phase2: {
    productStudied: boolean;
    quizPassed: boolean;
    upgradesStudied: boolean;
    takeoverStudied: boolean;
    pitchSubmitted: boolean;
    allComplete: boolean;
  };
  phase3: {
    ipadReady: boolean;
    whyWritten: boolean;
    practiceScheduled: boolean;
    allComplete: boolean;
  };
  phase4: {
    packingDone: boolean;
    essentialsChecked: boolean;
    playbookReady: boolean;
    allComplete: boolean;
  };
}

interface UseRampSelfServiceStatusProps {
  repData: RepData | null;
  goalsSetupComplete: boolean;
}

export const useRampSelfServiceStatus = ({
  repData,
  goalsSetupComplete,
}: UseRampSelfServiceStatusProps): SelfServiceStatus => {
  return useMemo(() => {
    const watchedVideoIds = Array.isArray(repData?.watched_videos)
      ? (repData!.watched_videos as string[])
      : [];

    const hasCommittedBlitz =
      Array.isArray(repData?.committed_blitzes) &&
      (repData!.committed_blitzes as unknown[]).length > 0;

    // Phase 1: videos + goals + blitz committed
    const phase1VideosWatched = ["what-is-blitz", "how-pay-works"].every((id) =>
      watchedVideoIds.includes(id)
    );
    const phase1 = {
      videosWatched: phase1VideosWatched,
      goalsSetupComplete,
      blitzCommitted: hasCommittedBlitz,
      allComplete: phase1VideosWatched && goalsSetupComplete && hasCommittedBlitz,
    };

    // Phase 2: all training content
    const phase2 = {
      productStudied: watchedVideoIds.includes("phase2-product"),
      quizPassed: watchedVideoIds.includes("phase2-quiz-passed"),
      upgradesStudied: watchedVideoIds.includes("phase2-upgrades"),
      takeoverStudied: watchedVideoIds.includes("phase2-takeover"),
      pitchSubmitted: watchedVideoIds.includes("phase2-pitch-submitted"),
      allComplete:
        watchedVideoIds.includes("phase2-product") &&
        watchedVideoIds.includes("phase2-quiz-passed") &&
        watchedVideoIds.includes("phase2-upgrades") &&
        watchedVideoIds.includes("phase2-takeover") &&
        watchedVideoIds.includes("phase2-pitch-submitted"),
    };

    // Phase 3: iPad + why + practice
    const phase3 = {
      ipadReady: watchedVideoIds.includes("phase3-ipad-ready"),
      whyWritten: watchedVideoIds.includes("phase3-why-written"),
      practiceScheduled: watchedVideoIds.includes("phase3-practice-scheduled"),
      allComplete:
        watchedVideoIds.includes("phase3-ipad-ready") &&
        watchedVideoIds.includes("phase3-why-written") &&
        watchedVideoIds.includes("phase3-practice-scheduled"),
    };

    // Phase 4: packing + essentials + playbook
    const phase4 = {
      packingDone: watchedVideoIds.includes("phase4-packing-done"),
      essentialsChecked: watchedVideoIds.includes("phase4-essentials-checked"),
      playbookReady: watchedVideoIds.includes("phase4-playbook-ready"),
      allComplete:
        watchedVideoIds.includes("phase4-packing-done") &&
        watchedVideoIds.includes("phase4-essentials-checked") &&
        watchedVideoIds.includes("phase4-playbook-ready"),
    };

    return { phase1, phase2, phase3, phase4 };
  }, [repData?.watched_videos, repData?.committed_blitzes, goalsSetupComplete]);
};
