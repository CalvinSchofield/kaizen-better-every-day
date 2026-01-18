import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const CACHE_KEY = 'kaizen-app-cache';

export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: CACHE_KEY,
});

// Helper to clear the persisted cache (used during logout or force refresh)
// IMPORTANT: Preserves Track backup keys (track-backup-*) to prevent data loss
export const clearPersistedCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    
    // Clear other app caches but PRESERVE track backups
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Preserve Track backups - these are critical for data recovery
      if (key.startsWith('track-backup-')) continue;
      
      // Clear all other app-specific caches
      if (key.startsWith('rep-data-cache') || 
          key.startsWith('rep-goals-cache') ||  // Goals cache - critical for pace calculations
          key.startsWith('preseason-fp-cache') ||  // Preseason FP cache - critical for Goals page
          key.startsWith('ytd-prmr-cache') ||  // YTD PRMR cache
          key.startsWith('cumulative-fp-cache') ||  // Cumulative FP cache for charts
          key.startsWith('competitors-cache') ||
          key.startsWith('blitzes-cache') ||
          key.startsWith('team-access-cache') ||
          key.startsWith('season-config-cache') ||
          key.startsWith('group-recruits-cache') ||
          key.startsWith('kaizen-layout-state') ||
          key.startsWith('kaizen-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // Ignore storage errors
  }
};

// Cache layout state for instant rendering without flash
const LAYOUT_STATE_KEY = 'kaizen-layout-state';

export interface CachedLayoutState {
  year: string | null;
  isLeader: boolean;
  isKnockingMode: boolean;
  timestamp: number;
}

export const getCachedLayoutState = (): CachedLayoutState | null => {
  try {
    const cached = localStorage.getItem(LAYOUT_STATE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    // Use cache if less than 30 minutes old
    if (Date.now() - parsed.timestamp > 30 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const setCachedLayoutState = (state: Omit<CachedLayoutState, 'timestamp'>) => {
  try {
    localStorage.setItem(LAYOUT_STATE_KEY, JSON.stringify({
      ...state,
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore storage errors
  }
};

export const clearCachedLayoutState = () => {
  try {
    localStorage.removeItem(LAYOUT_STATE_KEY);
  } catch {
    // Ignore
  }
};
