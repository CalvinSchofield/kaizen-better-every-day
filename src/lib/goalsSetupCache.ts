/**
 * Sticky cache for goals setup completion.
 * 
 * Once a user completes goal setup, we remember it to prevent
 * the setup wizard from ever flashing again - even during hydration
 * when goals data might not be available yet.
 * 
 * This is ONLY used to prevent UI flashes - the actual goals data
 * is still fetched from the server and used when available.
 */

const GOALS_SETUP_KEY_PREFIX = 'goals-setup-complete-';

/**
 * Check if goals setup has ever been completed for a user
 */
export const hasCompletedGoalsSetup = (userId: string | null | undefined): boolean => {
  if (!userId) return false;
  try {
    return localStorage.getItem(`${GOALS_SETUP_KEY_PREFIX}${userId}`) === 'true';
  } catch {
    return false;
  }
};

/**
 * Mark goals setup as complete (call when setup wizard finishes)
 */
export const markGoalsSetupComplete = (userId: string | null | undefined): void => {
  if (!userId) return;
  try {
    localStorage.setItem(`${GOALS_SETUP_KEY_PREFIX}${userId}`, 'true');
  } catch {
    // Ignore storage errors
  }
};

/**
 * Sync the sticky flag with actual goals state (call when goals are loaded)
 * This ensures the sticky flag matches reality
 */
export const syncGoalsSetupFlag = (userId: string | null | undefined, isComplete: boolean): void => {
  if (!userId) return;
  try {
    if (isComplete) {
      localStorage.setItem(`${GOALS_SETUP_KEY_PREFIX}${userId}`, 'true');
    }
    // Note: We don't clear the flag when isComplete is false, because
    // the user might have genuinely completed setup and we just haven't loaded yet.
    // The flag is "sticky" to prevent flashes during hydration.
  } catch {
    // Ignore storage errors
  }
};

/**
 * Clear the goals setup flag (e.g., on logout)
 */
export const clearGoalsSetupFlag = (userId: string): void => {
  try {
    localStorage.removeItem(`${GOALS_SETUP_KEY_PREFIX}${userId}`);
  } catch {
    // Ignore storage errors
  }
};

/**
 * Clear all goals setup flags (for user switching)
 */
export const clearAllGoalsSetupFlags = (): void => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(GOALS_SETUP_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // Ignore storage errors
  }
};
