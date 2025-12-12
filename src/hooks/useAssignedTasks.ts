import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Recruit } from "./useGroupRecruits";

export interface AssignedTask {
  id: string;
  rep_notion_page_id: string;
  activity_type: string;
  notes: string | null;
  next_action: string | null;
  next_action_due: string | null;
  assigned_to_user_id: string;
  assignment_status: string;
  logged_by_user_id: string;
  created_at: string;
  completed_at: string | null;
  // Joined data
  recruit?: Recruit;
  assignedByName?: string;
}

export const useAssignedTasks = (recruits: Recruit[]) => {
  return useQuery({
    queryKey: ['assigned-tasks'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];

      // Fetch tasks assigned to current user that are pending
      const { data: tasks, error } = await supabase
        .from('recruit_activities')
        .select('*')
        .eq('assigned_to_user_id', session.user.id)
        .eq('assignment_status', 'pending')
        .order('next_action_due', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Error fetching assigned tasks:', error);
        return [];
      }

      // Get the user who assigned each task
      const loggedByIds = [...new Set(tasks?.map(t => t.logged_by_user_id) || [])];
      const { data: assigners } = await supabase
        .from('reps')
        .select('user_id, name')
        .in('user_id', loggedByIds);

      const assignerMap = new Map(assigners?.map(a => [a.user_id, a.name]) || []);

      // Map tasks to include recruit data
      const recruitMap = new Map(recruits.map(r => [r.notionPageId, r]));
      
      return (tasks || []).map(task => ({
        ...task,
        recruit: recruitMap.get(task.rep_notion_page_id),
        assignedByName: assignerMap.get(task.logged_by_user_id) || 'Unknown',
      })) as AssignedTask[];
    },
    enabled: recruits.length > 0,
    staleTime: 30 * 1000, // 30 seconds
  });
};

export const useCompleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, notes }: { taskId: string; notes?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      // Update the task status
      const { error: updateError } = await supabase
        .from('recruit_activities')
        .update({
          assignment_status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (updateError) throw updateError;

      // Get the original task to know the recruit
      const { data: originalTask } = await supabase
        .from('recruit_activities')
        .select('rep_notion_page_id, next_action')
        .eq('id', taskId)
        .single();

      // Log a completion activity
      if (originalTask) {
        await supabase
          .from('recruit_activities')
          .insert({
            rep_notion_page_id: originalTask.rep_notion_page_id,
            activity_type: 'note',
            logged_by_user_id: session.user.id,
            notes: notes || `✓ Completed: ${originalTask.next_action || 'Assigned task'}`,
          });
      }

      return { taskId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
    },
  });
};
