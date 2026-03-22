import { useState, useMemo, useEffect } from "react";
import { X, ShieldCheck, Search } from "lucide-react";
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
  const [step, setStep] = useState<"name" | "lead" | "group">("name");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadUserId, setSelectedLeadUserId] = useState<string | null>(null);
  const [selectedLeadName, setSelectedLeadName] = useState<string | null>(null);
  const [mgmtGroupId, setMgmtGroupId] = useState("__none__");
  const { data: teamAccess } = useTeamAccess();
  const submitRequest = useSubmitOrgRequest();

  const accessLevel = teamAccess?.accessLevel || 'none';
  const isCorporate = hasMinAccess(accessLevel, 'corporate');
  const requestType = mode === "team" ? "create_team" : "create_mgmt_group";

  const filteredReps = useMemo(() => {
    if (!leadSearch.trim()) return allReps.slice(0, 20);
    const q = leadSearch.toLowerCase();
    return allReps.filter(r => getCleanName(r.name).toLowerCase().includes(q)).slice(0, 20);
  }, [allReps, leadSearch]);

  // When a leader is selected, auto-fill their MGMT group
  useEffect(() => {
    if (selectedLeadUserId && mode === "team") {
      const leadRep = allReps.find(r => r.userId === selectedLeadUserId);
      if (leadRep?.mgmtGroupId) {
        setMgmtGroupId(leadRep.mgmtGroupId);
      }
    }
  }, [selectedLeadUserId, allReps, mode]);

  const handleSelectLead = (userId: string | null, repName?: string) => {
    setSelectedLeadUserId(userId);
    setSelectedLeadName(repName || null);
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
      handleSubmit(userId);
    }
  };

  const handleSubmit = async (leadUserId?: string | null) => {
    if (!name.trim()) return;

    const finalLeadUserId = leadUserId !== undefined ? leadUserId : selectedLeadUserId;

    const requestData: Record<string, any> = {
      name: name.trim(),
      leadUserId: finalLeadUserId || null,
    };

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
    setMgmtGroupId("__none__");
  };

  const title = mode === "team" ? "Create New Team" : "Create New Management Group";

  return (
    <Drawer open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
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
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
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
                ) : (
                  <p className="text-sm text-center text-muted-foreground py-4">No results</p>
                )}
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
