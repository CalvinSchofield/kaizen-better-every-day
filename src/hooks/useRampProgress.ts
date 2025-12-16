import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Hook for safely saving ramp-to-blitz progress without race conditions.
 * Fetches latest watched_videos from DB before merging to prevent overwrites.
 */
export const useRampProgress = (userId: string | null | undefined) => {
  const saveProgress = useCallback(async (itemId: string) => {
    if (!userId) return false;

    try {
      // Fetch the latest watched_videos from DB to prevent race conditions
      const { data: currentRep, error: fetchError } = await supabase
        .from('reps')
        .select('watched_videos')
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        console.error('Failed to fetch current progress:', fetchError);
        return false;
      }

      const currentWatched = Array.isArray(currentRep?.watched_videos) 
        ? (currentRep.watched_videos as string[]) 
        : [];

      // Don't update if already included
      if (currentWatched.includes(itemId)) {
        return true;
      }

      const newWatched = [...currentWatched, itemId];

      const { error: updateError } = await supabase
        .from('reps')
        .update({ watched_videos: newWatched })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Failed to save progress:', updateError);
        toast({
          title: "Failed to save progress",
          description: "Please try again",
          variant: "destructive",
        });
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error saving progress:', err);
      return false;
    }
  }, [userId]);

  const removeProgress = useCallback(async (itemId: string) => {
    if (!userId) return false;

    try {
      const { data: currentRep, error: fetchError } = await supabase
        .from('reps')
        .select('watched_videos')
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        console.error('Failed to fetch current progress:', fetchError);
        return false;
      }

      const currentWatched = Array.isArray(currentRep?.watched_videos) 
        ? (currentRep.watched_videos as string[]) 
        : [];

      const newWatched = currentWatched.filter(id => id !== itemId);

      const { error: updateError } = await supabase
        .from('reps')
        .update({ watched_videos: newWatched })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Failed to remove progress:', updateError);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error removing progress:', err);
      return false;
    }
  }, [userId]);

  const updateIpadStatus = useCallback(async (hasIpad: boolean) => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('reps')
        .update({ ipad_assigned: hasIpad })
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to update iPad status:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error updating iPad status:', err);
      return false;
    }
  }, [userId]);

  return { saveProgress, removeProgress, updateIpadStatus };
};
