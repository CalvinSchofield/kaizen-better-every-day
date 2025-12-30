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
  id: string; // Supabase UUID - primary identifier
  notionPageId: string; // @deprecated Alias for id - to be removed
  name: string;
  phone: string;
  email: string;
  stage: string;
  recruiterId: string | null;
  recruiterNotionId: string | null; // @deprecated Alias for recruiterId - to be removed
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

  // Levi-specific lineage helpers (optional; only set when filtering Levi's team)
  recruiterDepth?: number | null;
  recruiterLineage?: 'direct' | 'downline' | null;
}

export interface RecruitActivity {
  id: string;
  recruit_id: string;
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
  team_leader_user_id: string | null;
  created_at: string;
}

// Recruiting pipeline stages - import from central constants
import { STAGES, EXIT_STAGES as EXIT_STAGE_LIST } from "@/utils/stageConstants";

const RECRUITING_STAGES = [
  STAGES.LIST_100,
  STAGES.POTENTIAL_FOLLOW_UP,
  STAGES.REACHED_OUT,
  "Reached out", // legacy casing from earlier data
  STAGES.EVALUATING,
  STAGES.SIGNED,
  STAGES.SIGNED_BUT_NOT_INTERESTED,
  "Signed but not interested", // legacy casing from earlier data
  STAGES.SHADOW,
  STAGES.SOLD,
  STAGES.SOLD_5_PLUS,
  STAGES.NOT_INTERESTED,
];

const canonicalizeStage = (stage: string | null | undefined): string => {
  const raw = (stage ?? "").trim();
  if (!raw) return "";

  const s = raw.toLowerCase();

  if (s === "100 list" || s === "100_list") return STAGES.LIST_100;
  if (s === "reached out" || s === "reached_out") return STAGES.REACHED_OUT;
  if (s === "evaluating") return STAGES.EVALUATING;
  if (s === "signed") return STAGES.SIGNED;

  // Shadow variants (e.g., "Shadow ✅", "Shadowed ✅")
  if (s.startsWith("shadow")) return STAGES.SHADOW;

  // Sold variants
  if (s.includes("sold") && (s.includes("5+") || s.includes("5"))) return STAGES.SOLD_5_PLUS;
  if (s === "sold" || (s.includes("sold") && !s.includes("100"))) return STAGES.SOLD;

  // Follow-up variants
  if (s === "potential follow up" || s === "potential_follow_up" || s === "follow up") {
    return STAGES.POTENTIAL_FOLLOW_UP;
  }

  // Exit variants
  if (s === "not interested" || s === "not_interested") return STAGES.NOT_INTERESTED;
  if (s === "signed but not interested" || s === "signed (left)") return STAGES.SIGNED_BUT_NOT_INTERESTED;

  return raw;
};

export const useGroupRecruits = () => {
  const { data: teamAccess, isLoading: teamLoading } = useTeamAccess();
  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';

  const CACHE_KEY = 'group-recruits-cache:v2';
  
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

      // Get the current user's rep ID
      const { data: currentRep } = await supabase
        .from('reps')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      const leaderId = currentRep?.id;
      
      if (!leaderId) {
        return { recruits: [], activities: [], pendingSuggestions: [] };
      }

      // Get accessible rep IDs from team access
      const accessibleIds = accessibleReps
        .map(r => r.id)
        .filter(Boolean);

      // Query recruits directly from reps table (source of truth)
      let repsQuery = supabase
        .from('reps')
        .select(`
          id,
          user_id,
          name,
          phone,
          email,
          stage,
          year,
          recruiter,
          team_leader,
          ramp_to_blitz_phase,
          ramp_phase_1_complete,
          ramp_phase_2_complete,
          ramp_phase_3_complete,
          ramp_phase_4_complete,
          onboarding_complete,
          trainings_complete,
          slack_joined,
          ipad_assigned,
          blitz_ready,
          committed_blitzes,
          created_at,
          updated_at
        `)
        .in('stage', RECRUITING_STAGES);

      // Filter by accessible rep IDs (from team access)
      // All leaders use the same filter - team access already handles permissions and excludes self
      if (accessibleIds.length > 0) {
        repsQuery = repsQuery.in('id', accessibleIds);
      } else {
        // No accessible reps means no results
        return { recruits: [], activities: [], pendingSuggestions: [] };
      }

      const { data: repsData, error: repsError } = await repsQuery;

      if (repsError) {
        console.error('Error fetching reps:', repsError);
        throw repsError;
      }

      // Parse committed blitzes from JSON field in reps table
      const parseCommittedBlitzes = (blitzesJson: any): BlitzCommitment[] => {
        if (!blitzesJson || !Array.isArray(blitzesJson)) return [];
        return blitzesJson.map((b: any) => ({
          id: b.id || b.blitzId || '',
          name: b.name || b.blitzName || '',
          date: b.date || b.startDate || '',
          endDate: b.endDate || b.end_date || null,
          location: b.location || null,
        }));
      };

      // Build lookup from accessibleReps to get team info
      const accessibleRepsMap = new Map(
        accessibleReps.map(ar => [ar.id, ar])
      );

      // Transform reps to match expected Recruit interface, enriching with team info
      let recruits: Recruit[] = (repsData || []).map((r: any) => {
        const accessibleRepInfo = accessibleRepsMap.get(r.id);
        
        return {
          id: r.id, // Supabase UUID - primary identifier
          notionPageId: r.id, // @deprecated Alias - to be removed
          name: r.name,
          phone: r.phone || '',
          email: r.email || '',
          stage: canonicalizeStage(r.stage),
          recruiterId: leaderId,
          recruiterNotionId: leaderId, // @deprecated Alias - to be removed
          recruiterName: r.recruiter || null,
          recruiterUserId: null,
          // Enrich with team info from accessibleReps
          teamName: accessibleRepInfo?.teamName || null,
          teamId: accessibleRepInfo?.teamId || null,
          mgmtGroupId: accessibleRepInfo?.mgmtGroupId || null,
          mgmtGroupName: accessibleRepInfo?.mgmtGroupName || null,
          year: r.year || '',
          location: null,
          recruitmentSource: null,
          lastContact: null,
          nextAction: null,
          nextActionDue: null,
          createdAt: r.created_at || new Date().toISOString(),
          committedBlitzes: parseCommittedBlitzes(r.committed_blitzes),
          rampToBlitzPhase: r.ramp_to_blitz_phase,
          phase1Complete: r.ramp_phase_1_complete ?? false,
          phase2Complete: r.ramp_phase_2_complete ?? false,
          phase3Complete: r.ramp_phase_3_complete ?? false,
          phase4Complete: r.ramp_phase_4_complete ?? false,
          onboardingComplete: r.onboarding_complete ?? false,
          trainingsComplete: r.trainings_complete ?? false,
          slackJoined: r.slack_joined ?? false,
          ipadAssigned: r.ipad_assigned ?? false,
          blitzReady: r.blitz_ready ?? false,
        };
      });

      // Exclude the current user from the recruits list
      recruits = recruits.filter(r => r.id !== leaderId);

      console.log('[useGroupRecruits] Fetched', recruits.length, 'recruits from Supabase');

      // Fetch activities for these recruits using recruit_id
      let activities: RecruitActivity[] = [];
      if (recruits.length > 0) {
        const recruitIds = recruits.map(r => r.id);
        const { data: activityData } = await supabase
          .from('recruit_activities')
          .select('*')
          .in('recruit_id', recruitIds)
          .order('created_at', { ascending: false })
          .limit(500);
        
        activities = (activityData || []) as RecruitActivity[];
      }

      // Hydrate nextAction / nextActionDue from the latest next_step activity
      // (Fixes "Follow Up" column counts showing 0 when we source recruits from reps table.)
      if (activities.length > 0) {
        const nextStepByRecruit = new Map<string, { nextAction: string | null; nextActionDue: string | null }>();

        // activities are already sorted newest-first
        for (const a of activities) {
          if (a.activity_type !== 'next_step') continue;
          if (!a.next_action && !a.next_action_due) continue;
          const recruitId = a.recruit_id;
          if (recruitId && !nextStepByRecruit.has(recruitId)) {
            nextStepByRecruit.set(recruitId, {
              nextAction: a.next_action ?? null,
              nextActionDue: a.next_action_due ?? null,
            });
          }
        }

        if (nextStepByRecruit.size > 0) {
          recruits = recruits.map(r => {
            const ns = nextStepByRecruit.get(r.id);
            if (!ns) return r;
            return {
              ...r,
              nextAction: ns.nextAction ?? r.nextAction,
              nextActionDue: ns.nextActionDue ?? r.nextActionDue,
            };
          });
        }
      }

      // Fetch pending suggestions for this leader (using team_leader_user_id)
      let pendingSuggestions: RecruitSuggestion[] = [];
      const { data: suggestions } = await supabase
        .from('recruit_suggestions')
        .select('*')
        .eq('team_leader_user_id', session.user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      pendingSuggestions = (suggestions || []) as RecruitSuggestion[];


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
      teamLeaderUserId: string;
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
          team_leader_user_id: suggestion.teamLeaderUserId,
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
          team_leader_user_id: newSuggestion.teamLeaderUserId,
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
      recruitId,
      recruitNotionId,
      newStage,
      notes,
    }: {
      recruitId?: string; // Supabase UUID - preferred
      recruitNotionId?: string; // Legacy Notion ID - fallback
      newStage: string;
      notes?: string;
    }) => {
      if (!recruitId && !recruitNotionId) {
        throw new Error("Either recruitId or recruitNotionId is required");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Route stage changes through edge function that handles both ID types
      const { data, error } = await supabase.functions.invoke("update-recruit-stage", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          recruitId,
          recruitNotionId,
          newStage,
          notes,
          isAutomatic: false,
        },
      });

      if (error) {
        console.error("Error updating recruit stage:", error);
        throw error;
      }

      return { recruitId, recruitNotionId, newStage, previousStage: data?.previousStage ?? null };
    },
    onMutate: async ({ recruitId, recruitNotionId, newStage }) => {
      await queryClient.cancelQueries({ queryKey: ["group-recruits"] });

      const previousData = queryClient.getQueryData(["group-recruits"]);

      queryClient.setQueriesData({ queryKey: ["group-recruits"] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          recruits: old.recruits.map((r: any) =>
            (recruitId && r.id === recruitId) || (recruitNotionId && r.notionPageId === recruitNotionId)
              ? { ...r, stage: newStage }
              : r
          ),
        };
      });

      return { previousData, recruitId, recruitNotionId, newStage };
    },
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueriesData({ queryKey: ["group-recruits"] }, context.previousData);
      }
      toast.error(
        err instanceof Error ? err.message : "Couldn't update stage. Please try again."
      );
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ["group-recruits"] });
      queryClient.invalidateQueries({ queryKey: ["recruits-rep-data"] });
      queryClient.invalidateQueries({ queryKey: ["recruit-detail-live"] });
      const identifier = data?.recruitId || data?.recruitNotionId;
      if (identifier) {
        queryClient.invalidateQueries({ queryKey: ["recruit-rep-data", identifier] });
        queryClient.invalidateQueries({ queryKey: ["recruit-activities", identifier] });
        queryClient.invalidateQueries({ queryKey: ["recruit-detail-live", identifier] });
      }
    },
  });
};

export const useLogRecruitActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      recruitId,
      recruitNotionId, 
      activityType, 
      notes,
      nextAction,
      nextActionDue,
      updateLastContact = false,
      assignedToUserId,
    }: { 
      recruitId?: string; // Supabase UUID - preferred
      recruitNotionId?: string; // Legacy Notion ID - fallback
      activityType: 'phone_call' | 'in_person' | 'note' | 'next_step';
      notes?: string;
      nextAction?: string;
      nextActionDue?: string;
      updateLastContact?: boolean;
      assignedToUserId?: string;
    }) => {
      if (!recruitId && !recruitNotionId) {
        throw new Error("Either recruitId or recruitNotionId is required");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Use rep_notion_page_id for backwards compatibility
      const repIdentifier = recruitNotionId || recruitId;

      // Look up the correct recruit_id from recruits table
      // The FK on recruit_activities.recruit_id references recruits.id
      // We need to check both notion_page_id AND id since some recruits may use Supabase ID as identifier
      let actualRecruitId: string | null = null;
      if (repIdentifier) {
        // First try to find by notion_page_id
        let { data: recruitData } = await supabase
          .from('recruits')
          .select('id')
          .eq('id', repIdentifier)
          .maybeSingle() as { data: { id: string } | null };
        
        // If not found by notion_page_id, try by direct id (for recruits created in Supabase)
        if (!recruitData && recruitId) {
          const { data: directMatch } = await supabase
            .from('recruits')
            .select('id')
            .eq('id', recruitId)
            .maybeSingle();
          recruitData = directMatch;
        }
        
        actualRecruitId = recruitData?.id || null;
      }

      // Insert activity directly to Supabase
      const { data, error } = await supabase
        .from('recruit_activities')
        .insert({
          rep_notion_page_id: repIdentifier,
          recruit_id: actualRecruitId, // Use the correct recruit table id
          activity_type: activityType,
          logged_by_user_id: session.user.id,
          notes: notes || null,
          next_action: nextAction || null,
          next_action_due: nextActionDue || null,
          assigned_to_user_id: assignedToUserId || null,
          assignment_status: assignedToUserId ? 'pending' : null,
        })
        .select()
        .single();

      if (error) throw error;
      return { ...data, recruitId, recruitNotionId, activityType, notes, nextAction, nextActionDue, assignedToUserId };
    },
    onMutate: async ({ recruitId, recruitNotionId, activityType, notes, nextAction, nextActionDue, assignedToUserId }) => {
      await queryClient.cancelQueries({ queryKey: ['group-recruits'] });
      
      const previousData = queryClient.getQueriesData({ queryKey: ['group-recruits'] });
      const tempId = `temp-${Date.now()}`;
      const repIdentifier = recruitNotionId || recruitId;
      
      queryClient.setQueriesData({ queryKey: ['group-recruits'] }, (old: any) => {
        if (!old) return old;
        const newActivity = {
          id: tempId,
          rep_notion_page_id: repIdentifier,
          recruit_id: recruitId,
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
      
      return { previousData, tempId, recruitId, recruitNotionId };
    },
    onError: (err, variables, context) => {
      console.error('useLogRecruitActivity error:', err, 'variables:', variables);
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
      const identifier = data?.recruitId || data?.recruitNotionId;
      if (identifier) {
        queryClient.invalidateQueries({ queryKey: ['recruit-activities', identifier] });
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
