import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DeleteRecruitConfirmDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruitId: string;
  recruitName: string;
  recruitNotionPageId: string;
  onDeleted?: () => void;
}

export const DeleteRecruitConfirmDrawer = ({
  open,
  onOpenChange,
  recruitId,
  recruitName,
  recruitNotionPageId,
  onDeleted,
}: DeleteRecruitConfirmDrawerProps) => {
  const [confirmText, setConfirmText] = useState("");
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Use edge function with service role to bypass RLS
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.functions.invoke("delete-recruit", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { recruitId, recruitNotionPageId },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${recruitName} has been deleted`);
      // Clear cached placeholder data so deleted reps don't briefly re-appear.
      localStorage.removeItem('group-recruits-cache:v2');
      queryClient.invalidateQueries({ queryKey: ["group-recruits"] });
      setConfirmText("");
      onOpenChange(false);
      onDeleted?.();
    },
    onError: (error) => {
      console.error("Failed to delete recruit:", error);
      const message = error instanceof Error ? error.message : "Failed to delete recruit";
      toast.error(message);
    },
  });

  const handleClose = (open: boolean) => {
    if (!open) {
      setConfirmText("");
    }
    onOpenChange(open);
  };

  const isConfirmValid = confirmText.toLowerCase() === "delete";

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent>
        <DrawerHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DrawerTitle className="text-xl">Delete Recruit</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
            <p className="text-sm font-medium text-destructive">
              This action cannot be undone
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              You are about to permanently delete{" "}
              <span className="font-semibold text-foreground">{recruitName}</span>{" "}
              and all their associated data including activities and blitz assignments.
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2 text-center">
              Type <span className="font-mono font-semibold text-foreground">delete</span> to confirm
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="text-center"
              autoComplete="off"
            />
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleClose(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => deleteMutation.mutate()}
            disabled={!isConfirmValid || deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Forever
              </>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
