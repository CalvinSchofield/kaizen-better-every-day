import { useEffect, useRef, useMemo, useCallback } from "react";
import { format, eachDayOfInterval, getDay, isBefore, startOfDay, isWithinInterval } from "date-fns";
import { usePlannedDays } from "./usePlannedDays";
import { useRepData } from "./useRepData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CommittedBlitz {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location?: string;
}

interface ExcludedBlitzDays {
  [blitzId: string]: string[];
}

// Parse date string as local date (not UTC)
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

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

// Check if a date falls within any blitz range
const findBlitzForDate = (dateStr: string, blitzes: CommittedBlitz[]): CommittedBlitz | null => {
  const date = parseLocalDate(dateStr);
  for (const blitz of blitzes) {
    const startDate = parseLocalDate(blitz.date);
    const endDate = blitz.endDate ? parseLocalDate(blitz.endDate) : startDate;
    if (isWithinInterval(date, { start: startDate, end: endDate })) {
      return blitz;
    }
  }
  return null;
};

export const usePlannedDaysSync = () => {
  const { plannedDays, addMultipleDays, isLoading: isLoadingPlanned } = usePlannedDays();
  const { repData } = useRepData();
  const queryClient = useQueryClient();
  
  // Track previous values to detect changes
  const prevCommittedBlitzIdsRef = useRef<string[]>([]);
  const prevPlannedDaysRef = useRef<string[]>([]);
  const prevSummerStartRef = useRef<string | null>(null);
  const prevSummerEndRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);
  
  // Fetch season config for summer dates and excluded blitz days
  const { data: seasonConfig } = useQuery({
    queryKey: ['season-config', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return null;
      const { data, error } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end, excluded_blitz_days')
        .eq('user_id', repData.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!repData?.user_id,
  });

  const excludedBlitzDays = useMemo(() => {
    return (seasonConfig?.excluded_blitz_days as ExcludedBlitzDays) || {};
  }, [seasonConfig?.excluded_blitz_days]);

  // Mutation to update excluded blitz days
  const updateExcludedDaysMutation = useMutation({
    mutationFn: async (newExcluded: ExcludedBlitzDays) => {
      if (!repData?.user_id) throw new Error('No user');
      const { error } = await supabase
        .from('season_config')
        .upsert({
          user_id: repData.user_id,
          excluded_blitz_days: newExcluded,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['season-config', repData?.user_id] });
    },
  });

  // Get committed blitzes directly from rep data
  const committedBlitzes = useMemo(() => {
    if (!repData?.committed_blitzes) return [];
    const blitzes = repData.committed_blitzes as CommittedBlitz[];
    return Array.isArray(blitzes) ? blitzes.filter(b => b && b.date) : [];
  }, [repData?.committed_blitzes]);
  
  const committedBlitzIds = useMemo(() => {
    return committedBlitzes.map(b => b.id);
  }, [committedBlitzes]);

  const today = startOfDay(new Date());

  // Calculate expected blitz days (Mon-Sat only), excluding user-excluded days
  const getBlitzDays = useMemo(() => {
    const days: string[] = [];
    for (const blitz of committedBlitzes) {
      const startDate = parseLocalDate(blitz.date);
      const endDate = blitz.endDate ? parseLocalDate(blitz.endDate) : startDate;
      const blitzDays = getWorkDaysInRange(startDate, endDate);
      const excludedForBlitz = excludedBlitzDays[blitz.id] || [];
      
      // Filter out excluded days and past days
      const includedDays = blitzDays.filter(d => 
        !excludedForBlitz.includes(d) && !isBefore(parseLocalDate(d), today)
      );
      days.push(...includedDays);
    }
    return [...new Set(days)];
  }, [committedBlitzes, excludedBlitzDays, today]);

  // Calculate expected summer days (Mon-Sat only)
  const getSummerDays = useMemo(() => {
    if (!seasonConfig?.personal_summer_start || !seasonConfig?.personal_summer_end) return [];
    const startDate = parseLocalDate(seasonConfig.personal_summer_start);
    const endDate = parseLocalDate(seasonConfig.personal_summer_end);
    return getWorkDaysInRange(startDate, endDate).filter(d => !isBefore(parseLocalDate(d), today));
  }, [seasonConfig, today]);

  // Function to add a day to exclusions for a blitz
  const addExcludedDay = useCallback((blitzId: string, dateStr: string) => {
    const newExcluded = { ...excludedBlitzDays };
    if (!newExcluded[blitzId]) {
      newExcluded[blitzId] = [];
    }
    if (!newExcluded[blitzId].includes(dateStr)) {
      newExcluded[blitzId] = [...newExcluded[blitzId], dateStr];
      updateExcludedDaysMutation.mutate(newExcluded);
    }
  }, [excludedBlitzDays, updateExcludedDaysMutation]);

  // Function to remove a day from exclusions for a blitz
  const removeExcludedDay = useCallback((blitzId: string, dateStr: string) => {
    const newExcluded = { ...excludedBlitzDays };
    if (newExcluded[blitzId]) {
      newExcluded[blitzId] = newExcluded[blitzId].filter(d => d !== dateStr);
      if (newExcluded[blitzId].length === 0) {
        delete newExcluded[blitzId];
      }
      updateExcludedDaysMutation.mutate(newExcluded);
    }
  }, [excludedBlitzDays, updateExcludedDaysMutation]);

  // Function to clear exclusions for a blitz (when uncommitting)
  const clearBlitzExclusions = useCallback((blitzId: string) => {
    const newExcluded = { ...excludedBlitzDays };
    if (newExcluded[blitzId]) {
      delete newExcluded[blitzId];
      updateExcludedDaysMutation.mutate(newExcluded);
    }
  }, [excludedBlitzDays, updateExcludedDaysMutation]);

  // Detect when user manually removes a day that's within a blitz range
  useEffect(() => {
    if (isLoadingPlanned || !repData?.user_id || !hasInitializedRef.current) return;
    
    const currentPlannedDates = plannedDays?.map(d => d.planned_date) || [];
    const prevPlannedDates = prevPlannedDaysRef.current;
    
    // Find removed days
    const removedDays = prevPlannedDates.filter(d => !currentPlannedDates.includes(d));
    
    // Check if any removed day is within a blitz range
    for (const removedDay of removedDays) {
      const blitz = findBlitzForDate(removedDay, committedBlitzes);
      if (blitz) {
        // User removed a blitz day - add to exclusions
        addExcludedDay(blitz.id, removedDay);
      }
    }
    
    // Find added days
    const addedDays = currentPlannedDates.filter(d => !prevPlannedDates.includes(d));
    
    // Check if any added day was previously excluded
    for (const addedDay of addedDays) {
      const blitz = findBlitzForDate(addedDay, committedBlitzes);
      if (blitz && excludedBlitzDays[blitz.id]?.includes(addedDay)) {
        // User re-added a previously excluded blitz day - remove from exclusions
        removeExcludedDay(blitz.id, addedDay);
      }
    }
    
    prevPlannedDaysRef.current = currentPlannedDates;
  }, [plannedDays, committedBlitzes, excludedBlitzDays, isLoadingPlanned, repData?.user_id, addExcludedDay, removeExcludedDay]);

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
      // Find removed blitzes
      const removedIds = prevBlitzIds.filter(id => !currentBlitzIds.includes(id));
      
      // Clear exclusions for removed blitzes (so if they re-commit, all days show)
      for (const removedId of removedIds) {
        clearBlitzExclusions(removedId);
      }
      
      if (newlyAddedIds.length > 0) {
        // Get dates for newly added blitzes only (respecting any existing exclusions)
        const newBlitzDays: string[] = [];
        for (const blitz of committedBlitzes.filter(b => newlyAddedIds.includes(b.id))) {
          const startDate = parseLocalDate(blitz.date);
          const endDate = blitz.endDate ? parseLocalDate(blitz.endDate) : startDate;
          const blitzDays = getWorkDaysInRange(startDate, endDate);
          const excludedForBlitz = excludedBlitzDays[blitz.id] || [];
          
          const includedDays = blitzDays.filter(d => 
            !excludedForBlitz.includes(d) && !isBefore(parseLocalDate(d), today)
          );
          newBlitzDays.push(...includedDays);
        }
        
        // Add only new days (not already planned)
        const plannedSet = new Set(plannedDays?.map(d => d.planned_date) || []);
        const daysToAdd = newBlitzDays.filter(d => !plannedSet.has(d));
        
        if (daysToAdd.length > 0) {
          addMultipleDays(daysToAdd);
        }
      }
    }
    
    prevCommittedBlitzIdsRef.current = currentBlitzIds;
    hasInitializedRef.current = true;
  }, [committedBlitzIds, committedBlitzes, plannedDays, isLoadingPlanned, addMultipleDays, repData?.user_id, today, excludedBlitzDays, clearBlitzExclusions]);

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

  // Initial population on first load
  useEffect(() => {
    if (isLoadingPlanned || !repData?.user_id) return;
    
    // Initialize prev planned days ref
    if (prevPlannedDaysRef.current.length === 0 && plannedDays && plannedDays.length > 0) {
      prevPlannedDaysRef.current = plannedDays.map(d => d.planned_date);
    }
    
    const plannedSet = new Set(plannedDays?.map(d => d.planned_date) || []);
    
    // Only add blitz days that aren't planned AND aren't excluded
    const blitzDaysToAdd = getBlitzDays.filter(d => !plannedSet.has(d));
    
    if (!hasInitializedRef.current) {
      const summerDaysToAdd = getSummerDays.filter(d => !plannedSet.has(d));
      const allDaysToAdd = [...new Set([...blitzDaysToAdd, ...summerDaysToAdd])];
      
      if (allDaysToAdd.length > 0) {
        addMultipleDays(allDaysToAdd);
      }
      
      hasInitializedRef.current = true;
      prevCommittedBlitzIdsRef.current = committedBlitzIds;
      prevPlannedDaysRef.current = plannedDays?.map(d => d.planned_date) || [];
      return;
    }
    
    // After initialization, only auto-add blitz days if they're missing and not excluded
    if (blitzDaysToAdd.length > 0) {
      addMultipleDays(blitzDaysToAdd);
    }
  }, [isLoadingPlanned, repData?.user_id, plannedDays, getBlitzDays, getSummerDays, addMultipleDays, committedBlitzIds]);

  return {
    getBlitzDays,
    getSummerDays,
    committedBlitzes,
    excludedBlitzDays,
  };
};