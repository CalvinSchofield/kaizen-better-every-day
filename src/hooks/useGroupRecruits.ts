import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "./useTeamAccess";

export interface Recruit {
  notionPageId: string;
  name: string;
  phone: string;
  email: string;
  stage: string;
  recruiterNotionId: string;
  year: string;
  lastContact: string | null;
  nextAction: string | null;
  nextActionDue: string | null;
  createdAt: string;
}

export interface RecruitActivity {
  id: string;
  rep_notion_page_id: string;
  activity_type: string;
  logged_by_user_id: string;
  notes: string | null;
  next_action: string | null;
  next_action_due: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface RecruitSuggestion {
  id: string;
  suggested_by_user_id: string;
  suggested_by_name: string;
  name: string;
  phone: string;
  relationship: string | null;
  notes: string | null;
  status: string;
  team_leader_notion_id: string;
  created_at: string;
}

export const useGroupRecruits = () => {
  const { data: teamAccess } = useTeamAccess();

  return useQuery({
    queryKey: ['group-recruits', teamAccess?.accessibleUserIds],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Get accessible notion IDs from team access
      const accessibleNotionIds = teamAccess?.accessibleReps?.map(r => r.notionPageId) || [];

      const { data, error } = await supabase.functions.invoke('fetch-group-recruits', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { accessibleNotionIds },
      });

      if (error) throw error;
      return data as {
        recruits: Recruit[];
        activities: RecruitActivity[];
        pendingSuggestions: RecruitSuggestion[];
      };
    },
    enabled: !!teamAccess && teamAccess.accessLevel !== 'none',
    staleTime: 1000 * 60 * 2,
  });
};

export const useSubmitSuggestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestion: {
      name: string;
      phone: string;
      relationship?: string;
      notes?: string;
      teamLeaderNotionId: string;
      suggestedByName: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('recruit_suggestions')
        .insert({
          suggested_by_user_id: user.id,
          suggested_by_name: suggestion.suggestedByName,
          name: suggestion.name,
          phone: suggestion.phone,
          relationship: suggestion.relationship,
          notes: suggestion.notes,
          team_leader_notion_id: suggestion.teamLeaderNotionId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['my-suggestions'] });
    },
  });
};

export const useApproveSuggestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      suggestionId, 
      action, 
      recruiterNotionId 
    }: { 
      suggestionId: string; 
      action: 'approve' | 'reject';
      recruiterNotionId?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('approve-recruit-suggestion', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { suggestionId, action, recruiterNotionId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
    },
  });
};

export const useUpdateRecruitStage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      recruitNotionId, 
      newStage, 
      notes 
    }: { 
      recruitNotionId: string; 
      newStage: string;
      notes?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('update-recruit-stage', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { recruitNotionId, newStage, notes },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
    },
  });
};

export const useLogRecruitActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      recruitNotionId, 
      activityType, 
      notes,
      nextAction,
      nextActionDue,
      updateLastContact = false,
    }: { 
      recruitNotionId: string; 
      activityType: 'phone_call' | 'in_person' | 'note' | 'next_step';
      notes?: string;
      nextAction?: string;
      nextActionDue?: string;
      updateLastContact?: boolean;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('log-recruit-activity', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { recruitNotionId, activityType, notes, nextAction, nextActionDue, updateLastContact },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
    },
  });
};

export const useMySuggestions = () => {
  return useQuery({
    queryKey: ['my-suggestions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('recruit_suggestions')
        .select('*')
        .eq('suggested_by_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RecruitSuggestion[];
    },
    staleTime: 1000 * 60 * 2,
  });
};
