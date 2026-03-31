import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateSalesQueriesForRealtime } from "@/utils/invalidateSalesQueries";

/**
 * Centralized realtime subscription for sales data changes.
 * Subscribes to daily_entries changes and invalidates all sales-dependent queries
 * EXCEPT daily-entry (managed by the durable counter queue during active tracking).
 */
export const useSalesRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => invalidateSalesQueriesForRealtime(queryClient);
    const channelName = `sales-realtime-updates-${Math.random().toString(36).slice(2)}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: number | null = null;
    let isMounted = true;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const subscribe = () => {
      if (!isMounted) return;

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "daily_entries",
          },
          invalidate
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            clearReconnectTimer();
            invalidate();
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            // Null out channel BEFORE removing to prevent recursive removeChannel calls
            const ch = channel;
            channel = null;
            if (ch) {
              supabase.removeChannel(ch);
            }

            clearReconnectTimer();
            reconnectTimer = window.setTimeout(() => {
              subscribe();
            }, 1500);
          }
        });
    };

    subscribe();

    const handleOnline = () => invalidate();
    const handleFocus = () => invalidate();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        invalidate();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      clearReconnectTimer();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      const ch = channel;
      channel = null;
      if (ch) {
        supabase.removeChannel(ch);
      }
    };
  }, [queryClient]);
};
