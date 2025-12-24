import { useState, useEffect, useMemo } from "react";
import { X, Calendar, MapPin, Check } from "lucide-react";
import { format, parseISO, isBefore, startOfYear } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useBlitzes } from "@/hooks/useBlitzes";

interface Rep {
  id: string;
  userId: string | null;
  name: string;
  teamId: string | null;
  teamName: string | null;
  recruiterUserId: string | null;
  recruiterName?: string;
  stage?: string | null;
  notionPageId?: string | null;
}

interface Team {
  id: string;
  name: string;
}

interface EditRepOrgDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rep: Rep;
  allTeams: Team[];
  allReps: Array<{ userId: string | null; name: string }>;
}

export const EditRepOrgDrawer = ({
  open,
  onOpenChange,
  rep,
  allTeams,
  allReps,
}: EditRepOrgDrawerProps) => {
  const [teamId, setTeamId] = useState(rep.teamId || "__none__");
  const [recruiterUserId, setRecruiterUserId] = useState(rep.recruiterUserId || "__none__");
  const [saving, setSaving] = useState(false);
  // Track using supabaseId (the actual DB UUID) for recruit_blitzes table
  const [committedBlitzIds, setCommittedBlitzIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  
  const { allBlitzesIncludingPast, loading: blitzesLoading } = useBlitzes();

  // Fetch current blitz commitments for this recruit
  const { data: currentCommitments, isLoading: commitmentsLoading } = useQuery({
    queryKey: ["recruit-blitzes", rep.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recruit_blitzes")
        .select("blitz_id")
        .eq("recruit_id", rep.id);
      
      if (error) throw error;
      return data?.map(rb => rb.blitz_id) || [];
    },
    enabled: open && !!rep.id,
  });

  // Reset state when drawer opens
  useEffect(() => {
    if (open) {
      setTeamId(rep.teamId || "__none__");
      setRecruiterUserId(rep.recruiterUserId || "__none__");
      if (currentCommitments) {
        setCommittedBlitzIds(new Set(currentCommitments));
      }
    }
  }, [open, rep.teamId, rep.recruiterUserId, currentCommitments]);

  // Filter blitzes to this year only and sort by date
  const thisYearBlitzes = useMemo(() => {
    const yearStart = startOfYear(new Date());
    return allBlitzesIncludingPast
      .filter(blitz => {
        const blitzDate = parseISO(blitz.date);
        return !isBefore(blitzDate, yearStart);
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allBlitzesIncludingPast]);

  // Split into past and future
  const { pastBlitzes, futureBlitzes } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const past: typeof thisYearBlitzes = [];
    const future: typeof thisYearBlitzes = [];
    
    thisYearBlitzes.forEach(blitz => {
      const endDate = blitz.endDate ? parseISO(blitz.endDate) : parseISO(blitz.date);
      if (isBefore(endDate, now)) {
        past.push(blitz);
      } else {
        future.push(blitz);
      }
    });
    
    // Sort past blitzes most recent first
    past.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return { pastBlitzes: past, futureBlitzes: future };
  }, [thisYearBlitzes]);

  // Get the supabaseId for a blitz (the actual DB UUID needed for recruit_blitzes)
  const getSupabaseId = (blitz: typeof thisYearBlitzes[0]) => {
    return blitz.supabaseId || blitz.id;
  };

  const toggleBlitz = (supabaseId: string) => {
    setCommittedBlitzIds(prev => {
      const next = new Set(prev);
      if (next.has(supabaseId)) {
        next.delete(supabaseId);
      } else {
        next.add(supabaseId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Update team and recruiter
      const { error } = await supabase.functions.invoke("update-rep-assignment", {
        body: {
          repId: rep.id,
          teamId: teamId === "__none__" ? null : teamId,
          recruiterUserId: recruiterUserId === "__none__" ? null : recruiterUserId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      // Update blitz commitments
      const currentSet = new Set(currentCommitments || []);
      const newSet = committedBlitzIds;
      
      // Find additions and removals
      const toAdd = [...newSet].filter(id => !currentSet.has(id));
      const toRemove = [...currentSet].filter(id => !newSet.has(id));

      // Remove old commitments
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("recruit_blitzes")
          .delete()
          .eq("recruit_id", rep.id)
          .in("blitz_id", toRemove);
        
        if (removeError) {
          console.error("Error removing blitz commitments:", removeError);
        }
      }

      // Add new commitments
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from("recruit_blitzes")
          .insert(toAdd.map(blitzId => ({
            recruit_id: rep.id,
            blitz_id: blitzId,
          })));
        
        if (addError) {
          console.error("Error adding blitz commitments:", addError);
        }
      }

      toast({ title: "Rep updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["team-access"] });
      queryClient.invalidateQueries({ queryKey: ["org-structure"] });
      queryClient.invalidateQueries({ queryKey: ["group-recruits"] });
      queryClient.invalidateQueries({ queryKey: ["recruit-blitzes", rep.id] });
      onOpenChange(false);
    } catch (err) {
      console.error("Error updating rep:", err);
      toast({
        title: "Error updating rep",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatBlitzDates = (startDate: string, endDate?: string | null) => {
    const start = parseISO(startDate);
    if (endDate) {
      const end = parseISO(endDate);
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    }
    return format(start, "MMM d, yyyy");
  };

  const renderBlitzItem = (blitz: typeof thisYearBlitzes[0], isPast: boolean) => {
    const supabaseId = getSupabaseId(blitz);
    const isCommitted = committedBlitzIds.has(supabaseId);
    
    return (
      <div
        key={supabaseId}
        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
          isCommitted 
            ? "bg-primary/10 border-primary/30" 
            : "bg-muted/30 border-border hover:bg-muted/50"
        }`}
        onClick={() => toggleBlitz(supabaseId)}
      >
        <Checkbox
          checked={isCommitted}
          onCheckedChange={() => toggleBlitz(supabaseId)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${isPast ? "text-muted-foreground" : ""}`}>
            {blitz.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Calendar className="h-3 w-3" />
            <span>{formatBlitzDates(blitz.date, blitz.endDate)}</span>
          </div>
          {blitz.location && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <MapPin className="h-3 w-3" />
              <span>{blitz.location}</span>
            </div>
          )}
        </div>
        {isCommitted && (
          <Check className="h-4 w-4 text-primary shrink-0" />
        )}
      </div>
    );
  };

  const isLoading = blitzesLoading || commitmentsLoading;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle>Edit Rep Assignment</DrawerTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-140px)]">
          <div className="p-4 space-y-6">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{rep.name}</p>
              {rep.stage && (
                <p className="text-sm text-muted-foreground">{rep.stage}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No team assigned</SelectItem>
                  {[...allTeams]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Recruiter</Label>
              <Select value={recruiterUserId} onValueChange={setRecruiterUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select recruiter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No recruiter assigned</SelectItem>
                  {[...allReps]
                    .filter((r) => r.userId)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((r) => (
                      <SelectItem key={r.userId!} value={r.userId!}>
                        {r.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Blitz Commitments Section */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Blitz Attendance</Label>
              
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading blitzes...</div>
              ) : (
                <div className="space-y-4">
                  {/* Upcoming Blitzes */}
                  {futureBlitzes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
                      <div className="space-y-2">
                        {futureBlitzes.map(blitz => renderBlitzItem(blitz, false))}
                      </div>
                    </div>
                  )}

                  {/* Past Blitzes */}
                  {pastBlitzes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Past Blitzes ({pastBlitzes.length})
                      </p>
                      <div className="space-y-2">
                        {pastBlitzes.map(blitz => renderBlitzItem(blitz, true))}
                      </div>
                    </div>
                  )}

                  {thisYearBlitzes.length === 0 && (
                    <p className="text-sm text-muted-foreground">No blitzes found for this year</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DrawerFooter className="border-t">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};