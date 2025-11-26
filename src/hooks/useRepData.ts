import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RepData {
  id: string;
  user_id: string;
  notion_page_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  recruiter: string | null;
  team_leader: string | null;
  team_leader_phone: string | null;
  stage: string | null;
  ramp_to_blitz_phase: string | null;
  onboarding_complete: boolean;
  trainings_complete: boolean;
  slack_joined: boolean;
  ramp_phase_1_complete: boolean;
  ramp_phase_2_complete: boolean;
  ramp_phase_3_complete: boolean;
  ramp_phase_4_complete: boolean;
  blitz_ready: boolean;
  path_to_pro_started: boolean;
  path_to_pro_progress: number;
  completed_tasks: unknown; // JSONB array of completed task IDs
  nudge_leader: boolean | null;
  last_nudge_time: string | null;
  year: string | null; // "Rookie", "Sophomore", or "Vet"
}

export const useRepData = () => {
  const [repData, setRepData] = useState<RepData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRepData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("reps")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      // If no rep data exists, automatically sync from Notion
      if (!data) {
        console.log("No rep data found, attempting auto-sync from Notion...");
        toast({
          title: "Syncing from Notion",
          description: "Loading your data from Notion...",
        });

        const { error: syncError } = await supabase.functions.invoke(
          "sync-notion-reps"
        );

        if (syncError) {
          console.error("Auto-sync error:", syncError);
          toast({
            title: "Sync failed",
            description: "Could not sync your data from Notion. Please contact your team leader.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Fetch the newly synced data
        const { data: syncedData, error: refetchError } = await supabase
          .from("reps")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (refetchError) throw refetchError;

        setRepData(syncedData);
        
        if (syncedData) {
          toast({
            title: "Sync successful",
            description: "Your data has been loaded from Notion.",
          });
        }
      } else {
        setRepData(data);
      }
    } catch (error: any) {
      console.error("Error fetching rep data:", error);
      toast({
        title: "Error loading data",
        description: "Could not load your journey data. Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    // Trigger Notion sync
    await supabase.functions.invoke("sync-notion-reps");
    // Wait a moment for sync to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Refetch the data
    await fetchRepData();
  };

  useEffect(() => {
    fetchRepData();

    // Set up automatic periodic sync from Notion every 5 minutes
    const syncInterval = setInterval(async () => {
      console.log("Auto-syncing from Notion...");
      try {
        await supabase.functions.invoke("sync-notion-reps");
      } catch (error) {
        console.error("Auto-sync error:", error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Set up realtime subscription to instantly reflect database changes
    const channel = supabase
      .channel("reps-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reps",
        },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            setRepData(payload.new as RepData);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(syncInterval);
      supabase.removeChannel(channel);
    };
  }, [toast]);

  return { repData, loading, refetch };
};
