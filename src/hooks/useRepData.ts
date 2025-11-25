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
  stage: string | null;
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
}

export const useRepData = () => {
  const [repData, setRepData] = useState<RepData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
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

        setRepData(data);
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

    fetchRepData();

    // Set up realtime subscription
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
      supabase.removeChannel(channel);
    };
  }, [toast]);

  return { repData, loading };
};
