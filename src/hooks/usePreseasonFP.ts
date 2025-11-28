import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Global summer start date - April 12, 2026
const GLOBAL_SUMMER_START = '2026-04-12';

export const usePreseasonFP = () => {
  const { data: totalFP = 0, isLoading } = useQuery({
    queryKey: ['preseason-fp-total'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      // Query all finalized entries before summer start date
      const { data, error } = await supabase
        .from('daily_entries')
        .select('fp_plus')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .lt('entry_date', GLOBAL_SUMMER_START);

      if (error) {
        console.error('Error fetching preseason FP:', error);
        return 0;
      }

      // Sum up all fp_plus values
      const total = data?.reduce((sum, entry) => sum + (entry.fp_plus || 0), 0) || 0;
      return Math.round(total * 10) / 10; // Round to 1 decimal place
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return { totalFP, isLoading };
};
