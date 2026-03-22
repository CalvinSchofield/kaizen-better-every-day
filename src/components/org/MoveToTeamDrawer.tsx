import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface TeamOption {
  id: string;
  name: string;
  mgmtGroupName?: string;
}

interface MoveToTeamDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repId: string;
  repName: string;
  teams: TeamOption[];
}

export const MoveToTeamDrawer = ({ open, onOpenChange, repId, repName, teams }: MoveToTeamDrawerProps) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [movingTo, setMovingTo] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return teams;
    const q = search.toLowerCase();
    return teams.filter((t) => t.name.toLowerCase().includes(q) || t.mgmtGroupName?.toLowerCase().includes(q));
  }, [teams, search]);

  const handleMove = async (team: TeamOption) => {
    setMovingTo(team.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Resolve mgmt_group_id from team_mgmt_groups
      const { data: tmg } = await supabase
        .from("team_mgmt_groups")
        .select("mgmt_group_id")
        .eq("team_id", team.id)
        .maybeSingle();

      const { error } = await supabase.functions.invoke("update-rep-assignment", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { repId, teamId: team.id, mgmtGroupId: tmg?.mgmt_group_id || null },
      });
      if (error) throw error;

      toast.success(`Moved ${repName} to ${team.name}`);
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to move rep");
    } finally {
      setMovingTo(null);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Move {repName} to Team</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <ScrollArea className="max-h-[50vh] px-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No teams found</p>
          ) : (
            <div className="space-y-1 pb-4">
              {filtered.map((team) => (
                <button
                  key={team.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 w-full text-left transition-colors"
                  onClick={() => handleMove(team)}
                  disabled={!!movingTo}
                >
                  {movingTo === team.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  ) : (
                    <Users className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{team.name}</p>
                    {team.mgmtGroupName && (
                      <p className="text-xs text-muted-foreground">{team.mgmtGroupName}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
};
