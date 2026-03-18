import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUserId } from './useCurrentUserId';

interface UplineContact {
  name: string;
  phone: string | null;
  year: string;
  userId: string;
}

/**
 * Walks up the recruiter chain (via recruits.recruiter_user_id → reps)
 * until it finds a non-Rookie (Sophomore, Vet, etc).
 * Max 6 hops to prevent infinite loops.
 */
async function resolveUpline(userId: string): Promise<UplineContact | null> {
  let currentUserId = userId;

  for (let i = 0; i < 6; i++) {
    // Find the recruit record for this user (recruits.id matches reps.id which shares user_id)
    // We need to find a recruit whose linked rep has user_id = currentUserId
    const { data: rep } = await supabase
      .from('reps')
      .select('id, recruiter, year, name, phone')
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (!rep) return null;

    // Find recruiter_user_id from the recruits table for this person
    const { data: recruit } = await supabase
      .from('recruits')
      .select('recruiter_user_id')
      .eq('id', rep.id)
      .maybeSingle();

    const recruiterUserId = recruit?.recruiter_user_id;
    if (!recruiterUserId) return null;

    // Look up the recruiter's rep record
    const { data: recruiterRep } = await supabase
      .from('reps')
      .select('name, phone, year, user_id')
      .eq('user_id', recruiterUserId)
      .maybeSingle();

    if (!recruiterRep) return null;

    // If they're NOT a Rookie, we found our upline
    if (recruiterRep.year && recruiterRep.year !== 'Rookie') {
      return {
        name: recruiterRep.name,
        phone: recruiterRep.phone,
        year: recruiterRep.year,
        userId: recruiterUserId,
      };
    }

    // They're a Rookie too — keep climbing
    currentUserId = recruiterUserId;
  }

  return null;
}

export const useUplineContact = () => {
  const { userId } = useCurrentUserId();

  return useQuery({
    queryKey: ['upline-contact', userId],
    queryFn: () => resolveUpline(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 30, // 30 min
    gcTime: 1000 * 60 * 60,
  });
};
