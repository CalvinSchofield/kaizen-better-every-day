import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "./useCurrentUserId";

export interface ActivityCalendarEvent {
  id: string;
  activity_id: string;
  user_id: string;
  added_at: string;
  calendar_date: string;
  calendar_time: string | null;
  recruit_name: string | null;
  event_title: string | null;
}

/**
 * Check if the current user has added a specific activity to their calendar
 */
export function useActivityCalendarEvent(activityId: string | null) {
  const { userId } = useCurrentUserId();
  
  return useQuery({
    queryKey: ['activity-calendar-event', activityId, userId],
    queryFn: async () => {
      if (!activityId || !userId) return null;
      
      const { data, error } = await supabase
        .from('activity_calendar_events')
        .select('*')
        .eq('activity_id', activityId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching calendar event:', error);
        return null;
      }
      
      return data as ActivityCalendarEvent | null;
    },
    enabled: !!activityId && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get all calendar events for the current user
 */
export function useUserCalendarEvents() {
  const { userId } = useCurrentUserId();
  
  return useQuery({
    queryKey: ['user-calendar-events', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('activity_calendar_events')
        .select('*')
        .eq('user_id', userId)
        .order('calendar_date', { ascending: true });
      
      if (error) {
        console.error('Error fetching user calendar events:', error);
        return [];
      }
      
      return data as ActivityCalendarEvent[];
    },
    enabled: !!userId,
  });
}

/**
 * Add an activity to the user's calendar tracking
 */
export function useAddCalendarEvent() {
  const queryClient = useQueryClient();
  const { userId } = useCurrentUserId();
  
  return useMutation({
    mutationFn: async (params: {
      activityId: string;
      calendarDate: string;
      calendarTime: string | null;
      recruitName: string;
      eventTitle: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('activity_calendar_events')
        .upsert({
          activity_id: params.activityId,
          user_id: userId,
          calendar_date: params.calendarDate,
          calendar_time: params.calendarTime,
          recruit_name: params.recruitName,
          event_title: params.eventTitle,
        }, {
          onConflict: 'activity_id,user_id',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activity-calendar-event', data.activity_id] });
      queryClient.invalidateQueries({ queryKey: ['user-calendar-events'] });
    },
  });
}

/**
 * Update an existing calendar event tracking entry
 */
export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      id: string;
      calendarDate: string;
      calendarTime: string | null;
      eventTitle?: string;
    }) => {
      const { data, error } = await supabase
        .from('activity_calendar_events')
        .update({
          calendar_date: params.calendarDate,
          calendar_time: params.calendarTime,
          ...(params.eventTitle && { event_title: params.eventTitle }),
        })
        .eq('id', params.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activity-calendar-event', data.activity_id] });
      queryClient.invalidateQueries({ queryKey: ['user-calendar-events'] });
    },
  });
}

/**
 * Remove calendar event tracking (user removed from their calendar)
 */
export function useRemoveCalendarEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('activity_calendar_events')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-calendar-event'] });
      queryClient.invalidateQueries({ queryKey: ['user-calendar-events'] });
    },
  });
}
