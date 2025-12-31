import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Accommodation {
  id: string;
  name: string;
  address: string | null;
  wifiPassword: string | null;
  doorCode: string | null;
  notes: string | null;
}

interface BlitzEvent {
  id: string;
  supabaseId?: string; // Actual DB ID for recruit_blitzes FK
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  address1?: string | null;
  wifi1?: string | null;
  code1?: string | null;
  accommodations?: Accommodation[];
}

const parseBlitzes = (blitzes: BlitzEvent[]): { future: BlitzEvent[]; past: BlitzEvent[] } => {
  if (!blitzes?.length) return { future: [], past: [] };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const future: BlitzEvent[] = [];
  const past: BlitzEvent[] = [];
  
  blitzes.forEach((blitz) => {
    if (!blitz?.date) return;
    const blitzEndDate = blitz.endDate ? new Date(blitz.endDate) : new Date(blitz.date);
    blitzEndDate.setHours(0, 0, 0, 0);
    if (blitzEndDate >= today) {
      future.push(blitz);
    } else {
      past.push(blitz);
    }
  });
  
  future.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  past.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return { future, past };
};

export const useBlitzes = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['blitzes'],
    queryFn: async () => {
      const { data, error: fetchError } = await supabase.functions.invoke('fetch-blitzes');
      
      if (fetchError) throw fetchError;
      
      return data?.blitzes || [];
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  const allBlitzesRaw = data || [];
  const { future: allBlitzes, past: pastBlitzes } = parseBlitzes(allBlitzesRaw);
  const allBlitzesIncludingPast = [...allBlitzes, ...pastBlitzes];

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: ['blitzes'] });
  };
  
  return { 
    allBlitzes, 
    pastBlitzes, 
    allBlitzesIncludingPast, 
    loading: isLoading && !data, // Only show loading on first load
    error,
    isUsingCache: false,
    lastUpdated: null,
    refetch,
    isFetching,
  };
};
