import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const CACHE_KEY = 'kaizen-app-cache';

export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: CACHE_KEY,
});

// Helper to clear the persisted cache (used during logout or force refresh)
export const clearPersistedCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
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
