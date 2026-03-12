import { useMemo } from "react";
import { RepData } from "@/hooks/useRepData";

export interface SelfServiceStatus {
  phase1: {
    payReviewed: boolean;
    goalsSetupComplete: boolean;
    blitzCommitted: boolean;
    allComplete: boolean;
  };
  phase2: {
    productStudied: boolean;
    upgradesStudied: boolean;
    takeoverStudied: boolean;
    pitchSubmitted: boolean;
    allComplete: boolean;
  };
  phase3: {
    ipadReady: boolean;
    practiceScheduled: boolean;
    allComplete: boolean;
  };
  phase4: {
    packingDone: boolean;
    essentialsChecked: boolean;
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

    // Phase 1: pay reviewed + goals + blitz committed
    const payReviewed = watchedVideoIds.includes('how-pay-works') || watchedVideoIds.includes('phase1-pay-reviewed');
    const phase1 = {
      payReviewed,
      goalsSetupComplete,
      blitzCommitted: hasCommittedBlitz,
      allComplete: payReviewed && goalsSetupComplete && hasCommittedBlitz,
    };

    // Phase 2: product, upgrades, takeover, pitch
    const phase2 = {
      productStudied: watchedVideoIds.includes("phase2-product"),
      upgradesStudied: watchedVideoIds.includes("phase2-upgrades"),
      takeoverStudied: watchedVideoIds.includes("phase2-takeover"),
      pitchSubmitted: watchedVideoIds.includes("phase2-pitch-submitted"),
      allComplete:
        watchedVideoIds.includes("phase2-product") &&
        watchedVideoIds.includes("phase2-upgrades") &&
        watchedVideoIds.includes("phase2-takeover") &&
        watchedVideoIds.includes("phase2-pitch-submitted"),
    };

    // Phase 3: iPad + practice
    const phase3 = {
      ipadReady: watchedVideoIds.includes("phase3-ipad-ready"),
      practiceScheduled: watchedVideoIds.includes("phase3-practice-scheduled"),
      allComplete:
        watchedVideoIds.includes("phase3-ipad-ready") &&
        watchedVideoIds.includes("phase3-practice-scheduled"),
    };

    // Phase 4: packing + essentials
    const phase4 = {
      packingDone: watchedVideoIds.includes("phase4-packing-done"),
      essentialsChecked: watchedVideoIds.includes("phase4-essentials-checked"),
      allComplete:
        watchedVideoIds.includes("phase4-packing-done") &&
        watchedVideoIds.includes("phase4-essentials-checked"),
    };

    return { phase1, phase2, phase3, phase4 };
  }, [repData?.watched_videos, repData?.committed_blitzes, goalsSetupComplete]);
};
