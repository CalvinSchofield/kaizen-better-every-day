import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConfetti } from "./useConfetti";
import { toast } from "sonner";

/**
 * Hook to detect when the current user wins a challenge or incentive
 * and trigger celebration animations
 */
export const useChallengeWinDetection = () => {
  const { fireWinConfetti } = useConfetti();
  const queryClient = useQueryClient();
  const celebratedIds = useRef<Set<string>>(new Set());

  const { data: currentUserId } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!currentUserId) return;

    // Listen for challenge completions where the current user is the winner
    const challengeChannel = supabase
      .channel('challenge-wins')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'challenges',
          filter: `winner_user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const challenge = payload.new as any;
          
          // Only celebrate if status just changed to completed and we haven't celebrated this one
          if (
            challenge.status === 'completed' && 
            payload.old?.status !== 'completed' &&
            !celebratedIds.current.has(challenge.id)
          ) {
            celebratedIds.current.add(challenge.id);
            console.log('[WinDetection] You won a challenge!', challenge.id);
            
            // Fire confetti
            fireWinConfetti();
            
            // Show toast
            toast.success('🏆 You won the challenge!', {
              description: challenge.is_tie 
                ? 'Won by tiebreaker - great work!' 
                : 'Congratulations on your victory!',
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    // Listen for incentive completions where the current user is the winner
    const incentiveChannel = supabase
      .channel('incentive-wins')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'incentives',
          filter: `winner_user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const incentive = payload.new as any;
          
          if (
            incentive.status === 'completed' && 
            payload.old?.status !== 'completed' &&
            !celebratedIds.current.has(incentive.id)
          ) {
            celebratedIds.current.add(incentive.id);
            console.log('[WinDetection] You won an incentive!', incentive.id);
            
            // Fire confetti
            fireWinConfetti();
            
            // Show toast
            toast.success('🎉 You won the incentive!', {
              description: 'Collect your prize!',
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(challengeChannel);
      supabase.removeChannel(incentiveChannel);
    };
  }, [currentUserId, fireWinConfetti]);
};
