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
  id: string; // Unified UUID - same in both recruits and reps tables
  name: string;
  phone: string;
  email: string;
  stage: string;
  recruiterId: string | null;
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

      // Get the current user's rep record
      const { data: currentRep } = await supabase
        .from('reps')
        .select('id, user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (!currentRep?.id) {
        return { recruits: [], activities: [], pendingSuggestions: [] };
      }

      // Build lookup from accessibleReps to get team info (by user_id)
      const accessibleRepsMap = new Map(
        accessibleReps.filter(ar => ar.userId).map(ar => [ar.userId, ar])
      );

      // Get accessible user IDs from teamAccess for filtering
      const accessibleUserIds = accessibleReps.map(ar => ar.userId).filter(Boolean) as string[];
      
      // Get accessible team IDs for filtering ghost reps (user_id = NULL) by their team_id in recruits table
      const accessibleTeamIds = [...new Set(accessibleReps.map(ar => ar.teamId).filter(Boolean))] as string[];
      
      // Query from reps table (has 106 records) - My Group shows org members, not just recruiting CRM
      // Filter by user_id being in accessible list, or for area directors query all
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
          onboarding_complete,
          trainings_complete,
          slack_joined,
          ramp_phase_1_complete,
          ramp_phase_2_complete,
          ramp_phase_3_complete,
          ramp_phase_4_complete,
          ipad_assigned,
          blitz_ready,
          recruiter,
          team_leader,
          created_at
        `)
        .order('created_at', { ascending: false });
      
      // Filter by accessible user IDs unless area director (who sees everyone)
      if (accessLevel !== 'area_director' && accessibleUserIds.length > 0) {
        repsQuery = repsQuery.in('user_id', accessibleUserIds);
      }
      
      const { data: repsData, error: repsError } = await repsQuery;

      if (repsError) {
        console.error('Error fetching reps:', repsError);
        throw repsError;
      }

      // Filter to only recruiting stages and exclude current user
      let filteredReps = (repsData || []).filter((r: any) => {
        // Exclude current user
        if (r.user_id === session.user.id) return false;
        
        // Canonicalize stage and check if it's a recruiting stage
        const stage = canonicalizeStage(r.stage);
        return RECRUITING_STAGES.includes(stage);
      });

      console.log('[useGroupRecruits] Fetched', filteredReps.length, 'reps from reps table (filtered from', repsData?.length, 'total)');

      // Also fetch ghost reps (user_id = NULL) from recruits table for accessible teams
      // These are recruits without app accounts who won't appear in the reps query above
      let ghostRecruits: any[] = [];
      if (accessLevel === 'area_director') {
        // Area directors see all recruits
        const { data: allRecruits } = await supabase
          .from('recruits')
          .select(`
            id, name, phone, email, stage, year, team_id, mgmt_group_id, recruiter_user_id, location, recruitment_source, last_contact, next_action, next_action_due, onboarding_complete, trainings_complete, slack_joined, ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete, ipad_assigned, blitz_ready, created_at,
            teams:team_id(id, name),
            mgmt_groups:mgmt_group_id(id, name),
            recruiter:recruiter_user_id(id, name, user_id)
          `)
          .order('created_at', { ascending: false });
        ghostRecruits = allRecruits || [];
      } else if (accessibleTeamIds.length > 0) {
        const { data: teamRecruits } = await supabase
          .from('recruits')
          .select(`
            id, name, phone, email, stage, year, team_id, mgmt_group_id, recruiter_user_id, location, recruitment_source, last_contact, next_action, next_action_due, onboarding_complete, trainings_complete, slack_joined, ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete, ipad_assigned, blitz_ready, created_at,
            teams:team_id(id, name),
            mgmt_groups:mgmt_group_id(id, name),
            recruiter:recruiter_user_id(id, name, user_id)
          `)
          .in('team_id', accessibleTeamIds)
          .order('created_at', { ascending: false });
        ghostRecruits = teamRecruits || [];
      }

      // Normalization helpers (prevents duplicate "rep-only" rows from masking the real recruit UUID)
      const stripEmojisForKey = (text: string | null | undefined): string => {
        if (!text) return "";
        return text
          .replace(
            /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu,
            ""
          )
          .trim();
      };

      const normalizeNameForKey = (name: string | null | undefined): string | null => {
        const cleaned = stripEmojisForKey(name).replace(/\s+/g, " ").trim();
        return cleaned ? cleaned.toLowerCase() : null;
      };

      const normalizeEmailForKey = (email: string | null | undefined): string | null => {
        const cleaned = (email ?? "").trim().toLowerCase();
        return cleaned ? cleaned : null;
      };

      const normalizePhoneForKey = (phone: string | null | undefined): string | null => {
        const digits = (phone ?? "").replace(/\D/g, "");
        if (!digits) return null;
        return digits.length > 10 ? digits.slice(-10) : digits;
      };

      const getIdentityKeys = (p: {
        email?: string | null;
        phone?: string | null;
        name?: string | null;
      }) => {
        const email = normalizeEmailForKey(p.email);
        const phone = normalizePhoneForKey(p.phone);
        const name = normalizeNameForKey(p.name);
        return {
          emailKey: email ? `email:${email}` : null,
          phoneKey: phone ? `phone:${phone}` : null,
          nameKey: name ? `name:${name}` : null,
        };
      };

      // Build a set of identity keys we already have from reps to avoid duplicates
      const repIdentityKeys = new Set<string>();
      for (const r of filteredReps) {
        const { emailKey, phoneKey, nameKey } = getIdentityKeys(r);
        if (emailKey) repIdentityKeys.add(emailKey);
        if (phoneKey) repIdentityKeys.add(phoneKey);
        if (nameKey) repIdentityKeys.add(nameKey);
      }

      // Filter ghost recruits to only those without a matching rep and in recruiting stages
      const filteredGhostRecruits = ghostRecruits.filter((r: any) => {
        const stage = canonicalizeStage(r.stage);
        if (!RECRUITING_STAGES.includes(stage)) return false;

        const { emailKey, phoneKey, nameKey } = getIdentityKeys(r);
        if (emailKey && repIdentityKeys.has(emailKey)) return false;
        if (phoneKey && repIdentityKeys.has(phoneKey)) return false;
        if (nameKey && repIdentityKeys.has(nameKey)) return false;

        return true;
      });

      console.log('[useGroupRecruits] Found', filteredGhostRecruits.length, 'additional ghost recruits from recruits table');

      // Get matching recruit records to get additional CRM data (team_id, mgmt_group_id, etc.)
      // Match by email OR (normalized) phone/name.
      const repEmails = filteredReps.map((r: any) => r.email).filter(Boolean) as string[];

      const repNameVariants = Array.from(
        new Set(
          filteredReps
            .map((r: any) => r.name)
            .filter(Boolean)
            .flatMap((n: string) => {
              const original = (n ?? '').replace(/\s+/g, ' ').trim();
              const stripped = stripEmojisForKey(original).replace(/\s+/g, ' ').trim();
              return [original, stripped].filter(Boolean);
            })
        )
      );

      const recruitsByKey = new Map<string, any | null>();
      const nameKeyCounts = new Map<string, number>();

      const indexRecruit = (recruit: any) => {
        const { emailKey, phoneKey, nameKey } = getIdentityKeys(recruit);
        if (emailKey) recruitsByKey.set(emailKey, recruit);
        if (phoneKey) recruitsByKey.set(phoneKey, recruit);

        if (nameKey) {
          const next = (nameKeyCounts.get(nameKey) ?? 0) + 1;
          nameKeyCounts.set(nameKey, next);
          // Only allow name matches when unique to prevent cross-person linking
          recruitsByKey.set(nameKey, next === 1 ? recruit : null);
        }
      };

      // Fetch by email first - use OR filters for case-insensitive matching
      if (repEmails.length > 0) {
        const emailFilters = repEmails.map((email) => `email.ilike.${email}`).join(',');
        const { data: matchingRecruits } = await supabase
          .from('recruits')
          .select(`
            id, email, name, phone, team_id, mgmt_group_id, recruiter_user_id, location, recruitment_source, last_contact, next_action, next_action_due,
            teams:team_id(id, name),
            mgmt_groups:mgmt_group_id(id, name),
            recruiter:recruiter_user_id(id, name, user_id)
          `)
          .or(emailFilters);

        for (const recruit of matchingRecruits || []) {
          indexRecruit(recruit);
        }
      }

      // Fetch by name as a fallback (including cases where emails differ)
      if (repNameVariants.length > 0) {
        const { data: nameMatchedRecruits } = await supabase
          .from('recruits')
          .select(`
            id, email, name, phone, team_id, mgmt_group_id, recruiter_user_id, location, recruitment_source, last_contact, next_action, next_action_due,
            teams:team_id(id, name),
            mgmt_groups:mgmt_group_id(id, name),
            recruiter:recruiter_user_id(id, name, user_id)
          `)
          .in('name', repNameVariants);

        for (const recruit of nameMatchedRecruits || []) {
          indexRecruit(recruit);
        }
      }

      // Index all team recruits we already fetched (covers phone-based matches + provides richer joined data)
      for (const teamRecruit of ghostRecruits || []) {
        indexRecruit(teamRecruit);
      }

      // Get blitz commitments for recruits that have matching records (deduped ids)
      const recruitIdsForRelatedData = Array.from(
        new Set(Array.from(recruitsByKey.values()).map((r: any) => r?.id).filter(Boolean))
      );

      let blitzesByRecruit = new Map<string, BlitzCommitment[]>();

      if (recruitIdsForRelatedData.length > 0) {
        const { data: recruitBlitzes } = await supabase
          .from('recruit_blitzes')
          .select('recruit_id, blitzes(id, name, date, end_date, location)')
          .in('recruit_id', recruitIdsForRelatedData);

        for (const rb of recruitBlitzes || []) {
          if (!blitzesByRecruit.has(rb.recruit_id)) {
            blitzesByRecruit.set(rb.recruit_id, []);
          }
          const blitz = rb.blitzes as any;
          if (blitz) {
            blitzesByRecruit.get(rb.recruit_id)!.push({
              id: blitz.id,
              name: blitz.name,
              date: blitz.date,
              endDate: blitz.end_date || null,
              location: blitz.location || null,
            });
          }
        }
      }

      // Build a map of email/name -> rep ID for ghost recruit lookup
      const repIdsByKey = new Map<string, string>();
      for (const r of filteredReps) {
        if (r.email) repIdsByKey.set(`email:${r.email.toLowerCase()}`, r.id);
        if (r.name) repIdsByKey.set(`name:${r.name.toLowerCase()}`, r.id);
      }

      // Transform reps to match expected Recruit interface
      let recruits: Recruit[] = filteredReps.map((r: any) => {
        const accessibleRepInfo = accessibleRepsMap.get(r.user_id);

        const { emailKey, phoneKey, nameKey } = getIdentityKeys(r);
        const matchingRecruit =
          (emailKey ? recruitsByKey.get(emailKey) : null) ||
          (phoneKey ? recruitsByKey.get(phoneKey) : null) ||
          (nameKey ? recruitsByKey.get(nameKey) : null);

        // Prefer the recruit UUID when we can resolve it (prevents "rep-only" duplicates)
        const unifiedId = (matchingRecruit as any)?.id || r.id;

        // Extract team/recruiter info from joined relations
        const teamData = (matchingRecruit as any)?.teams as { id: string; name: string } | null;
        const mgmtGroupData = (matchingRecruit as any)?.mgmt_groups as { id: string; name: string } | null;
        const recruiterData = (matchingRecruit as any)?.recruiter as { id: string; name: string; user_id: string } | null;

        return {
          id: unifiedId,
          name: r.name,
          phone: r.phone || '',
          email: r.email || '',
          stage: canonicalizeStage(r.stage),
          recruiterId: recruiterData?.id || null,
          recruiterName: recruiterData?.name || r.recruiter || r.team_leader || null,
          recruiterUserId: recruiterData?.user_id || (matchingRecruit as any)?.recruiter_user_id || null,
          teamName: teamData?.name || accessibleRepInfo?.teamName || null,
          teamId: (matchingRecruit as any)?.team_id || accessibleRepInfo?.teamId || null,
          mgmtGroupId: (matchingRecruit as any)?.mgmt_group_id || accessibleRepInfo?.mgmtGroupId || null,
          mgmtGroupName: mgmtGroupData?.name || accessibleRepInfo?.mgmtGroupName || null,
          year: r.year || '',
          location: (matchingRecruit as any)?.location || null,
          recruitmentSource: (matchingRecruit as any)?.recruitment_source || null,
          lastContact: (matchingRecruit as any)?.last_contact || null,
          nextAction: (matchingRecruit as any)?.next_action || null,
          nextActionDue: (matchingRecruit as any)?.next_action_due || null,
          createdAt: r.created_at || new Date().toISOString(),
          committedBlitzes: (matchingRecruit as any)?.id ? (blitzesByRecruit.get((matchingRecruit as any).id) || []) : [],
          rampToBlitzPhase: null,
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

      // Add ghost recruits (from recruits table, no matching rep) to the list
      for (const ghostRecruit of filteredGhostRecruits) {
        // Find team info from accessibleReps if possible
        const teamInfo = accessibleReps.find(ar => ar.teamId === ghostRecruit.team_id);

        // Extract team/recruiter info from joined relations
        const teamData = ghostRecruit.teams as { id: string; name: string } | null;
        const mgmtGroupData = ghostRecruit.mgmt_groups as { id: string; name: string } | null;
        const recruiterData = ghostRecruit.recruiter as { id: string; name: string; user_id: string } | null;

        // With unified UUIDs, ghost recruits use the same ID for both tables
        recruits.push({
          id: ghostRecruit.id, // Unified ID
          name: ghostRecruit.name,
          phone: ghostRecruit.phone || '',
          email: ghostRecruit.email || '',
          stage: canonicalizeStage(ghostRecruit.stage),
          recruiterId: recruiterData?.id || null,
          recruiterName: recruiterData?.name || null,
          recruiterUserId: recruiterData?.user_id || ghostRecruit.recruiter_user_id || null,
          teamName: teamData?.name || teamInfo?.teamName || null,
          teamId: ghostRecruit.team_id || null,
          mgmtGroupId: ghostRecruit.mgmt_group_id || null,
          mgmtGroupName: mgmtGroupData?.name || teamInfo?.mgmtGroupName || null,
          year: ghostRecruit.year || '',
          location: ghostRecruit.location || null,
          recruitmentSource: ghostRecruit.recruitment_source || null,
          lastContact: ghostRecruit.last_contact || null,
          nextAction: ghostRecruit.next_action || null,
          nextActionDue: ghostRecruit.next_action_due || null,
          createdAt: ghostRecruit.created_at || new Date().toISOString(),
          committedBlitzes: blitzesByRecruit.get(ghostRecruit.id) || [],
          rampToBlitzPhase: null,
          phase1Complete: ghostRecruit.ramp_phase_1_complete ?? false,
          phase2Complete: ghostRecruit.ramp_phase_2_complete ?? false,
          phase3Complete: ghostRecruit.ramp_phase_3_complete ?? false,
          phase4Complete: ghostRecruit.ramp_phase_4_complete ?? false,
          onboardingComplete: ghostRecruit.onboarding_complete ?? false,
          trainingsComplete: ghostRecruit.trainings_complete ?? false,
          slackJoined: ghostRecruit.slack_joined ?? false,
          ipadAssigned: ghostRecruit.ipad_assigned ?? false,
          blitzReady: ghostRecruit.blitz_ready ?? false,
        });
      }

      // Final dedupe pass - PRIMARY: by UUID (unified architecture), SECONDARY: by identity keys
      const seenIds = new Set<string>();
      const seenIdentityKeys = new Set<string>();
      recruits = recruits.filter((r) => {
        // First check UUID - the unified architecture guarantees same person = same ID
        if (r.id && seenIds.has(r.id)) return false;
        if (r.id) seenIds.add(r.id);
        
        // Secondary check by identity keys (email/phone/name) for edge cases
        const { emailKey, phoneKey, nameKey } = getIdentityKeys(r);
        const identityKey = emailKey || phoneKey || nameKey;
        if (identityKey && seenIdentityKeys.has(identityKey)) return false;
        if (identityKey) seenIdentityKeys.add(identityKey);
        
        return true;
      });

      console.log('[useGroupRecruits] Transformed', recruits.length, 'total recruits for display (including', filteredGhostRecruits.length, 'ghost recruits)');

      // Fetch activities for these recruits using recruit_id (deduped from final list)
      const recruitIdsForActivities = Array.from(new Set(recruits.map(r => r.id).filter(Boolean)));

      let activities: RecruitActivity[] = [];
      if (recruitIdsForActivities.length > 0) {
        const { data: activityData } = await supabase
          .from('recruit_activities')
          .select('*')
          .in('recruit_id', recruitIdsForActivities)
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
    // Expose whether we're showing placeholder/cached data vs fresh data
    isPlaceholderData: query.isPlaceholderData,
    isFetching: query.isFetching,
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
        throw new Error(error.message || "Failed to update stage");
      }

      // Edge function may return error in response body (not thrown)
      if (data?.error) {
        console.error("Edge function returned error:", data.error);
        throw new Error(data.error);
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
      if (nextActionDue !== undefined) {
        updateData.next_action_due = nextActionDue;
        // When rescheduling (changing due date), clear completed_at so it's treated as pending again
        updateData.completed_at = null;
      }
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
    onMutate: async ({ activityId, notes, createdAt, nextAction, nextActionDue, assignedToUserId }) => {
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
                  next_action: nextAction ?? a.next_action,
                  next_action_due: nextActionDue ?? a.next_action_due,
                  // When rescheduling, clear completed_at so it's treated as pending again
                  completed_at: nextActionDue !== undefined ? null : a.completed_at,
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
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
      // Also invalidate the specific recruit's activities cache
      if (data?.activityId) {
        queryClient.invalidateQueries({ queryKey: ['recruit-activities'] });
      }
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
