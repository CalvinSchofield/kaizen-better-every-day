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
}

export const VetBlitzCard = ({ repData, allBlitzes }: VetBlitzCardProps) => {
  const { toast } = useToast();
  const [committedBlitzIds, setCommittedBlitzIds] = useState<string[]>([]);
  const [expandedBlitzes, setExpandedBlitzes] = useState<Set<string>>(new Set());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactedMembers, setContactedMembers] = useState<{ [blitzId: string]: string[] }>({});

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

  const handleBlitzCommit = async (blitzId: string, blitzName: string) => {
    const isCurrentlyCommitted = committedBlitzIds.includes(blitzId);

    // Optimistic update
    setCommittedBlitzIds(prev =>
      isCurrentlyCommitted
        ? prev.filter(id => id !== blitzId)
        : [...prev, blitzId]
    );

    try {
      const newCommittedIds = isCurrentlyCommitted
        ? committedBlitzIds.filter(id => id !== blitzId)
        : [...committedBlitzIds, blitzId];

      const { error } = await supabase.functions.invoke('update-blitz-commitment', {
        body: {
          repNotionPageId: repData.notion_page_id,
          blitzPageIds: newCommittedIds,
        },
      });

      if (error) throw error;

      if (!isCurrentlyCommitted) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
        toast({
          title: "Committed! 🎉",
          description: `You're now committed to ${blitzName}`,
        });
      } else {
        toast({
          title: "Uncommitted",
          description: `Removed from ${blitzName}`,
        });
      }
    } catch (error) {
      console.error('Error updating commitment:', error);
      // Revert optimistic update
      setCommittedBlitzIds(committedBlitzIds);
      toast({
        title: "Update failed",
        description: "Could not update your commitment. Please try again.",
        variant: "destructive",
      });
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
    return sortTeamMembers(
      teamMembers.filter(member => !member.committedBlitzes.includes(blitzId))
    );
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
              <div className="border rounded-lg p-4 space-y-3">
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
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>

                {/* Expandable details */}
                <CollapsibleContent className="space-y-4 pt-2">
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
                      {committedMembers.map((member) => (
                        <div
                          key={member.notionPageId}
                          className="flex items-center justify-between p-3 border rounded-lg bg-card"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {member.year === "Rookie" && (
                              <Badge className="bg-orange-500 text-white border-orange-600 flex-shrink-0">
                                🔥 Rookie
                              </Badge>
                            )}
                            <span className={`font-medium truncate ${member.year === "Rookie" ? "text-orange-600 dark:text-orange-400" : ""}`}>
                              {member.name}
                            </span>
                            {member.year === "Rookie" && (
                              <>
                                {member.blitzReady ? (
                                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                ) : (
                                  <span className="text-xs text-yellow-600 dark:text-yellow-400 flex-shrink-0">
                                    ⚠️ Not ready
                                  </span>
                                )}
                              </>
                            )}
                            {!member.ipadAssigned && (
                              <Badge variant="destructive" className="text-xs flex-shrink-0">
                                No iPad
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!member.ipadAssigned && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendIpadRequestEmail(member)}
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                Request iPad
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
                      ))}
                    </div>
                  )}

                  {/* Invite list for uncommitted members */}
                  {uncommittedMembers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">
                        {committedMembers.length > 0 ? "Invite More" : "Invite Team Members"}
                      </h4>
                      <div className="space-y-2">
                        {uncommittedMembers.map((member) => {
                          const isContactedForThisBlitz = (contactedMembers[blitz.id] || []).includes(member.notionPageId);
                          return (
                            <button
                              key={member.notionPageId}
                              onClick={() => toggleContactedStatus(member.notionPageId, blitz.id)}
                              className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${
                                isContactedForThisBlitz
                                  ? 'bg-green-50 dark:bg-green-950 border-green-500'
                                  : 'bg-card hover:bg-secondary/50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {member.year === "Rookie" && (
                                  <Badge className="bg-orange-500 text-white border-orange-600">
                                    🔥 Rookie
                                  </Badge>
                                )}
                                <span className={`font-medium ${member.year === "Rookie" ? "text-orange-600 dark:text-orange-400" : ""}`}>
                                  {member.name}
                                </span>
                              </div>
                              {isContactedForThisBlitz && (
                                <Badge className="bg-green-500 text-white">
                                  <Check className="h-3 w-3 mr-1" />
                                  Contacted
                                </Badge>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
};
