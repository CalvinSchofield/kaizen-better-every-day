import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export const useBlitzes = () => {
  const [allBlitzes, setAllBlitzes] = useState<BlitzEvent[]>([]);
  const [pastBlitzes, setPastBlitzes] = useState<BlitzEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from cache immediately for instant offline access
  useEffect(() => {
    const cached = localStorage.getItem('blitzes-cache');
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        const isRecent = Date.now() - timestamp < 60 * 60 * 1000; // 1 hour
        if (isRecent && data.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const future: BlitzEvent[] = [];
          const past: BlitzEvent[] = [];
          
          data.forEach((blitz: any) => {
            if (!blitz || !blitz.date) return;
            const blitzEndDate = blitz.endDate ? new Date(blitz.endDate) : new Date(blitz.date);
            blitzEndDate.setHours(0, 0, 0, 0);
            if (blitzEndDate >= today) {
              future.push(blitz);
            } else {
              past.push(blitz);
            }
          });
          
          // Sort future by date ascending, past by date descending
          future.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          past.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          setAllBlitzes(future);
          setPastBlitzes(past);
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to parse cached blitzes:', e);
      }
    }
  }, []);

  useEffect(() => {
    const fetchAllBlitzes = async () => {
      setLoading(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('fetch-preseason-blitzes');
        
        if (error) throw error;
        
        if (data?.blitzes) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const future: BlitzEvent[] = [];
          const past: BlitzEvent[] = [];
          
          data.blitzes.forEach((blitz: any) => {
            if (!blitz || !blitz.date) return;
            const blitzEndDate = blitz.endDate ? new Date(blitz.endDate) : new Date(blitz.date);
            blitzEndDate.setHours(0, 0, 0, 0);
            if (blitzEndDate >= today) {
              future.push(blitz);
            } else {
              past.push(blitz);
            }
          });
          
          // Sort future by date ascending, past by date descending
          future.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          past.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          setAllBlitzes(future);
          setPastBlitzes(past);
          
          // Cache for offline access (store ALL blitzes)
          localStorage.setItem('blitzes-cache', JSON.stringify({
            data: data.blitzes,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Error fetching blitzes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllBlitzes();
  }, []);

  return { allBlitzes, pastBlitzes, loading };
};
