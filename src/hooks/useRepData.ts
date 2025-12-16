import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface RepData {
  id: string;
  user_id: string;
  notion_page_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  recruiter: string | null;
  team_leader: string | null;
  team_leader_phone: string | null;
  stage: string | null;
  ramp_to_blitz_phase: string | null;
  onboarding_complete: boolean;
  trainings_complete: boolean;
  slack_joined: boolean;
  ramp_phase_1_complete: boolean;
  ramp_phase_2_complete: boolean;
  ramp_phase_3_complete: boolean;
  ramp_phase_4_complete: boolean;
  blitz_ready: boolean;
  path_to_pro_started: boolean;
  path_to_pro_progress: number;
  completed_tasks: unknown; // JSONB array of completed task IDs
  nudge_leader: boolean | null;
  last_nudge_time: string | null;
  year: string | null; // "Rookie", "Sophomore", or "Vet"
  personal_fp: number | null;
  personal_fp_goal: number | null;
  reps_with_sale: number | null;
  reps_with_sale_goal: number | null;
  blitz_trip_name: string | null;
  blitz_trip_date: string | null;
  blitz_trip_end_date: string | null;
  blitz_trip_location: string | null;
  committed_blitzes: unknown; // JSONB array of committed blitz names
  declined_blitz_rsvps: unknown; // JSONB array of declined blitz IDs
  custom_counter_config: unknown; // JSONB array of custom counter definitions
  efp_mode_enabled: boolean | null;
  timezone: string | null;
  crm_enabled: boolean | null;
  crm_detailed_enabled: boolean | null;
  profile_photo_url: string | null;
}

// Helper to get user-specific cache key
const getRepCacheKey = (userId: string) => `rep-data-cache-${userId}`;

// Helper to clear all rep data caches (for logout)
export const clearAllRepCaches = () => {
  // Clear any rep-data-cache keys
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('rep-data-cache')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
};

// Helper to get initial userId synchronously from localStorage
const getStoredUserId = (): string | null => {
  try {
    return localStorage.getItem('kaizen-current-user-id');
  } catch {
    return null;
  }
};

// Helper to store userId for synchronous access
const storeUserId = (userId: string | null) => {
  try {
    if (userId) {
      localStorage.setItem('kaizen-current-user-id', userId);
    } else {
      localStorage.removeItem('kaizen-current-user-id');
    }
  } catch {
    // Ignore storage errors
  }
};

export const useRepData = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Initialize with stored userId for instant access (prevents flicker)
  const [currentUserId, setCurrentUserId] = useState<string | null>(getStoredUserId);
  const [authChecked, setAuthChecked] = useState(false);

  // Get current user ID on mount and listen for auth changes
  useEffect(() => {
    let isMounted = true;
    
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (isMounted) {
        const userId = user?.id ?? null;
        setCurrentUserId(userId);
        storeUserId(userId);
        setAuthChecked(true);
      }
    };
    getCurrentUser();

    // Listen for auth changes to update currentUserId
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;
      
      // If user changed, clear old user's cache
      if (currentUserId && newUserId && currentUserId !== newUserId) {
        console.log('User changed, clearing old cache');
        clearAllRepCaches();
        queryClient.clear();
      }
      
      if (isMounted) {
        setCurrentUserId(newUserId);
        storeUserId(newUserId);
        setAuthChecked(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [currentUserId, queryClient]);

  // Get initial data from localStorage cache for instant display (prevents flicker)
  const getInitialData = (): RepData | null => {
    if (!currentUserId) return null;
    const cacheKey = getRepCacheKey(currentUserId);
    const cachedRep = localStorage.getItem(cacheKey);
    if (cachedRep) {
      try {
        const { data: cached, userId: cachedUserId } = JSON.parse(cachedRep);
        // Only use cache if it belongs to current user
        if (cached && cachedUserId === currentUserId) {
          return cached;
        }
      } catch (e) {
        // Invalid cache, ignore
      }
    }
    return null;
  };

  const { data: repData, isLoading: loading } = useQuery({
    queryKey: ['rep-data', currentUserId],
    enabled: !!currentUserId, // Only run when we have a user ID
    staleTime: 1 * 60 * 1000, // 1 minute - more responsive to changes
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
    refetchOnWindowFocus: true, // Refresh when app comes back to foreground
    retry: 1,
    initialData: getInitialData() ?? undefined, // Use cached data immediately to prevent flicker
    queryFn: async () => {
      if (!currentUserId) return null;

      const cacheKey = getRepCacheKey(currentUserId);

      const { data, error } = await supabase
        .from("reps")
        .select("*")
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (error) throw error;

      // CRITICAL: Validate fetched data belongs to current user
      if (data && data.user_id !== currentUserId) {
        console.error('SECURITY: Fetched rep data does not match current user!', {
          fetchedUserId: data.user_id,
          currentUserId
        });
        return null;
      }

      // If no rep data exists, automatically sync from Notion
      if (!data) {
        console.log("No rep data found, attempting auto-sync from Notion...");
        toast({
          title: "Syncing from Notion",
          description: "Loading your data from Notion...",
        });

        const { error: syncError } = await supabase.functions.invoke(
          "sync-notion-reps"
        );

        if (syncError) {
          console.error("Auto-sync error:", syncError);
          toast({
            title: "Sync failed",
            description: "Could not sync your data from Notion. Please contact your team leader.",
            variant: "destructive",
          });
          return null;
        }

        // Fetch the newly synced data
        const { data: syncedData, error: refetchError } = await supabase
          .from("reps")
          .select("*")
          .eq("user_id", currentUserId)
          .maybeSingle();

        if (refetchError) throw refetchError;

        // Validate synced data
        if (syncedData && syncedData.user_id !== currentUserId) {
          console.error('SECURITY: Synced rep data does not match current user!');
          return null;
        }

        if (syncedData) {
          toast({
            title: "Sync successful",
            description: "Your data has been loaded from Notion.",
          });
          // Cache the synced data with user ID
          localStorage.setItem(cacheKey, JSON.stringify({
            data: syncedData,
            timestamp: Date.now(),
            userId: currentUserId
          }));
        }

        return syncedData;
      }

      // Cache the data for offline access with user ID
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now(),
        userId: currentUserId
      }));

      return data;
    },
  });

  const refetch = async () => {
    if (!currentUserId) return;
    // Trigger Notion sync
    await supabase.functions.invoke("sync-notion-reps");
    // Wait a moment for sync to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Refetch the data
    await queryClient.invalidateQueries({ queryKey: ['rep-data', currentUserId] });
  };

  useEffect(() => {
    if (!currentUserId) return;

    // Set up automatic periodic sync from Notion every 2 minutes
    const syncInterval = setInterval(async () => {
      console.log("Auto-syncing from Notion...");
      try {
        await supabase.functions.invoke("sync-notion-reps");
        await queryClient.invalidateQueries({ queryKey: ['rep-data', currentUserId] });
      } catch (error) {
        console.error("Auto-sync error:", error);
      }
    }, 2 * 60 * 1000); // 2 minutes - more responsive for leader updates

    // PWA visibility change handler - sync when app comes back to foreground
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log("App became visible, syncing from Notion...");
        try {
          await supabase.functions.invoke("sync-notion-reps");
          await queryClient.invalidateQueries({ queryKey: ['rep-data', currentUserId] });
        } catch (error) {
          console.error("Visibility sync error:", error);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up realtime subscription to instantly reflect database changes
    // CRITICAL: Filter to only process changes for the CURRENT USER
    const channel = supabase
      .channel(`reps-changes-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reps",
          filter: `user_id=eq.${currentUserId}` // Only listen to current user's changes
        },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const newData = payload.new as RepData;
            
            // CRITICAL: Double-check the data belongs to current user
            if (newData.user_id === currentUserId) {
              queryClient.setQueryData(['rep-data', currentUserId], newData);
              
              // Update cache
              const cacheKey = getRepCacheKey(currentUserId);
              localStorage.setItem(cacheKey, JSON.stringify({
                data: newData,
                timestamp: Date.now(),
                userId: currentUserId
              }));
            } else {
              console.warn('Received realtime update for different user, ignoring');
            }
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast, currentUserId]);

  // isInitializing: true when we don't have a stored userId AND auth hasn't been checked yet
  // If we have a stored userId, we can render immediately with cached data
  const isInitializing = !currentUserId && !authChecked;

  return { repData: repData ?? null, loading, isInitializing, refetch };
};
