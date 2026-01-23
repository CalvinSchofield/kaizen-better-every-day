import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/utils/withTimeout";

export type IncentiveMetric = 'fp_plus' | 'prmr' | 'transitions' | 'doors_knocked';
export type IncentiveTargetType = 'first_to' | 'most_by_end' | 'group_total' | 'anyone_who';
export type IncentiveStatus = 'active' | 'completed' | 'cancelled';
export type IncentiveVisibility = 'public' | 'private';

export interface EligibleRep {
  id: string;
  user_id: string;
  rep_name?: string;
  profile_photo_url?: string;
  timezone?: string; // For visibility calculations
}

export interface Incentive {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  reward: string;
  metric: IncentiveMetric;
  target_type: IncentiveTargetType;
  target_value: number | null;
  visibility: IncentiveVisibility;
  status: IncentiveStatus;
  start_date: string;
  end_date: string;
  winner_user_id: string | null;
  winner_user_ids: string[] | null; // For 'anyone_who' type with multiple winners
  created_at: string;
  completed_at: string | null;
  creator_timezone: string | null;
  // Joined data
  creator_name?: string;
  eligible_reps?: EligibleRep[];
  eligible_count?: number;
}

// Get the timezone offset in minutes for a given timezone
// More negative = further west = later in the day
const getTimezoneOffset = (timezone: string): number => {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return (tzDate.getTime() - utcDate.getTime()) / 60000;
  } catch {
    return 0;
  }
};

// Find the westernmost (latest) timezone among a list
const getLatestTimezone = (timezones: (string | null | undefined)[]): string => {
  const validTimezones = timezones.filter(Boolean) as string[];
  if (validTimezones.length === 0) return Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  return validTimezones.reduce((latest, tz) => {
    return getTimezoneOffset(tz) < getTimezoneOffset(latest) ? tz : latest;
  });
};

// Check if a completed incentive should still be visible (until 10 AM next day in latest timezone)
export const isIncentiveStillVisible = (
  incentive: Incentive, 
  participantTimezones: (string | null | undefined)[]
): boolean => {
  if (incentive.status === 'active') return true;
  if (incentive.status === 'cancelled') return false;
  
  // For completed incentives, check if we're past 10 AM the next day in latest participant timezone
  const latestTimezone = getLatestTimezone([...participantTimezones, incentive.creator_timezone]);
  
  const [year, month, day] = incentive.end_date.split('-').map(Number);
  // Visibility cutoff: 10 AM on the day AFTER end_date in the latest timezone
  const cutoffDate = new Date(year, month - 1, day + 1, 10, 0, 0, 0);
  
  // Get current time in the latest timezone for comparison
  const nowUtc = new Date();
  const nowInLatestTz = new Date(nowUtc.toLocaleString('en-US', { timeZone: latestTimezone }));
  
  return nowInLatestTz < cutoffDate;
};

// Check if incentive is a solo personal goal (only 1 participant who is also creator)
export const isSoloPersonalGoal = (incentive: Incentive, userId?: string): boolean => {
  const eligibleCount = incentive.eligible_count || incentive.eligible_reps?.length || 0;
  if (eligibleCount !== 1) return false;
  
  const soloParticipant = incentive.eligible_reps?.[0];
  // It's a solo goal if the only participant is the creator
  return soloParticipant?.user_id === incentive.created_by;
};

export interface CreateIncentiveInput {
  title: string;
  description?: string;
  reward: string;
  metric: IncentiveMetric;
  target_type: IncentiveTargetType;
  target_value?: number;
  visibility: IncentiveVisibility;
  start_date: string;
  end_date: string;
  creator_timezone?: string;
  eligible_user_ids: string[];
}

export const useIncentives = (filter: 'active' | 'history' = 'active') => {
  return useQuery({
    queryKey: ['incentives', filter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const statusFilter = filter === 'active' ? ['active'] : ['completed', 'cancelled'];

      const { data: incentives, error } = await supabase
        .from('incentives')
        .select(`
          *,
          incentive_eligible_reps (
            id,
            user_id
          )
        `)
        .in('status', statusFilter)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get creator and eligible rep names
      const userIds = new Set<string>();
      incentives?.forEach(i => {
        userIds.add(i.created_by);
        i.incentive_eligible_reps?.forEach((r: any) => userIds.add(r.user_id));
      });

      const { data: reps } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url')
        .in('user_id', Array.from(userIds));

      const repMap = new Map(reps?.map(r => [r.user_id, r]) || []);

      return (incentives || []).map(i => ({
        ...i,
        creator_name: repMap.get(i.created_by)?.name || 'Unknown',
        eligible_count: i.incentive_eligible_reps?.length || 0,
        eligible_reps: i.incentive_eligible_reps?.map((r: any) => ({
          ...r,
          rep_name: repMap.get(r.user_id)?.name || 'Unknown',
          profile_photo_url: repMap.get(r.user_id)?.profile_photo_url,
        })),
      })) as Incentive[];
    },
    staleTime: 30 * 1000,
  });
};

export const useMyActiveIncentives = () => {
  return useQuery({
    queryKey: ['my-active-incentives'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      // If auth isn't ready yet (or user is signed out), treat as "no incentives".
      if (!user) return [];

      // Get incentives where I'm eligible
      const { data: myEligibility, error: eligError } = await supabase
        .from('incentive_eligible_reps')
        .select('incentive_id')
        .eq('user_id', user.id);

      if (eligError) throw eligError;
      
      const eligibleIds = myEligibility?.map((e) => e.incentive_id) || [];

      // Fetch active incentives + recently completed ones (within last 24h to catch 10AM cutoff)
      // This allows us to show completed incentives until 10 AM the next day
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: incentives, error } = await supabase
        .from('incentives')
        .select(`
          *,
          incentive_eligible_reps (
            id,
            user_id
          )
        `)
        .or(`status.eq.active,and(status.eq.completed,completed_at.gte.${twentyFourHoursAgo})`)
        .or(`id.in.(${eligibleIds.join(',')}),created_by.eq.${user.id}`)
        .order('end_date', { ascending: true });

      if (error) throw error;

      // Get rep names and timezones (creator + eligible reps)
      const userIds = new Set<string>();
      incentives?.forEach((i) => {
        userIds.add(i.created_by);
        i.incentive_eligible_reps?.forEach((r: any) => userIds.add(r.user_id));
      });

      const { data: reps } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url, timezone')
        .in('user_id', Array.from(userIds));

      const repMap = new Map(reps?.map((r) => [r.user_id, r]) || []);

      const mappedIncentives = (incentives || []).map((i) => {
        const eligibleReps = i.incentive_eligible_reps?.map((r: any) => ({
          ...r,
          rep_name: repMap.get(r.user_id)?.name || 'Unknown',
          profile_photo_url: repMap.get(r.user_id)?.profile_photo_url,
          timezone: repMap.get(r.user_id)?.timezone,
        })) || [];
        
        return {
          ...i,
          creator_name: repMap.get(i.created_by)?.name || 'Unknown',
          eligible_count: eligibleReps.length,
          eligible_reps: eligibleReps,
        };
      }) as (Incentive & { eligible_reps: (EligibleRep & { timezone?: string })[] })[];
      
      // Filter completed incentives by visibility window (10 AM next day in latest participant timezone)
      const visibleIncentives = mappedIncentives.filter((i) => {
        if (i.status === 'active') return true;
        if (i.status === 'cancelled') return false;
        
        // For completed incentives, check 10 AM next day cutoff
        const participantTimezones = i.eligible_reps?.map(r => r.timezone) || [];
        return isIncentiveStillVisible(i, participantTimezones);
      });
      
      // Sort incentives with priority:
      // 1. User is a participant (eligible rep) - highest priority
      // 2. User is the creator
      // 3. By participant count (more = higher priority)
      // 4. By end date (soonest first)
      const sortedIncentives = visibleIncentives.sort((a, b) => {
        const aIsParticipant = a.eligible_reps?.some(r => r.user_id === user.id) ? 1 : 0;
        const bIsParticipant = b.eligible_reps?.some(r => r.user_id === user.id) ? 1 : 0;
        
        // Participant incentives first
        if (aIsParticipant !== bIsParticipant) return bIsParticipant - aIsParticipant;
        
        const aIsCreator = a.created_by === user.id ? 1 : 0;
        const bIsCreator = b.created_by === user.id ? 1 : 0;
        
        // Creator incentives second
        if (aIsCreator !== bIsCreator) return bIsCreator - aIsCreator;
        
        // More participants = higher priority
        const aCount = a.eligible_count || 0;
        const bCount = b.eligible_count || 0;
        if (aCount !== bCount) return bCount - aCount;
        
        // Finally by end date (soonest first)
        return a.end_date.localeCompare(b.end_date);
      });

      return sortedIncentives as Incentive[];
    },
    staleTime: 10 * 1000, // 10 seconds for faster refresh
    gcTime: 30 * 1000, // Garbage collect after 30s to prevent stale cached data
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refresh when app comes back to foreground
    refetchInterval: 60 * 1000, // Auto-refresh every 60 seconds to catch completed competitions
    retry: 1,
  });
};

export const useCreateIncentive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateIncentiveInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create incentive
      const { data: incentive, error: incentiveError } = await supabase
        .from('incentives')
        .insert({
          created_by: user.id,
          title: input.title,
          description: input.description || null,
          reward: input.reward,
          metric: input.metric,
          target_type: input.target_type,
          target_value: input.target_value || null,
          visibility: input.visibility,
          start_date: input.start_date,
          end_date: input.end_date,
          creator_timezone: input.creator_timezone || null,
          status: 'active',
        })
        .select()
        .single();

      if (incentiveError) throw incentiveError;

      // Add eligible reps
      const eligibleReps = input.eligible_user_ids.map(userId => ({
        incentive_id: incentive.id,
        user_id: userId,
      }));

      const { error: eligError } = await supabase
        .from('incentive_eligible_reps')
        .insert(eligibleReps);

      if (eligError) throw eligError;

      // Send push notifications to eligible participants
      if (input.eligible_user_ids.length > 0) {
        try {
          const { data: creatorRep } = await supabase
            .from('reps')
            .select('name')
            .eq('user_id', user.id)
            .single();
          
          const creatorName = creatorRep?.name || 'A leader';
          
          await supabase.functions.invoke('send-challenge-notification', {
            body: {
              type: 'incentive_created',
              targetUserIds: input.eligible_user_ids,
              title: '🏆 New Incentive!',
              body: `${creatorName} created "${input.title}" - prize: ${input.reward}`,
            },
          });
        } catch (notifError) {
          console.error('[useCreateIncentive] Notification error (non-fatal):', notifError);
        }
      }

      return incentive;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentives'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-incentives'] });
    },
  });
};

export interface UpdateIncentiveInput {
  id: string;
  title?: string;
  description?: string;
  reward?: string;
  target_value?: number;
  end_date?: string;
  visibility?: IncentiveVisibility;
  eligible_user_ids?: string[];
}

export const useUpdateIncentive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateIncentiveInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify user is the creator
      const { data: incentive, error: fetchError } = await supabase
        .from('incentives')
        .select('created_by')
        .eq('id', input.id)
        .single();

      if (fetchError) throw fetchError;
      if (incentive.created_by !== user.id) {
        throw new Error('Only the creator can edit this incentive');
      }

      // Update incentive fields
      const updateFields: any = {};
      if (input.title !== undefined) updateFields.title = input.title;
      if (input.description !== undefined) updateFields.description = input.description;
      if (input.reward !== undefined) updateFields.reward = input.reward;
      if (input.target_value !== undefined) updateFields.target_value = input.target_value;
      if (input.end_date !== undefined) updateFields.end_date = input.end_date;
      if (input.visibility !== undefined) updateFields.visibility = input.visibility;

      if (Object.keys(updateFields).length > 0) {
        const { error: updateError } = await supabase
          .from('incentives')
          .update(updateFields)
          .eq('id', input.id);

        if (updateError) throw updateError;
      }

      // Update eligible reps if provided
      if (input.eligible_user_ids !== undefined) {
        // Delete existing eligible reps
        await supabase
          .from('incentive_eligible_reps')
          .delete()
          .eq('incentive_id', input.id);

        // Insert new eligible reps
        if (input.eligible_user_ids.length > 0) {
          const eligibleReps = input.eligible_user_ids.map(userId => ({
            incentive_id: input.id,
            user_id: userId,
          }));

          const { error: eligError } = await supabase
            .from('incentive_eligible_reps')
            .insert(eligibleReps);

          if (eligError) throw eligError;
        }
      }

      return { id: input.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentives'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-incentives'] });
    },
  });
};

export const useCancelIncentive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (incentiveId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify user is the creator and incentive hasn't been claimed
      const { data: incentive, error: fetchError } = await supabase
        .from('incentives')
        .select('created_by, status, winner_user_id')
        .eq('id', incentiveId)
        .single();

      if (fetchError) throw fetchError;
      if (incentive.created_by !== user.id) {
        throw new Error('Only the creator can cancel this incentive');
      }
      if (incentive.winner_user_id) {
        throw new Error('Cannot cancel an incentive that has already been claimed');
      }
      if (incentive.status === 'cancelled') {
        throw new Error('Incentive is already cancelled');
      }

      // Cancel the incentive
      const { error: updateError } = await supabase
        .from('incentives')
        .update({ 
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', incentiveId);

      if (updateError) throw updateError;

      return { id: incentiveId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentives'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-incentives'] });
    },
  });
};
