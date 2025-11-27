import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown, ChevronUp, Check, Mail, Users, Flame } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

interface VetBlitzCardProps {
  repData: any;
  allBlitzes: any[];
}

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
}

interface TeamMember {
  notionPageId: string;
  name: string;
  email: string | null;
  phone: string | null;
  blitzReady: boolean;
  committedBlitzes: string[];
  ipadAssigned: boolean;
  year: string | null;
  stage: string | null;
  onboardingStatus: string | null;
}

export const VetBlitzCard = ({ repData, allBlitzes }: VetBlitzCardProps) => {
  const { toast } = useToast();
  const [committedBlitzIds, setCommittedBlitzIds] = useState<string[]>([]);
  const [expandedBlitzes, setExpandedBlitzes] = useState<Set<string>>(new Set());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactedMembers, setContactedMembers] = useState<{ [blitzId: string]: string[] }>({});
  const [expandedInviteLists, setExpandedInviteLists] = useState<Set<string>>(new Set());
  const [uncommitDialogOpen, setUncommitDialogOpen] = useState(false);
  const [blitzToUncommit, setBlitzToUncommit] = useState<{ id: string; name: string } | null>(null);

  // Load committed blitzes from repData
  useEffect(() => {
    if (repData?.committed_blitzes && Array.isArray(repData.committed_blitzes)) {
      const committedIds = repData.committed_blitzes
        .map((b: any) => b.id)
        .filter((id: string) => id != null && id !== "");
      setCommittedBlitzIds(committedIds);
    } else {
      setCommittedBlitzIds([]);
    }
  }, [repData]);

  // Load contacted members from repData
  useEffect(() => {
    if (repData?.contacted_for_blitz) {
      setContactedMembers(repData.contacted_for_blitz);
    }
  }, [repData?.contacted_for_blitz]);

  // Fetch team members
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!repData?.notion_page_id) return;

      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('fetch-team-members', {
          body: { leaderNotionPageId: repData.notion_page_id },
        });

        if (error) throw error;

        if (data?.teamMembers) {
          // Filter out the vet themselves from their team list
          const filteredMembers = data.teamMembers.filter(
            (member: TeamMember) => member.notionPageId !== repData.notion_page_id
          );
          setTeamMembers(filteredMembers);
        }
      } catch (error) {
        console.error('Error fetching team members:', error);
        toast({
          title: "Error loading team",
          description: "Could not load team members. Please refresh.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTeamMembers();
  }, [repData?.notion_page_id, toast]);

  // Sort team members by year (rookies first) then alphabetically
  const sortTeamMembers = (members: TeamMember[]) => {
    return [...members].sort((a, b) => {
      if (a.year === "Rookie" && b.year !== "Rookie") return -1;
      if (a.year !== "Rookie" && b.year === "Rookie") return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const toggleBlitzExpansion = (blitzId: string) => {
    setExpandedBlitzes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(blitzId)) {
        newSet.delete(blitzId);
      } else {
        newSet.add(blitzId);
      }
      return newSet;
    });
  };

  const toggleInviteList = (blitzId: string) => {
    setExpandedInviteLists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(blitzId)) {
        newSet.delete(blitzId);
      } else {
        newSet.add(blitzId);
      }
      return newSet;
    });
  };

  const handleBlitzCommit = async (blitzId: string, blitzName: string) => {
    const isCurrentlyCommitted = committedBlitzIds.includes(blitzId);

    if (isCurrentlyCommitted) {
      // Show confirmation dialog for uncommit
      setBlitzToUncommit({ id: blitzId, name: blitzName });
      setUncommitDialogOpen(true);
      return;
    }

    // Optimistic update for commit
    setCommittedBlitzIds(prev => [...prev, blitzId]);

    try {
      const newCommittedIds = [...committedBlitzIds, blitzId];

      const { error } = await supabase.functions.invoke('update-blitz-commitment', {
        body: {
          repNotionPageId: repData.notion_page_id,
          blitzPageIds: newCommittedIds,
        },
      });

      if (error) throw error;

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      toast({
        title: "Committed! 🎉",
        description: `You're now committed to ${blitzName}`,
      });
    } catch (error) {
      console.error('Error updating commitment:', error);
      setCommittedBlitzIds(committedBlitzIds);
      toast({
        title: "Update failed",
        description: "Could not update your commitment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const confirmUncommit = async () => {
    if (!blitzToUncommit) return;

    const newCommittedIds = committedBlitzIds.filter(id => id !== blitzToUncommit.id);
    setCommittedBlitzIds(newCommittedIds);

    try {
      const { error } = await supabase.functions.invoke('update-blitz-commitment', {
        body: {
          repNotionPageId: repData.notion_page_id,
          blitzPageIds: newCommittedIds,
        },
      });

      if (error) throw error;

      toast({
        title: "Uncommitted",
        description: `Removed from ${blitzToUncommit.name}`,
      });
    } catch (error) {
      console.error('Error updating commitment:', error);
      setCommittedBlitzIds(committedBlitzIds);
      toast({
        title: "Update failed",
        description: "Could not update your commitment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUncommitDialogOpen(false);
      setBlitzToUncommit(null);
    }
  };

  const toggleMemberCommitment = async (member: TeamMember, blitzId: string, isCommitted: boolean) => {
    try {
      const newCommittedBlitzes = isCommitted
        ? member.committedBlitzes.filter(id => id !== blitzId)
        : [...member.committedBlitzes, blitzId];

      const { error } = await supabase.functions.invoke('update-blitz-commitment', {
        body: {
          repNotionPageId: member.notionPageId,
          blitzPageIds: newCommittedBlitzes,
        },
      });

      if (error) throw error;

      // Update local state
      setTeamMembers(prev =>
        prev.map(m =>
          m.notionPageId === member.notionPageId
            ? { ...m, committedBlitzes: newCommittedBlitzes }
            : m
        )
      );

      toast({
        title: isCommitted ? "Uncommitted" : "Committed",
        description: `${member.name} has been ${isCommitted ? 'removed from' : 'added to'} this blitz`,
      });
    } catch (error) {
      console.error('Error toggling member commitment:', error);
      toast({
        title: "Update failed",
        description: "Could not update team member commitment",
        variant: "destructive",
      });
    }
  };

  const toggleContactedStatus = async (memberId: string, blitzId: string) => {
    const currentContacted = contactedMembers[blitzId] || [];
    const isContacted = currentContacted.includes(memberId);
    const newContacted = isContacted
      ? currentContacted.filter(id => id !== memberId)
      : [...currentContacted, memberId];

    const newContactedMembers = {
      ...contactedMembers,
      [blitzId]: newContacted,
    };

    setContactedMembers(newContactedMembers);

    try {
      const { error } = await supabase
        .from('reps')
        .update({ contacted_for_blitz: newContactedMembers })
        .eq('id', repData.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating contacted status:', error);
      setContactedMembers(contactedMembers);
      toast({
        title: "Update failed",
        description: "Could not update contacted status",
        variant: "destructive",
      });
    }
  };

  const sendIpadRequestEmail = (member: TeamMember) => {
    const subject = `iPad Request for ${member.name}`;
    const body = `Hi,\n\nI'd like to request an iPad for ${member.name}.\n\nContact:\nEmail: ${member.email || 'N/A'}\nPhone: ${member.phone || 'N/A'}\n\nThanks!`;
    const mailtoLink = `mailto:salesassets@vivint.com?cc=Calvin.Schofield@vivint.com&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  const getCommittedMembers = (blitzId: string) => {
    return sortTeamMembers(
      teamMembers.filter(member => member.committedBlitzes.includes(blitzId))
    );
  };

  const getUncommittedMembers = (blitzId: string) => {
    const stageOrder = ["Sold (5+) 💰", "Sold 💲", "Shadow ✅", "Signed", "Evaluating"];
    
    return teamMembers
      .filter(member => !member.committedBlitzes.includes(blitzId))
      .filter(member => member.stage && stageOrder.includes(member.stage))
      .sort((a, b) => {
        const aStage = a.stage || "";
        const bStage = b.stage || "";
        const aIndex = stageOrder.indexOf(aStage);
        const bIndex = stageOrder.indexOf(bStage);
        return aIndex - bIndex;
      });
  };

  const getRookieCount = (blitzId: string) => {
    return teamMembers.filter(
      member => member.committedBlitzes.includes(blitzId) && member.year === "Rookie"
    ).length;
  };

  const getTeamMemberCount = (blitzId: string) => {
    return teamMembers.filter(
      member => member.committedBlitzes.includes(blitzId) && member.year !== "Rookie"
    ).length;
  };

  const isWithinSevenDays = (blitzDate: string) => {
    const today = new Date();
    const blitz = new Date(blitzDate);
    const diffTime = blitz.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  };

  const getReadinessStatus = (member: TeamMember) => {
    if (!member.onboardingStatus) return "Not Started";
    const step = member.onboardingStatus.toLowerCase();
    
    // Check if blitz ready (Phase 4 complete AND iPad assigned)
    if (step.includes("phase 4") && member.ipadAssigned) return "Blitz Ready ✓";
    if (step.includes("phase 4")) return "Phase 4 ✓";
    if (step.includes("phase 3")) return "Phase 3";
    if (step.includes("phase 2")) return "Phase 2";
    if (step.includes("phase 1")) return "Phase 1";
    if (step.includes("training") || step.includes("required")) return "Training";
    if (step.includes("onboarding")) return "Onboarding";
    return "Started";
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (allBlitzes.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Blitz Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>No upcoming blitzes found.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Blitz Management
        </CardTitle>
        <CardDescription>
          Manage your commitments and team attendance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {allBlitzes.map((blitz) => {
          const isCommitted = committedBlitzIds.includes(blitz.id);
          const isExpanded = expandedBlitzes.has(blitz.id);
          const committedMembers = getCommittedMembers(blitz.id);
          const uncommittedMembers = getUncommittedMembers(blitz.id);
          const rookieCount = getRookieCount(blitz.id);
          const teamCount = getTeamMemberCount(blitz.id);
          const hasRookiesButNotCommitted = rookieCount > 0 && !isCommitted;

          const startDate = new Date(blitz.date);
          const endDate = blitz.endDate ? new Date(blitz.endDate) : startDate;
          const dateStr =
            startDate.toDateString() === endDate.toDateString()
              ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

          return (
            <Collapsible
              key={blitz.id}
              open={isExpanded}
              onOpenChange={() => toggleBlitzExpansion(blitz.id)}
            >
              <div 
                className="border rounded-lg p-4 space-y-3 cursor-pointer active:scale-[0.99] transition-transform"
                onClick={() => toggleBlitzExpansion(blitz.id)}
              >
                {/* Collapsed state header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{blitz.name}</h3>
                      {isCommitted && (
                        <Badge className="bg-green-500 text-white border-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          Committed
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <Calendar className="h-4 w-4" />
                      <span>{dateStr}</span>
                      {blitz.location && <span>• {blitz.location}</span>}
                    </div>
                    {/* Team indicators */}
                    <div className="flex items-center gap-3 text-sm">
                      {rookieCount > 0 && (
                        <div className={`flex items-center gap-1.5 ${hasRookiesButNotCommitted ? 'text-orange-600 dark:text-orange-400 font-semibold' : 'text-muted-foreground'}`}>
                          <Flame className={`h-4 w-4 ${hasRookiesButNotCommitted ? 'animate-pulse' : ''}`} />
                          <span>{rookieCount} {rookieCount === 1 ? 'rookie' : 'rookies'} going</span>
                        </div>
                      )}
                      {teamCount > 0 && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{teamCount} team {teamCount === 1 ? 'member' : 'members'} going</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>

                {/* Expandable details */}
                <CollapsibleContent className="space-y-4 pt-2" onClick={(e) => e.stopPropagation()}>
                  {/* Your commitment toggle */}
                  <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <span className="font-medium">Your Status</span>
                    <Button
                      size="sm"
                      variant={isCommitted ? "destructive" : "default"}
                      onClick={() => handleBlitzCommit(blitz.id, blitz.name)}
                    >
                      {isCommitted ? "Uncommit" : "Commit"}
                    </Button>
                  </div>

                  {/* Team members committed */}
                  {committedMembers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Team Members Attending</h4>
                      {committedMembers.map((member) => {
                        const showIpadWarning = isWithinSevenDays(blitz.date) && !member.ipadAssigned;
                        const readinessStatus = member.year === "Rookie" ? getReadinessStatus(member) : null;
                        const isUrgentIpad = member.year === "Rookie" && showIpadWarning;
                        
                        return (
                          <div
                            key={member.notionPageId}
                            className={`flex items-center justify-between p-3 border rounded-lg ${isUrgentIpad ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'bg-card'}`}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {member.year === "Rookie" && (
                                <Badge className="bg-orange-500 text-white border-orange-600 flex-shrink-0 text-xs">
                                  🔥
                                </Badge>
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className={`font-medium truncate ${member.year === "Rookie" ? "text-orange-600 dark:text-orange-400" : ""}`}>
                                  {member.name}
                                </span>
                                {member.year === "Rookie" && readinessStatus && (
                                  <span className="text-xs text-muted-foreground">
                                    {readinessStatus}
                                  </span>
                                )}
                              </div>
                              {showIpadWarning && (
                                <Badge variant="destructive" className="text-xs flex-shrink-0 animate-pulse">
                                  ⚠️ No iPad
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {showIpadWarning && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                                  onClick={() => sendIpadRequestEmail(member)}
                                >
                                  <Mail className="h-3 w-3 mr-1" />
                                  iPad
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleMemberCommitment(member, blitz.id, true)}
                              >
                                Uncommit
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Invite list for uncommitted members */}
                  <Collapsible
                    open={expandedInviteLists.has(blitz.id)}
                    onOpenChange={() => toggleInviteList(blitz.id)}
                  >
                    <div className="space-y-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full">
                          {expandedInviteLists.has(blitz.id) ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                          {committedMembers.length > 0 ? "Invite More" : "Invite Team Members"} ({uncommittedMembers.length})
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 pt-2">
                        {uncommittedMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No team members with priority stages (Sold, Shadow, Signed, Evaluating) available to invite
                          </p>
                        ) : (
                          uncommittedMembers.map((member) => {
                            const isContactedForThisBlitz = (contactedMembers[blitz.id] || []).includes(member.notionPageId);
                            return (
                              <div
                                key={member.notionPageId}
                                className="flex items-center justify-between p-3 border rounded-lg bg-card"
                              >
                                <button
                                  onClick={() => toggleContactedStatus(member.notionPageId, blitz.id)}
                                  className="flex items-center gap-2 flex-1 text-left"
                                >
                                  {member.year === "Rookie" && (
                                    <Badge className="bg-orange-500 text-white border-orange-600 flex-shrink-0 text-xs">
                                      🔥
                                    </Badge>
                                  )}
                                  <span className={`font-medium ${isContactedForThisBlitz ? 'line-through opacity-50' : ''} ${member.year === "Rookie" ? "text-orange-600 dark:text-orange-400" : ""}`}>
                                    {member.name}
                                  </span>
                                </button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => toggleMemberCommitment(member, blitz.id, false)}
                                >
                                  Commit
                                </Button>
                              </div>
                            );
                          })
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>

      <AlertDialog open={uncommitDialogOpen} onOpenChange={setUncommitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uncommit from Blitz?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to uncommit from {blitzToUncommit?.name}? You can always commit again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUncommit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Uncommit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
