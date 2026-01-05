import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface Rep {
  userId: string | null;
  name: string;
}

interface MgmtGroup {
  id: string;
  name: string;
  leadUserId: string | null;
  leadName?: string;
}

interface EditMgmtGroupDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: MgmtGroup;
  allReps: Rep[];
  teamCount: number;
}

export const EditMgmtGroupDrawer = ({
  open,
  onOpenChange,
  group,
  allReps,
  teamCount,
}: EditMgmtGroupDrawerProps) => {
  const [name, setName] = useState(group.name);
  const [leadUserId, setLeadUserId] = useState(group.leadUserId || "__none__");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.functions.invoke("manage-mgmt-group", {
        body: {
          action: "update",
          mgmtGroupId: group.id,
          name: name.trim(),
          leadUserId: leadUserId === "__none__" ? null : leadUserId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({ title: "Management group updated" });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      queryClient.invalidateQueries({ queryKey: ["org-structure"] });
      onOpenChange(false);
    } catch (err) {
      console.error("Error updating group:", err);
      toast({
        title: "Error updating group",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("manage-mgmt-group", {
        body: {
          action: "delete",
          mgmtGroupId: group.id,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Management group deleted" });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      queryClient.invalidateQueries({ queryKey: ["org-structure"] });
      onOpenChange(false);
    } catch (err) {
      console.error("Error deleting group:", err);
      toast({
        title: "Error deleting group",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <DrawerTitle>Edit Management Group</DrawerTitle>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter group name"
              />
            </div>

            <div className="space-y-2">
              <Label>Group Leader</Label>
              <Select value={leadUserId} onValueChange={setLeadUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select leader (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No leader assigned</SelectItem>
                  {allReps
                    .filter((r) => r.userId)
                    .map((rep) => (
                      <SelectItem key={rep.userId!} value={rep.userId!}>
                        {rep.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DrawerFooter className="border-t">
            <div className="flex gap-2 w-full">
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving || teamCount > 0}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
            {teamCount > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Remove all teams before deleting this group
              </p>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Delete Management Group?</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete "{group.name}". This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
