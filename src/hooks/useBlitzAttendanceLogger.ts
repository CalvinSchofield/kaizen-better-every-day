import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
}

// Global lock to prevent multiple components from processing simultaneously
let globalProcessingLock = false;

export const useBlitzAttendanceLogger = (allBlitzes: BlitzEvent[], enabled: boolean = false) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasRunRef = useRef(false);

  // Fetch processed blitz IDs from database (persists across devices)
  const { data: processedBlitzIds = [] } = useQuery({
    queryKey: ['processed-blitz-ids'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data } = await supabase
        .from('reps')
        .select('processed_blitz_ids')
        .eq('user_id', session.user.id)
        .maybeSingle();

      return (data?.processed_blitz_ids as string[]) || [];
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled,
  });

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

      // Invalidate the query to refresh processed IDs
      queryClient.invalidateQueries({ queryKey: ['processed-blitz-ids'] });

      return { success: true, data };
    } catch (error: any) {
      console.error('Error logging blitz attendance:', error);
      return { success: false, error: error.message };
    }
  }, [queryClient]);

  // Auto-log for ended or ending-today blitzes (after 6 PM local on end date)
  useEffect(() => {
    // Only run once per component mount and only if enabled
    if (!enabled || allBlitzes.length === 0 || hasRunRef.current) return;
    
    // Set hasRunRef IMMEDIATELY before any async operations to prevent re-runs
    hasRunRef.current = true;
    
    // Global lock to prevent multiple components from processing
    if (globalProcessingLock) {
      console.log('[BlitzAttendance] Another process is already running, skipping');
      return;
    }

    const processBlitzes = async () => {
      // Set lock immediately
      globalProcessingLock = true;

      try {
        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentHour = now.getHours();

        console.log(`[BlitzAttendance] Checking ${allBlitzes.length} blitzes for auto-logging`);
        console.log(`[BlitzAttendance] Already processed (from DB): ${processedBlitzIds.join(', ') || 'none'}`);

        const blitzesToLog = allBlitzes.filter(blitz => {
          // Check database-persisted processed IDs
          if (processedBlitzIds.includes(blitz.id)) {
            console.log(`[BlitzAttendance] Skipping ${blitz.name} - already processed`);
            return false;
          }
          
          const endDateStr = blitz.endDate || blitz.date;
          const endDate = new Date(endDateStr);
          endDate.setHours(0, 0, 0, 0);
          
          // Any blitz that has already ended (before today) is eligible
          if (endDate < today) {
            console.log(`[BlitzAttendance] ${blitz.name} eligible - past blitz`);
            return true;
          }
          
          // Blitz ends TODAY and it's after 6 PM - eligible
          if (endDate.getTime() === today.getTime() && currentHour >= 18) {
            console.log(`[BlitzAttendance] ${blitz.name} eligible - ends today and it's after 6 PM`);
            return true;
          }
          
          console.log(`[BlitzAttendance] ${blitz.name} not eligible - future blitz`);
          return false;
        });

        if (blitzesToLog.length > 0) {
          console.log(`[BlitzAttendance] Found ${blitzesToLog.length} blitzes to log attendance for:`, blitzesToLog.map(b => b.name));
          
          // Process sequentially to avoid race conditions
          for (const blitz of blitzesToLog) {
            console.log(`[BlitzAttendance] Calling edge function for ${blitz.name}...`);
            const result = await logBlitzAttendance(blitz);
            console.log(`[BlitzAttendance] Result for ${blitz.name}:`, result);
            
            // Only show toast if we actually logged something (not skipped)
            if (result.success && result.data?.loggedCount > 0) {
              toast({
                title: "Blitz Attendance Logged",
                description: `Logged attendance for ${result.data.loggedCount} attendees from ${blitz.name}`,
              });
            }
          }
        } else {
          console.log(`[BlitzAttendance] No blitzes need attendance logging`);
        }
      } finally {
        // Release lock after a delay to prevent rapid re-triggering
        setTimeout(() => {
          globalProcessingLock = false;
        }, 5000);
      }
    };

    processBlitzes();
  }, [allBlitzes, enabled, logBlitzAttendance, toast, processedBlitzIds]);

  return {
    logBlitzAttendance,
    isProcessed: (blitzId: string) => processedBlitzIds.includes(blitzId),
  };
};