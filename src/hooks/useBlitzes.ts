import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  address1?: string | null;
  wifi1?: string | null;
  code1?: string | null;
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

  // Load from cache immediately for instant offline access
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed: CachedBlitzes = JSON.parse(cached);
        const isRecent = Date.now() - parsed.timestamp < CACHE_DURATION;
        if (isRecent && parsed.data?.length > 0) {
          const { future, past } = parseBlitzesFromCache(parsed);
          setAllBlitzes(future);
          setPastBlitzes(past);
          setLastUpdated(new Date(parsed.timestamp));
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to parse cached blitzes:', e);
      }
    }
  }, []);

  const fetchBlitzes = useCallback(async () => {
    setLoading(true);
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
      setError(err as Error);
      
      // Try to use cached data as fallback
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlitzes();
  }, [fetchBlitzes]);

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
