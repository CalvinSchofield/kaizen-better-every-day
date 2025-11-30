import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TodayData {
  doors: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp: number;
}

interface ComparisonData {
  fpChange: number;
  label: string;
}

interface UseDailyFocusParams {
  today: TodayData;
  comparison: ComparisonData;
  avgDoors: number;
  avgFp: number;
}

export const useDailyFocus = (params: UseDailyFocusParams | null) => {
  return useQuery({
    queryKey: ['daily-focus', params?.today],
    queryFn: async () => {
      if (!params) return null;

      const { data, error } = await supabase.functions.invoke('generate-daily-focus', {
        body: params
      });

      if (error) {
        console.error('Error generating daily focus:', error);
        throw error;
      }

      return data.focus as string;
    },
    enabled: !!params && params.today.fp > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
};
