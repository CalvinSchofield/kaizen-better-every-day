import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "./useTeamAccess";
import { useEffect, useCallback } from "react";
import { toast } from "sonner";

export interface BlitzCommitment {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location?: string;
}

export interface Recruit {
  notionPageId: string;
  name: string;
  phone: string;
  email: string;
  stage: string;
  recruiterNotionId: string;
  recruiterName: string | null;
  recruiterUserId: string | null;
  teamName: string | null;
  teamId: string | null;
  mgmtGroupId: string | null;
  mgmtGroupName: string | null;
  year: string;
  location: string | null;
  recruitmentSource: string | null;
  lastContact: string | null;
  nextAction: string | null;
  nextActionDue: string | null;
  createdAt: string;
  committedBlitzes?: BlitzCommitment[];
  // Ramp-to-blitz phase data
  rampToBlitzPhase?: string | null;
  phase1Complete?: boolean;
  phase2Complete?: boolean;
  phase3Complete?: boolean;
  phase4Complete?: boolean;
  onboardingComplete?: boolean;
  trainingsComplete?: boolean;
  slackJoined?: boolean;
  ipadAssigned?: boolean;
  blitzReady?: boolean;
  // Legacy field for backwards compatibility
  onboardingStatus?: string | null;
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
  assigned_to_user_id: string | null;
  assignment_status: string | null;
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
  'Not Interested',
  'Signed but Not Interested',
];

export const useGroupRecruits = () => {
  const { data: teamAccess, isLoading: teamLoading } = useTeamAccess();
  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';

  const CACHE_KEY = 'group-recruits-cache';
  
  // Load cached data on mount
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { timestamp } = JSON.parse(cached);
        const isRecent = Date.now() - timestamp < 10 * 60 * 1000; // 10 minutes
        if (!isRecent) {
          localStorage.removeItem(CACHE_KEY);
        }
      } catch (e) {
        localStorage.removeItem(CACHE_KEY);
      }
    }
  }, []);

  const query = useQuery({
    queryKey: ['group-recruits', teamAccess?.accessLevel, teamAccess?.accessibleReps?.length],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const accessLevel = teamAccess?.accessLevel;
      const accessibleReps = teamAccess?.accessibleReps || [];
      
      console.log('[useGroupRecruits] Running query with accessLevel:', accessLevel, 'accessibleReps count:', accessibleReps.length);

      // Get the current user's rep notion page ID
      const { data: currentRep } = await supabase
        .from('reps')
        .select('notion_page_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      const leaderNotionId = currentRep?.notion_page_id;
      
      if (!leaderNotionId) {
        return { recruits: [], activities: [], pendingSuggestions: [] };
      }

      // Build team IDs based on access level
      let teamIds: string[] = [];
      let mgmtGroupIds: string[] = [];
      
      if (accessLevel === 'area_director') {
        // Area directors see all teams
        teamIds = teamAccess?.teams?.map(t => t.id) || [];
        mgmtGroupIds = teamAccess?.mgmtGroups?.map(g => g.id) || [];
      } else if (accessLevel === 'mgmt_group_lead') {
        // Mgmt group leads see teams in their mgmt groups
        teamIds = teamAccess?.teams?.map(t => t.id) || [];
        mgmtGroupIds = teamAccess?.mgmtGroups?.map(g => g.id) || [];
      } else if (accessLevel === 'team_lead') {
        // Team leads see their teams only
        teamIds = teamAccess?.teams?.map(t => t.id) || [];
      }

      // Query recruits directly from Supabase
      let recruitsQuery = supabase
        .from('recruits')
        .select(`
          id,
          notion_page_id,
          name,
          phone,
          email,
          stage,
          year,
          location,
          recruitment_source,
          last_contact,
          next_action,
          next_action_due,
          created_at,
          team_id,
          mgmt_group_id,
          recruiter_user_id,
          ramp_phase_1_complete,
          ramp_phase_2_complete,
          ramp_phase_3_complete,
          ramp_phase_4_complete,
          onboarding_complete,
          trainings_complete,
          slack_joined,
          ipad_assigned,
          blitz_ready,
          teams:team_id (
            id,
            name
          ),
          mgmt_groups:mgmt_group_id (
            id,
            name
          )
        `)
        .in('stage', RECRUITING_STAGES);

      // Apply team/mgmt group filters based on access level
      if (accessLevel === 'area_director') {
        // Area directors see all recruits (no filter needed, RLS handles it)
      } else if (accessLevel === 'mgmt_group_lead' && mgmtGroupIds.length > 0) {
        recruitsQuery = recruitsQuery.in('mgmt_group_id', mgmtGroupIds);
      } else if (accessLevel === 'team_lead' && teamIds.length > 0) {
        recruitsQuery = recruitsQuery.in('team_id', teamIds);
      }

      const { data: recruitsData, error: recruitsError } = await recruitsQuery;

      if (recruitsError) {
        console.error('Error fetching recruits:', recruitsError);
        throw recruitsError;
      }

      // Get recruiter names from reps table
      const recruiterUserIds = [...new Set((recruitsData || [])
        .map(r => r.recruiter_user_id)
        .filter(Boolean))];
      
      let recruiterMap = new Map<string, string>();
      if (recruiterUserIds.length > 0) {
        const { data: recruiters } = await supabase
          .from('reps')
          .select('user_id, name')
          .in('user_id', recruiterUserIds);
        
        (recruiters || []).forEach(r => {
          if (r.user_id) {
            recruiterMap.set(r.user_id, r.name);
          }
        });
      }

      // Get committed blitzes for these recruits
      const recruitIds = (recruitsData || []).map(r => r.id);
      let blitzCommitments = new Map<string, BlitzCommitment[]>();
      
      if (recruitIds.length > 0) {
        const { data: blitzData } = await supabase
          .from('recruit_blitzes')
          .select(`
            recruit_id,
            blitzes (
              id,
              name,
              date,
              end_date,
              location
            )
          `)
          .in('recruit_id', recruitIds);

        (blitzData || []).forEach((rb: any) => {
          if (rb.blitzes) {
            const existing = blitzCommitments.get(rb.recruit_id) || [];
            existing.push({
              id: rb.blitzes.id,
              name: rb.blitzes.name,
              date: rb.blitzes.date,
              endDate: rb.blitzes.end_date,
              location: rb.blitzes.location,
            });
            blitzCommitments.set(rb.recruit_id, existing);
          }
        });
      }

      // Transform recruits to match expected interface
      let recruits: Recruit[] = (recruitsData || []).map((r: any) => ({
        notionPageId: r.notion_page_id || r.id, // fallback to id if no notion page id
        name: r.name,
        phone: r.phone || '',
        email: r.email || '',
        stage: r.stage || '',
        recruiterNotionId: leaderNotionId,
        recruiterName: r.recruiter_user_id ? (recruiterMap.get(r.recruiter_user_id) || null) : null,
        recruiterUserId: r.recruiter_user_id || null,
        teamName: r.teams?.name || null,
        teamId: r.team_id,
        mgmtGroupId: r.mgmt_group_id,
        mgmtGroupName: r.mgmt_groups?.name || null,
        year: r.year || '',
        location: r.location || null,
        recruitmentSource: r.recruitment_source || null,
        lastContact: r.last_contact,
        nextAction: r.next_action,
        nextActionDue: r.next_action_due,
        createdAt: r.created_at || new Date().toISOString(),
        committedBlitzes: blitzCommitments.get(r.id) || [],
        phase1Complete: r.ramp_phase_1_complete ?? false,
        phase2Complete: r.ramp_phase_2_complete ?? false,
        phase3Complete: r.ramp_phase_3_complete ?? false,
        phase4Complete: r.ramp_phase_4_complete ?? false,
        onboardingComplete: r.onboarding_complete ?? false,
        trainingsComplete: r.trainings_complete ?? false,
        slackJoined: r.slack_joined ?? false,
        ipadAssigned: r.ipad_assigned ?? false,
        blitzReady: r.blitz_ready ?? false,
      }));

      // Exclude the current user from the recruits list
      recruits = recruits.filter(r => r.notionPageId !== leaderNotionId);

      console.log('[useGroupRecruits] Fetched', recruits.length, 'recruits from Supabase');

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

      // Fetch pending suggestions for this leader
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

      // Cache successful result
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: { recruits, activities, pendingSuggestions },
        timestamp: Date.now(),
      }));

      return { recruits, activities, pendingSuggestions };
    },
    enabled: !!teamAccess?.accessLevel && isLeader,
    staleTime: 1000 * 60 * 2, // 2 minutes - faster refresh since we're not hitting Notion
    refetchInterval: 1000 * 60 * 3, // Refetch every 3 minutes
    placeholderData: () => {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          const isRecent = Date.now() - timestamp < 30 * 60 * 1000; // 30 minutes for placeholder
          if (isRecent && data) {
            return data;
          }
        } catch (e) {
          console.error('Failed to parse cached recruits:', e);
        }
      }
      return undefined;
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Show toast when using stale data due to error
  useEffect(() => {
    if (query.isError && query.data) {
      toast.warning("Using cached data", {
        description: "Couldn't refresh your group. Showing last known data.",
      });
    }
  }, [query.isError, query.data]);

  const getCachedTimestamp = useCallback(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { timestamp } = JSON.parse(cached);
        return new Date(timestamp);
      } catch (e) {
        return null;
      }
    }
    return null;
  }, []);

  return {
    ...query,
    isLeader,
    isLoading: teamLoading || query.isLoading,
    lastUpdated: getCachedTimestamp(),
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

      const { data, error } = await supabase
        .from('recruit_suggestions')
        .insert({
          suggested_by_user_id: user.id,
          suggested_by_name: suggestion.suggestedByName,
          name: suggestion.name,
          phone: suggestion.phone,
          relationship: suggestion.relationship,
          notes: suggestion.notes,
          team_leader_notion_id: suggestion.teamLeaderNotionId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async (newSuggestion) => {
      await queryClient.cancelQueries({ queryKey: ['my-suggestions'] });
      
      const previousData = queryClient.getQueryData(['my-suggestions']);
      
      queryClient.setQueryData(['my-suggestions'], (old: RecruitSuggestion[] | undefined) => {
        const optimisticSuggestion: RecruitSuggestion = {
          id: `temp-${Date.now()}`,
          suggested_by_user_id: 'optimistic',
          suggested_by_name: newSuggestion.suggestedByName,
          name: newSuggestion.name,
          phone: newSuggestion.phone,
          relationship: newSuggestion.relationship || null,
          notes: newSuggestion.notes || null,
          status: 'pending',
          team_leader_notion_id: newSuggestion.teamLeaderNotionId,
          created_at: new Date().toISOString(),
        };
        return [optimisticSuggestion, ...(old || [])];
      });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['my-suggestions'], context.previousData);
      }
    },
    onSettled: () => {
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

      // Update directly in Supabase recruits table
      const { error: updateError } = await supabase
        .from('recruits')
        .update({ stage: newStage })
        .eq('notion_page_id', recruitNotionId);

      if (updateError) {
        console.error('Error updating recruit stage in Supabase:', updateError);
      }

      // Also call edge function to update Notion (for backwards compatibility)
      const { data, error } = await supabase.functions.invoke('update-recruit-stage', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { recruitNotionId, newStage, notes },
      });

      if (error) throw error;
      return { ...data, recruitNotionId, newStage };
    },
    onMutate: async ({ recruitNotionId, newStage }) => {
      await queryClient.cancelQueries({ queryKey: ['group-recruits'] });
      
      const previousData = queryClient.getQueryData(['group-recruits']);
      
      queryClient.setQueriesData({ queryKey: ['group-recruits'] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          recruits: old.recruits.map((r: any) =>
            r.notionPageId === recruitNotionId ? { ...r, stage: newStage } : r
          ),
        };
      });
      
      return { previousData, recruitNotionId, newStage };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueriesData({ queryKey: ['group-recruits'] }, context.previousData);
      }
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'] });
      queryClient.invalidateQueries({ queryKey: ['recruit-detail-live'] });
      if (data?.recruitNotionId) {
        queryClient.invalidateQueries({ queryKey: ['recruit-rep-data', data.recruitNotionId] });
        queryClient.invalidateQueries({ queryKey: ['recruit-activities', data.recruitNotionId] });
        queryClient.invalidateQueries({ queryKey: ['recruit-detail-live', data.recruitNotionId] });
      }
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
      assignedToUserId,
    }: { 
      recruitNotionId: string; 
      activityType: 'phone_call' | 'in_person' | 'note' | 'next_step';
      notes?: string;
      nextAction?: string;
      nextActionDue?: string;
      updateLastContact?: boolean;
      assignedToUserId?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('log-recruit-activity', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { recruitNotionId, activityType, notes, nextAction, nextActionDue, updateLastContact, assignedToUserId },
      });

      if (error) throw error;
      return { ...data, tempId: `temp-${Date.now()}`, recruitNotionId, activityType, notes, nextAction, nextActionDue, assignedToUserId };
    },
    onMutate: async ({ recruitNotionId, activityType, notes, nextAction, nextActionDue, assignedToUserId }) => {
      await queryClient.cancelQueries({ queryKey: ['group-recruits'] });
      
      const previousData = queryClient.getQueriesData({ queryKey: ['group-recruits'] });
      const tempId = `temp-${Date.now()}`;
      
      queryClient.setQueriesData({ queryKey: ['group-recruits'] }, (old: any) => {
        if (!old) return old;
        const newActivity = {
          id: tempId,
          rep_notion_page_id: recruitNotionId,
          activity_type: activityType,
          logged_by_user_id: 'optimistic',
          notes: notes || null,
          next_action: nextAction || null,
          next_action_due: nextActionDue || null,
          assigned_to_user_id: assignedToUserId || null,
          assignment_status: assignedToUserId ? 'pending' : null,
          completed_at: null,
          created_at: new Date().toISOString(),
        };
        return {
          ...old,
          activities: [newActivity, ...old.activities],
        };
      });
      
      return { previousData, tempId, recruitNotionId };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
      if (data?.recruitNotionId) {
        queryClient.invalidateQueries({ queryKey: ['recruit-activities', data.recruitNotionId] });
      }
    },
  });
};

export const useUpdateRecruitActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      activityId, 
      notes,
      createdAt,
      nextAction,
      nextActionDue,
      assignedToUserId,
    }: { 
      activityId: string; 
      notes?: string;
      createdAt?: string;
      nextAction?: string;
      nextActionDue?: string;
      assignedToUserId?: string | null;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const updateData: Record<string, any> = {};
      if (notes !== undefined) updateData.notes = notes;
      if (createdAt !== undefined) updateData.created_at = createdAt;
      if (nextAction !== undefined) updateData.next_action = nextAction;
      if (nextActionDue !== undefined) updateData.next_action_due = nextActionDue;
      if (assignedToUserId !== undefined) {
        updateData.assigned_to_user_id = assignedToUserId;
        if (assignedToUserId) {
          updateData.assignment_status = 'pending';
        } else {
          updateData.assignment_status = null;
        }
      }

      const { error } = await supabase
        .from('recruit_activities')
        .update(updateData)
        .eq('id', activityId);

      if (error) throw error;
      return { activityId, notes, createdAt, nextAction, nextActionDue, assignedToUserId };
    },
    onMutate: async ({ activityId, notes, createdAt, assignedToUserId }) => {
      await queryClient.cancelQueries({ queryKey: ['group-recruits'] });
      
      const previousData = queryClient.getQueriesData({ queryKey: ['group-recruits'] });
      
      queryClient.setQueriesData({ queryKey: ['group-recruits'] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          activities: old.activities.map((a: any) =>
            a.id === activityId
              ? { 
                  ...a, 
                  notes: notes ?? a.notes, 
                  created_at: createdAt ?? a.created_at,
                  assigned_to_user_id: assignedToUserId !== undefined ? assignedToUserId : a.assigned_to_user_id,
                }
              : a
          ),
        };
      });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
    },
  });
};

export const useDeleteRecruitActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activityId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('recruit_activities')
        .delete()
        .eq('id', activityId);

      if (error) throw error;
      return { activityId };
    },
    onSuccess: (data) => {
      queryClient.setQueriesData({ queryKey: ['group-recruits'] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          activities: old.activities.filter((a: any) => a.id !== data.activityId),
        };
      });
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

export const useUpdateMySuggestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      suggestionId, 
      name, 
      phone, 
      relationship, 
      notes 
    }: { 
      suggestionId: string; 
      name: string;
      phone: string;
      relationship?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('recruit_suggestions')
        .update({
          name,
          phone,
          relationship,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', suggestionId)
        .eq('suggested_by_user_id', user.id)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ suggestionId, name, phone, relationship, notes }) => {
      await queryClient.cancelQueries({ queryKey: ['my-suggestions'] });
      
      const previousData = queryClient.getQueryData(['my-suggestions']);
      
      queryClient.setQueryData(['my-suggestions'], (old: RecruitSuggestion[] | undefined) => {
        if (!old) return old;
        return old.map(s => 
          s.id === suggestionId 
            ? { ...s, name, phone, relationship: relationship || null, notes: notes || null }
            : s
        );
      });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['my-suggestions'], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-suggestions'] });
    },
  });
};

export const useDeleteMySuggestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('recruit_suggestions')
        .delete()
        .eq('id', suggestionId)
        .eq('suggested_by_user_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;
      return { suggestionId };
    },
    onMutate: async (suggestionId) => {
      await queryClient.cancelQueries({ queryKey: ['my-suggestions'] });
      
      const previousData = queryClient.getQueryData(['my-suggestions']);
      
      queryClient.setQueryData(['my-suggestions'], (old: RecruitSuggestion[] | undefined) => {
        if (!old) return old;
        return old.filter(s => s.id !== suggestionId);
      });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['my-suggestions'], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-suggestions'] });
    },
  });
};
