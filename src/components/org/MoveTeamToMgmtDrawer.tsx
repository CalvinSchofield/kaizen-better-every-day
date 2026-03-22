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

interface MgmtOption {
  id: string;
  name: string;
  leadUserId?: string | null;
  leadName?: string | null;
}

interface MoveTeamToMgmtDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  teamLeadUserId?: string | null;
  mgmtGroups: MgmtOption[];
}

export const MoveTeamToMgmtDrawer = ({
  open,
  onOpenChange,
  teamId,
  teamName,
  teamLeadUserId,
  mgmtGroups,
}: MoveTeamToMgmtDrawerProps) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [movingTo, setMovingTo] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState<MgmtOption | null>(null);
  const [updateRecruiter, setUpdateRecruiter] = useState(true);
  const [currentRecruiterName, setCurrentRecruiterName] = useState<string | null>(null);
  const [currentRecruiterUserId, setCurrentRecruiterUserId] = useState<string | null>(null);
  const [currentRecruiterGroupName, setCurrentRecruiterGroupName] = useState<string | null>(null);

  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      setConfirmStep(null);
      setUpdateRecruiter(true);
      setSearch("");
      setCurrentRecruiterName(null);
      setCurrentRecruiterUserId(null);
      setCurrentRecruiterGroupName(null);
    }
  }, [open]);

  // Fetch current recruiter info when entering confirm step
  useEffect(() => {
    if (!confirmStep || !teamLeadUserId) return;

    const fetchRecruiterInfo = async () => {
      // Find the team leader's recruit record to get their recruiter_user_id
      const { data: reps } = await supabase
        .from("reps")
        .select("name")
        .eq("user_id", teamLeadUserId)
        .maybeSingle();

      if (!reps) return;

      const { data: recruit } = await supabase
        .from("recruits")
        .select("recruiter_user_id")
        .ilike("name", getCleanName(reps.name))
        .maybeSingle();

      if (recruit?.recruiter_user_id) {
        setCurrentRecruiterUserId(recruit.recruiter_user_id);
        const { data: recruiterRep } = await supabase
          .from("reps")
          .select("name")
          .eq("user_id", recruit.recruiter_user_id)
          .maybeSingle();
        setCurrentRecruiterName(recruiterRep ? getCleanName(recruiterRep.name) : "Unknown");

        // Check if current recruiter leads a different mgmt group
        const { data: recruiterMg } = await supabase
          .from("mgmt_groups")
          .select("name")
          .eq("lead_user_id", recruit.recruiter_user_id)
          .maybeSingle();
        setCurrentRecruiterGroupName(recruiterMg?.name || null);
      } else {
        setCurrentRecruiterUserId(null);
        setCurrentRecruiterName("None");
        setCurrentRecruiterGroupName(null);
      }
    };

    fetchRecruiterInfo();
  }, [confirmStep, teamLeadUserId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return mgmtGroups;
    const q = search.toLowerCase();
    return mgmtGroups.filter((mg) => mg.name.toLowerCase().includes(q));
  }, [mgmtGroups, search]);

  const handleSelectGroup = (mg: MgmtOption) => {
    if (!teamLeadUserId || !mg.leadUserId) {
      // No team leader or no group leader — just move without asking
      handleMove(mg, false);
      return;
    }
    // If the team leader's recruiter is already the target group leader, skip confirmation
    setConfirmStep(mg);
    setUpdateRecruiter(true);
  };

  const handleMove = async (mg: MgmtOption, shouldUpdateRecruiter: boolean) => {
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

      // Optionally update the team leader's recruiter to the MGMT group leader
      if (shouldUpdateRecruiter && teamLeadUserId && mg.leadUserId) {
        const { data: teamLeadRep } = await supabase
          .from("reps")
          .select("name")
          .eq("user_id", teamLeadUserId)
          .maybeSingle();

        if (teamLeadRep) {
          const { data: teamLeadRecruit } = await supabase
            .from("recruits")
            .select("id")
            .ilike("name", getCleanName(teamLeadRep.name))
            .maybeSingle();

          if (teamLeadRecruit) {
            const { session } = await getSessionSafe();
            if (session) {
              await supabase.functions.invoke("update-rep-assignment", {
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: { repId: teamLeadRecruit.id, recruiterUserId: mg.leadUserId },
              });
            }
          }
        }
      }

      toast.success(`Moved ${teamName} to ${mg.name}`);
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      queryClient.invalidateQueries({ queryKey: ["recruiter-tree-data"] });
      queryClient.invalidateQueries({ queryKey: ["group-recruits"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to move team");
    } finally {
      setMovingTo(null);
    }
  };

  const hasIssue =
    confirmStep &&
    currentRecruiterGroupName &&
    currentRecruiterGroupName !== confirmStep.name;

  const targetLeadName = confirmStep?.leadName
    ? getCleanName(confirmStep.leadName)
    : "the group leader";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {confirmStep ? `Confirm: Move ${teamName}` : `Move ${teamName} to MGMT Group`}
          </DrawerTitle>
        </DrawerHeader>

        {!confirmStep ? (
          <>
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
                      onClick={() => handleSelectGroup(mg)}
                      disabled={!!movingTo}
                    >
                      <Users className="h-4 w-4 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{mg.name}</p>
                        {mg.leadName && (
                          <p className="text-xs text-muted-foreground">
                            Led by {getCleanName(mg.leadName)}
                          </p>
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
                <span className="font-medium">{teamName}</span>
              </p>
              <div className="flex items-center gap-2 text-sm">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">To:</span>{" "}
                <span className="font-medium">{confirmStep.name}</span>
              </div>
            </div>

            {teamLeadUserId && confirmStep.leadUserId && (
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
                    New MGMT leader:{" "}
                    <span className="font-medium text-foreground">{targetLeadName}</span>
                  </p>
                </div>

                {hasIssue && (
                  <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-3">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-warning">
                      Current recruiter ({currentRecruiterName}) leads{" "}
                      <span className="font-medium">{currentRecruiterGroupName}</span>, which is a
                      different group. Updating the recruiter will change the recruiting lineage.
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
                        Only changes org structure, not recruiting lineage
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
