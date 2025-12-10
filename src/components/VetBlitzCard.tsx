import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown, ChevronUp, Check, Mail, Users, Flame, ChevronRight, MessageCircle, Phone } from "lucide-react";
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
  isLoadingBlitzes?: boolean;
  isLoadingTeam?: boolean;
  onTeamMemberUpdate?: (notionPageId: string, updates: Partial<TeamMember>) => void;
  onCommitmentChange?: () => void;
  accessLevel?: 'area_director' | 'mgmt_group_lead' | 'team_lead' | 'none';
  mgmtGroups?: Array<{ id: string; name: string }>;
  teams?: Array<{ id: string; name: string }>;
}

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  address1?: string | null;
  wifi1?: string | null;
  code1?: string | null;
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
  teamId?: string | null;
  teamName?: string | null;
}

// Polished invite member row with contact actions
const InviteMemberRow = ({ 
  member, 
  blitzId,
  isContacted, 
  isDeclined,
  onToggleContacted,
  onCommit,
  onToggleDeclined,
}: {
  member: TeamMember;
  blitzId: string;
  isContacted: boolean;
  isDeclined: boolean;
  onToggleContacted: () => void;
  onCommit: () => void;
  onToggleDeclined: () => void;
}) => {
  const phone = member.phone?.replace(/\D/g, '') || '';
  const hasPhone = phone.length >= 10;
  
  const handleText = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasPhone) {
      window.location.href = `sms:${phone}`;
      // Also mark as contacted
      onToggleContacted();
    }
  };
  
  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasPhone) {
      window.location.href = `tel:${phone}`;
      // Also mark as contacted
      onToggleContacted();
    }
  };
  
  if (isDeclined) {
    return (
      <div className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/30 border-border/50 opacity-60">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-destructive text-xs">✕</span>
          <span className="font-medium text-sm truncate line-through text-muted-foreground">
            {member.name}
          </span>
          <span className="text-xs text-muted-foreground">(declined)</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={onToggleDeclined}
        >
          Undo
        </Button>
      </div>
    );
  }
  
  if (isContacted) {
    return (
      <div className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/30 border-border/50 opacity-70">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Check className="h-3.5 w-3.5 text-green-500" />
          <span className="font-medium text-sm truncate text-muted-foreground">
            {member.name}
          </span>
          <span className="text-xs text-green-600 dark:text-green-400">contacted</span>
        </div>
        <div className="flex items-center gap-1">
          {hasPhone && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                onClick={handleText}
                title="Send text message"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-green-600 hover:bg-green-500/10"
                onClick={handleCall}
                title="Call"
              >
                <Phone className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-between p-2.5 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={`font-medium text-sm truncate ${
          member.year === "Rookie" 
            ? "text-orange-600 dark:text-orange-400" 
            : ""
        }`}>
          {member.name}
        </span>
        {member.year === "Rookie" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium">
            Rookie
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {hasPhone && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
              onClick={handleText}
              title="Send text message"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-green-600 hover:bg-green-500/10"
              onClick={handleCall}
              title="Call"
            >
              <Phone className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="default"
          className="h-7 px-3 text-xs ml-1"
          onClick={onCommit}
        >
          Commit
        </Button>
      </div>
    </div>
  );
};

export const VetBlitzCard = ({ repData, allBlitzes, teamMembers: propTeamMembers, isTeamLead: propIsTeamLead, isLoadingBlitzes = false, isLoadingTeam = false, onTeamMemberUpdate, onCommitmentChange, accessLevel = 'none', mgmtGroups = [], teams = [] }: VetBlitzCardProps) => {
  const { toast } = useToast();
  const [committedBlitzIds, setCommittedBlitzIds] = useState<string[]>([]);
  const [expandedBlitz, setExpandedBlitz] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(propTeamMembers);
  const [contactedMembers, setContactedMembers] = useState<{ [blitzId: string]: string[] }>({});
  const [declinedMembers, setDeclinedMembers] = useState<{ [blitzId: string]: string[] }>({});
  const [expandedInviteLists, setExpandedInviteLists] = useState<Set<string>>(new Set());
  const [uncommitDialogOpen, setUncommitDialogOpen] = useState(false);
  const [blitzToUncommit, setBlitzToUncommit] = useState<{ id: string; name: string } | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedRookie, setSelectedRookie] = useState<TeamMember | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [memberToCommit, setMemberToCommit] = useState<{ member: TeamMember; blitzId: string; isCommitted: boolean } | null>(null);
  // Default to highest access level available
  const getDefaultScope = (): 'you' | 'team' | 'mgmt' | 'office' => {
    if (accessLevel === 'area_director') return 'office';
    if (accessLevel === 'mgmt_group_lead') return 'mgmt';
    if (accessLevel === 'team_lead') return 'team';
    return 'you';
  };
  const [attendanceScope, setAttendanceScope] = useState<'you' | 'team' | 'mgmt' | 'office'>(getDefaultScope());
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false); // Prevent rapid clicks
  
  // Track pending updates to prevent stale data overwrites
  const pendingCommitmentsRef = useRef<Set<string>>(new Set());
  
  // Track last fetched scope to prevent prop overwrites
  const lastFetchedScopeRef = useRef<string>("");
  // Fetch team members and contacted status based on attendance scope
  const fetchAttendanceData = useCallback(async () => {
    if (!repData?.notion_page_id) return;

    setLoadingAttendance(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('fetch-blitz-attendance', {
        body: {
          scope: attendanceScope,
          leaderNotionPageId: repData.notion_page_id,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      console.log('Attendance data received:', data);

      if (data) {
        // Track that we've fetched for this scope
        lastFetchedScopeRef.current = attendanceScope;
        
        if (attendanceScope === 'you') {
          // Personal view - show no team members
          setTeamMembers([]);
        } else {
          // Filter out the leader themselves from team list
          const filteredMembers = (data.teamMembers || []).filter(
            (member: TeamMember) => member.notionPageId !== repData.notion_page_id
          );
          console.log(`Filtered ${filteredMembers.length} team members for scope: ${attendanceScope}`);
          setTeamMembers(filteredMembers);
        }
        
        // Set contacted members from shared blitz_invites table
        setContactedMembers(data.contactedForBlitz || {});
        
        // Set declined members from shared blitz_declines table
        setDeclinedMembers(data.declinedForBlitz || {});
      }
    } catch (error: any) {
      console.error('Error fetching attendance data:', error);
      toast({
        title: "Error loading attendance",
        description: error.message || "Could not load team attendance data. Please try switching scopes or refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoadingAttendance(false);
    }
  }, [repData?.notion_page_id, attendanceScope, toast]);

  // Only refetch when scope changes or on mount, not on every repData change
  // Fetch attendance when scope changes - use ref to prevent redundant fetches
  const lastScopeRef = useRef<string>("");
  useEffect(() => {
    const scopeKey = `${attendanceScope}`;
    if (scopeKey === lastScopeRef.current) return; // Skip if scope didn't change
    lastScopeRef.current = scopeKey;
    
    fetchAttendanceData();
  }, [attendanceScope]); // Removed fetchAttendanceData from deps to prevent constant refetching

  // Load committed blitzes from repData - only update when actually different and no pending updates
  const lastCommittedBlitzesRef = useRef<string>("");
  useEffect(() => {
    // Don't overwrite state while an update is in progress or while we have pending commitments
    if (isUpdating || pendingCommitmentsRef.current.size > 0) return;
    
    const currentHash = JSON.stringify(repData?.committed_blitzes);
    if (currentHash === lastCommittedBlitzesRef.current) return; // Skip if no change
    lastCommittedBlitzesRef.current = currentHash;
    
    if (repData?.committed_blitzes && Array.isArray(repData.committed_blitzes)) {
      const committedIds = repData.committed_blitzes
        .map((b: any) => b.id)
        .filter((id: string) => id != null && id !== "");
      setCommittedBlitzIds(committedIds);
    } else {
      setCommittedBlitzIds([]);
    }
  }, [repData?.committed_blitzes, isUpdating]);

  // Only use propTeamMembers for initial 'you' scope - fetched data takes precedence for other scopes
  // This prevents the fetched attendance data from being overwritten by stale props
  useEffect(() => {
    // Don't overwrite if we've already fetched data for a non-'you' scope
    if (lastFetchedScopeRef.current && lastFetchedScopeRef.current !== 'you') {
      return;
    }
    // For 'you' scope, we don't show team members
    if (attendanceScope === 'you') {
      setTeamMembers([]);
    }
  }, [propTeamMembers, attendanceScope]);

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
    if (isUpdating) return; // Prevent rapid clicks
    
    const isCurrentlyCommitted = committedBlitzIds.includes(blitzId);

    if (isCurrentlyCommitted) {
      // Show confirmation dialog for uncommit
      setBlitzToUncommit({ id: blitzId, name: blitzName });
      setUncommitDialogOpen(true);
      return;
    }

    // Track pending update to prevent stale data overwrite
    pendingCommitmentsRef.current.add(blitzId);
    
    // Optimistic update for commit
    setIsUpdating(true);
    const newCommittedIds = [...committedBlitzIds, blitzId];
    setCommittedBlitzIds(newCommittedIds);

    try {
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
      
      // Trigger parent refetch (delayed in parent)
      onCommitmentChange?.();
      
      // Clear pending update after grace period
      setTimeout(() => {
        pendingCommitmentsRef.current.delete(blitzId);
      }, 5000);
    } catch (error) {
      console.error('Error updating commitment:', error);
      // Revert optimistic update on error
      setCommittedBlitzIds(committedBlitzIds.filter(id => id !== blitzId));
      pendingCommitmentsRef.current.delete(blitzId);
      toast({
        title: "Update failed",
        description: "Could not update your commitment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmUncommit = async () => {
    if (!blitzToUncommit) return;

    // Track pending update
    pendingCommitmentsRef.current.add(blitzToUncommit.id);
    
    // Optimistic update
    const originalCommittedIds = [...committedBlitzIds];
    const newCommittedIds = committedBlitzIds.filter(id => id !== blitzToUncommit.id);
    setCommittedBlitzIds(newCommittedIds);

    const blitzIdToRemove = blitzToUncommit.id;
    const blitzNameToRemove = blitzToUncommit.name;
    
    // Close dialog immediately for snappy UX
    setUncommitDialogOpen(false);
    setBlitzToUncommit(null);

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
        description: `Removed from ${blitzNameToRemove}`,
      });
      
      // Trigger parent refetch (delayed in parent)
      onCommitmentChange?.();
      
      // Clear pending update after grace period
      setTimeout(() => {
        pendingCommitmentsRef.current.delete(blitzIdToRemove);
      }, 5000);
    } catch (error) {
      console.error('Error updating commitment:', error);
      // Revert on error
      setCommittedBlitzIds(originalCommittedIds);
      pendingCommitmentsRef.current.delete(blitzIdToRemove);
      toast({
        title: "Update failed",
        description: "Could not update your commitment. Please try again.",
        variant: "destructive",
      });
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

      // If committing (not uncommitting), clear any decline record
      if (!isCommitted) {
        await supabase.functions.invoke('toggle-blitz-decline', {
          body: {
            blitzId,
            repNotionPageId: member.notionPageId,
            isDeclined: false,
          },
        });
        
        // Update local declinedMembers state
        setDeclinedMembers(prev => ({
          ...prev,
          [blitzId]: (prev[blitzId] || []).filter(id => id !== member.notionPageId),
        }));
      }

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

    // Optimistic update
    setContactedMembers(newContactedMembers);

    try {
      const { error } = await supabase.functions.invoke('toggle-blitz-invite', {
        body: {
          blitzId,
          repNotionPageId: memberId,
          isContacted: !isContacted,
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating contacted status:', error);
      // Revert on error
      setContactedMembers(contactedMembers);
      toast({
        title: "Update failed",
        description: "Could not update contacted status",
        variant: "destructive",
      });
    }
  };

  const toggleDeclinedStatus = async (memberId: string, blitzId: string) => {
    const currentDeclined = declinedMembers[blitzId] || [];
    const isDeclined = currentDeclined.includes(memberId);
    const newDeclined = isDeclined
      ? currentDeclined.filter(id => id !== memberId)
      : [...currentDeclined, memberId];

    // Optimistic update
    setDeclinedMembers(prev => ({
      ...prev,
      [blitzId]: newDeclined,
    }));

    try {
      const { error } = await supabase.functions.invoke('toggle-blitz-decline', {
        body: {
          blitzId,
          repNotionPageId: memberId,
          isDeclined: !isDeclined,
        },
      });

      if (error) throw error;
      
      toast({
        title: isDeclined ? "Decline removed" : "Marked as declined",
        description: isDeclined 
          ? "Team member is back in the invite list"
          : "Team member marked as declined for this blitz",
      });
    } catch (error) {
      console.error('Error updating declined status:', error);
      // Revert on error
      setDeclinedMembers(prev => ({
        ...prev,
        [blitzId]: currentDeclined,
      }));
      toast({
        title: "Update failed",
        description: "Could not update declined status",
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


  // Show skeleton loading state when blitzes are loading
  if (isLoadingBlitzes) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Blitz Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
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

  // Get available scope options based on access level
  const getScopeOptions = () => {
    if (accessLevel === 'area_director') {
      return [
        { value: 'you', label: 'You' },
        { value: 'team', label: 'Team' },
        { value: 'mgmt', label: 'MGMT' },
        { value: 'office', label: 'Office' },
      ];
    } else if (accessLevel === 'mgmt_group_lead') {
      return [
        { value: 'you', label: 'You' },
        { value: 'team', label: 'Team' },
        { value: 'mgmt', label: 'MGMT' },
      ];
    } else {
      // Team lead
      return [
        { value: 'you', label: 'You' },
        { value: 'team', label: 'Team' },
      ];
    }
  };

  const handleScopeChange = (value: string) => {
    if (loadingAttendance) return;
    setAttendanceScope(value as 'you' | 'team' | 'mgmt' | 'office');
  };

  // Simplified personal view for non-team leads OR when scope is 'you'
  if (!propIsTeamLead || attendanceScope === 'you') {
    return (
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {propIsTeamLead ? 'Blitz Management' : 'Your Blitz Commitments'}
              </CardTitle>
              <CardDescription>
                {propIsTeamLead ? 'Manage your commitments and team attendance' : 'Manage which blitzes you\'re attending'}
              </CardDescription>
            </div>
            
            {/* Scope selector dropdown - only for leaders */}
            {propIsTeamLead && (
              <Select
                value={attendanceScope}
                onValueChange={handleScopeChange}
                disabled={loadingAttendance}
              >
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getScopeOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
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
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  isUpdating ? 'opacity-50 pointer-events-none' : 'hover:bg-accent/5'
                }`}
                onClick={() => handleBlitzCommit(blitz.id, blitz.name)}
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

  // Full team management view for leaders with team scope
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Blitz Management
            </CardTitle>
            <CardDescription>
              Manage your commitments and team attendance
            </CardDescription>
          </div>
          
          {/* Scope selector dropdown */}
          <Select
            value={attendanceScope}
            onValueChange={handleScopeChange}
            disabled={loadingAttendance}
          >
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getScopeOptions().map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 relative">
        {/* Professional loading overlay during sync */}
        {loadingAttendance && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <div className="flex flex-col items-center gap-3 bg-card/95 px-6 py-4 rounded-xl shadow-lg border border-border/50">
              <div className="relative">
                <div className="h-8 w-8 rounded-full border-2 border-primary/20"></div>
                <div className="absolute inset-0 h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-medium text-foreground">Syncing from Notion</span>
                <span className="text-xs text-muted-foreground">Fetching latest data...</span>
              </div>
            </div>
          </div>
        )}
        
        {teamMembers.length === 0 && !loadingAttendance && (
          <Alert className="bg-muted/50">
            <AlertDescription className="text-sm">
              {attendanceScope === 'team' && "No team members found. Make sure you have reps assigned to your team in Notion."}
              {attendanceScope === 'mgmt' && "No management group members found. Verify your MGMT group assignments in Notion."}
              {attendanceScope === 'office' && "No office members found. Check team and MGMT group structures in Notion."}
            </AlertDescription>
          </Alert>
        )}
        
        {!loadingAttendance && allBlitzes.map((blitz) => {
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

                  {/* Invite list for uncommitted members - only show if there are uncommitted members */}
                  {uncommittedMembers.length > 0 && (
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
                              
                              if (uninvitedCount === 0) {
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
                      <CollapsibleContent className="space-y-3 pt-3">
                        {uncommittedMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            All team members are already committed to this blitz
                          </p>
                        ) : (
                          (() => {
                            // Group members by team for MGMT and AD views
                            const shouldGroupByTeam = accessLevel === 'area_director' || accessLevel === 'mgmt_group_lead';
                            
                            if (shouldGroupByTeam) {
                              // Group by team
                              const teamGroups: { [teamName: string]: typeof uncommittedMembers } = {};
                              uncommittedMembers.forEach(member => {
                                const teamName = member.teamName || 'Other';
                                if (!teamGroups[teamName]) {
                                  teamGroups[teamName] = [];
                                }
                                teamGroups[teamName].push(member);
                              });
                              
                              // Sort teams alphabetically, sort members within each team alphabetically
                              const sortedTeamNames = Object.keys(teamGroups).sort((a, b) => a.localeCompare(b));
                              
                              return (
                                <div className="space-y-4">
                                  {sortedTeamNames.map(teamName => {
                                    const teamMembers = teamGroups[teamName].sort((a, b) => a.name.localeCompare(b.name));
                                    const teamUninvitedCount = teamMembers.filter(
                                      m => !(contactedMembers[blitz.id] || []).includes(m.notionPageId) &&
                                           !(declinedMembers[blitz.id] || []).includes(m.notionPageId)
                                    ).length;
                                    
                                    return (
                                      <Collapsible key={teamName} defaultOpen={teamUninvitedCount > 0}>
                                        <CollapsibleTrigger className="w-full">
                                          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                                            <div className="flex items-center gap-2">
                                              <Users className="h-4 w-4 text-muted-foreground" />
                                              <span className="font-medium text-sm">{teamName}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {teamUninvitedCount > 0 ? (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                                  {teamUninvitedCount} to invite
                                                </span>
                                              ) : (
                                                <Check className="h-4 w-4 text-green-500" />
                                              )}
                                              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                                            </div>
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="space-y-2 pt-2 pl-2">
                                          {teamMembers.map(member => (
                                            <InviteMemberRow 
                                              key={member.notionPageId}
                                              member={member}
                                              blitzId={blitz.id}
                                              isContacted={(contactedMembers[blitz.id] || []).includes(member.notionPageId)}
                                              isDeclined={(declinedMembers[blitz.id] || []).includes(member.notionPageId)}
                                              onToggleContacted={() => toggleContactedStatus(member.notionPageId, blitz.id)}
                                              onCommit={() => promptMemberCommitment(member, blitz.id, false)}
                                              onToggleDeclined={() => toggleDeclinedStatus(member.notionPageId, blitz.id)}
                                            />
                                          ))}
                                        </CollapsibleContent>
                                      </Collapsible>
                                    );
                                  })}
                                </div>
                              );
                            } else {
                              // Flat list for team leads - sorted alphabetically
                              const sortedMembers = [...uncommittedMembers].sort((a, b) => a.name.localeCompare(b.name));
                              return (
                                <div className="space-y-2">
                                  {sortedMembers.map(member => (
                                    <InviteMemberRow 
                                      key={member.notionPageId}
                                      member={member}
                                      blitzId={blitz.id}
                                      isContacted={(contactedMembers[blitz.id] || []).includes(member.notionPageId)}
                                      isDeclined={(declinedMembers[blitz.id] || []).includes(member.notionPageId)}
                                      onToggleContacted={() => toggleContactedStatus(member.notionPageId, blitz.id)}
                                      onCommit={() => promptMemberCommitment(member, blitz.id, false)}
                                      onToggleDeclined={() => toggleDeclinedStatus(member.notionPageId, blitz.id)}
                                    />
                                  ))}
                                </div>
                              );
                            }
                          })()
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                  )}
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
