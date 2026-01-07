import { useChallengeWinDetection } from "@/hooks/useChallengeWinDetection";

/**
 * Component that listens for challenge/incentive wins and triggers celebrations.
 * Must be mounted inside a QueryClientProvider.
 */
export const ChallengeWinListener = () => {
  useChallengeWinDetection();
  return null;
};
