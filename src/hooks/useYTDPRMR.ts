import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useYTDPRMR = () => {
  const { data: totalPRMR = 0, isLoading } = useQuery({
    queryKey: ['ytd-prmr-total'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      // Get start of 2026 Sales Season (Sept 28, 2025)
      const seasonStart = '2025-09-28';

      // Query all finalized entries from start of year to now
      const { data, error } = await supabase
        .from('daily_entries')
        .select('prmr, upgrade_prmr')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .gte('entry_date', seasonStart);

      if (error) {
        console.error('Error fetching YTD PRMR:', error);
        return 0;
      }

      // Sum up all prmr values (prmr field IS total PRMR)
      const total = data?.reduce((sum, entry) => sum + (entry.prmr || 0), 0) || 0;
      return Math.round(total); // Round to nearest dollar
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return { totalPRMR, isLoading };
};
