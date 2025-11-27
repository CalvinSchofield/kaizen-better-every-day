import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Loader2 } from "lucide-react";

const CompetitorSyncButton = () => {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    console.log("Starting Competitor sync from Notion...");

    try {
      const { data, error } = await supabase.functions.invoke("sync-notion-competitors");

      if (error) throw error;

      console.log("Sync response:", data);

      toast({
        title: "Sync Complete!",
        description: `Synced ${data.syncedCount || 0} competitors from Notion`,
      });
    } catch (error: any) {
      console.error("Sync error:", error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync competitors from Notion",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button
      onClick={handleSync}
      disabled={syncing}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {syncing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Syncing Competitors...
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4" />
          Sync Competitors
        </>
      )}
    </Button>
  );
};

export default CompetitorSyncButton;
