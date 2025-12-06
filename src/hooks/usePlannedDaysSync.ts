import { useEffect, useRef, useMemo } from "react";
import { format, eachDayOfInterval, getDay, isBefore, startOfDay } from "date-fns";
import { usePlannedDays } from "./usePlannedDays";
import { useRepData } from "./useRepData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface CommittedBlitz {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location?: string;
}

// Generates all Mon-Sat dates between start and end (no Sundays)
const getWorkDaysInRange = (startDate: Date, endDate: Date): string[] => {
  const days: string[] = [];
  const interval = eachDayOfInterval({ start: startDate, end: endDate });
  
  for (const day of interval) {
    const dayOfWeek = getDay(day);
    // Skip Sundays (0)
    if (dayOfWeek !== 0) {
      days.push(format(day, 'yyyy-MM-dd'));
    }
  }
  return days;
};

export const usePlannedDaysSync = () => {
  const { plannedDays, addMultipleDays, isLoading: isLoadingPlanned } = usePlannedDays();
  const { repData } = useRepData();
  
  // Track previous values to detect changes
  const prevCommittedBlitzIdsRef = useRef<string[]>([]);
  const prevSummerStartRef = useRef<string | null>(null);
  const prevSummerEndRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);
  
  // Fetch season config for summer dates
  const { data: seasonConfig } = useQuery({
    queryKey: ['season-config', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return null;
      const { data, error } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end')
        .eq('user_id', repData.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!repData?.user_id,
  });

  // Get committed blitzes directly from rep data (they're already full objects)
  const committedBlitzes = useMemo(() => {
    if (!repData?.committed_blitzes) return [];
    const blitzes = repData.committed_blitzes as CommittedBlitz[];
    return Array.isArray(blitzes) ? blitzes.filter(b => b && b.date) : [];
  }, [repData?.committed_blitzes]);
  
  const committedBlitzIds = useMemo(() => {
    return committedBlitzes.map(b => b.id);
  }, [committedBlitzes]);

  const today = startOfDay(new Date());

  // Calculate expected blitz days (Mon-Sat only)
  const getBlitzDays = useMemo(() => {
    const days: string[] = [];
    for (const blitz of committedBlitzes) {
      const startDate = new Date(blitz.date);
      const endDate = blitz.endDate ? new Date(blitz.endDate) : startDate;
      const blitzDays = getWorkDaysInRange(startDate, endDate);
      days.push(...blitzDays.filter(d => !isBefore(new Date(d), today)));
    }
    return [...new Set(days)]; // Remove duplicates
  }, [committedBlitzes, today]);

  // Calculate expected summer days (Mon-Sat only)
  const getSummerDays = useMemo(() => {
    if (!seasonConfig?.personal_summer_start || !seasonConfig?.personal_summer_end) return [];
    const startDate = new Date(seasonConfig.personal_summer_start);
    const endDate = new Date(seasonConfig.personal_summer_end);
    return getWorkDaysInRange(startDate, endDate).filter(d => !isBefore(new Date(d), today));
  }, [seasonConfig, today]);

  // Sync blitz dates when committed_blitzes changes
  useEffect(() => {
    if (isLoadingPlanned || !repData?.user_id) return;
    
    const currentBlitzIds = committedBlitzIds;
    const prevBlitzIds = prevCommittedBlitzIdsRef.current;
    
    // Check if blitzes changed
    const blitzesChanged = JSON.stringify(currentBlitzIds.sort()) !== JSON.stringify(prevBlitzIds.sort());
    
    if (blitzesChanged && hasInitializedRef.current) {
      // Find newly added blitzes
      const newlyAddedIds = currentBlitzIds.filter(id => !prevBlitzIds.includes(id));
      
      if (newlyAddedIds.length > 0) {
        // Get dates for newly added blitzes only
        const newBlitzDays: string[] = [];
        for (const blitz of committedBlitzes.filter(b => newlyAddedIds.includes(b.id))) {
          const startDate = new Date(blitz.date);
          const endDate = blitz.endDate ? new Date(blitz.endDate) : startDate;
          const blitzDays = getWorkDaysInRange(startDate, endDate);
          newBlitzDays.push(...blitzDays.filter(d => !isBefore(new Date(d), today)));
        }
        
        // Add only new days (not already planned)
        const plannedSet = new Set(plannedDays?.map(d => d.planned_date) || []);
        const daysToAdd = newBlitzDays.filter(d => !plannedSet.has(d));
        
        if (daysToAdd.length > 0) {
          addMultipleDays(daysToAdd);
        }
      }
      
      // Note: We don't remove days when uncommitting - user can manually remove if desired
    }
    
    prevCommittedBlitzIdsRef.current = currentBlitzIds;
    hasInitializedRef.current = true;
  }, [committedBlitzIds, committedBlitzes, plannedDays, isLoadingPlanned, addMultipleDays, repData?.user_id, today]);

  // Sync summer dates when they change
  useEffect(() => {
    if (isLoadingPlanned || !repData?.user_id) return;
    
    const currentStart = seasonConfig?.personal_summer_start || null;
    const currentEnd = seasonConfig?.personal_summer_end || null;
    
    const summerChanged = currentStart !== prevSummerStartRef.current || 
                          currentEnd !== prevSummerEndRef.current;
    
    if (summerChanged && hasInitializedRef.current && currentStart && currentEnd) {
      const summerDays = getSummerDays;
      
      // Add only new summer days (not already planned)
      const plannedSet = new Set(plannedDays?.map(d => d.planned_date) || []);
      const daysToAdd = summerDays.filter(d => !plannedSet.has(d));
      
      if (daysToAdd.length > 0) {
        addMultipleDays(daysToAdd);
      }
    }
    
    prevSummerStartRef.current = currentStart;
    prevSummerEndRef.current = currentEnd;
  }, [seasonConfig, getSummerDays, plannedDays, isLoadingPlanned, addMultipleDays, repData?.user_id]);

  // Initial population on first load - adds blitz days that aren't already planned
  useEffect(() => {
    if (isLoadingPlanned || !repData?.user_id) return;
    
    // Always check for blitz days that need to be added (even if some planned days exist)
    const plannedSet = new Set(plannedDays?.map(d => d.planned_date) || []);
    const blitzDaysToAdd = getBlitzDays.filter(d => !plannedSet.has(d));
    
    // On first load, also add summer days if none exist
    if (!hasInitializedRef.current) {
      const summerDaysToAdd = getSummerDays.filter(d => !plannedSet.has(d));
      const allDaysToAdd = [...new Set([...blitzDaysToAdd, ...summerDaysToAdd])];
      
      if (allDaysToAdd.length > 0) {
        addMultipleDays(allDaysToAdd);
      }
      
      hasInitializedRef.current = true;
      prevCommittedBlitzIdsRef.current = committedBlitzIds;
      return;
    }
    
    // After initialization, only auto-add blitz days (summer days handled by separate effect)
    if (blitzDaysToAdd.length > 0) {
      addMultipleDays(blitzDaysToAdd);
    }
  }, [isLoadingPlanned, repData?.user_id, plannedDays, getBlitzDays, getSummerDays, addMultipleDays, committedBlitzIds]);

  return {
    getBlitzDays,
    getSummerDays,
    committedBlitzes,
  };
};