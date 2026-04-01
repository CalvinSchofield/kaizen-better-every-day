import { useState, useMemo, useEffect } from "react";
import { X, ShieldCheck, Search, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSubmitOrgRequest } from "@/hooks/useOrgRequests";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { hasMinAccess } from "@/utils/roleHierarchy";
import { getCleanName } from "@/utils/nameUtils";

interface Rep {
  userId: string | null;
  name: string;
  repId?: string;
  mgmtGroupId?: string | null;
}

interface PendingRecruit {
  id: string;
  name: string;
  email: string | null;
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
  pendingRecruits?: PendingRecruit[];
}

export const CreateEntityDrawer = ({
  open,
  onOpenChange,
  mode,
  allReps,
  allGroups = [],
  pendingRecruits = [],
}: CreateEntityDrawerProps) => {
  const [name, setName] = useState("");
  const [step, setStep] = useState<"name" | "lead" | "group">("name");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadUserId, setSelectedLeadUserId] = useState<string | null>(null);
  const [selectedLeadName, setSelectedLeadName] = useState<string | null>(null);
  const [selectedPendingRecruitId, setSelectedPendingRecruitId] = useState<string | null>(null);
  const [mgmtGroupId, setMgmtGroupId] = useState("__none__");
  const { data: teamAccess } = useTeamAccess();
  const submitRequest = useSubmitOrgRequest();

  const accessLevel = teamAccess?.accessLevel || 'none';
  const isCorporate = hasMinAccess(accessLevel, 'corporate');
  const requestType = mode === "team" ? "create_team" : "create_mgmt_group";

  // Combined list: active reps + pending recruits (no app account yet)
  const filteredReps = useMemo(() => {
    const q = leadSearch.toLowerCase().trim();
    const filtered = q
      ? allReps.filter(r => getCleanName(r.name).toLowerCase().includes(q))
      : allReps;
    return filtered.slice(0, 20);
  }, [allReps, leadSearch]);

  const filteredPendingRecruits = useMemo(() => {
    if (pendingRecruits.length === 0) return [];
    const q = leadSearch.toLowerCase().trim();
    // Exclude recruits who already appear in allReps (they have accounts)
    const repUserIds = new Set(allReps.filter(r => r.userId).map(r => r.userId));
    const repNames = new Set(allReps.map(r => getCleanName(r.name).toLowerCase()));
    
    const available = pendingRecruits.filter(pr => {
      // Skip if they already have an account as a rep
      if (repNames.has(getCleanName(pr.name).toLowerCase())) return false;
      if (!q) return true;
      return getCleanName(pr.name).toLowerCase().includes(q);
    });
    return available.slice(0, 10);
  }, [pendingRecruits, leadSearch, allReps]);

  // When a leader is selected, auto-fill their MGMT group
  useEffect(() => {
    if (selectedLeadUserId && mode === "team") {
      const leadRep = allReps.find(r => r.userId === selectedLeadUserId);
      if (leadRep?.mgmtGroupId) {
        setMgmtGroupId(leadRep.mgmtGroupId);
      }
    }
  }, [selectedLeadUserId, allReps, mode]);

  const handleSelectLead = (userId: string | null, repName?: string, pendingRecruitId?: string) => {
    setSelectedLeadUserId(userId);
    setSelectedLeadName(repName || null);
    setSelectedPendingRecruitId(pendingRecruitId || null);

    if (mode === "team" && allGroups.length > 0) {
      // Auto-fill mgmt group from leader's current group
      if (userId) {
        const leadRep = allReps.find(r => r.userId === userId);
        if (leadRep?.mgmtGroupId) {
          setMgmtGroupId(leadRep.mgmtGroupId);
        } else {
          setMgmtGroupId("__none__");
        }
      } else {
        setMgmtGroupId("__none__");
      }
      setStep("group");
    } else {
      // No groups to assign, submit directly
      handleSubmit(userId, pendingRecruitId);
    }
  };

  const handleSubmit = async (leadUserId?: string | null, pendingRecruitIdOverride?: string) => {
    if (!name.trim()) return;

    const finalLeadUserId = leadUserId !== undefined ? leadUserId : selectedLeadUserId;
    const finalPendingRecruitId = pendingRecruitIdOverride !== undefined ? pendingRecruitIdOverride : selectedPendingRecruitId;

    const requestData: Record<string, any> = {
      name: name.trim(),
      leadUserId: finalLeadUserId || null,
    };

    // If a pending recruit was selected as leader (no userId yet), store their recruit ID
    if (!finalLeadUserId && finalPendingRecruitId) {
      requestData.pendingLeadRecruitId = finalPendingRecruitId;
    }

    if (mode === "team" && mgmtGroupId !== "__none__") {
      requestData.mgmtGroupId = mgmtGroupId;
    }

    submitRequest.mutate(
      { requestType, requestData },
      {
        onSuccess: () => {
          resetState();
          onOpenChange(false);
        },
      }
    );
  };

  const resetState = () => {
    setName("");
    setStep("name");
    setLeadSearch("");
    setSelectedLeadUserId(null);
    setSelectedLeadName(null);
    setSelectedPendingRecruitId(null);
    setMgmtGroupId("__none__");
  };

  const title = mode === "team" ? "Create New Team" : "Create New Management Group";
  const isPendingLeader = !!selectedPendingRecruitId && !selectedLeadUserId;

  return (
    <Drawer open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle>{title}</DrawerTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="p-4 space-y-4">
          {!isCorporate && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                This request will be sent to your upline leadership for approval before being executed.
              </p>
            </div>
          )}

          {/* Step 1: Name */}
          {step === "name" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`Enter ${mode === "team" ? "team" : "group"} name`}
                />
              </div>

              <Button
                onClick={() => setStep("lead")}
                disabled={!name.trim()}
                className="w-full"
              >
                Next — Choose Leader
              </Button>
            </>
          )}

          {/* Step 2: Leader */}
          {step === "lead" && (
            <>
              <p className="text-sm text-muted-foreground">Who leads "{name.trim()}"?</p>
              <Button
                variant="outline"
                className="w-full text-muted-foreground"
                onClick={() => handleSelectLead(null)}
                disabled={submitRequest.isPending}
              >
                Skip — Assign leader later
              </Button>
              <Separator />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
              <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                {/* Pending recruits section */}
                {filteredPendingRecruits.length > 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1 pt-2">
                      Pending Signups
                    </p>
                    {filteredPendingRecruits.map((pr) => (
                      <button
                        key={`pending-${pr.id}`}
                        onClick={() => handleSelectLead(null, getCleanName(pr.name), pr.id)}
                        disabled={submitRequest.isPending}
                        className="w-full text-left p-3 rounded-lg border border-dashed border-primary/30 hover:bg-accent transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-sm font-medium">{getCleanName(pr.name)}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] text-primary shrink-0">
                          Pending
                        </Badge>
                      </button>
                    ))}
                    {filteredReps.length > 0 && (
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1 pt-2">
                        Active Reps
                      </p>
                    )}
                  </>
                )}

                {/* Active reps */}
                {filteredReps.length > 0 ? (
                  filteredReps.map((rep, idx) => (
                    <button
                      key={rep.userId || `ghost-${idx}`}
                      onClick={() => handleSelectLead(rep.userId, getCleanName(rep.name))}
                      disabled={submitRequest.isPending}
                      className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors flex items-center justify-between"
                    >
                      <p className="text-sm font-medium">{getCleanName(rep.name)}</p>
                      {!rep.userId && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
                          No account yet
                        </Badge>
                      )}
                    </button>
                  ))
                ) : filteredPendingRecruits.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-4">No results</p>
                ) : null}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setStep("name")}>
                ← Back
              </Button>
            </>
          )}

          {/* Step 3: MGMT Group assignment (team mode only) */}
          {step === "group" && (
            <>
              <p className="text-sm text-muted-foreground">
                {selectedLeadName 
                  ? `Assign "${name.trim()}" (led by ${selectedLeadName}) to a Management Group`
                  : `Assign "${name.trim()}" to a Management Group`
                }
              </p>

              {isPendingLeader && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    {selectedLeadName} will be assigned as leader once they're approved and join the app.
                  </p>
                </div>
              )}

              {selectedLeadUserId && mgmtGroupId !== "__none__" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/50 border border-border/50">
                  <p className="text-xs text-muted-foreground">
                    Auto-selected based on {selectedLeadName}'s current group. You can change it below.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Management Group</Label>
                <Select value={mgmtGroupId} onValueChange={setMgmtGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
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

              <Button
                onClick={() => handleSubmit()}
                disabled={submitRequest.isPending}
                className="w-full"
              >
                {submitRequest.isPending ? "Creating..." : "Create Team"}
              </Button>

              <Button variant="outline" className="w-full" onClick={() => setStep("lead")}>
                ← Back
              </Button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
