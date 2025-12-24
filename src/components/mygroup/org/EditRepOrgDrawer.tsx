import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  id: string;
  userId: string | null;
  name: string;
  teamId: string | null;
  teamName: string | null;
  recruiterUserId: string | null;
  recruiterName?: string;
  stage?: string | null;
}

interface Team {
  id: string;
  name: string;
}

interface EditRepOrgDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rep: Rep;
  allTeams: Team[];
  allReps: Array<{ userId: string | null; name: string }>;
}

export const EditRepOrgDrawer = ({
  open,
  onOpenChange,
  rep,
  allTeams,
  allReps,
}: EditRepOrgDrawerProps) => {
  const [teamId, setTeamId] = useState(rep.teamId || "__none__");
  const [recruiterUserId, setRecruiterUserId] = useState(rep.recruiterUserId || "__none__");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.functions.invoke("update-rep-assignment", {
        body: {
          repId: rep.id,
          teamId: teamId === "__none__" ? null : teamId,
          recruiterUserId: recruiterUserId === "__none__" ? null : recruiterUserId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({ title: "Rep assignment updated" });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      queryClient.invalidateQueries({ queryKey: ["org-structure"] });
      queryClient.invalidateQueries({ queryKey: ["group-recruits"] });
      onOpenChange(false);
    } catch (err) {
      console.error("Error updating rep:", err);
      toast({
        title: "Error updating rep",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle>Edit Rep Assignment</DrawerTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="p-4 space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium">{rep.name}</p>
            {rep.stage && (
              <p className="text-sm text-muted-foreground">{rep.stage}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Team</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No team assigned</SelectItem>
                {[...allTeams]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Recruiter</Label>
            <Select value={recruiterUserId} onValueChange={setRecruiterUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select recruiter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No recruiter assigned</SelectItem>
                {[...allReps]
                  .filter((r) => r.userId)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((r) => (
                    <SelectItem key={r.userId!} value={r.userId!}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DrawerFooter className="border-t">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
