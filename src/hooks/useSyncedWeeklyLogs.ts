import { useCallback, useMemo, useEffect } from "react";
import { useRepGoals } from "./useRepGoals";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRepData } from "./useRepData";

type WeeklyLogs = Record<string, number>;

// Get current week start (Monday) for weekly tracking
const getCurrentWeekStart = (): string => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
};

// Legacy localStorage keys for migration
const getLocalStorageKey = (userId: string, type: 'mnl' | 'roleplay') => 
  `weekly-${type}-${userId}`;

/**
 * Hook for synced weekly activity logs (MNL, Role Plays) across devices.
 * Migrates from localStorage to database on first load.
 */
export const useSyncedWeeklyLogs = () => {
  const { goals, isLoading, updateGoals } = useRepGoals();
  const { repData } = useRepData();
  const queryClient = useQueryClient();

  // Parse weekly logs from goals
  const weeklyMnlLogs = useMemo((): WeeklyLogs => {
    const logs = goals?.weekly_mnl_logs;
    return (logs && typeof logs === 'object' && !Array.isArray(logs)) 
      ? logs 
      : {};
  }, [goals?.weekly_mnl_logs]);

  const weeklyRoleplayLogs = useMemo((): WeeklyLogs => {
    const logs = goals?.weekly_roleplay_logs;
    return (logs && typeof logs === 'object' && !Array.isArray(logs)) 
      ? logs 
      : {};
  }, [goals?.weekly_roleplay_logs]);

  const currentWeekStart = getCurrentWeekStart();

  // Get current week's values
  const currentWeekMnl = weeklyMnlLogs[currentWeekStart] || 0;
  const currentWeekRolePlays = weeklyRoleplayLogs[currentWeekStart] || 0;

  // Migrate from localStorage if database is empty
  useEffect(() => {
    const migrate = async () => {
      if (!repData?.user_id || isLoading) return;
      
      // Check if we already have data in database
      const hasMnlData = Object.keys(weeklyMnlLogs).length > 0;
      const hasRoleplayData = Object.keys(weeklyRoleplayLogs).length > 0;
      
      if (hasMnlData || hasRoleplayData) {
        // Already have DB data, clear localStorage
        localStorage.removeItem(getLocalStorageKey(repData.user_id, 'mnl'));
        localStorage.removeItem(getLocalStorageKey(repData.user_id, 'roleplay'));
        return;
      }

      try {
        const lsMnl = localStorage.getItem(getLocalStorageKey(repData.user_id, 'mnl'));
        const lsRoleplay = localStorage.getItem(getLocalStorageKey(repData.user_id, 'roleplay'));

        if (!lsMnl && !lsRoleplay) return;

        const mnlLogs = lsMnl ? JSON.parse(lsMnl) : {};
        const roleplayLogs = lsRoleplay ? JSON.parse(lsRoleplay) : {};

        // Migrate to database
        const { error } = await supabase
          .from('rep_goals')
          .upsert({
            user_id: repData.user_id,
            weekly_mnl_logs: mnlLogs,
            weekly_roleplay_logs: roleplayLogs,
          }, { onConflict: 'user_id' });

        if (!error) {
          localStorage.removeItem(getLocalStorageKey(repData.user_id, 'mnl'));
          localStorage.removeItem(getLocalStorageKey(repData.user_id, 'roleplay'));
          queryClient.invalidateQueries({ queryKey: ['rep-goals'] });
        }
      } catch {
        // Ignore migration errors
      }
    };

    migrate();
  }, [repData?.user_id, isLoading, weeklyMnlLogs, weeklyRoleplayLogs, queryClient]);

  // Toggle MNL attendance for current week
  const toggleMnlAttendance = useCallback(async () => {
    if (!repData?.user_id) return;

    const currentValue = weeklyMnlLogs[currentWeekStart] || 0;
    const newValue = currentValue > 0 ? 0 : 1;

    const newLogs = {
      ...weeklyMnlLogs,
      [currentWeekStart]: newValue,
    };

    // Calculate total progress (count of weeks with attendance)
    const totalProgress = Object.values(newLogs).filter(v => v > 0).length;

    const { error } = await supabase
      .from('rep_goals')
      .upsert({
        user_id: repData.user_id,
        weekly_mnl_logs: newLogs,
        monday_night_lights_progress: totalProgress,
      }, { onConflict: 'user_id' });

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['rep-goals'] });
      queryClient.invalidateQueries({ queryKey: ['preseason-prep-leaderboard-weekly'] });
    }
    
    return newValue > 0;
  }, [repData?.user_id, weeklyMnlLogs, currentWeekStart, queryClient]);

  // Increment role plays for current week
  const incrementRolePlays = useCallback(async (increment: number = 1) => {
    if (!repData?.user_id) return;

    const currentValue = weeklyRoleplayLogs[currentWeekStart] || 0;
    const newValue = Math.max(0, currentValue + increment);

    const newLogs = {
      ...weeklyRoleplayLogs,
      [currentWeekStart]: newValue,
    };

    // Calculate total progress (sum of all role plays)
    const totalProgress = Object.values(newLogs).reduce((sum, v) => sum + v, 0);

    const { error } = await supabase
      .from('rep_goals')
      .upsert({
        user_id: repData.user_id,
        weekly_roleplay_logs: newLogs,
        role_plays_progress: totalProgress,
      }, { onConflict: 'user_id' });

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['rep-goals'] });
      queryClient.invalidateQueries({ queryKey: ['preseason-prep-leaderboard-weekly'] });
    }
  }, [repData?.user_id, weeklyRoleplayLogs, currentWeekStart, queryClient]);

  // Set role plays for current week to specific value
  const setRolePlays = useCallback(async (value: number) => {
    if (!repData?.user_id) return;

    const newLogs = {
      ...weeklyRoleplayLogs,
      [currentWeekStart]: Math.max(0, value),
    };

    const totalProgress = Object.values(newLogs).reduce((sum, v) => sum + v, 0);

    const { error } = await supabase
      .from('rep_goals')
      .upsert({
        user_id: repData.user_id,
        weekly_roleplay_logs: newLogs,
        role_plays_progress: totalProgress,
      }, { onConflict: 'user_id' });

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['rep-goals'] });
      queryClient.invalidateQueries({ queryKey: ['preseason-prep-leaderboard-weekly'] });
    }
  }, [repData?.user_id, weeklyRoleplayLogs, currentWeekStart, queryClient]);

  return {
    weeklyMnlLogs,
    weeklyRoleplayLogs,
    currentWeekStart,
    currentWeekMnl,
    currentWeekRolePlays,
    isLoading,
    toggleMnlAttendance,
    incrementRolePlays,
    setRolePlays,
    // Helper to check if attended MNL this week
    attendedMnlThisWeek: currentWeekMnl > 0,
  };
};
