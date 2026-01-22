import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RecruitActivity } from "./useGroupRecruits";
import { toast } from "sonner";

/**
 * Hook that subscribes to realtime updates for recruit_activities table.
 * This ensures all leaders in a recruit's upline see activity changes immediately
 * when any other leader logs, updates, or deletes an activity.
 */
export const useRecruitActivitiesRealtime = (recruitNotionIds: string[]) => {
  const queryClient = useQueryClient();
  const currentUserIdRef = useRef<string | null>(null);

  // Fetch current user ID once on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      currentUserIdRef.current = data.user?.id || null;
    });
  }, []);

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
        async (payload) => {
          console.log('[Realtime] recruit_activities change:', payload.eventType, payload);
          
          const newActivity = payload.new as RecruitActivity | undefined;
          const oldActivity = payload.old as RecruitActivity | undefined;
          
          // Only process if activity is for a recruit we're tracking
          const relevantRecruitId = newActivity?.recruit_id || oldActivity?.recruit_id;
          if (!relevantRecruitId || !recruitNotionIds.includes(relevantRecruitId)) {
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

          // Check if this activity update affects the current user's calendar
          // Only notify if someone ELSE rescheduled an activity that WE have in our calendar
          if (payload.eventType === 'UPDATE' && newActivity && currentUserIdRef.current) {
            const oldDue = (oldActivity as any)?.next_action_due;
            const newDue = (newActivity as any)?.next_action_due;
            
            // Only check if the due date actually changed
            if (oldDue && newDue && oldDue !== newDue) {
              // Check if current user has this activity in their calendar
              const { data: calendarEvent } = await supabase
                .from('activity_calendar_events')
                .select('id')
                .eq('activity_id', newActivity.id)
                .eq('user_id', currentUserIdRef.current)
                .maybeSingle();
              
              if (calendarEvent) {
                // Only show toast if someone else made the change
                const updatedBy = (newActivity as any)?.logged_by_user_id;
                if (updatedBy && updatedBy !== currentUserIdRef.current) {
                  toast.info('A task in your calendar was rescheduled', {
                    description: 'You may want to update your calendar',
                    duration: 6000,
                  });
                }
              }
            }
          }
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

/**
 * Hook that subscribes to realtime updates for reps table.
 * This catches changes from Notion sync or direct updates for immediate UI refresh.
 * 
 * IMPORTANT: We update the cache directly instead of invalidating to prevent
 * race conditions where a refetch might return stale data before the DB has
 * fully propagated the update (which was causing stage changes to revert).
 */
export const useRepsRealtime = (recruitNotionIds: string[]) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (recruitNotionIds.length === 0) return;

    console.log('[Realtime] Subscribing to reps table for', recruitNotionIds.length, 'recruits');

    const channel = supabase
      .channel('reps-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reps',
        },
        (payload) => {
          const updatedRep = payload.new as any;
          
          // Only process if this rep is one we're tracking
          if (!updatedRep?.notion_page_id || !recruitNotionIds.includes(updatedRep.notion_page_id)) {
            return;
          }

          console.log('[Realtime] reps change for:', updatedRep.name, 'stage:', updatedRep.stage);

          // Update the cache directly with the new values instead of invalidating
          // This prevents race conditions where a refetch returns stale data
          queryClient.setQueriesData({ queryKey: ['group-recruits'] }, (old: any) => {
            if (!old) return old;
            
            return {
              ...old,
              recruits: old.recruits.map((r: any) => {
                if (r.notionPageId !== updatedRep.notion_page_id) return r;
                
                // Merge updated fields from the realtime payload
                return {
                  ...r,
                  stage: updatedRep.stage ?? r.stage,
                  phone: updatedRep.phone ?? r.phone,
                  email: updatedRep.email ?? r.email,
                  year: updatedRep.year ?? r.year,
                  rampToBlitzPhase: updatedRep.ramp_to_blitz_phase ?? r.rampToBlitzPhase,
                  phase1Complete: updatedRep.ramp_phase_1_complete ?? r.phase1Complete,
                  phase2Complete: updatedRep.ramp_phase_2_complete ?? r.phase2Complete,
                  phase3Complete: updatedRep.ramp_phase_3_complete ?? r.phase3Complete,
                  phase4Complete: updatedRep.ramp_phase_4_complete ?? r.phase4Complete,
                  onboardingComplete: updatedRep.onboarding_complete ?? r.onboardingComplete,
                  trainingsComplete: updatedRep.trainings_complete ?? r.trainingsComplete,
                  slackJoined: updatedRep.slack_joined ?? r.slackJoined,
                  ipadAssigned: updatedRep.ipad_assigned ?? r.ipadAssigned,
                  blitzReady: updatedRep.blitz_ready ?? r.blitzReady,
                };
              }),
            };
          });

          // Also update the live recruit detail if open
          queryClient.setQueriesData({ queryKey: ['recruit-detail-live', updatedRep.notion_page_id] }, (old: any) => {
            if (!old) return old;
            return {
              ...old,
              stage: updatedRep.stage ?? old.stage,
              phone: updatedRep.phone ?? old.phone,
              email: updatedRep.email ?? old.email,
              year: updatedRep.year ?? old.year,
              rampToBlitzPhase: updatedRep.ramp_to_blitz_phase ?? old.rampToBlitzPhase,
              phase1Complete: updatedRep.ramp_phase_1_complete ?? old.phase1Complete,
              phase2Complete: updatedRep.ramp_phase_2_complete ?? old.phase2Complete,
              phase3Complete: updatedRep.ramp_phase_3_complete ?? old.phase3Complete,
              phase4Complete: updatedRep.ramp_phase_4_complete ?? old.phase4Complete,
              onboardingComplete: updatedRep.onboarding_complete ?? old.onboardingComplete,
              trainingsComplete: updatedRep.trainings_complete ?? old.trainingsComplete,
              slackJoined: updatedRep.slack_joined ?? old.slackJoined,
              ipadAssigned: updatedRep.ipad_assigned ?? old.ipadAssigned,
              blitzReady: updatedRep.blitz_ready ?? old.blitzReady,
            };
          });

          // Only invalidate non-critical queries that don't cause race conditions
          queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['recruit-rep-data'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['leader-preseason-prep-leaderboard-weekly'], exact: false });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] reps subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Unsubscribing from reps');
      supabase.removeChannel(channel);
    };
  }, [recruitNotionIds.join(','), queryClient]);
};
