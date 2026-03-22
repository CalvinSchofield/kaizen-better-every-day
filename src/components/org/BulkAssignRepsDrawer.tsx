import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, Loader2 } from "lucide-react";
import { getCleanName } from "@/utils/nameUtils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface RepOption {
  id: string;
  name: string;
  currentTeamName?: string | null;
  stage?: string | null;
  year?: string | null;
}

interface BulkAssignRepsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTeamId: string;
  targetTeamName: string;
  availableReps: RepOption[];
}

export const BulkAssignRepsDrawer = ({
  open,
  onOpenChange,
  targetTeamId,
  targetTeamName,
  availableReps,
}: BulkAssignRepsDrawerProps) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isAssigning, setIsAssigning] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return availableReps;
    const q = search.toLowerCase();
    return availableReps.filter((r) => r.name.toLowerCase().includes(q));
  }, [availableReps, search]);

  const toggleRep = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setIsAssigning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Resolve mgmt_group_id from team_mgmt_groups
      const { data: tmg } = await supabase
        .from("team_mgmt_groups")
        .select("mgmt_group_id")
        .eq("team_id", targetTeamId)
        .maybeSingle();
      const mgmtGroupId = tmg?.mgmt_group_id || null;

      let successCount = 0;
      for (const repId of selected) {
        const { error } = await supabase.functions.invoke("update-rep-assignment", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { repId, teamId: targetTeamId, mgmtGroupId },
        });
        if (!error) successCount++;
      }

      toast.success(`Assigned ${successCount} rep${successCount !== 1 ? "s" : ""} to ${targetTeamName}`);
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      setSelected(new Set());
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to assign reps");
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Assign Reps to {targetTeamName}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reps..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <ScrollArea className="max-h-[50vh] px-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No reps available to assign</p>
          ) : (
            <div className="space-y-1 pb-2">
              {filtered.map((rep) => (
                <label
                  key={rep.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(rep.id)}
                    onCheckedChange={() => toggleRep(rep.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{rep.name}</p>
                    {rep.currentTeamName && (
                      <p className="text-xs text-muted-foreground">Currently: {rep.currentTeamName}</p>
                    )}
                  </div>
                  {rep.stage && (
                    <span className="text-xs text-muted-foreground shrink-0">{rep.stage}</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="px-4 pb-6 pt-2">
          <Button
            className="w-full"
            disabled={selected.size === 0 || isAssigning}
            onClick={handleAssign}
          >
            {isAssigning ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Assigning...</>
            ) : (
              `Assign ${selected.size} Rep${selected.size !== 1 ? "s" : ""}`
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
