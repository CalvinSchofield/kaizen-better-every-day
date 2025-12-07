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

// Recruiting pipeline stages (stages that indicate someone is in the recruiting funnel)
const RECRUITING_STAGES = [
  '100 List',
  'Potential Follow Up',
  'Reached out',
  'Reached Out',
  'Evaluating',
  'Signed',
  'Shadow ✅',
  'Sold 💲',
  'Sold (5+) 💰',
  'Not Interested'
];

export const useGroupRecruits = () => {
  const { data: teamAccess, isLoading: teamLoading } = useTeamAccess();
  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';

  const query = useQuery({
    queryKey: ['group-recruits', teamAccess?.accessibleReps?.[0]?.notionPageId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // For leaders, fetch team members which already includes stage info
      // Use the current user's rep notion page ID as the leader ID
      const { data: currentRep } = await supabase
        .from('reps')
        .select('notion_page_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      const leaderNotionId = currentRep?.notion_page_id;
      if (!leaderNotionId) {
        return { recruits: [], activities: [], pendingSuggestions: [] };
      }

      const { data: teamData, error: teamError } = await supabase.functions.invoke('fetch-team-members', {
        body: { leaderNotionPageId: leaderNotionId }
      });

      if (teamError) throw teamError;

      // Filter team members who are in recruiting stages
      const recruits: Recruit[] = (teamData?.teamMembers || [])
        .filter((member: any) => RECRUITING_STAGES.includes(member.stage))
        .map((member: any) => ({
          notionPageId: member.notionPageId,
          name: member.name,
          phone: member.phone || '',
          email: member.email || '',
          stage: member.stage,
          recruiterNotionId: leaderNotionId,
          year: member.year || '',
          lastContact: null,
          nextAction: null,
          nextActionDue: null,
          createdAt: new Date().toISOString(),
        }));

      // Fetch activities for these recruits
      let activities: RecruitActivity[] = [];
      if (recruits.length > 0) {
        const recruitNotionIds = recruits.map(r => r.notionPageId);
        const { data: activityData } = await supabase
          .from('recruit_activities')
          .select('*')
          .in('rep_notion_page_id', recruitNotionIds)
          .order('created_at', { ascending: false })
          .limit(500);
        
        activities = (activityData || []) as RecruitActivity[];
      }

      // Fetch pending suggestions for this leader (reuse leaderNotionId)
      let pendingSuggestions: RecruitSuggestion[] = [];
      if (leaderNotionId) {
        const { data: suggestions } = await supabase
          .from('recruit_suggestions')
          .select('*')
          .eq('team_leader_notion_id', leaderNotionId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        
        pendingSuggestions = (suggestions || []) as RecruitSuggestion[];
      }

      return { recruits, activities, pendingSuggestions };
    },
    enabled: !!teamAccess?.accessibleReps?.length && isLeader,
    staleTime: 1000 * 60 * 2,
  });

  return {
    ...query,
    isLeader,
    isLoading: teamLoading || query.isLoading,
  };
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
