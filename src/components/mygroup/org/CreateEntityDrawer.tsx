import { useState } from "react";
import { X, ShieldCheck } from "lucide-react";
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
import { useSubmitOrgRequest } from "@/hooks/useOrgRequests";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { hasMinAccess } from "@/utils/roleHierarchy";

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
  const [leadUserId, setLeadUserId] = useState("__none__");
  const [mgmtGroupId, setMgmtGroupId] = useState("__none__");
  const { data: teamAccess } = useTeamAccess();
  const submitRequest = useSubmitOrgRequest();

  const accessLevel = teamAccess?.accessLevel || 'none';
  const isCorporate = hasMinAccess(accessLevel, 'corporate');
  const requestType = mode === "team" ? "create_team" : "create_mgmt_group";

  const handleSave = async () => {
    if (!name.trim()) return;

    const requestData: Record<string, any> = {
      name: name.trim(),
      leadUserId: leadUserId === "__none__" ? null : leadUserId,
    };

    if (mode === "team" && mgmtGroupId !== "__none__") {
      requestData.mgmtGroupId = mgmtGroupId;
    }

    submitRequest.mutate(
      { requestType, requestData },
      {
        onSuccess: () => {
          setName("");
          setLeadUserId("__none__");
          setMgmtGroupId("__none__");
          onOpenChange(false);
        },
      }
    );
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
          {!isCorporate && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                This request will be sent to your upline leadership for approval before being executed.
              </p>
            </div>
          )}

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
                <SelectItem value="__none__">No leader assigned</SelectItem>
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
                  <SelectItem value="__none__">No group assigned</SelectItem>
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
          <Button onClick={handleSave} disabled={submitRequest.isPending || !name.trim()} className="w-full">
            {submitRequest.isPending
              ? "Submitting..."
              : isCorporate
              ? `Create ${mode === "team" ? "Team" : "Group"}`
              : `Request ${mode === "team" ? "Team" : "Group"} Creation`}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
