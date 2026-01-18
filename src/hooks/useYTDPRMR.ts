import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUserId } from './useCurrentUserId';

interface YTDPRMRData {
  totalPRMR: number;
}

const CACHE_KEY_PREFIX = 'ytd-prmr-cache-';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Get cached data for instant loading
const getCachedYTDPRMR = (userId: string): YTDPRMRData | undefined => {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
        return parsed.data;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return undefined;
};

// Save to cache for instant loading on next visit
const setCachedYTDPRMR = (userId: string, data: YTDPRMRData): void => {
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch {
    // Ignore cache errors (e.g., storage full)
  }
};

export const useYTDPRMR = () => {
  const { userId, isReady: authReady } = useCurrentUserId();
  
  // Get initial data from cache for instant display
  const initialData = userId ? getCachedYTDPRMR(userId) : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['ytd-prmr-total', userId],
    enabled: authReady && !!userId,
    queryFn: async () => {
      if (!userId) return { totalPRMR: 0 };

      // Get start of 2026 Sales Season (Sept 28, 2025)
      const seasonStart = '2025-09-28';

      // Query all finalized entries from start of year to now
      const { data, error } = await supabase
        .from('daily_entries')
        .select('prmr, upgrade_prmr')
        .eq('user_id', userId)
        .eq('is_finalized', true)
        .gte('entry_date', seasonStart);

      if (error) {
        console.error('Error fetching YTD PRMR:', error);
        return { totalPRMR: 0 };
      }

      // Sum up all prmr values (prmr field IS total PRMR)
      const total = data?.reduce((sum, entry) => sum + (entry.prmr || 0), 0) || 0;
      const result: YTDPRMRData = { totalPRMR: Math.round(total) };
      
      // Cache the result for instant loading
      setCachedYTDPRMR(userId, result);
      
      return result;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    initialData,
  });

  return { 
    totalPRMR: data?.totalPRMR ?? 0, 
    isLoading: isLoading || !authReady 
  };
};
