import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// Stage progression order - higher index = more advanced
// We NEVER move backward, only forward
const STAGE_PROGRESSION_ORDER = [
  '100 List',
  'Potential Follow Up',
  'Reached Out',
  'Reached out',
  'Evaluating',
  'Signed',
  'Shadow ✅',
  'Sold 💲',
  'Sold (5+) 💰',
  // These are terminal states (not in progression)
  // 'Signed but Not Interested',
  // 'Not Interested',
];

// Exit/terminal stages that auto-progression should NEVER override
const EXIT_STAGES = ['Potential Follow Up', 'Not Interested', 'Signed but Not Interested'];

// Get stage index (returns -1 for terminal/unknown stages)
const getStageIndex = (stage: string | null): number => {
  if (!stage) return -1;
  const normalizedStage = stage.trim();
  return STAGE_PROGRESSION_ORDER.findIndex(
    s => s.toLowerCase() === normalizedStage.toLowerCase()
  );
};

// Check if we can progress from current stage to new stage (forward only)
// IMPORTANT: Never auto-progress FROM an exit stage - these are manually set by leaders
export const canProgressToStage = (currentStage: string | null, newStage: string): boolean => {
  // Never auto-progress from exit stages - leader manually put them there
  if (currentStage && EXIT_STAGES.some(es => es.toLowerCase() === currentStage.toLowerCase())) {
    return false;
  }
  
  const currentIndex = getStageIndex(currentStage);
  const newIndex = getStageIndex(newStage);
  
  // If either stage is not in progression order, allow the change
  if (currentIndex === -1 || newIndex === -1) return true;
  
  // Only allow forward progression
  return newIndex > currentIndex;
};

// Get the appropriate auto-stage based on metrics
export const getAutoStageFromMetrics = (
  currentStage: string | null,
  fpPlus: number,
  onboardingComplete: boolean,
  hasAttendedBlitz: boolean
): string | null => {
  // Check stages in order from most advanced to least
  
  // Sold (5+) - has 5+ FP+
  if (fpPlus >= 5 && canProgressToStage(currentStage, 'Sold (5+) 💰')) {
    return 'Sold (5+) 💰';
  }
  
  // Sold - has any FP+ or PRMR
  if (fpPlus > 0 && canProgressToStage(currentStage, 'Sold 💲')) {
    return 'Sold 💲';
  }
  
  // Shadow Complete - has attended a blitz
  if (hasAttendedBlitz && canProgressToStage(currentStage, 'Shadow ✅')) {
    return 'Shadow ✅';
  }
  
  // Signed - onboarding is complete
  if (onboardingComplete && canProgressToStage(currentStage, 'Signed')) {
    return 'Signed';
  }
  
  return null;
};

export const useAutoStageProgression = () => {
  const queryClient = useQueryClient();

  // Check and auto-update stage for a recruit based on their metrics
  // Supports both recruitId (Supabase UUID) and recruitNotionId (legacy)
  const checkAndUpdateStage = useCallback(async (
    identifier: string,
    currentStage: string | null,
    isSupabaseId: boolean = false // Set to true if identifier is a Supabase UUID
  ) => {
    try {
      // Fetch recruit's rep data to check metrics
      // Try by Supabase ID first if specified, otherwise by Notion ID
      let repData = null;
      
      if (isSupabaseId) {
        const { data } = await supabase
          .from('reps')
          .select('id, notion_page_id, user_id, onboarding_complete, committed_blitzes, blitz_trip_date')
          .eq('id', identifier)
          .maybeSingle();
        repData = data;
      }
      
      if (!repData) {
        const { data } = await supabase
          .from('reps')
          .select('id, notion_page_id, user_id, onboarding_complete, committed_blitzes, blitz_trip_date')
          .eq('notion_page_id', identifier)
          .maybeSingle();
        repData = data;
      }

      if (!repData?.user_id) return null;

      // Get total FP+ from daily entries
      const { data: entries } = await supabase
        .from('daily_entries')
        .select('fp_plus')
        .eq('user_id', repData.user_id);

      const totalFpPlus = entries?.reduce((sum, e) => sum + (e.fp_plus || 0), 0) || 0;
      
      // Check if they've attended a blitz (blitz trip date is in the past)
      const hasAttendedBlitz = repData.blitz_trip_date 
        ? new Date(repData.blitz_trip_date) < new Date()
        : false;
      
      const onboardingComplete = repData.onboarding_complete ?? false;

      const newStage = getAutoStageFromMetrics(
        currentStage,
        totalFpPlus,
        onboardingComplete,
        hasAttendedBlitz
      );

      if (newStage && newStage !== currentStage) {
        // Update stage via edge function
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        const { error } = await supabase.functions.invoke('update-recruit-stage', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { 
            recruitId: repData.id, // Always use Supabase ID
            recruitNotionId: repData.notion_page_id, // Include for backwards compatibility
            newStage, 
            notes: `Auto-progressed based on: ${
              newStage.includes('5+') ? '5+ FP+ achieved' :
              newStage.includes('Sold') ? 'First sale recorded' :
              newStage.includes('Shadow') ? 'Attended blitz' :
              newStage.includes('Signed') ? 'Onboarding completed' : 'Progress'
            }`,
            isAutomatic: true,
          },
        });

        if (!error) {
          // Invalidate all related queries for proper UI updates
          queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
          queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'] });
          queryClient.invalidateQueries({ queryKey: ['recruit-rep-data', repData.id] });
          queryClient.invalidateQueries({ queryKey: ['recruit-rep-data', identifier] });
          return newStage;
        }
      }

      return null;
    } catch (error) {
      console.error('Error checking auto-stage progression:', error);
      return null;
    }
  }, [queryClient]);

  // Check stage based on reaching out and connecting (for 100 List progression)
  const checkReachedOutProgression = useCallback(async (
    identifier: string,
    currentStage: string | null,
    wasConnected: boolean
  ): Promise<'show_popup' | 'auto_update' | null> => {
    // Only show popup for 100 List stage when connected
    const is100List = currentStage?.toLowerCase().includes('100') || 
                      currentStage?.toLowerCase().includes('list');
    
    if (is100List && wasConnected) {
      return 'show_popup';
    }
    
    return null;
  }, []);

  return {
    checkAndUpdateStage,
    checkReachedOutProgression,
    canProgressToStage,
    getAutoStageFromMetrics,
  };
};
