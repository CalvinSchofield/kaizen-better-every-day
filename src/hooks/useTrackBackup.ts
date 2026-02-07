import { useEffect, useCallback, useRef } from 'react';
import { DailyEntry } from './useDailyEntry';

const BACKUP_KEY_PREFIX = 'track-backup-';

interface BackupData {
  entry: Partial<DailyEntry>;
  timestamp: string;
  userId: string;
  lastServerSync?: string; // When we last confirmed server data
}

/**
 * SYNCHRONOUS backup reader for React Query initialData
 * Must be callable before hooks render to prevent zeros flash
 */
export const getInstantBackup = (userId: string | null, entryDate: string): Partial<DailyEntry> | null => {
  if (!userId) return null;
  
  try {
    const key = `${BACKUP_KEY_PREFIX}${userId}-${entryDate}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const backup: BackupData = JSON.parse(stored);
    
    // Verify user match
    if (backup.userId !== userId) return null;
    
    // Check if backup is recent (within 24 hours)
    const backupTime = new Date(backup.timestamp);
    const hoursDiff = (Date.now() - backupTime.getTime()) / (1000 * 60 * 60);
    if (hoursDiff > 24) return null;
    
    return backup.entry;
  } catch {
    return null;
  }
};

/**
 * Smart merge helper - takes HIGHER value for each counter
 * This prevents data loss when merging backup with server/cache
 */
export const smartMergeEntries = (
  primary: Partial<DailyEntry> | null,
  backup: Partial<DailyEntry> | null
): Partial<DailyEntry> => {
  const counterFields = [
    'doors_knocked', 
    'decision_makers', 
    'pitches', 
    'transitions', 
    'presentations', 
    'closes'
  ] as const;
  
  const result: Partial<DailyEntry> = {
    ...backup,
    ...primary,
  };
  
  // For counters, always take the HIGHER value
  for (const field of counterFields) {
    const primaryVal = (primary?.[field] as number) || 0;
    const backupVal = (backup?.[field] as number) || 0;
    (result as any)[field] = Math.max(primaryVal, backupVal);
  }
  
  // For timestamps, merge arrays (deduplicate by value)
  const primaryTimestamps = primary?.counter_timestamps || {};
  const backupTimestamps = backup?.counter_timestamps || {};
  const mergedTimestamps: Record<string, string[]> = {};
  
  const allFields = new Set([...Object.keys(primaryTimestamps), ...Object.keys(backupTimestamps)]);
  for (const field of allFields) {
    const primaryArr = primaryTimestamps[field] || [];
    const backupArr = backupTimestamps[field] || [];
    mergedTimestamps[field] = [...new Set([...backupArr, ...primaryArr])].sort();
  }
  result.counter_timestamps = mergedTimestamps;
  
  // For sales_log, merge by ID
  const primarySales = primary?.sales_log || [];
  const backupSales = backup?.sales_log || [];
  const salesById = new Map<string, any>();
  for (const sale of backupSales) salesById.set(sale.id, sale);
  for (const sale of primarySales) salesById.set(sale.id, sale);
  result.sales_log = Array.from(salesById.values());
  
  // Take earliest work_start_time
  if (primary?.work_start_time && backup?.work_start_time) {
    result.work_start_time = primary.work_start_time < backup.work_start_time 
      ? primary.work_start_time 
      : backup.work_start_time;
  }
  
  // Take latest work_end_time
  if (primary?.work_end_time && backup?.work_end_time) {
    result.work_end_time = primary.work_end_time > backup.work_end_time 
      ? primary.work_end_time 
      : backup.work_end_time;
  }
  
  return result;
};

/**
 * Local persistence layer for Track data
 * Saves counter state to localStorage on every change
 * Can recover from corrupted React Query cache
 */
export const useTrackBackup = (userId: string | null, entryDate: string) => {
  const lastSaveRef = useRef<string>('');
  
  const getBackupKey = useCallback(() => {
    if (!userId) return null;
    return `${BACKUP_KEY_PREFIX}${userId}-${entryDate}`;
  }, [userId, entryDate]);

  // Save entry to localStorage with server sync timestamp
  const saveBackup = useCallback((entry: Partial<DailyEntry>, isServerConfirmed?: boolean) => {
    const key = getBackupKey();
    if (!key || !userId) return;
    
    // Prevent duplicate saves
    const entryJson = JSON.stringify(entry);
    if (entryJson === lastSaveRef.current) return;
    lastSaveRef.current = entryJson;
    
    try {
      // Load existing backup to preserve lastServerSync if not updating it
      let existingBackup: BackupData | null = null;
      const existingStored = localStorage.getItem(key);
      if (existingStored) {
        try {
          existingBackup = JSON.parse(existingStored);
        } catch {}
      }
      
      const backup: BackupData = {
        entry,
        timestamp: new Date().toISOString(),
        userId,
        lastServerSync: isServerConfirmed 
          ? new Date().toISOString() 
          : existingBackup?.lastServerSync,
      };
      localStorage.setItem(key, JSON.stringify(backup));
      console.log('[TrackBackup] Saved backup for', entryDate, isServerConfirmed ? '(server confirmed)' : '');
    } catch (error) {
      console.error('[TrackBackup] Failed to save backup:', error);
    }
  }, [getBackupKey, userId, entryDate]);

  // Load backup from localStorage
  const loadBackup = useCallback((): Partial<DailyEntry> | null => {
    return getInstantBackup(userId, entryDate);
  }, [userId, entryDate]);

  // Clear backup (after successful save)
  const clearBackup = useCallback(() => {
    const key = getBackupKey();
    if (!key) return;
    
    try {
      localStorage.removeItem(key);
      lastSaveRef.current = '';
      console.log('[TrackBackup] Cleared backup for', entryDate);
    } catch (error) {
      console.error('[TrackBackup] Failed to clear backup:', error);
    }
  }, [getBackupKey, entryDate]);

  // Check if backup exists and has more data than server
  const hasUnsavedBackup = useCallback((serverEntry: Partial<DailyEntry> | null): boolean => {
    const backup = loadBackup();
    if (!backup) return false;
    
    // Compare activity totals
    const backupTotal = (backup.doors_knocked || 0) + 
                       (backup.decision_makers || 0) + 
                       (backup.pitches || 0) + 
                       (backup.transitions || 0) + 
                       (backup.presentations || 0) + 
                       (backup.closes || 0);
    
    const serverTotal = (serverEntry?.doors_knocked || 0) + 
                       (serverEntry?.decision_makers || 0) + 
                       (serverEntry?.pitches || 0) + 
                       (serverEntry?.transitions || 0) + 
                       (serverEntry?.presentations || 0) + 
                       (serverEntry?.closes || 0);
    
    return backupTotal > serverTotal;
  }, [loadBackup]);

  // Check if backup has server confirmation
  const hasServerConfirmedBackup = useCallback((): boolean => {
    const key = getBackupKey();
    if (!key) return false;
    
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return false;
      
      const backup: BackupData = JSON.parse(stored);
      return !!backup.lastServerSync;
    } catch {
      return false;
    }
  }, [getBackupKey]);

  return {
    saveBackup,
    loadBackup,
    clearBackup,
    hasUnsavedBackup,
    hasServerConfirmedBackup,
  };
};

// Helper to get current user ID synchronously from localStorage
export const getCurrentUserId = (): string | null => {
  try {
    const authData = localStorage.getItem('sb-wjxlzcuqpoamrwumszau-auth-token');
    if (!authData) return null;
    const parsed = JSON.parse(authData);
    return parsed?.user?.id || null;
  } catch {
    return null;
  }
};
