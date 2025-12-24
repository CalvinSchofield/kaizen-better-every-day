import { useState, useEffect, useMemo } from "react";
import { X, Calendar, MapPin, Check, Building2, User, Phone, Mail, Activity } from "lucide-react";
import { format, parseISO, isBefore, startOfYear, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  phone?: string | null;
  email?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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
  const [committedBlitzIds, setCommittedBlitzIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("organization");
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

  // Look up the linked rep record to get user_id for app access
  const { data: linkedRepData } = useQuery({
    queryKey: ["linked-rep", rep.email, rep.notionPageId],
    queryFn: async () => {
      // Try to find matching rep by notion_page_id or email
      let query = supabase
        .from("reps")
        .select("user_id, name")
        .not("user_id", "is", null);
      
      if (rep.notionPageId) {
        query = query.eq("notion_page_id", rep.notionPageId);
      } else if (rep.email) {
        query = query.ilike("email", rep.email);
      } else {
        return null;
      }
      
      const { data } = await query.maybeSingle();
      return data;
    },
    enabled: open && !!(rep.email || rep.notionPageId),
  });

  const linkedUserId = linkedRepData?.user_id || null;
  const hasAppAccess = !!linkedUserId;

  // Fetch additional rep data if they have app access
  const { data: repGoals } = useQuery({
    queryKey: ["rep-goals-org", linkedUserId],
    queryFn: async () => {
      if (!linkedUserId) return null;
      const { data } = await supabase
        .from("rep_goals")
        .select("will_do_fp_goal, setup_complete")
        .eq("user_id", linkedUserId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!linkedUserId,
  });

  // Fetch last activity (most recent daily entry)
  const { data: lastActivity } = useQuery({
    queryKey: ["last-activity-org", linkedUserId],
    queryFn: async () => {
      if (!linkedUserId) return null;
      const { data } = await supabase
        .from("daily_entries")
        .select("entry_date, updated_at")
        .eq("user_id", linkedUserId)
        .order("entry_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: open && !!linkedUserId,
  });

  // Reset state when drawer opens
  useEffect(() => {
    if (open) {
      setTeamId(rep.teamId || "__none__");
      setRecruiterUserId(rep.recruiterUserId || "__none__");
      setActiveTab("organization");
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
      
      const toAdd = [...newSet].filter(id => !currentSet.has(id));
      const toRemove = [...currentSet].filter(id => !newSet.has(id));

      if (toRemove.length > 0) {
        await supabase
          .from("recruit_blitzes")
          .delete()
          .eq("recruit_id", rep.id)
          .in("blitz_id", toRemove);
      }

      if (toAdd.length > 0) {
        await supabase
          .from("recruit_blitzes")
          .insert(toAdd.map(blitzId => ({
            recruit_id: rep.id,
            blitz_id: blitzId,
          })));
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
  const attendedCount = committedBlitzIds.size;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <DrawerTitle>Rep Details</DrawerTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-3 bg-muted rounded-lg mt-2">
            <p className="font-medium">{rep.name}</p>
            {rep.stage && (
              <p className="text-sm text-muted-foreground">{rep.stage}</p>
            )}
          </div>
        </DrawerHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-4 pt-2 border-b">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="organization" className="text-xs">
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                Org
              </TabsTrigger>
              <TabsTrigger value="details" className="text-xs">
                <User className="h-3.5 w-3.5 mr-1.5" />
                Details
              </TabsTrigger>
              <TabsTrigger value="blitzes" className="text-xs">
                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                Blitzes
                {attendedCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                    {attendedCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 230px)' }}>
            {/* Organization Tab */}
            <TabsContent value="organization" className="p-4 space-y-4 mt-0">
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
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="p-4 space-y-4 mt-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Stage</span>
                  <span className="text-sm font-medium">{rep.stage || "—"}</span>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    Phone
                  </span>
                  <span className="text-sm font-medium">
                    {rep.phone ? (
                      <a href={`tel:${rep.phone}`} className="text-primary hover:underline">
                        {rep.phone}
                      </a>
                    ) : "—"}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </span>
                  <span className="text-sm font-medium truncate max-w-[180px]">
                    {rep.email ? (
                      <a href={`mailto:${rep.email}`} className="text-primary hover:underline">
                        {rep.email}
                      </a>
                    ) : "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">App Access</span>
                  <Badge variant={hasAppAccess ? "default" : "secondary"}>
                    {hasAppAccess ? "Yes" : "No"}
                  </Badge>
                </div>

                {hasAppAccess && (
                  <>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">Goals Set</span>
                      <Badge variant={repGoals?.setup_complete ? "default" : "secondary"}>
                        {repGoals?.setup_complete ? "Yes" : "No"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">FP Goal</span>
                      <span className="text-sm font-medium">
                        {repGoals?.will_do_fp_goal || "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5" />
                        Last Activity
                      </span>
                      <span className="text-sm font-medium">
                        {lastActivity?.updated_at ? (
                          formatDistanceToNow(parseISO(lastActivity.updated_at), { addSuffix: true })
                        ) : "No activity yet"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* Blitzes Tab */}
            <TabsContent value="blitzes" className="p-4 space-y-4 mt-0">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading blitzes...</div>
              ) : (
                <div className="space-y-4">
                  {/* Upcoming Blitzes */}
                  {futureBlitzes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Upcoming ({futureBlitzes.length})
                      </p>
                      <div className="space-y-2">
                        {futureBlitzes.map(blitz => renderBlitzItem(blitz, false))}
                      </div>
                    </div>
                  )}

                  {/* Past Blitzes */}
                  {pastBlitzes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Past ({pastBlitzes.length})
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
            </TabsContent>
          </div>
        </Tabs>

        <DrawerFooter className="border-t">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
