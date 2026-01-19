import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "./useCurrentUserId";
import { toast } from "sonner";
import { hapticLight, hapticMedium } from "@/utils/haptics";

// Types
export interface ActivityReaction {
  id: string;
  activity_id: string;
  user_id: string;
  reaction_type: 'like' | 'helpful' | 'thumbsup';
  created_at: string;
}

export interface ActivityComment {
  id: string;
  activity_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  // Joined data
  user_name?: string;
  user_photo?: string | null;
}

export interface ReadStatus {
  id: string;
  recruit_id: string;
  user_id: string;
  last_seen_at: string;
}

// Hook for activity reactions
export const useActivityReactions = (activityIds: string[]) => {
  return useQuery({
    queryKey: ['activity-reactions', activityIds],
    queryFn: async () => {
      if (activityIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('recruit_activity_reactions')
        .select('*')
        .in('activity_id', activityIds);
      
      if (error) throw error;
      
      // Group by activity_id
      const reactionsByActivity: Record<string, ActivityReaction[]> = {};
      data?.forEach(reaction => {
        if (!reactionsByActivity[reaction.activity_id]) {
          reactionsByActivity[reaction.activity_id] = [];
        }
        reactionsByActivity[reaction.activity_id].push(reaction as ActivityReaction);
      });
      
      return reactionsByActivity;
    },
    enabled: activityIds.length > 0,
    staleTime: 30 * 1000,
  });
};

// Hook to toggle a reaction
export const useToggleReaction = () => {
  const queryClient = useQueryClient();
  const { userId } = useCurrentUserId();
  
  return useMutation({
    mutationFn: async ({ 
      activityId, 
      reactionType = 'like' 
    }: { 
      activityId: string; 
      reactionType?: 'like' | 'helpful' | 'thumbsup' 
    }) => {
      if (!userId) throw new Error('Not authenticated');
      
      // Check if user already has this reaction
      const { data: existing } = await supabase
        .from('recruit_activity_reactions')
        .select('id')
        .eq('activity_id', activityId)
        .eq('user_id', userId)
        .eq('reaction_type', reactionType)
        .maybeSingle();
      
      if (existing) {
        // Remove reaction
        const { error } = await supabase
          .from('recruit_activity_reactions')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        return { action: 'removed' };
      } else {
        // Add reaction
        const { error } = await supabase
          .from('recruit_activity_reactions')
          .insert({
            activity_id: activityId,
            user_id: userId,
            reaction_type: reactionType,
          });
        if (error) throw error;
        return { action: 'added' };
      }
    },
    onMutate: () => {
      hapticLight();
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activity-reactions'] });
    },
    onError: () => {
      toast.error('Failed to update reaction');
    },
  });
};

// Hook for activity comments
export const useActivityComments = (activityId: string | null) => {
  return useQuery({
    queryKey: ['activity-comments', activityId],
    queryFn: async () => {
      if (!activityId) return [];
      
      const { data, error } = await supabase
        .from('recruit_activity_comments')
        .select('*')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Get user info for comments
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: users } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url')
        .in('user_id', userIds);
      
      const userMap = new Map(users?.map(u => [u.user_id, u]) || []);
      
      return data.map(comment => ({
        ...comment,
        user_name: userMap.get(comment.user_id)?.name || 'Unknown',
        user_photo: userMap.get(comment.user_id)?.profile_photo_url || null,
      })) as ActivityComment[];
    },
    enabled: !!activityId,
    staleTime: 10 * 1000,
  });
};

// Hook to add a comment with optional mentions
export const useAddComment = () => {
  const queryClient = useQueryClient();
  const { userId } = useCurrentUserId();
  
  return useMutation({
    mutationFn: async ({ 
      activityId, 
      content,
      mentionedUserIds = [],
      commenterName,
      recruitName,
    }: { 
      activityId: string; 
      content: string;
      mentionedUserIds?: string[];
      commenterName?: string;
      recruitName?: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      
      // Insert the comment
      const { data, error } = await supabase
        .from('recruit_activity_comments')
        .insert({
          activity_id: activityId,
          user_id: userId,
          content: content.trim(),
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // If there are mentions, store them and send notifications
      if (mentionedUserIds.length > 0 && data) {
        // Store mentions
        const mentionRecords = mentionedUserIds.map(mentionedUserId => ({
          comment_id: data.id,
          mentioned_user_id: mentionedUserId,
        }));
        
        await supabase
          .from('activity_comment_mentions')
          .insert(mentionRecords);
        
        // Send notification via edge function
        try {
          await supabase.functions.invoke('send-mention-notification', {
            body: {
              mentionedUserIds,
              commenterId: userId,
              commenterName: commenterName || 'Someone',
              recruitName,
              activityId,
              commentContent: content.trim(),
            },
          });
        } catch (notifyError) {
          console.error('Failed to send mention notifications:', notifyError);
          // Don't fail the comment if notification fails
        }
      }
      
      return data;
    },
    onMutate: () => {
      hapticMedium();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activity-comments', variables.activityId] });
      queryClient.invalidateQueries({ queryKey: ['activity-comment-counts'] });
    },
    onError: () => {
      toast.error('Failed to add comment');
    },
  });
};

// Hook to update activity notes (only own activities)
export const useUpdateActivityNotes = () => {
  const queryClient = useQueryClient();
  const { userId } = useCurrentUserId();
  
  return useMutation({
    mutationFn: async ({ 
      activityId, 
      notes 
    }: { 
      activityId: string; 
      notes: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      
      // First verify the user owns this activity
      const { data: activity, error: fetchError } = await supabase
        .from('recruit_activities')
        .select('logged_by_user_id')
        .eq('id', activityId)
        .single();
      
      if (fetchError) throw fetchError;
      if (activity.logged_by_user_id !== userId) {
        throw new Error('You can only edit your own activities');
      }
      
      // Update the notes
      const { error } = await supabase
        .from('recruit_activities')
        .update({ notes: notes.trim() })
        .eq('id', activityId);
      
      if (error) throw error;
    },
    onMutate: () => {
      hapticMedium();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruit-activities'] });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      toast.success('Activity updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update activity');
    },
  });
};

// Hook to delete a comment
export const useDeleteComment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('recruit_activity_comments')
        .delete()
        .eq('id', commentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-comments'] });
      queryClient.invalidateQueries({ queryKey: ['activity-comment-counts'] });
    },
    onError: () => {
      toast.error('Failed to delete comment');
    },
  });
};

// Hook to get comment counts for multiple activities
export const useActivityCommentCounts = (activityIds: string[]) => {
  return useQuery({
    queryKey: ['activity-comment-counts', activityIds],
    queryFn: async () => {
      if (activityIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('recruit_activity_comments')
        .select('activity_id')
        .in('activity_id', activityIds);
      
      if (error) throw error;
      
      // Count by activity_id
      const counts: Record<string, number> = {};
      data?.forEach(comment => {
        counts[comment.activity_id] = (counts[comment.activity_id] || 0) + 1;
      });
      
      return counts;
    },
    enabled: activityIds.length > 0,
    staleTime: 30 * 1000,
  });
};

// Hook for read status (unread detection)
export const useActivityReadStatus = (recruitId: string | null) => {
  const { userId } = useCurrentUserId();
  
  return useQuery({
    queryKey: ['activity-read-status', recruitId, userId],
    queryFn: async () => {
      if (!recruitId || !userId) return null;
      
      const { data, error } = await supabase
        .from('recruit_activity_read_status')
        .select('*')
        .eq('recruit_id', recruitId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) throw error;
      return data as ReadStatus | null;
    },
    enabled: !!recruitId && !!userId,
    staleTime: 60 * 1000,
  });
};

// Hook to mark activities as read
export const useMarkActivitiesRead = () => {
  const queryClient = useQueryClient();
  const { userId } = useCurrentUserId();
  
  return useMutation({
    mutationFn: async (recruitId: string) => {
      if (!userId) throw new Error('Not authenticated');
      
      // Upsert the read status
      const { error } = await supabase
        .from('recruit_activity_read_status')
        .upsert({
          recruit_id: recruitId,
          user_id: userId,
          last_seen_at: new Date().toISOString(),
        }, {
          onConflict: 'recruit_id,user_id',
        });
      
      if (error) throw error;
    },
    onSuccess: (_, recruitId) => {
      queryClient.invalidateQueries({ queryKey: ['activity-read-status', recruitId] });
      queryClient.invalidateQueries({ queryKey: ['unread-activity-counts'] });
    },
  });
};

// Hook to count unread activities for a recruit
export const useUnreadActivityCount = (recruitId: string | null, activities: Array<{ 
  id: string; 
  created_at: string; 
  logged_by_user_id: string;
}>) => {
  const { userId } = useCurrentUserId();
  const { data: readStatus } = useActivityReadStatus(recruitId);
  
  if (!userId || !recruitId || activities.length === 0) return 0;
  
  const lastSeenAt = readStatus?.last_seen_at 
    ? new Date(readStatus.last_seen_at) 
    : new Date(0);
  
  // Count activities created after last_seen_at by other users
  return activities.filter(a => 
    a.logged_by_user_id !== userId && 
    new Date(a.created_at) > lastSeenAt
  ).length;
};

// Real-time subscription for reactions and comments
export const useActivitySocialRealtime = (activityIds: string[]) => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (activityIds.length === 0) return;
    
    // Subscribe to reactions
    const reactionsChannel = supabase
      .channel('activity-reactions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recruit_activity_reactions',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['activity-reactions'] });
        }
      )
      .subscribe();
    
    // Subscribe to comments
    const commentsChannel = supabase
      .channel('activity-comments-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recruit_activity_comments',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['activity-comments'] });
          queryClient.invalidateQueries({ queryKey: ['activity-comment-counts'] });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [activityIds, queryClient]);
};

// Extended activity type for digest view
export interface UnreadActivity {
  id: string;
  recruit_id: string;
  recruit_name: string;
  activity_type: string;
  notes: string | null;
  next_action: string | null;
  next_action_due: string | null;
  created_at: string;
  logged_by_user_id: string;
  logger_name?: string;
  logger_photo?: string | null;
  assigned_to_user_id: string | null;
  assignment_status: string | null;
  completed_at: string | null;
}

// Hook to fetch all unread activities across all recruits
export const useAllUnreadActivities = (recruitIds: string[]) => {
  const { userId } = useCurrentUserId();
  
  return useQuery({
    queryKey: ['all-unread-activities', recruitIds.join(','), userId],
    queryFn: async () => {
      if (!userId || recruitIds.length === 0) return [];
      
      // 1. Get all read statuses for current user
      const { data: readStatuses } = await supabase
        .from('recruit_activity_read_status')
        .select('recruit_id, last_seen_at')
        .eq('user_id', userId)
        .in('recruit_id', recruitIds);
      
      // Create a map of recruit_id -> last_seen_at
      const readStatusMap = new Map<string, Date>();
      readStatuses?.forEach(rs => {
        readStatusMap.set(rs.recruit_id, new Date(rs.last_seen_at));
      });
      
      // 2. Get all activities from all recruits (limit to recent ones)
      const { data: activities, error } = await supabase
        .from('recruit_activities')
        .select(`
          id,
          recruit_id,
          activity_type,
          notes,
          next_action,
          next_action_due,
          created_at,
          logged_by_user_id,
          assigned_to_user_id,
          assignment_status,
          completed_at
        `)
        .in('recruit_id', recruitIds)
        .neq('logged_by_user_id', userId) // Exclude own activities
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) throw error;
      if (!activities) return [];
      
      // 3. Filter to unread only (created after last_seen_at)
      const unreadActivities = activities.filter(activity => {
        const lastSeenAt = readStatusMap.get(activity.recruit_id) || new Date(0);
        return new Date(activity.created_at) > lastSeenAt;
      });
      
      // 4. Get recruit names
      const recruitIdsToFetch = [...new Set(unreadActivities.map(a => a.recruit_id))];
      const { data: recruits } = await supabase
        .from('recruits')
        .select('id, name')
        .in('id', recruitIdsToFetch);
      
      const recruitMap = new Map(recruits?.map(r => [r.id, r.name]) || []);
      
      // 5. Get logger info
      const loggerIds = [...new Set(unreadActivities.map(a => a.logged_by_user_id))];
      const { data: loggers } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url')
        .in('user_id', loggerIds);
      
      const loggerMap = new Map(loggers?.map(l => [l.user_id, l]) || []);
      
      // 6. Combine all data
      return unreadActivities.map(activity => ({
        ...activity,
        recruit_name: recruitMap.get(activity.recruit_id) || 'Unknown',
        logger_name: loggerMap.get(activity.logged_by_user_id)?.name,
        logger_photo: loggerMap.get(activity.logged_by_user_id)?.profile_photo_url,
      })) as UnreadActivity[];
    },
    enabled: !!userId && recruitIds.length > 0,
    staleTime: 30 * 1000,
  });
};

// Hook to mark all activities as read for multiple recruits
export const useMarkAllActivitiesRead = () => {
  const queryClient = useQueryClient();
  const { userId } = useCurrentUserId();
  
  return useMutation({
    mutationFn: async (recruitIds: string[]) => {
      if (!userId || recruitIds.length === 0) return;
      
      const now = new Date().toISOString();
      
      // Upsert read status for all recruits
      const records = recruitIds.map(recruitId => ({
        recruit_id: recruitId,
        user_id: userId,
        last_seen_at: now,
      }));
      
      const { error } = await supabase
        .from('recruit_activity_read_status')
        .upsert(records, {
          onConflict: 'recruit_id,user_id',
        });
      
      if (error) throw error;
    },
    onMutate: () => {
      hapticMedium();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-read-status'] });
      queryClient.invalidateQueries({ queryKey: ['all-unread-activities'] });
      queryClient.invalidateQueries({ queryKey: ['unread-activity-counts'] });
      toast.success('All marked as read');
    },
    onError: () => {
      toast.error('Failed to mark as read');
    },
  });
};

// Hook to get total unread count across all recruits
export const useTotalUnreadCount = (recruitIds: string[]) => {
  const { data: unreadActivities } = useAllUnreadActivities(recruitIds);
  return unreadActivities?.length || 0;
};
