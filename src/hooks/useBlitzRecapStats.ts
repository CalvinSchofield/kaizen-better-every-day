import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { parseDateAsLocal, getTodayDateString } from "@/utils/blitzDateUtils";

export interface BlitzRecapStat {
  id: string;
  name: string;
  location: string | null;
  startDate: string;
  endDate: string;
  daysWorked: number;
  doors: number;
  fpPlus: number;
  prmr: number;
}

export function useBlitzRecapStats(committedBlitzes: any[] | null) {
  const { userId } = useCurrentUserId();

  // Filter to only past blitzes
  const pastBlitzes = (committedBlitzes || []).filter((b: any) => {
    if (!b?.endDate && !b?.date) return false;
    const endDate = parseDateAsLocal(b.endDate ?? b.date);
    if (!endDate) return false;
    const today = parseDateAsLocal(getTodayDateString()) ?? new Date();
    return endDate.getTime() < today.getTime();
  });

  return useQuery({
    queryKey: ['blitz-recap-stats', userId, pastBlitzes.map((b: any) => b.id).join(',')],
    queryFn: async () => {
      if (!userId || pastBlitzes.length === 0) return [];

      // Get the earliest start and latest end across all past blitzes
      const allDates = pastBlitzes.flatMap((b: any) => [b.date, b.endDate].filter(Boolean));
      const earliest = allDates.sort()[0];
      const latest = allDates.sort().reverse()[0];

      // Single query for all entries in the range
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date, doors_knocked, fp_plus, prmr, work_start_time')
        .eq('user_id', userId)
        .gte('entry_date', earliest)
        .lte('entry_date', latest);

      if (error) throw error;

      // Aggregate per blitz
      return pastBlitzes.map((blitz: any): BlitzRecapStat => {
        const startDate = blitz.date;
        const endDate = blitz.endDate ?? blitz.date;

        const blitzEntries = (entries || []).filter(e =>
          e.entry_date >= startDate && e.entry_date <= endDate
        );

        return {
          id: blitz.id,
          name: blitz.name,
          location: blitz.location || null,
          startDate,
          endDate,
          daysWorked: blitzEntries.filter(e => e.work_start_time).length,
          doors: blitzEntries.reduce((s, e) => s + (e.doors_knocked || 0), 0),
          fpPlus: blitzEntries.reduce((s, e) => s + (Number(e.fp_plus) || 0), 0),
          prmr: blitzEntries.reduce((s, e) => s + (Number(e.prmr) || 0), 0),
        };
      }).sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
    },
    enabled: !!userId && pastBlitzes.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}
