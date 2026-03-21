import { useState, useMemo } from "react";
import { Search, AlertTriangle, ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getCleanName, getInitials } from "@/utils/nameUtils";
import { cn } from "@/lib/utils";

interface EligibleRecruiter {
  userId: string;
  name: string;
  profilePhotoUrl?: string | null;
  stage?: string | null;
}

interface ReassignRecruiterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPerson: {
    id: string;
    name: string;
    userId: string | null;
    childCount: number;
    currentRecruiterUserId?: string | null;
  } | null;
  eligibleRecruiters: EligibleRecruiter[];
}

export const ReassignRecruiterDrawer = ({
  open,
  onOpenChange,
  selectedPerson,
  eligibleRecruiters,
}: ReassignRecruiterDrawerProps) => {
  const [search, setSearch] = useState("");
  const [selectedRecruiter, setSelectedRecruiter] = useState<EligibleRecruiter | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const filtered = useMemo(() => {
    if (!selectedPerson) return [];
    const q = search.toLowerCase().trim();
    return eligibleRecruiters
      .filter((r) => {
        // Can't reassign to self
        if (r.userId === selectedPerson.userId) return false;
        // Can't reassign to current recruiter (no-op)
        if (r.userId === selectedPerson.currentRecruiterUserId) return false;
        if (q && !getCleanName(r.name).toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => getCleanName(a.name).localeCompare(getCleanName(b.name)));
  }, [eligibleRecruiters, search, selectedPerson]);

  const handleSelect = (recruiter: EligibleRecruiter) => {
    setSelectedRecruiter(recruiter);
    // Show confirmation only if the person being moved has children (branch move)
    if (selectedPerson && selectedPerson.childCount > 0) {
      setShowConfirm(true);
    } else {
      executeReassignment(recruiter);
    }
  };

  const executeReassignment = async (recruiter: EligibleRecruiter) => {
    if (!selectedPerson) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.functions.invoke("update-rep-assignment", {
        body: {
          repId: selectedPerson.id,
          recruiterUserId: recruiter.userId,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      toast({
        title: "Recruiter reassigned",
        description: `${getCleanName(selectedPerson.name)} is now under ${getCleanName(recruiter.name)}`,
      });

      queryClient.invalidateQueries({ queryKey: ["recruiter-tree-data"] });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      queryClient.invalidateQueries({ queryKey: ["group-recruits"] });
      queryClient.invalidateQueries({ queryKey: ["org-structure"] });
      onOpenChange(false);
    } catch (err) {
      console.error("Error reassigning recruiter:", err);
      toast({
        title: "Error reassigning recruiter",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setShowConfirm(false);
      setSelectedRecruiter(null);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSearch("");
      setSelectedRecruiter(null);
    }
    onOpenChange(isOpen);
  };

  if (!selectedPerson) return null;

  const cleanPersonName = getCleanName(selectedPerson.name);

  return (
    <>
      <Drawer open={open} onOpenChange={handleClose}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-base">
              Reassign {cleanPersonName}
            </DrawerTitle>
            {selectedPerson.childCount > 0 && (
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>
                  {selectedPerson.childCount} recruit{selectedPerson.childCount !== 1 ? "s" : ""} in their downline will move too
                </span>
              </div>
            )}
          </DrawerHeader>

          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recruiters..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 px-4" style={{ maxHeight: "calc(80vh - 180px)" }}>
            <div className="space-y-1 pb-4">
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No eligible recruiters found
                </p>
              )}
              {filtered.map((recruiter) => {
                const cleanName = getCleanName(recruiter.name);
                const initials = getInitials(cleanName);
                return (
                  <button
                    key={recruiter.userId}
                    disabled={saving}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg",
                      "hover:bg-muted/60 active:bg-muted transition-colors text-left"
                    )}
                    onClick={() => handleSelect(recruiter)}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={recruiter.profilePhotoUrl || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{cleanName}</p>
                      {recruiter.stage && (
                        <p className="text-xs text-muted-foreground truncate">
                          {recruiter.stage}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* Branch move confirmation */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Branch Move
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cleanPersonName} has{" "}
              <strong>{selectedPerson.childCount} recruit{selectedPerson.childCount !== 1 ? "s" : ""}</strong>{" "}
              in their downline. Moving them to{" "}
              <strong>{selectedRecruiter ? getCleanName(selectedRecruiter.name) : ""}</strong>{" "}
              will move their entire branch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={() =>
                selectedRecruiter && executeReassignment(selectedRecruiter)
              }
            >
              {saving ? "Moving..." : "Move Branch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
