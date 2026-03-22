import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "./useCurrentUserId";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonField = any;

export interface RepData {
  id: string;
  user_id: string;
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
  completed_tasks: JsonField;
  nudge_leader: boolean | null;
  last_nudge_time: string | null;
  year: string | null;
  personal_fp: number | null;
  personal_fp_goal: number | null;
  reps_with_sale: number | null;
  reps_with_sale_goal: number | null;
  blitz_trip_name: string | null;
  blitz_trip_date: string | null;
  blitz_trip_end_date: string | null;
  blitz_trip_location: string | null;
  committed_blitzes: JsonField;
  declined_blitz_rsvps: JsonField;
  custom_counter_config: JsonField;
  efp_mode_enabled: boolean | null;
  timezone: string | null;
  crm_enabled: boolean | null;
  crm_detailed_enabled: boolean | null;
  profile_photo_url: string | null;
  watched_videos: JsonField;
  ipad_assigned: boolean | null;
  intro_seen: boolean | null;
  sales_logger_enabled: boolean | null;
  me_vs_me_enabled: boolean | null;
  pages_toured: JsonField;
  contacted_for_blitz: JsonField;
  counter_layout_config: JsonField;
  created_at: string | null;
  dismissed_recruit_ids: JsonField;
  processed_blitz_ids: JsonField;
  rsvp_first_window_ack_blitz_ids: string[];
  rsvp_second_window_ack_blitz_ids: string[];
  updated_at: string | null;
  self_reported_onboarding_complete: boolean | null;
  self_reported_trainings_complete: boolean | null;
  self_reported_slack_joined: boolean | null;
}

// Helper to get user-specific cache key
const getRepCacheKey = (userId: string) => `rep-data-cache-${userId}`;

// Helper to clear all rep data caches (for logout)
export const clearAllRepCaches = () => {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('rep-data-cache')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
};

export const useRepData = () => {
  const queryClient = useQueryClient();
  // PERF FIX: Use shared useCurrentUserId instead of independent auth check.
  // This eliminates a redundant getUser() network call + duplicate onAuthStateChange listener.
  const { userId: currentUserId, isReady: authChecked } = useCurrentUserId();

  const { data: repData, isLoading: loading } = useQuery({
    queryKey: ['rep-data', currentUserId],
    enabled: !!currentUserId,
    staleTime: 1 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      if (!currentUserId) return null;

      const cacheKey = getRepCacheKey(currentUserId);

      const { data, error } = await supabase
        .from("reps")
        .select("*")
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.user_id !== currentUserId) {
        console.error('SECURITY: Fetched rep data does not match current user!');
        return null;
      }

      if (!data) {
        console.log("No rep data found - user needs to be added by admin");
        return null;
      }

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
    await queryClient.invalidateQueries({ queryKey: ['rep-data', currentUserId] });
  };

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`reps-changes-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reps",
          filter: `user_id=eq.${currentUserId}`
        },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const newData = payload.new as RepData;
            if (newData.user_id === currentUserId) {
              queryClient.setQueryData(['rep-data', currentUserId], newData);
              const cacheKey = getRepCacheKey(currentUserId);
              localStorage.setItem(cacheKey, JSON.stringify({
                data: newData,
                timestamp: Date.now(),
                userId: currentUserId
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, currentUserId]);

  const isInitializing = !currentUserId && !authChecked;

  return { repData: repData ?? null, loading, isInitializing, refetch };
};
