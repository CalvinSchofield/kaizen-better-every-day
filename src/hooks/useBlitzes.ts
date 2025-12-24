import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface CachedBlitzes {
  data: BlitzEvent[];
  timestamp: number;
}

const CACHE_KEY = 'blitzes-cache';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const parseBlitzesFromCache = (cached: CachedBlitzes | null): { future: BlitzEvent[]; past: BlitzEvent[] } => {
  if (!cached?.data?.length) return { future: [], past: [] };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const future: BlitzEvent[] = [];
  const past: BlitzEvent[] = [];
  
  cached.data.forEach((blitz) => {
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
  const [allBlitzes, setAllBlitzes] = useState<BlitzEvent[]>([]);
  const [pastBlitzes, setPastBlitzes] = useState<BlitzEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasLoadedCache, setHasLoadedCache] = useState(false);

  // Load from cache immediately for instant display - stale-while-revalidate
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed: CachedBlitzes = JSON.parse(cached);
        // Use cache even if older - we'll refresh in background
        if (parsed.data?.length > 0) {
          const { future, past } = parseBlitzesFromCache(parsed);
          setAllBlitzes(future);
          setPastBlitzes(past);
          setLastUpdated(new Date(parsed.timestamp));
          setLoading(false); // Show cached data immediately
          setHasLoadedCache(true);
        }
      } catch (e) {
        console.error('Failed to parse cached blitzes:', e);
      }
    }
  }, []);

  const fetchBlitzes = useCallback(async (isBackgroundRefresh = false) => {
    // Only show loading spinner if we don't have any cached data
    if (!isBackgroundRefresh && !hasLoadedCache) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('fetch-blitzes');
      
      if (fetchError) throw fetchError;
      
      if (data?.blitzes) {
        const cached: CachedBlitzes = { data: data.blitzes, timestamp: Date.now() };
        const { future, past } = parseBlitzesFromCache(cached);
        
        setAllBlitzes(future);
        setPastBlitzes(past);
        setIsUsingCache(false);
        setLastUpdated(new Date());
        
        // Cache for offline access
        localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
      }
    } catch (err) {
      console.error('Error fetching blitzes:', err);
      // Only set error if we don't have cached data to show
      if (!hasLoadedCache) {
        setError(err as Error);
      }
      
      // Try to use cached data as fallback (only show toast if we didn't already have cache)
      if (!hasLoadedCache) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const parsed: CachedBlitzes = JSON.parse(cached);
            if (parsed.data?.length > 0) {
              const { future, past } = parseBlitzesFromCache(parsed);
              setAllBlitzes(future);
              setPastBlitzes(past);
              setIsUsingCache(true);
              setLastUpdated(new Date(parsed.timestamp));
              toast.warning("Using cached data", {
                description: "Couldn't refresh blitzes. Showing last known data.",
              });
            }
          } catch (e) {
            console.error('Failed to use cached blitzes:', e);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [hasLoadedCache]);

  // Initial fetch - background refresh if we already have cached data
  useEffect(() => {
    fetchBlitzes(hasLoadedCache);
  }, [hasLoadedCache]); // Only run once when cache status is known

  const allBlitzesIncludingPast = [...allBlitzes, ...pastBlitzes];
  
  return { 
    allBlitzes, 
    pastBlitzes, 
    allBlitzesIncludingPast, 
    loading, 
    error,
    isUsingCache,
    lastUpdated,
    refetch: fetchBlitzes,
  };
};
