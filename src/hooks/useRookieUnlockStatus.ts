import { useMemo } from "react";

interface BlitzData {
  date?: string;
  endDate?: string;
}

interface RepDataForUnlock {
  year?: string | null;
  stage?: string | null;
  committed_blitzes?: BlitzData[] | unknown;
}

/**
 * Centralized hook to determine if a rookie should have access to 
 * post-blitz features (Track, Insights, Calendar, etc.)
 * 
 * Unlocks if:
 * 1. Has attended a past blitz
 * 2. Is currently on an active blitz
 * 3. Has been marked as "Shadow ✅" (completed shadow day)
 */
export const useRookieUnlockStatus = (repData: RepDataForUnlock | null) => {
  const isRookie = repData?.year === "Rookie";
  
  const blitzes = useMemo(() => {
    if (!repData?.committed_blitzes) return [];
    return Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [];
  }, [repData?.committed_blitzes]);

  // Check if user has been marked as Shadow ✅ (completed shadow day)
  const hasCompletedShadow = useMemo(() => {
    const stage = repData?.stage?.toLowerCase() || '';
    return stage.includes('shadow');
  }, [repData?.stage]);

  // Check if currently on an active blitz
  const isOnActiveBlitz = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    return blitzes.some((blitz: BlitzData) => {
      if (!blitz.date) return false;
      
      // Check if today is blitz start date
      if (todayStr === blitz.date) return true;
      
      // Check if currently between start and end
      if (blitz.endDate) {
        const startDate = new Date(blitz.date + 'T00:00:00');
        const endDate = new Date(blitz.endDate + 'T23:59:59');
        if (now >= startDate && now <= endDate) return true;
      }
      
      return false;
    });
  }, [blitzes]);

  // Check if has attended a past blitz
  const hasAttendedBlitz = useMemo(() => {
    const now = new Date();
    
    return blitzes.some((blitz: BlitzData) => {
      if (!blitz.endDate) return false;
      const endDate = new Date(blitz.endDate + 'T23:59:59');
      return endDate < now;
    });
  }, [blitzes]);

  // Combined check: any of these conditions unlocks features
  const hasAttendedOrOnBlitz = hasAttendedBlitz || isOnActiveBlitz;
  
  // Ultimate unlock: blitz OR shadow ✅
  const isUnlocked = hasAttendedOrOnBlitz || hasCompletedShadow;
  
  // Pre-blitz status (locked)
  const isPreBlitzRookie = isRookie && !isUnlocked;

  return {
    isRookie,
    hasAttendedBlitz,
    isOnActiveBlitz,
    hasAttendedOrOnBlitz,
    hasCompletedShadow,
    isUnlocked,
    isPreBlitzRookie,
  };
};

/**
 * Pure function version for use outside of React components
 */
export const checkRookieUnlockStatus = (repData: RepDataForUnlock | null) => {
  const isRookie = repData?.year === "Rookie";
  
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];

  // Check if user has been marked as Shadow ✅
  const stage = repData?.stage?.toLowerCase() || '';
  const hasCompletedShadow = stage.includes('shadow');

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const isOnActiveBlitz = blitzes.some((blitz: BlitzData) => {
    if (!blitz.date) return false;
    if (todayStr === blitz.date) return true;
    if (blitz.endDate) {
      const startDate = new Date(blitz.date + 'T00:00:00');
      const endDate = new Date(blitz.endDate + 'T23:59:59');
      if (now >= startDate && now <= endDate) return true;
    }
    return false;
  });

  const hasAttendedBlitz = blitzes.some((blitz: BlitzData) => {
    if (!blitz.endDate) return false;
    const endDate = new Date(blitz.endDate + 'T23:59:59');
    return endDate < now;
  });

  const hasAttendedOrOnBlitz = hasAttendedBlitz || isOnActiveBlitz;
  const isUnlocked = hasAttendedOrOnBlitz || hasCompletedShadow;
  const isPreBlitzRookie = isRookie && !isUnlocked;

  return {
    isRookie,
    hasAttendedBlitz,
    isOnActiveBlitz,
    hasAttendedOrOnBlitz,
    hasCompletedShadow,
    isUnlocked,
    isPreBlitzRookie,
  };
};
