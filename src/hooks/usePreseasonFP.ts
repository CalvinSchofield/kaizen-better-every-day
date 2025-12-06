import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Global summer start date - April 12, 2026
const GLOBAL_SUMMER_START = '2026-04-12';

export const usePreseasonFP = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['preseason-fp-total'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { totalFP: 0, totalPRMR: 0 };

      // Query all finalized entries before summer start date
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('fp_plus, prmr')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .lt('entry_date', GLOBAL_SUMMER_START);

      if (error) {
        console.error('Error fetching preseason FP:', error);
        return { totalFP: 0, totalPRMR: 0 };
      }

      // Sum up all values
      const totalFP = entries?.reduce((sum, entry) => sum + (entry.fp_plus || 0), 0) || 0;
      const totalPRMR = entries?.reduce((sum, entry) => sum + (entry.prmr || 0), 0) || 0;
      
      return {
        totalFP: Math.round(totalFP * 10) / 10,
        totalPRMR: Math.round(totalPRMR * 100) / 100,
      };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return { 
    totalFP: data?.totalFP ?? 0, 
    totalPRMR: data?.totalPRMR ?? 0,
    isLoading 
  };
};
