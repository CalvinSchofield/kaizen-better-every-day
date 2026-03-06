import { EXIT_STAGES } from "@/utils/stageConstants";

/**
 * Stages that indicate a rep is no longer active and should be locked out of the app
 * and excluded from leaderboards/competitions.
 */
export const INACTIVE_STAGES = EXIT_STAGES;

/**
 * Check if a rep's stage indicates they are active (not quit/inactive).
 * Returns true if stage is null/undefined (pre-stage) or an active stage.
 */
export const isRepActive = (stage: string | null | undefined): boolean => {
  if (!stage) return true; // No stage = still active (pre-assignment)
  return !INACTIVE_STAGES.some(s => s.toLowerCase() === stage.toLowerCase());
};

/**
 * Filter a reps map to only include active reps.
 * Used by leaderboard hooks to exclude inactive reps.
 */
export const filterActiveReps = <T extends { stage?: string | null }>(
  repsMap: Map<string, T>
): Map<string, T> => {
  const filtered = new Map<string, T>();
  repsMap.forEach((value, key) => {
    if (isRepActive(value.stage)) {
      filtered.set(key, value);
    }
  });
  return filtered;
};
