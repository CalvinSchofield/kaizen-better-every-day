import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Check, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface VetBlitzCommitmentsProps {
  repData: any;
}

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
}

export const VetBlitzCommitments = ({ repData }: VetBlitzCommitmentsProps) => {
  const { toast } = useToast();
  const [committedBlitzIds, setCommittedBlitzIds] = useState<string[]>([]);
  const [allBlitzes, setAllBlitzes] = useState<BlitzEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [uncommitDialog, setUncommitDialog] = useState<{ open: boolean; blitzId: string; blitzName: string }>({
    open: false,
    blitzId: "",
    blitzName: "",
  });

  // Load all blitzes from Preseason Trips database and filter for future dates
  useEffect(() => {
    const fetchAllBlitzes = async () => {
      setLoading(true);
      
      try {
        // Fetch all blitzes from Notion Preseason Trips database
        const { data, error } = await supabase.functions.invoke('fetch-preseason-blitzes');
        
        if (error) throw error;
        
        if (data?.blitzes) {
          // Filter to future blitzes only
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const futureBlitzes = data.blitzes
            .filter((blitz: any) => {
              if (!blitz || !blitz.date) return false;
              const blitzEndDate = blitz.endDate ? new Date(blitz.endDate) : new Date(blitz.date);
              blitzEndDate.setHours(0, 0, 0, 0);
              return blitzEndDate >= today;
            })
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          setAllBlitzes(futureBlitzes);
          console.log('[VetBlitzCommitments] Loaded all future blitzes:', futureBlitzes);
          
          // Extract committed blitz IDs from repData
          if (repData?.committed_blitzes && Array.isArray(repData.committed_blitzes)) {
            const committedIds = repData.committed_blitzes
              .map((b: any) => b.id)
              .filter((id: string) => id != null && id !== ""); // Filter out null/undefined/empty IDs
            setCommittedBlitzIds(committedIds);
            console.log('[VetBlitzCommitments] Rep is committed to these IDs:', committedIds);
          } else {
            setCommittedBlitzIds([]);
          }
        }
      } catch (error) {
        console.error('[VetBlitzCommitments] Error fetching blitzes:', error);
        toast({
          title: "Error loading blitzes",
          description: "Could not load upcoming blitzes. Please refresh.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAllBlitzes();
  }, [repData, toast]);

  // Fetch team members for indicator
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!repData?.notion_page_id) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('fetch-team-members', {
          body: { leaderNotionPageId: repData.notion_page_id }
        });

        if (error) throw error;

        setTeamMembers(data?.teamMembers || []);
      } catch (error) {
        console.error('[VetBlitzCommitments] Error fetching team members:', error);
      }
    };

    fetchTeamMembers();
  }, [repData]);

  const handleBlitzClick = (blitzId: string, blitzName: string) => {
    const isCommitted = committedBlitzIds.includes(blitzId);
    
    if (isCommitted) {
      // Show confirmation dialog for uncommitting
      setUncommitDialog({ open: true, blitzId, blitzName });
    } else {
      // Commit directly
      commitToBlitz(blitzId, blitzName);
    }
  };

  const commitToBlitz = async (blitzId: string, blitzName: string) => {
    const newCommitmentIds = [...committedBlitzIds, blitzId];

    // Optimistically update UI
    setCommittedBlitzIds(newCommitmentIds);

    // Show confetti animation when committing
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    // Update Notion via edge function
    try {
      if (!repData.notion_page_id) {
        throw new Error("Rep Notion page ID not found");
      }

      const { error } = await supabase.functions.invoke('update-blitz-commitment', {
        body: {
          repNotionPageId: repData.notion_page_id,
          blitzPageIds: newCommitmentIds.filter((id) => id != null && id !== "") // Filter out nulls before sending
        }
      });

      if (error) throw error;

      toast({
        title: "Committed!",
        description: `You've committed to ${blitzName}!`,
      });
    } catch (error) {
      console.error("Error updating commitment:", error);
      // Revert optimistic update
      setCommittedBlitzIds(committedBlitzIds.filter(id => id !== blitzId));
      
      toast({
        title: "Error",
        description: "Could not update your commitment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUncommit = async () => {
    const { blitzId, blitzName } = uncommitDialog;
    const newCommitmentIds = committedBlitzIds.filter(id => id !== blitzId);

    // Close dialog
    setUncommitDialog({ open: false, blitzId: "", blitzName: "" });

    // Optimistically update UI
    setCommittedBlitzIds(newCommitmentIds);

    // Update Notion via edge function
    try {
      if (!repData.notion_page_id) {
        throw new Error("Rep Notion page ID not found");
      }

      const { error } = await supabase.functions.invoke('update-blitz-commitment', {
        body: {
          repNotionPageId: repData.notion_page_id,
          blitzPageIds: newCommitmentIds.filter((id) => id != null && id !== "") // Filter out nulls before sending
        }
      });

      if (error) throw error;

      toast({
        title: "Commitment removed",
        description: `You've removed your commitment to ${blitzName}`,
      });
    } catch (error) {
      console.error("Error updating commitment:", error);
      // Revert optimistic update
      setCommittedBlitzIds([...committedBlitzIds, blitzId]);
      
      toast({
        title: "Error",
        description: "Could not update your commitment. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Calculate team member indicator for each blitz
  const getTeamMemberCount = (blitzId: string) => {
    // Filter out the leader themselves
    const filteredMembers = teamMembers.filter((member: any) => 
      member.notionPageId !== repData.notion_page_id
    );
    return filteredMembers.filter((member: any) => 
      member.committedBlitzes.includes(blitzId)
    ).length;
  };

  const getRookieCount = (blitzId: string) => {
    // Filter out the leader and count only rookies
    const filteredMembers = teamMembers.filter((member: any) => 
      member.notionPageId !== repData.notion_page_id
    );
    return filteredMembers.filter((member: any) => 
      member.committedBlitzes.includes(blitzId) && member.year === "Rookie"
    ).length;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upcoming Blitzes
        </CardTitle>
        <CardDescription>
          Commit to the blitzes you're planning to attend
        </CardDescription>
      </CardHeader>
      <CardContent>
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {!loading && allBlitzes.length === 0 && (
        <Alert>
          <AlertDescription>No upcoming blitzes scheduled</AlertDescription>
        </Alert>
      )}

      {!loading && allBlitzes.length > 0 && (
        <div className="space-y-3">
          {allBlitzes.map((blitz) => {
            const isCommitted = committedBlitzIds.includes(blitz.id);
            const teamCount = getTeamMemberCount(blitz.id);
            const rookieCount = getRookieCount(blitz.id);
            const showTeamIndicator = !isCommitted && teamCount > 0;
            const hasRookies = rookieCount > 0;
            
            return (
              <div
                key={blitz.id}
                onClick={() => handleBlitzClick(blitz.id, blitz.name)}
                className={`p-4 rounded-lg border transition-all cursor-pointer ${
                  isCommitted 
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20' 
                    : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm truncate">{blitz.name}</h4>
                      {isCommitted && (
                        <Badge variant="default" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Committed
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {blitz.date}{blitz.endDate && ` - ${blitz.endDate}`}
                    </p>
                    {blitz.location && (
                      <p className="text-xs text-muted-foreground mt-1">
                        📍 {blitz.location}
                      </p>
                    )}
                    {showTeamIndicator && (
                      <div className="mt-2 space-y-1">
                        {hasRookies ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-orange-500/10 border border-orange-500/20">
                            <span className="text-2xl">🔥</span>
                            <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                              {rookieCount} rookie{rookieCount !== 1 ? 's' : ''} going — they need you there!
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            👥 {teamCount} team {teamCount === 1 ? 'member' : 'members'} going
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </CardContent>

      <Sheet open={uncommitDialog.open} onOpenChange={(open) => setUncommitDialog({ ...uncommitDialog, open })}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Remove commitment?</SheetTitle>
            <SheetDescription>
              Are you sure you want to remove your commitment to {uncommitDialog.blitzName}?
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="flex flex-row gap-2 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setUncommitDialog({ ...uncommitDialog, open: false })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleUncommit}
            >
              Yes, remove
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Card>
  );
};
