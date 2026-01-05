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
}

interface Team {
  id: string;
  name: string;
  leadUserId: string | null;
  leadName?: string;
  mgmtGroupId: string | null;
}

interface EditTeamDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
  allReps: Rep[];
  allGroups: MgmtGroup[];
  repCount: number;
}

export const EditTeamDrawer = ({
  open,
  onOpenChange,
  team,
  allReps,
  allGroups,
  repCount,
}: EditTeamDrawerProps) => {
  const [name, setName] = useState(team.name);
  const [leadUserId, setLeadUserId] = useState(team.leadUserId || "__none__");
  const [mgmtGroupId, setMgmtGroupId] = useState(team.mgmtGroupId || "__none__");
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

      const { error } = await supabase.functions.invoke("manage-team", {
        body: {
          action: "update",
          teamId: team.id,
          name: name.trim(),
          leadUserId: leadUserId === "__none__" ? null : leadUserId,
          mgmtGroupId: mgmtGroupId === "__none__" ? null : mgmtGroupId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({ title: "Team updated" });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      queryClient.invalidateQueries({ queryKey: ["org-structure"] });
      onOpenChange(false);
    } catch (err) {
      console.error("Error updating team:", err);
      toast({
        title: "Error updating team",
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

      const { data, error } = await supabase.functions.invoke("manage-team", {
        body: {
          action: "delete",
          teamId: team.id,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Team deleted" });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      queryClient.invalidateQueries({ queryKey: ["org-structure"] });
      onOpenChange(false);
    } catch (err) {
      console.error("Error deleting team:", err);
      toast({
        title: "Error deleting team",
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
              <DrawerTitle>Edit Team</DrawerTitle>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter team name"
              />
            </div>

            <div className="space-y-2">
              <Label>Team Leader</Label>
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

            <div className="space-y-2">
              <Label>Management Group</Label>
              <Select value={mgmtGroupId} onValueChange={setMgmtGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No group assigned</SelectItem>
                  {allGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
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
                disabled={saving || repCount > 0}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
            {repCount > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Remove all reps before deleting this team
              </p>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Delete Team?</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete "{team.name}". This action cannot be undone.
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
