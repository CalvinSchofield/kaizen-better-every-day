import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
}

export const useBlitzAttendanceLogger = (allBlitzes: BlitzEvent[], enabled: boolean = false) => {
  const { toast } = useToast();
  const processedBlitzesRef = useRef<Set<string>>(new Set());
  
  // Check localStorage for already processed blitzes
  useEffect(() => {
    const stored = localStorage.getItem('processed-blitz-attendance');
    if (stored) {
      try {
        const ids = JSON.parse(stored);
        processedBlitzesRef.current = new Set(ids);
      } catch (e) {
        console.error('Error parsing processed blitz attendance:', e);
      }
    }
  }, []);

  const logBlitzAttendance = useCallback(async (blitz: BlitzEvent) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const { data, error } = await supabase.functions.invoke('log-blitz-attendance', {
        body: {
          blitzId: blitz.id,
          blitzName: blitz.name,
          blitzEndDate: blitz.endDate || blitz.date,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      // Mark as processed
      processedBlitzesRef.current.add(blitz.id);
      localStorage.setItem('processed-blitz-attendance', JSON.stringify([...processedBlitzesRef.current]));

      return { success: true, data };
    } catch (error: any) {
      console.error('Error logging blitz attendance:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Auto-log for recently ended blitzes (within last 2 days)
  useEffect(() => {
    if (!enabled || allBlitzes.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const recentlyEndedBlitzes = allBlitzes.filter(blitz => {
      const endDate = new Date(blitz.endDate || blitz.date);
      endDate.setHours(0, 0, 0, 0);
      
      // Blitz ended within last 2 days and not already processed
      return endDate >= twoDaysAgo && 
             endDate < today && 
             !processedBlitzesRef.current.has(blitz.id);
    });

    if (recentlyEndedBlitzes.length > 0) {
      console.log(`Found ${recentlyEndedBlitzes.length} recently ended blitzes to log attendance for`);
      
      // Process each one
      recentlyEndedBlitzes.forEach(async (blitz) => {
        const result = await logBlitzAttendance(blitz);
        if (result.success) {
          toast({
            title: "Blitz Attendance Logged",
            description: `Logged attendance for ${result.data?.loggedCount || 0} attendees from ${blitz.name}`,
          });
        }
      });
    }
  }, [allBlitzes, enabled, logBlitzAttendance, toast]);

  return {
    logBlitzAttendance,
    isProcessed: (blitzId: string) => processedBlitzesRef.current.has(blitzId),
  };
};
