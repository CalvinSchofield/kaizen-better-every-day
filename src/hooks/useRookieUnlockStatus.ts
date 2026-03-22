import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionSafe } from "@/utils/authSession";
import { isRepActive } from "@/utils/repStatusUtils";

const GLOBAL_SUMMER_START = '2026-04-12';

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
 * 3. Has been marked as "Shadow ✅" (completed shadow day) or "Sold"
 * 4. Their personal summer start date has arrived (fallback: global date)
 * 
 * NEVER unlocks inactive reps (Not Interested, Signed but Not Interested, Potential Follow Up)
 */
export const useRookieUnlockStatus = (repData: RepDataForUnlock | null) => {
  const isRookie = repData?.year === "Rookie";
  
  // Inactive reps are NEVER unlocked regardless of any other condition
  const isInactive = repData?.stage ? !isRepActive(repData.stage) : false;
  
  const blitzes = useMemo(() => {
    if (!repData?.committed_blitzes) return [];
    return Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [];
  }, [repData?.committed_blitzes]);

  // Check if stage qualifies for unlock (shadow or sold)
  const hasQualifyingStage = useMemo(() => {
    const stage = repData?.stage?.toLowerCase() || '';
    return stage.includes('shadow') || stage.includes('sold');
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
      if (todayStr === blitz.date) return true;
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

  const hasAttendedOrOnBlitz = hasAttendedBlitz || isOnActiveBlitz;

  // Only query season_config if rookie isn't already unlocked by other means
  const needsSummerCheck = isRookie && !isInactive && !hasAttendedOrOnBlitz && !hasQualifyingStage;

  const { data: seasonConfig } = useQuery({
    queryKey: ['rookie-summer-check'],
    enabled: needsSummerCheck,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const { user } = await getSessionSafe();
      if (!user) return null;
      const { data } = await supabase
        .from('season_config')
        .select('personal_summer_start')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
  });

  const hasSummerStarted = useMemo(() => {
    if (!needsSummerCheck) return false;
    const start = seasonConfig?.personal_summer_start;
    const effectiveStart = start || GLOBAL_SUMMER_START;
    return new Date() >= new Date(effectiveStart + 'T00:00:00');
  }, [needsSummerCheck, seasonConfig]);

  // Ultimate unlock: blitz OR qualifying stage OR summer started — but NEVER inactive
  const isUnlocked = !isInactive && (hasAttendedOrOnBlitz || hasQualifyingStage || hasSummerStarted);
  
  // Pre-blitz status (locked)
  const isPreBlitzRookie = isRookie && !isUnlocked;

  return {
    isRookie,
    hasAttendedBlitz,
    isOnActiveBlitz,
    hasAttendedOrOnBlitz,
    hasCompletedShadow: hasQualifyingStage,
    hasSummerStarted,
    isUnlocked,
    isPreBlitzRookie,
  };
};

/**
 * Pure function version for use outside of React components.
 * Uses global fallback date since it can't query async.
 */
export const checkRookieUnlockStatus = (repData: RepDataForUnlock | null) => {
  const isRookie = repData?.year === "Rookie";
  
  // Inactive reps are NEVER unlocked
  const isInactive = repData?.stage ? !isRepActive(repData.stage) : false;
  
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];

  const stage = repData?.stage?.toLowerCase() || '';
  const hasQualifyingStage = stage.includes('shadow') || stage.includes('sold');

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
  
  // Summer check using global fallback only
  const hasSummerStarted = isRookie && !isInactive && !hasAttendedOrOnBlitz && !hasQualifyingStage
    ? now >= new Date(GLOBAL_SUMMER_START + 'T00:00:00')
    : false;

  const isUnlocked = !isInactive && (hasAttendedOrOnBlitz || hasQualifyingStage || hasSummerStarted);
  const isPreBlitzRookie = isRookie && !isUnlocked;

  return {
    isRookie,
    hasAttendedBlitz,
    isOnActiveBlitz,
    hasAttendedOrOnBlitz,
    hasCompletedShadow: hasQualifyingStage,
    hasSummerStarted,
    isUnlocked,
    isPreBlitzRookie,
  };
};
