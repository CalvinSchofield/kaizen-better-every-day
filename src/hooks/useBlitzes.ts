import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
}

export const useBlitzes = () => {
  const [allBlitzes, setAllBlitzes] = useState<BlitzEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllBlitzes = async () => {
      setLoading(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('fetch-preseason-blitzes');
        
        if (error) throw error;
        
        if (data?.blitzes) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const futureBlitzes = data.blitzes
            .filter((blitz: any) => {
              if (!blitz || !blitz.date) return false;
              const blitzEndDate = blitz.endDate ? new Date(blitz.endDate) : new Date(blitz.date);
              blitzEndDate.setHours(0, 0, 0, 0);
              return blitzEndDate >= today;
            })
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          setAllBlitzes(futureBlitzes);
        }
      } catch (error) {
        console.error('Error fetching blitzes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllBlitzes();
  }, []);

  return { allBlitzes, loading };
};
