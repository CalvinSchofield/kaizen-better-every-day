import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionSafe } from "@/utils/authSession";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Search, Users, Loader2, AlertTriangle, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getCleanName } from "@/utils/nameUtils";
import { cn } from "@/lib/utils";

interface TeamOption {
  id: string;
  name: string;
  mgmtGroupName?: string;
  leadUserId?: string | null;
  leadName?: string | null;
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
  const [confirmStep, setConfirmStep] = useState<TeamOption | null>(null);
  const [updateRecruiter, setUpdateRecruiter] = useState(true);
  const [currentRecruiterName, setCurrentRecruiterName] = useState<string | null>(null);
  const [currentRecruiterUserId, setCurrentRecruiterUserId] = useState<string | null>(null);
  const [currentRecruiterTeamName, setCurrentRecruiterTeamName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmStep(null);
      setUpdateRecruiter(true);
      setSearch("");
      setCurrentRecruiterName(null);
      setCurrentRecruiterUserId(null);
      setCurrentRecruiterTeamName(null);
    }
  }, [open]);

  // Fetch current recruiter info for the rep being moved
  useEffect(() => {
    if (!confirmStep) return;

    const fetchRecruiterInfo = async () => {
      const { data: recruit } = await supabase
        .from("recruits")
        .select("recruiter_user_id")
        .eq("id", repId)
        .maybeSingle();

      if (recruit?.recruiter_user_id) {
        setCurrentRecruiterUserId(recruit.recruiter_user_id);
        const { data: recruiterRep } = await supabase
          .from("reps")
          .select("name")
          .eq("user_id", recruit.recruiter_user_id)
          .maybeSingle();
        setCurrentRecruiterName(recruiterRep ? getCleanName(recruiterRep.name) : "Unknown");

        // Check if current recruiter leads a team (and which one)
        const { data: recruiterTeam } = await supabase
          .from("teams")
          .select("name")
          .eq("lead_user_id", recruit.recruiter_user_id)
          .maybeSingle();
        setCurrentRecruiterTeamName(recruiterTeam?.name || null);
      } else {
        setCurrentRecruiterUserId(null);
        setCurrentRecruiterName("None");
        setCurrentRecruiterTeamName(null);
      }
    };

    fetchRecruiterInfo();
  }, [confirmStep, repId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return teams;
    const q = search.toLowerCase();
    return teams.filter((t) => t.name.toLowerCase().includes(q) || t.mgmtGroupName?.toLowerCase().includes(q));
  }, [teams, search]);

  const handleSelectTeam = (team: TeamOption) => {
    if (!team.leadUserId) {
      // No team leader — just move without asking
      handleMove(team, false);
      return;
    }
    setConfirmStep(team);
    setUpdateRecruiter(true);
  };

  const handleMove = async (team: TeamOption, shouldUpdateRecruiter: boolean) => {
    setMovingTo(team.id);
    try {
      const { session } = await getSessionSafe();
      if (!session) throw new Error("Not authenticated");

      // Resolve mgmt_group_id from team_mgmt_groups
      const { data: tmg } = await supabase
        .from("team_mgmt_groups")
        .select("mgmt_group_id")
        .eq("team_id", team.id)
        .maybeSingle();

      const body: Record<string, unknown> = {
        repId,
        teamId: team.id,
        mgmtGroupId: tmg?.mgmt_group_id || null,
      };

      // If updating recruiter, set it to the team leader
      if (shouldUpdateRecruiter && team.leadUserId) {
        body.recruiterUserId = team.leadUserId;
      }

      const { error } = await supabase.functions.invoke("update-rep-assignment", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      });
      if (error) throw error;

      toast.success(`Moved ${repName} to ${team.name}`);
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      queryClient.invalidateQueries({ queryKey: ["recruiter-tree-data"] });
      queryClient.invalidateQueries({ queryKey: ["group-recruits"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to move rep");
    } finally {
      setMovingTo(null);
    }
  };

  const hasIssue =
    confirmStep &&
    currentRecruiterTeamName &&
    currentRecruiterTeamName !== confirmStep.name;

  const targetLeadName = confirmStep?.leadName
    ? getCleanName(confirmStep.leadName)
    : "the team leader";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {confirmStep ? `Confirm: Move ${getCleanName(repName)}` : `Move ${getCleanName(repName)} to Team`}
          </DrawerTitle>
        </DrawerHeader>

        {!confirmStep ? (
          <>
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
                      onClick={() => handleSelectTeam(team)}
                      disabled={!!movingTo}
                    >
                      <Users className="h-4 w-4 text-green-500 shrink-0" />
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
          </>
        ) : (
          <div className="px-4 pb-4 space-y-4">
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm">
                <span className="text-muted-foreground">Moving:</span>{" "}
                <span className="font-medium">{getCleanName(repName)}</span>
              </p>
              <div className="flex items-center gap-2 text-sm">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">To:</span>{" "}
                <span className="font-medium">{confirmStep.name}</span>
              </div>
            </div>

            {confirmStep.leadUserId && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Update recruiter relationship?</p>

                <div className="rounded-lg border p-3 space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    Current recruiter:{" "}
                    <span className="font-medium text-foreground">
                      {currentRecruiterName || "Loading..."}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Team leader:{" "}
                    <span className="font-medium text-foreground">{targetLeadName}</span>
                  </p>
                </div>

                {hasIssue && (
                  <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-3">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-warning">
                      Current recruiter ({currentRecruiterName}) leads{" "}
                      <span className="font-medium">{currentRecruiterTeamName}</span>, a
                      different team. Updating will change the recruiting lineage.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <button
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                      updateRecruiter
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent/50"
                    )}
                    onClick={() => setUpdateRecruiter(true)}
                  >
                    {updateRecruiter && <Check className="h-4 w-4 text-primary shrink-0" />}
                    <div className={cn("min-w-0", !updateRecruiter && "ml-7")}>
                      <p className="text-sm font-medium">
                        Update recruiter to {targetLeadName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Changes both structure and recruiting lineage
                      </p>
                    </div>
                  </button>

                  <button
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                      !updateRecruiter
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent/50"
                    )}
                    onClick={() => setUpdateRecruiter(false)}
                  >
                    {!updateRecruiter && <Check className="h-4 w-4 text-primary shrink-0" />}
                    <div className={cn("min-w-0", updateRecruiter && "ml-7")}>
                      <p className="text-sm font-medium">Keep current recruiter</p>
                      <p className="text-xs text-muted-foreground">
                        Only changes team assignment, not recruiting lineage
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {confirmStep && (
          <DrawerFooter className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmStep(null)}
              disabled={!!movingTo}
            >
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleMove(confirmStep, updateRecruiter)}
              disabled={!!movingTo}
            >
              {movingTo ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {movingTo ? "Moving..." : "Confirm Move"}
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
};
