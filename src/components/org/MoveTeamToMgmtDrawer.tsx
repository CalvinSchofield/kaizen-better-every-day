import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface MgmtOption {
  id: string;
  name: string;
}

interface MoveTeamToMgmtDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  mgmtGroups: MgmtOption[];
}

export const MoveTeamToMgmtDrawer = ({ open, onOpenChange, teamId, teamName, mgmtGroups }: MoveTeamToMgmtDrawerProps) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [movingTo, setMovingTo] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return mgmtGroups;
    const q = search.toLowerCase();
    return mgmtGroups.filter((mg) => mg.name.toLowerCase().includes(q));
  }, [mgmtGroups, search]);

  const handleMove = async (mg: MgmtOption) => {
    setMovingTo(mg.id);
    try {
      // Delete old linkage, insert new one
      await supabase.from("team_mgmt_groups").delete().eq("team_id", teamId);
      const { error } = await supabase.from("team_mgmt_groups").insert({
        team_id: teamId,
        mgmt_group_id: mg.id,
      });
      if (error) throw error;

      // Also update recruits in this team to the new mgmt_group_id
      await supabase.from("recruits").update({ mgmt_group_id: mg.id }).eq("team_id", teamId);

      toast.success(`Moved ${teamName} to ${mg.name}`);
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to move team");
    } finally {
      setMovingTo(null);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Move {teamName} to MGMT Group</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <ScrollArea className="max-h-[50vh] px-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No MGMT groups found</p>
          ) : (
            <div className="space-y-1 pb-4">
              {filtered.map((mg) => (
                <button
                  key={mg.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 w-full text-left transition-colors"
                  onClick={() => handleMove(mg)}
                  disabled={!!movingTo}
                >
                  {movingTo === mg.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  ) : (
                    <Users className="h-4 w-4 text-blue-500 shrink-0" />
                  )}
                  <p className="text-sm font-medium truncate">{mg.name}</p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
};
