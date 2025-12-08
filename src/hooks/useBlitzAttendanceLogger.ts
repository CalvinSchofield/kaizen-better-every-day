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

  // Auto-log for ended or ending-today blitzes (after 6 PM local on end date)
  useEffect(() => {
    if (!enabled || allBlitzes.length === 0) return;

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Extend window to 7 days to catch any missed blitzes
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const currentHour = now.getHours();

    console.log(`[BlitzAttendance] Checking ${allBlitzes.length} blitzes for auto-logging (enabled: ${enabled})`);
    console.log(`[BlitzAttendance] Already processed: ${[...processedBlitzesRef.current].join(', ') || 'none'}`);

    const blitzesToLog = allBlitzes.filter(blitz => {
      if (processedBlitzesRef.current.has(blitz.id)) {
        console.log(`[BlitzAttendance] Skipping ${blitz.name} - already processed`);
        return false;
      }
      
      const endDateStr = blitz.endDate || blitz.date;
      const endDate = new Date(endDateStr);
      endDate.setHours(0, 0, 0, 0);
      
      console.log(`[BlitzAttendance] Checking ${blitz.name}: endDate=${endDateStr}, parsed=${endDate.toISOString()}, today=${today.toISOString()}`);
      
      // Blitz ended in past 7 days - always eligible
      if (endDate >= sevenDaysAgo && endDate < today) {
        console.log(`[BlitzAttendance] ${blitz.name} eligible - ended within last 7 days`);
        return true;
      }
      
      // Blitz ends TODAY and it's after 6 PM - eligible
      if (endDate.getTime() === today.getTime() && currentHour >= 18) {
        console.log(`[BlitzAttendance] ${blitz.name} eligible - ends today and it's after 6 PM`);
        return true;
      }
      
      console.log(`[BlitzAttendance] ${blitz.name} not eligible - future blitz or too old`);
      return false;
    });

    if (blitzesToLog.length > 0) {
      console.log(`[BlitzAttendance] Found ${blitzesToLog.length} blitzes to log attendance for:`, blitzesToLog.map(b => b.name));
      
      // Process each one
      blitzesToLog.forEach(async (blitz) => {
        console.log(`[BlitzAttendance] Calling edge function for ${blitz.name}...`);
        const result = await logBlitzAttendance(blitz);
        console.log(`[BlitzAttendance] Result for ${blitz.name}:`, result);
        if (result.success) {
          toast({
            title: "Blitz Attendance Logged",
            description: `Logged attendance for ${result.data?.loggedCount || 0} attendees from ${blitz.name}`,
          });
        }
      });
    } else {
      console.log(`[BlitzAttendance] No blitzes need attendance logging`);
    }
  }, [allBlitzes, enabled, logBlitzAttendance, toast]);

  return {
    logBlitzAttendance,
    isProcessed: (blitzId: string) => processedBlitzesRef.current.has(blitzId),
  };
};
