import { useEffect, useRef, useMemo, useCallback, useState } from "react";
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
  const { plannedDays, addMultipleDays, removeMultipleDays, isLoading: isLoadingPlanned } = usePlannedDays();
  const { repData } = useRepData();
  const queryClient = useQueryClient();
  
  // LOCAL state for pending exclusions - applied immediately before DB saves
  const [pendingExclusions, setPendingExclusions] = useState<ExcludedBlitzDays>({});
  
  // Track previous values to detect changes
  const prevCommittedBlitzesRef = useRef<CommittedBlitz[]>([]);
  const prevCommittedBlitzIdsRef = useRef<string[]>([]);
  const prevPlannedDaysRef = useRef<string[]>([]);
  const prevSummerStartRef = useRef<string | null>(null);
  const prevSummerEndRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);
  
  // Fetch season config for summer dates, excluded blitz days, and excluded summer days
  const { data: seasonConfig } = useQuery({
    queryKey: ['season-config', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return null;
      const { data, error } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end, excluded_blitz_days, excluded_summer_days')
        .eq('user_id', repData.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!repData?.user_id,
  });

  // Merge DB exclusions with pending local exclusions
  const excludedBlitzDays = useMemo(() => {
    const dbExclusions = (seasonConfig?.excluded_blitz_days as ExcludedBlitzDays) || {};
    // Merge pending exclusions on top
    const merged: ExcludedBlitzDays = { ...dbExclusions };
    for (const blitzId of Object.keys(pendingExclusions)) {
      if (!merged[blitzId]) {
        merged[blitzId] = [];
      }
      for (const date of pendingExclusions[blitzId]) {
        if (!merged[blitzId].includes(date)) {
          merged[blitzId] = [...merged[blitzId], date];
        }
      }
    }
    return merged;
  }, [seasonConfig?.excluded_blitz_days, pendingExclusions]);

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
      // Clear pending exclusions once saved to DB
      setPendingExclusions({});
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

  // Get excluded summer days from season config
  const excludedSummerDays = useMemo(() => {
    return (seasonConfig?.excluded_summer_days as string[]) || [];
  }, [seasonConfig?.excluded_summer_days]);

  // Calculate expected summer days (Mon-Sat only), excluding user-marked off-days
  const getSummerDays = useMemo(() => {
    if (!seasonConfig?.personal_summer_start || !seasonConfig?.personal_summer_end) return [];
    const startDate = parseLocalDate(seasonConfig.personal_summer_start);
    const endDate = parseLocalDate(seasonConfig.personal_summer_end);
    return getWorkDaysInRange(startDate, endDate).filter(d => 
      !isBefore(parseLocalDate(d), today) && !excludedSummerDays.includes(d)
    );
  }, [seasonConfig, today, excludedSummerDays]);

  // Function to add a day to exclusions for a blitz
  const addExcludedDay = useCallback((blitzId: string, dateStr: string) => {
    // IMMEDIATELY add to pending exclusions (local state)
    setPendingExclusions(prev => {
      const updated = { ...prev };
      if (!updated[blitzId]) {
        updated[blitzId] = [];
      }
      if (!updated[blitzId].includes(dateStr)) {
        updated[blitzId] = [...updated[blitzId], dateStr];
      }
      return updated;
    });
    
    // Then save to DB
    const dbExclusions = (seasonConfig?.excluded_blitz_days as ExcludedBlitzDays) || {};
    const newExcluded = { ...dbExclusions };
    if (!newExcluded[blitzId]) {
      newExcluded[blitzId] = [];
    }
    if (!newExcluded[blitzId].includes(dateStr)) {
      newExcluded[blitzId] = [...newExcluded[blitzId], dateStr];
      updateExcludedDaysMutation.mutate(newExcluded);
    }
  }, [seasonConfig?.excluded_blitz_days, updateExcludedDaysMutation]);

  // Function to remove a day from exclusions for a blitz
  const removeExcludedDay = useCallback((blitzId: string, dateStr: string) => {
    // Remove from pending exclusions
    setPendingExclusions(prev => {
      const updated = { ...prev };
      if (updated[blitzId]) {
        updated[blitzId] = updated[blitzId].filter(d => d !== dateStr);
        if (updated[blitzId].length === 0) {
          delete updated[blitzId];
        }
      }
      return updated;
    });
    
    // Remove from DB
    const dbExclusions = (seasonConfig?.excluded_blitz_days as ExcludedBlitzDays) || {};
    const newExcluded = { ...dbExclusions };
    if (newExcluded[blitzId]) {
      newExcluded[blitzId] = newExcluded[blitzId].filter(d => d !== dateStr);
      if (newExcluded[blitzId].length === 0) {
        delete newExcluded[blitzId];
      }
      updateExcludedDaysMutation.mutate(newExcluded);
    }
  }, [seasonConfig?.excluded_blitz_days, updateExcludedDaysMutation]);

  // Function to clear exclusions for a blitz (when uncommitting)
  const clearBlitzExclusions = useCallback((blitzId: string) => {
    // Clear from pending
    setPendingExclusions(prev => {
      const updated = { ...prev };
      delete updated[blitzId];
      return updated;
    });
    
    // Clear from DB
    const dbExclusions = (seasonConfig?.excluded_blitz_days as ExcludedBlitzDays) || {};
    if (dbExclusions[blitzId]) {
      const newExcluded = { ...dbExclusions };
      delete newExcluded[blitzId];
      updateExcludedDaysMutation.mutate(newExcluded);
    }
  }, [seasonConfig?.excluded_blitz_days, updateExcludedDaysMutation]);

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
    const prevBlitzes = prevCommittedBlitzesRef.current;
    
    // Check if blitzes changed
    const blitzesChanged = JSON.stringify(currentBlitzIds.sort()) !== JSON.stringify(prevBlitzIds.sort());
    
    if (blitzesChanged && hasInitializedRef.current) {
      // Find newly added blitzes
      const newlyAddedIds = currentBlitzIds.filter(id => !prevBlitzIds.includes(id));
      // Find removed blitzes
      const removedIds = prevBlitzIds.filter(id => !currentBlitzIds.includes(id));
      
      // Remove planned days for removed blitzes
      if (removedIds.length > 0) {
        const daysToRemove: string[] = [];
        
        // Use the PREVIOUS blitz data to find the date ranges
        for (const removedId of removedIds) {
          const removedBlitz = prevBlitzes.find(b => b.id === removedId);
          if (removedBlitz) {
            const startDate = parseLocalDate(removedBlitz.date);
            const endDate = removedBlitz.endDate ? parseLocalDate(removedBlitz.endDate) : startDate;
            const blitzDays = getWorkDaysInRange(startDate, endDate);
            
            // Only remove days that are in this blitz range AND currently planned
            const currentPlannedDates = plannedDays?.map(d => d.planned_date) || [];
            const plannedBlitzDays = blitzDays.filter(d => currentPlannedDates.includes(d));
            daysToRemove.push(...plannedBlitzDays);
          }
          
          // Clear exclusions for this blitz (so if they re-commit, all days show)
          clearBlitzExclusions(removedId);
        }
        
        // Remove the blitz days from planned days
        if (daysToRemove.length > 0) {
          removeMultipleDays(daysToRemove);
        }
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
    
    // Always update the refs
    prevCommittedBlitzIdsRef.current = currentBlitzIds;
    prevCommittedBlitzesRef.current = [...committedBlitzes];
    hasInitializedRef.current = true;
  }, [committedBlitzIds, committedBlitzes, plannedDays, isLoadingPlanned, addMultipleDays, removeMultipleDays, repData?.user_id, today, excludedBlitzDays, clearBlitzExclusions]);

  // Sync summer dates when they change - recalculate planned days based on new range
  useEffect(() => {
    if (isLoadingPlanned || !repData?.user_id) return;
    
    const currentStart = seasonConfig?.personal_summer_start || null;
    const currentEnd = seasonConfig?.personal_summer_end || null;
    const prevStart = prevSummerStartRef.current;
    const prevEnd = prevSummerEndRef.current;
    
    const summerChanged = currentStart !== prevStart || currentEnd !== prevEnd;
    
    if (summerChanged && hasInitializedRef.current && currentStart && currentEnd) {
      const currentPlannedDates = plannedDays?.map(d => d.planned_date) || [];
      
      // Calculate old summer days (if we had previous dates)
      let oldSummerDays: string[] = [];
      if (prevStart && prevEnd) {
        const prevSummerStart = parseLocalDate(prevStart);
        const prevSummerEnd = parseLocalDate(prevEnd);
        oldSummerDays = getWorkDaysInRange(prevSummerStart, prevSummerEnd);
      }
      
      // New summer days from current settings
      const newSummerDays = getSummerDays;
      
      // Days to remove: old summer days that aren't in new range
      const daysToRemove = oldSummerDays.filter(d => 
        currentPlannedDates.includes(d) && !newSummerDays.includes(d)
      );
      
      // Days to add: new summer days that aren't already planned
      const plannedSet = new Set(currentPlannedDates);
      const daysToAdd = newSummerDays.filter(d => !plannedSet.has(d));
      
      // Remove old days first
      if (daysToRemove.length > 0) {
        removeMultipleDays(daysToRemove);
      }
      
      // Then add new days
      if (daysToAdd.length > 0) {
        addMultipleDays(daysToAdd);
      }
    }
    
    prevSummerStartRef.current = currentStart;
    prevSummerEndRef.current = currentEnd;
  }, [seasonConfig, getSummerDays, plannedDays, isLoadingPlanned, addMultipleDays, removeMultipleDays, repData?.user_id]);

  // Initial population on first load - ONLY runs once
  useEffect(() => {
    if (isLoadingPlanned || !repData?.user_id || hasInitializedRef.current) return;
    
    // Initialize prev planned days ref
    prevPlannedDaysRef.current = plannedDays?.map(d => d.planned_date) || [];
    
    const plannedSet = new Set(plannedDays?.map(d => d.planned_date) || []);
    
    // Only add blitz days that aren't planned AND aren't excluded
    const blitzDaysToAdd = getBlitzDays.filter(d => !plannedSet.has(d));
    const summerDaysToAdd = getSummerDays.filter(d => !plannedSet.has(d));
    const allDaysToAdd = [...new Set([...blitzDaysToAdd, ...summerDaysToAdd])];
    
    if (allDaysToAdd.length > 0) {
      addMultipleDays(allDaysToAdd);
    }
    
    hasInitializedRef.current = true;
    prevCommittedBlitzIdsRef.current = committedBlitzIds;
    prevCommittedBlitzesRef.current = [...committedBlitzes];
  }, [isLoadingPlanned, repData?.user_id, plannedDays, getBlitzDays, getSummerDays, addMultipleDays, committedBlitzIds, committedBlitzes]);

  // Mutation to update excluded summer days
  const updateExcludedSummerDaysMutation = useMutation({
    mutationFn: async (newExcluded: string[]) => {
      if (!repData?.user_id) throw new Error('No user');
      const { error } = await supabase
        .from('season_config')
        .upsert({
          user_id: repData.user_id,
          excluded_summer_days: newExcluded,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['season-config', repData?.user_id] });
    },
  });

  // Add a summer off-day
  const addSummerOffDay = useCallback((dateStr: string) => {
    const currentExcluded = excludedSummerDays;
    if (!currentExcluded.includes(dateStr)) {
      updateExcludedSummerDaysMutation.mutate([...currentExcluded, dateStr]);
    }
  }, [excludedSummerDays, updateExcludedSummerDaysMutation]);

  // Remove a summer off-day
  const removeSummerOffDay = useCallback((dateStr: string) => {
    const currentExcluded = excludedSummerDays;
    if (currentExcluded.includes(dateStr)) {
      updateExcludedSummerDaysMutation.mutate(currentExcluded.filter(d => d !== dateStr));
    }
  }, [excludedSummerDays, updateExcludedSummerDaysMutation]);

  return {
    getBlitzDays,
    getSummerDays,
    committedBlitzes,
    excludedBlitzDays,
    excludedSummerDays,
    addSummerOffDay,
    removeSummerOffDay,
  };
};