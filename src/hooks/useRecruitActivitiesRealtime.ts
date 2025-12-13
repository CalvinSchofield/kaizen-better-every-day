import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RecruitActivity } from "./useGroupRecruits";

/**
 * Hook that subscribes to realtime updates for recruit_activities table.
 * This ensures all leaders in a recruit's upline see activity changes immediately
 * when any other leader logs, updates, or deletes an activity.
 */
export const useRecruitActivitiesRealtime = (recruitNotionIds: string[]) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (recruitNotionIds.length === 0) return;

    console.log('[Realtime] Subscribing to recruit_activities for', recruitNotionIds.length, 'recruits');

    const channel = supabase
      .channel('recruit-activities-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recruit_activities',
        },
        (payload) => {
          console.log('[Realtime] recruit_activities change:', payload.eventType, payload);
          
          const newActivity = payload.new as RecruitActivity | undefined;
          const oldActivity = payload.old as RecruitActivity | undefined;
          
          // Only process if activity is for a recruit we're tracking
          const relevantNotionId = newActivity?.rep_notion_page_id || oldActivity?.rep_notion_page_id;
          if (!relevantNotionId || !recruitNotionIds.includes(relevantNotionId)) {
            return;
          }

          // Update the cache based on the event type
          queryClient.setQueriesData({ queryKey: ['group-recruits'] }, (old: any) => {
            if (!old) return old;
            
            let updatedActivities = [...old.activities];
            
            switch (payload.eventType) {
              case 'INSERT':
                // Only add if not already present (avoid duplicates from optimistic updates)
                if (!updatedActivities.some((a: RecruitActivity) => a.id === newActivity?.id)) {
                  updatedActivities = [newActivity, ...updatedActivities];
                }
                break;
              case 'UPDATE':
                updatedActivities = updatedActivities.map((a: RecruitActivity) =>
                  a.id === newActivity?.id ? newActivity : a
                );
                break;
              case 'DELETE':
                updatedActivities = updatedActivities.filter(
                  (a: RecruitActivity) => a.id !== oldActivity?.id
                );
                break;
            }
            
            return {
              ...old,
              activities: updatedActivities,
            };
          });

          // Also invalidate assigned-tasks for immediate sync of task assignments
          queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] recruit_activities subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Unsubscribing from recruit_activities');
      supabase.removeChannel(channel);
    };
  }, [recruitNotionIds.join(','), queryClient]);
};

/**
 * Hook that subscribes to realtime updates for recruit_suggestions table.
 */
export const useRecruitSuggestionsRealtime = (leaderNotionId: string | null) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!leaderNotionId) return;

    console.log('[Realtime] Subscribing to recruit_suggestions');

    const channel = supabase
      .channel('recruit-suggestions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recruit_suggestions',
        },
        (payload) => {
          console.log('[Realtime] recruit_suggestions change:', payload.eventType);
          
          // Invalidate queries to refresh suggestions
          queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
          queryClient.invalidateQueries({ queryKey: ['my-suggestions'] });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] recruit_suggestions subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Unsubscribing from recruit_suggestions');
      supabase.removeChannel(channel);
    };
  }, [leaderNotionId, queryClient]);
};
