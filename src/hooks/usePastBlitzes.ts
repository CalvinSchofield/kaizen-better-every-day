import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, isBefore, parseISO } from 'date-fns';

interface BlitzPeriod {
  name: string;
  location?: string;
  startDate: string;
  endDate: string;
}

export function usePastBlitzes() {
  return useQuery({
    queryKey: ['past-blitzes'],
    queryFn: async () => {
      const { data: reps, error } = await supabase
        .from('reps')
        .select('committed_blitzes')
        .not('committed_blitzes', 'is', null);

      if (error) throw error;

      const now = new Date();
      const blitzMap = new Map<string, BlitzPeriod>();

      // Extract unique blitzes from all reps
      reps?.forEach(rep => {
        const blitzes = rep.committed_blitzes as any[];
        if (!Array.isArray(blitzes)) return;

        blitzes.forEach((blitz: any) => {
          if (!blitz?.date || !blitz?.endDate || !blitz?.name) return;
          
          const endDate = parseISO(blitz.endDate);
          // Only include past blitzes (ended before today)
          if (!isBefore(endDate, now)) return;

          const key = `${blitz.name}-${blitz.date}`;
          if (!blitzMap.has(key)) {
            blitzMap.set(key, {
              name: blitz.name,
              location: blitz.location,
              startDate: blitz.date,
              endDate: blitz.endDate,
            });
          }
        });
      });

      // Sort by end date descending (most recent first)
      return Array.from(blitzMap.values())
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
        .slice(0, 10); // Limit to last 10 blitzes
    },
    staleTime: 5 * 60 * 1000,
  });
}
