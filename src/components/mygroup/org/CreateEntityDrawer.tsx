import { useState } from "react";
import { X } from "lucide-react";
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

interface CreateEntityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "team" | "mgmt_group";
  allReps: Rep[];
  allGroups?: MgmtGroup[];
}

export const CreateEntityDrawer = ({
  open,
  onOpenChange,
  mode,
  allReps,
  allGroups = [],
}: CreateEntityDrawerProps) => {
  const [name, setName] = useState("");
  const [leadUserId, setLeadUserId] = useState("");
  const [mgmtGroupId, setMgmtGroupId] = useState("");
  const [saving, setSaving] = useState(false);
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

      const endpoint = mode === "team" ? "manage-team" : "manage-mgmt-group";
      const body =
        mode === "team"
          ? {
              action: "create",
              name: name.trim(),
              leadUserId: leadUserId || null,
              mgmtGroupId: mgmtGroupId || null,
            }
          : {
              action: "create",
              name: name.trim(),
              leadUserId: leadUserId || null,
            };

      const { error } = await supabase.functions.invoke(endpoint, {
        body,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({ title: `${mode === "team" ? "Team" : "Management Group"} created` });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      queryClient.invalidateQueries({ queryKey: ["org-structure"] });
      
      // Reset form
      setName("");
      setLeadUserId("");
      setMgmtGroupId("");
      onOpenChange(false);
    } catch (err) {
      console.error("Error creating entity:", err);
      toast({
        title: "Error creating " + (mode === "team" ? "team" : "group"),
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const title = mode === "team" ? "Create New Team" : "Create New Management Group";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle>{title}</DrawerTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Enter ${mode === "team" ? "team" : "group"} name`}
            />
          </div>

          <div className="space-y-2">
            <Label>Leader (optional)</Label>
            <Select value={leadUserId} onValueChange={setLeadUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select leader" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No leader assigned</SelectItem>
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

          {mode === "team" && allGroups.length > 0 && (
            <div className="space-y-2">
              <Label>Management Group (optional)</Label>
              <Select value={mgmtGroupId} onValueChange={setMgmtGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No group assigned</SelectItem>
                  {allGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DrawerFooter className="border-t">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Creating..." : `Create ${mode === "team" ? "Team" : "Group"}`}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
