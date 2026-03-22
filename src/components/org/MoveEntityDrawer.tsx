import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Search, Users, Loader2, AlertTriangle, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getCleanName } from "@/utils/nameUtils";
import { cn } from "@/lib/utils";

interface TargetOption {
  id: string;
  name: string;
  leadUserId?: string | null;
  leadName?: string | null;
}

type EntityType =
  | "mgmt_group"    // moving mgmt_group → sr_mgmt_group
  | "sr_mgmt_group" // moving sr_mgmt_group → region (via office? or direct)
  | "region"         // moving region → sr_region
  | "sr_region"      // moving sr_region → partner
  | "partner";       // moving partner → division

const ENTITY_LABELS: Record<EntityType, { entityLabel: string; parentLabel: string; parentTable: string; fkColumn: string }> = {
  mgmt_group: { entityLabel: "MGMT Group", parentLabel: "Sr MGMT Group", parentTable: "sr_mgmt_groups", fkColumn: "sr_mgmt_group_id" },
  sr_mgmt_group: { entityLabel: "Sr MGMT Group", parentLabel: "Region", parentTable: "regions", fkColumn: "region_id" },
  region: { entityLabel: "Region", parentLabel: "Sr Region", parentTable: "sr_regions", fkColumn: "sr_region_id" },
  sr_region: { entityLabel: "Sr Region", parentLabel: "Partnership", parentTable: "partners", fkColumn: "partner_id" },
  partner: { entityLabel: "Partnership", parentLabel: "Division", parentTable: "divisions", fkColumn: "division_id" },
};

interface MoveEntityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  entityLeadUserId?: string | null;
  targets: TargetOption[];
}

export const MoveEntityDrawer = ({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  entityLeadUserId,
  targets,
}: MoveEntityDrawerProps) => {
  const queryClient = useQueryClient();
  const labels = ENTITY_LABELS[entityType];
  const [search, setSearch] = useState("");
  const [movingTo, setMovingTo] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState<TargetOption | null>(null);
  const [updateRecruiter, setUpdateRecruiter] = useState(true);
  const [currentRecruiterName, setCurrentRecruiterName] = useState<string | null>(null);
  const [currentRecruiterUserId, setCurrentRecruiterUserId] = useState<string | null>(null);
  const [currentRecruiterGroupName, setCurrentRecruiterGroupName] = useState<string | null>(null);

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
    if (!confirmStep || !entityLeadUserId) return;

    const fetchRecruiterInfo = async () => {
      const { data: rep } = await supabase
        .from("reps")
        .select("name")
        .eq("user_id", entityLeadUserId)
        .maybeSingle();

      if (!rep) return;

      const { data: recruit } = await supabase
        .from("recruits")
        .select("recruiter_user_id")
        .ilike("name", getCleanName(rep.name))
        .maybeSingle();

      if (recruit?.recruiter_user_id) {
        setCurrentRecruiterUserId(recruit.recruiter_user_id);
        const { data: recruiterRep } = await supabase
          .from("reps")
          .select("name")
          .eq("user_id", recruit.recruiter_user_id)
          .maybeSingle();
        setCurrentRecruiterName(recruiterRep ? getCleanName(recruiterRep.name) : "Unknown");

        // Check what the current recruiter leads (any level)
        const checks = await Promise.all([
          supabase.from("mgmt_groups").select("name").eq("lead_user_id", recruit.recruiter_user_id).maybeSingle(),
          supabase.from("sr_mgmt_groups").select("name").eq("lead_user_id", recruit.recruiter_user_id).maybeSingle(),
          supabase.from("regions").select("name").eq("lead_user_id", recruit.recruiter_user_id).maybeSingle(),
          supabase.from("sr_regions").select("name").eq("lead_user_id", recruit.recruiter_user_id).maybeSingle(),
          supabase.from("partners").select("name").eq("lead_user_id", recruit.recruiter_user_id).maybeSingle(),
          supabase.from("divisions").select("name").eq("lead_user_id", recruit.recruiter_user_id).maybeSingle(),
        ]);
        const leadsGroup = checks.find(c => c.data?.name);
        setCurrentRecruiterGroupName(leadsGroup?.data?.name || null);
      } else {
        setCurrentRecruiterUserId(null);
        setCurrentRecruiterName("None");
        setCurrentRecruiterGroupName(null);
      }
    };

    fetchRecruiterInfo();
  }, [confirmStep, entityLeadUserId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return targets;
    const q = search.toLowerCase();
    return targets.filter((t) => t.name.toLowerCase().includes(q));
  }, [targets, search]);

  const handleSelectTarget = (target: TargetOption) => {
    if (!entityLeadUserId || !target.leadUserId) {
      handleMove(target, false);
      return;
    }
    setConfirmStep(target);
    setUpdateRecruiter(true);
  };

  const handleMove = async (target: TargetOption, shouldUpdateRecruiter: boolean) => {
    setMovingTo(target.id);
    try {
      // Update the FK on the entity table
      const entityTable = entityType === "mgmt_group" ? "mgmt_groups" :
        entityType === "sr_mgmt_group" ? "sr_mgmt_groups" :
        entityType === "region" ? "regions" :
        entityType === "sr_region" ? "sr_regions" : "partners";

      const { error } = await supabase
        .from(entityTable)
        .update({ [labels.fkColumn]: target.id } as any)
        .eq("id", entityId);

      if (error) throw error;

      // Optionally update the entity leader's recruiter
      if (shouldUpdateRecruiter && entityLeadUserId && target.leadUserId) {
        const { data: leadRep } = await supabase
          .from("reps")
          .select("name")
          .eq("user_id", entityLeadUserId)
          .maybeSingle();

        if (leadRep) {
          const { data: leadRecruit } = await supabase
            .from("recruits")
            .select("id")
            .ilike("name", getCleanName(leadRep.name))
            .maybeSingle();

          if (leadRecruit) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              await supabase.functions.invoke("update-rep-assignment", {
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: { repId: leadRecruit.id, recruiterUserId: target.leadUserId },
              });
            }
          }
        }
      }

      toast.success(`Moved ${entityName} to ${target.name}`);
      queryClient.invalidateQueries({ queryKey: ["org-structure-data"] });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      queryClient.invalidateQueries({ queryKey: ["recruiter-tree-data"] });
      queryClient.invalidateQueries({ queryKey: ["group-recruits"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to move");
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
    : `the ${labels.parentLabel} leader`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>
            {confirmStep
              ? `Confirm: Move ${entityName}`
              : `Move ${entityName} to ${labels.parentLabel}`}
          </DrawerTitle>
        </DrawerHeader>

        {!confirmStep ? (
          <>
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search ${labels.parentLabel}s...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <ScrollArea className="flex-1 px-4" style={{ maxHeight: "calc(85vh - 140px)" }}>
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No {labels.parentLabel}s found
                </p>
              ) : (
                <div className="space-y-1 pb-4">
                  {filtered.map((t) => (
                    <button
                      key={t.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 w-full text-left transition-colors"
                      onClick={() => handleSelectTarget(t)}
                      disabled={!!movingTo}
                    >
                      {movingTo === t.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      ) : (
                        <Users className="h-4 w-4 text-primary shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        {t.leadName && (
                          <p className="text-xs text-muted-foreground">
                            Led by {getCleanName(t.leadName)}
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
          <div className="px-4 pb-4 space-y-4 overflow-y-auto">
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm">
                <span className="text-muted-foreground">Moving:</span>{" "}
                <span className="font-medium">{entityName}</span>
              </p>
              <div className="flex items-center gap-2 text-sm">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">To:</span>{" "}
                <span className="font-medium">{confirmStep.name}</span>
              </div>
            </div>

            {entityLeadUserId && confirmStep.leadUserId && (
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
                    {labels.parentLabel} leader:{" "}
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
                      updateRecruiter ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                    )}
                    onClick={() => setUpdateRecruiter(true)}
                  >
                    {updateRecruiter && <Check className="h-4 w-4 text-primary shrink-0" />}
                    <div className={cn("min-w-0", !updateRecruiter && "ml-7")}>
                      <p className="text-sm font-medium">Update recruiter to {targetLeadName}</p>
                      <p className="text-xs text-muted-foreground">
                        Changes both structure and recruiting lineage
                      </p>
                    </div>
                  </button>

                  <button
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                      !updateRecruiter ? "border-primary bg-primary/5" : "hover:bg-accent/50"
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
              {movingTo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {movingTo ? "Moving..." : "Confirm Move"}
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
};
