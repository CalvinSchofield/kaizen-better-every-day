import { useEffect, useCallback, useRef } from 'react';
import { DailyEntry } from './useDailyEntry';

const BACKUP_KEY_PREFIX = 'track-backup-';

interface BackupData {
  entry: Partial<DailyEntry>;
  timestamp: string;
  userId: string;
}

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

  // Save entry to localStorage
  const saveBackup = useCallback((entry: Partial<DailyEntry>) => {
    const key = getBackupKey();
    if (!key || !userId) return;
    
    // Prevent duplicate saves
    const entryJson = JSON.stringify(entry);
    if (entryJson === lastSaveRef.current) return;
    lastSaveRef.current = entryJson;
    
    try {
      const backup: BackupData = {
        entry,
        timestamp: new Date().toISOString(),
        userId,
      };
      localStorage.setItem(key, JSON.stringify(backup));
      console.log('[TrackBackup] Saved backup for', entryDate);
    } catch (error) {
      console.error('[TrackBackup] Failed to save backup:', error);
    }
  }, [getBackupKey, userId, entryDate]);

  // Load backup from localStorage
  const loadBackup = useCallback((): Partial<DailyEntry> | null => {
    const key = getBackupKey();
    if (!key || !userId) return null;
    
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      const backup: BackupData = JSON.parse(stored);
      
      // Verify this backup belongs to current user
      if (backup.userId !== userId) {
        console.warn('[TrackBackup] Backup user mismatch, ignoring');
        return null;
      }
      
      // Check if backup is from today (within 24 hours)
      const backupTime = new Date(backup.timestamp);
      const now = new Date();
      const hoursDiff = (now.getTime() - backupTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        console.log('[TrackBackup] Backup is too old, ignoring');
        clearBackup();
        return null;
      }
      
      console.log('[TrackBackup] Loaded backup from', backup.timestamp);
      return backup.entry;
    } catch (error) {
      console.error('[TrackBackup] Failed to load backup:', error);
      return null;
    }
  }, [getBackupKey, userId]);

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

  return {
    saveBackup,
    loadBackup,
    clearBackup,
    hasUnsavedBackup,
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
