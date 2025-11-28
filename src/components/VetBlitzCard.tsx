import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown, ChevronUp, Check, Mail, Users, Flame, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VetBlitzCardProps {
  repData: any;
  allBlitzes: any[];
  teamMembers: TeamMember[];
  isTeamLead: boolean;
  onTeamMemberUpdate?: (notionPageId: string, updates: Partial<TeamMember>) => void;
  onCommitmentChange?: () => void;
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

export const VetBlitzCard = ({ repData, allBlitzes, teamMembers: propTeamMembers, isTeamLead: propIsTeamLead, onTeamMemberUpdate, onCommitmentChange }: VetBlitzCardProps) => {
  const { toast } = useToast();
  const [committedBlitzIds, setCommittedBlitzIds] = useState<string[]>([]);
  const [expandedBlitz, setExpandedBlitz] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(propTeamMembers);
  const [contactedMembers, setContactedMembers] = useState<{ [blitzId: string]: string[] }>({});
  const [expandedInviteLists, setExpandedInviteLists] = useState<Set<string>>(new Set());
  const [uncommitDialogOpen, setUncommitDialogOpen] = useState(false);
  const [blitzToUncommit, setBlitzToUncommit] = useState<{ id: string; name: string } | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedRookie, setSelectedRookie] = useState<TeamMember | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [memberToCommit, setMemberToCommit] = useState<{ member: TeamMember; blitzId: string; isCommitted: boolean } | null>(null);

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

  // Sync team members from props
  useEffect(() => {
    setTeamMembers(propTeamMembers);
  }, [propTeamMembers]);

  // Load contacted members from repData
  useEffect(() => {
    if (repData?.contacted_for_blitz) {
      setContactedMembers(repData.contacted_for_blitz);
    }
  }, [repData?.contacted_for_blitz]);

  // Sort team members by year (rookies first) then alphabetically
  const sortTeamMembers = (members: TeamMember[]) => {
    return [...members].sort((a, b) => {
      if (a.year === "Rookie" && b.year !== "Rookie") return -1;
      if (a.year !== "Rookie" && b.year === "Rookie") return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const toggleBlitzExpansion = (blitzId: string) => {
    setExpandedBlitz(prev => prev === blitzId ? null : blitzId);
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
      
      // Trigger parent refetch to update next blitz display
      onCommitmentChange?.();
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
      
      // Trigger parent refetch to update next blitz display
      onCommitmentChange?.();
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

  const promptMemberCommitment = (member: TeamMember, blitzId: string, isCommitted: boolean) => {
    setMemberToCommit({ member, blitzId, isCommitted });
    setCommitDialogOpen(true);
  };

  const confirmMemberCommitment = async () => {
    if (!memberToCommit) return;

    const { member, blitzId, isCommitted } = memberToCommit;

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
    } finally {
      setCommitDialogOpen(false);
      setMemberToCommit(null);
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

  const openStatusDialog = (member: TeamMember, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRookie(member);
    setSelectedStatus(member.onboardingStatus || "Started");
    setStatusDialogOpen(true);
  };

  const updateRookieStatus = async () => {
    if (!selectedRookie || !selectedStatus) return;

    try {
      const { error } = await supabase.functions.invoke('update-rookie-status', {
        body: {
          rookieNotionPageId: selectedRookie.notionPageId,
          onboardingStatus: selectedStatus,
        },
      });

      if (error) throw error;

      const updates = { onboardingStatus: selectedStatus };

      // Update local state
      setTeamMembers(prev =>
        prev.map(m =>
          m.notionPageId === selectedRookie.notionPageId
            ? { ...m, ...updates }
            : m
        )
      );

      // Notify parent of changes
      if (onTeamMemberUpdate) {
        onTeamMemberUpdate(selectedRookie.notionPageId, updates);
      }

      toast({
        title: "Status updated",
        description: `${selectedRookie.name}'s status has been updated to ${selectedStatus}`,
      });
    } catch (error) {
      console.error('Error updating rookie status:', error);
      toast({
        title: "Update failed",
        description: "Could not update rookie status",
        variant: "destructive",
      });
    } finally {
      setStatusDialogOpen(false);
      setSelectedRookie(null);
    }
  };

  const getCommittedMembers = (blitzId: string) => {
    return sortTeamMembers(
      teamMembers.filter(member => member.committedBlitzes.includes(blitzId))
    );
  };

  const getUncommittedMembers = (blitzId: string) => {
    const allowedStages = ["Sold (5+) 💰", "Sold 💲", "Shadow ✅", "Signed", "Evaluating"];
    return sortTeamMembers(
      teamMembers.filter(member => 
        !member.committedBlitzes.includes(blitzId) && 
        member.stage && 
        allowedStages.includes(member.stage)
      )
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

  // Simplified view for vets who are not team leads
  if (!propIsTeamLead) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Your Blitz Commitments
          </CardTitle>
          <CardDescription>
            Manage which blitzes you're attending
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {allBlitzes.map((blitz) => {
            const isCommitted = committedBlitzIds.includes(blitz.id);
            const startDate = new Date(blitz.date);
            const endDate = blitz.endDate ? new Date(blitz.endDate) : startDate;
            const dateStr =
              startDate.toDateString() === endDate.toDateString()
                ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

            return (
              <div
                key={blitz.id}
                className="border rounded-lg p-4 space-y-3"
              >
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
                  </div>
                  <Button
                    size="sm"
                    variant={isCommitted ? "destructive" : "default"}
                    onClick={() => handleBlitzCommit(blitz.id, blitz.name)}
                  >
                    {isCommitted ? "Uncommit" : "Commit"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
        <Sheet open={uncommitDialogOpen} onOpenChange={setUncommitDialogOpen}>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>Uncommit from Blitz?</SheetTitle>
              <SheetDescription>
                Are you sure you want to uncommit from {blitzToUncommit?.name}? You can always commit again later.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-3">
              <Button 
                className="w-full h-12 text-base"
                variant="destructive"
                onClick={confirmUncommit}
              >
                Yes, Uncommit
              </Button>
              <Button 
                className="w-full h-12 text-base"
                variant="outline"
                onClick={() => setUncommitDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </Card>
    );
  }

  // Full team management view for vets with team members
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
          const isExpanded = expandedBlitz === blitz.id;
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
              <div className="border rounded-lg overflow-hidden">
                {/* Collapsed state header */}
                <div 
                  className="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-accent/5 transition-colors"
                  onClick={() => toggleBlitzExpansion(blitz.id)}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{blitz.name}</h3>
                      {isCommitted && (
                        <Badge className="bg-green-500 text-white border-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          Committed
                        </Badge>
                      )}
                      {hasRookiesButNotCommitted && (
                        <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-400">
                          <Flame className="h-3 w-3 mr-1" />
                          Needs Commitment
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
                        <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-semibold">
                          <Flame className="h-4 w-4" />
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
                <CollapsibleContent>
                  <div className="space-y-4 p-4 pt-2">
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
                        const isRookieNotReady = member.year === "Rookie" && readinessStatus !== "Blitz Ready ✓";
                        
                        return (
                          <div
                            key={member.notionPageId}
                            className={`flex items-center justify-between p-2.5 border rounded-lg transition-all ${
                              isUrgentIpad 
                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' 
                                : isRookieNotReady 
                                  ? 'border-accent bg-accent/10 hover:bg-accent/20 cursor-pointer' 
                                  : 'bg-card'
                            }`}
                          >
                            <button
                              onClick={isRookieNotReady ? (e) => openStatusDialog(member, e) : undefined}
                              className={`flex items-center gap-2 flex-1 min-w-0 text-left ${isRookieNotReady ? 'cursor-pointer' : ''}`}
                              disabled={!isRookieNotReady}
                            >
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-medium truncate text-sm ${member.year === "Rookie" ? "text-orange-600 dark:text-orange-400" : ""}`}>
                                    {member.name}
                                  </span>
                                  {isRookieNotReady && (
                                    <Badge variant="outline" className="text-xs bg-accent/20 border-accent text-accent-foreground flex-shrink-0">
                                      Update
                                    </Badge>
                                  )}
                                  {showIpadWarning && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        sendIpadRequestEmail(member);
                                      }}
                                      className="flex-shrink-0 group"
                                      title="Click to email sales assets"
                                    >
                                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 animate-pulse cursor-pointer hover:bg-destructive/80 transition-all group-hover:scale-105 flex items-center gap-1">
                                        <Mail className="h-2.5 w-2.5" />
                                        No iPad
                                      </Badge>
                                    </button>
                                  )}
                                </div>
                                {member.year === "Rookie" && readinessStatus && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {readinessStatus}
                                  </span>
                                )}
                              </div>
                            </button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => promptMemberCommitment(member, blitz.id, true)}
                            >
                              ✕
                            </Button>
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
                          {(() => {
                            const uninvitedCount = uncommittedMembers.filter(
                              member => !(contactedMembers[blitz.id] || []).includes(member.notionPageId)
                            ).length;
                            
                            if (uninvitedCount === 0 && uncommittedMembers.length > 0) {
                              return (
                                <>
                                  {committedMembers.length > 0 ? "Invite More" : "Invite Team Members"}
                                  <Check className="h-4 w-4 ml-2 text-green-500" />
                                </>
                              );
                            }
                            
                            return `${committedMembers.length > 0 ? "Invite More" : "Invite Team Members"} (${uninvitedCount})`;
                          })()}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 pt-2">
                        {uncommittedMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            All team members are already committed to this blitz
                          </p>
                        ) : (
                          uncommittedMembers.map((member) => {
                            const isContactedForThisBlitz = (contactedMembers[blitz.id] || []).includes(member.notionPageId);
                            return (
                              <div
                                key={member.notionPageId}
                                className={`flex items-center justify-between p-2.5 border rounded-lg transition-all ${isContactedForThisBlitz ? 'bg-muted/50 opacity-60' : 'bg-card'}`}
                              >
                                <button
                                  onClick={() => toggleContactedStatus(member.notionPageId, blitz.id)}
                                  className="flex items-center gap-2 flex-1 text-left min-w-0"
                                >
                                  <span className={`font-medium text-sm truncate transition-all ${isContactedForThisBlitz ? 'line-through text-muted-foreground' : ''} ${!isContactedForThisBlitz && member.year === "Rookie" ? "text-orange-600 dark:text-orange-400" : ""}`}>
                                    {member.name}
                                  </span>
                                </button>
                                {!isContactedForThisBlitz && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 px-3 text-xs"
                                    onClick={() => promptMemberCommitment(member, blitz.id, false)}
                                  >
                                    Commit
                                  </Button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                    </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>

      <Sheet open={uncommitDialogOpen} onOpenChange={setUncommitDialogOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Uncommit from Blitz?</SheetTitle>
            <SheetDescription>
              Are you sure you want to uncommit from {blitzToUncommit?.name}? You can always commit again later.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <Button 
              className="w-full h-12 text-base"
              variant="destructive"
              onClick={confirmUncommit}
            >
              Yes, Uncommit
            </Button>
            <Button 
              className="w-full h-12 text-base"
              variant="outline"
              onClick={() => setUncommitDialogOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={commitDialogOpen} onOpenChange={setCommitDialogOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>
              {memberToCommit?.isCommitted ? 'Uncommit Team Member?' : 'Commit Team Member?'}
            </SheetTitle>
            <SheetDescription>
              {memberToCommit?.isCommitted 
                ? `Remove ${memberToCommit.member.name} from this blitz?`
                : `Add ${memberToCommit?.member.name} to this blitz?`
              }
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <Button 
              className="w-full h-12 text-base"
              variant={memberToCommit?.isCommitted ? "destructive" : "default"}
              onClick={confirmMemberCommitment}
            >
              {memberToCommit?.isCommitted ? 'Yes, Uncommit' : 'Yes, Commit'}
            </Button>
            <Button 
              className="w-full h-12 text-base"
              variant="outline"
              onClick={() => setCommitDialogOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Update {selectedRookie?.name}'s Status</SheetTitle>
            <SheetDescription>
              Select the last stage they've completed
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-6">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="text-base">
                <SelectValue placeholder="Select completed stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Started">✓ Started</SelectItem>
                <SelectItem value="Onboarding ✅">✓ Onboarding</SelectItem>
                <SelectItem value="Trainings ✅">✓ Required Trainings</SelectItem>
                <SelectItem value="Slack ✅">✓ Slack</SelectItem>
                <SelectItem value="Phase 1 ✅">✓ Phase 1</SelectItem>
                <SelectItem value="Phase 2 ✅">✓ Phase 2</SelectItem>
                <SelectItem value="Phase 3 ✅">✓ Phase 3</SelectItem>
                <SelectItem value="Phase 4 ✅">✓ Phase 4 (Blitz Ready)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={updateRookieStatus} className="flex-1">
              Update Status
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
};
