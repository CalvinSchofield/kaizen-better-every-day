import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Loader2 } from "lucide-react";

const AdminSyncButton = () => {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    console.log("Starting Notion sync...");

    try {
      const { data, error } = await supabase.functions.invoke("sync-notion-reps", {
        body: {},
      });

      if (error) throw error;

      console.log("Sync response:", data);

      toast({
        title: "Sync Complete!",
        description: data.message || `Synced ${data.synced} reps from Notion`,
      });

      if (data.errors && data.errors.length > 0) {
        console.warn("Sync had some errors:", data.errors);
        toast({
          title: "Some items had errors",
          description: "Check console for details",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync from Notion",
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
          Syncing...
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4" />
          Sync from Notion
        </>
      )}
    </Button>
  );
};

export default AdminSyncButton;
