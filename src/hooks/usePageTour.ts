import { useCallback, useEffect, useState } from 'react';
import { useRepData } from './useRepData';
import { supabase } from '@/integrations/supabase/client';

export type TourablePage = 
  | 'home' 
  | 'track' 
  | 'calendar' 
  | 'insights' 
  | 'my-group' 
  | 'customers' 
  | 'reports'
  | 'goals';

interface UsePageTourOptions {
  page: TourablePage;
  enabled?: boolean;
  delay?: number;
}

export const usePageTour = ({ page, enabled = true, delay = 600 }: UsePageTourOptions) => {
  const { repData, refetch } = useRepData();
  const [showTour, setShowTour] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Check if this page tour has been completed
  const pagesToured: string[] = Array.isArray(repData?.pages_toured) ? repData.pages_toured : [];
  const hasCompletedTour = pagesToured.includes(page);

  // Trigger tour after delay if not completed
  useEffect(() => {
    if (!enabled || hasCompletedTour || !repData) {
      setIsReady(true);
      return;
    }

    const timer = setTimeout(() => {
      setShowTour(true);
      setIsReady(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [enabled, hasCompletedTour, repData, delay, page]);

  // Mark tour as complete
  const completeTour = useCallback(async () => {
    if (!repData?.user_id) return;

    const updatedPages = [...pagesToured, page];
    
    const { error } = await supabase
      .from('reps')
      .update({ pages_toured: updatedPages })
      .eq('user_id', repData.user_id);

    if (!error) {
      await refetch();
    }
    
    setShowTour(false);
  }, [repData?.user_id, pagesToured, page, refetch]);

  // Skip tour (same as complete - marks as done)
  const skipTour = useCallback(async () => {
    await completeTour();
  }, [completeTour]);

  // Manually start tour (for replay from settings)
  const startTour = useCallback(() => {
    setShowTour(true);
  }, []);

  // Reset a specific tour (for replay)
  const resetTour = useCallback(async () => {
    if (!repData?.user_id) return;

    const updatedPages = pagesToured.filter(p => p !== page);
    
    await supabase
      .from('reps')
      .update({ pages_toured: updatedPages })
      .eq('user_id', repData.user_id);

    await refetch();
  }, [repData?.user_id, pagesToured, page, refetch]);

  return {
    showTour,
    isReady,
    hasCompletedTour,
    completeTour,
    skipTour,
    startTour,
    resetTour,
  };
};

// Reset all tours for a user
export const resetAllTours = async (userId: string) => {
  await supabase
    .from('reps')
    .update({ pages_toured: [] })
    .eq('user_id', userId);
};
