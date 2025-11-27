import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Check, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string;
  location: string;
}

interface TeamMember {
  notionPageId: string;
  name: string;
  email: string;
  phone: string;
  onboardingStatus: string;
  blitzReady: boolean;
  ipadAssigned: boolean;
  committedBlitzes: string[];
  year: string;
}

interface VetTeamBlitzCardProps {
  repData: any;
  allBlitzes: BlitzEvent[];
}

export const VetTeamBlitzCard = ({ repData, allBlitzes }: VetTeamBlitzCardProps) => {
  const [selectedBlitzId, setSelectedBlitzId] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactedMembers, setContactedMembers] = useState<Record<string, string[]>>({});

  // Get next upcoming blitz as default
  const nextBlitz = allBlitzes.length > 0 ? allBlitzes[0] : null;

  useEffect(() => {
    if (nextBlitz && !selectedBlitzId) {
      setSelectedBlitzId(nextBlitz.id);
    }
  }, [nextBlitz, selectedBlitzId]);

  useEffect(() => {
    if (repData?.notion_page_id) {
      fetchTeamMembers();
      // Load contacted members from database
      if (repData.contacted_for_blitz) {
        setContactedMembers(repData.contacted_for_blitz);
      }
    }
  }, [repData]);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('fetch-team-members', {
        body: { leaderNotionPageId: repData.notion_page_id }
      });

      if (error) throw error;

      setTeamMembers(data.teamMembers || []);
    } catch (error: any) {
      console.error("Error fetching team members:", error);
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const selectedBlitz = allBlitzes.find(b => b.id === selectedBlitzId);
  
  // Filter out the leader themselves from the team members list
  const filteredTeamMembers = teamMembers.filter(member => 
    member.notionPageId !== repData.notion_page_id
  );
  
  // Sort by year (Rookie first) then alphabetically
  const sortTeamMembers = (members: TeamMember[]) => {
    return [...members].sort((a, b) => {
      // Rookies first
      if (a.year === "Rookie" && b.year !== "Rookie") return -1;
      if (a.year !== "Rookie" && b.year === "Rookie") return 1;
      // Then alphabetically by name
      return a.name.localeCompare(b.name);
    });
  };
  
  const committedMembers = sortTeamMembers(
    filteredTeamMembers.filter(member =>
      member.committedBlitzes.includes(selectedBlitzId)
    )
  );
  const uncommittedMembers = sortTeamMembers(
    filteredTeamMembers.filter(member =>
      !member.committedBlitzes.includes(selectedBlitzId)
    )
  );

  const toggleMemberCommitment = async (member: TeamMember, isCommitted: boolean) => {
    try {
      const updatedBlitzes = isCommitted
        ? member.committedBlitzes.filter(id => id !== selectedBlitzId)
        : [...member.committedBlitzes, selectedBlitzId];

      // Optimistically update UI
      setTeamMembers(prev =>
        prev.map(m =>
          m.notionPageId === member.notionPageId
            ? { ...m, committedBlitzes: updatedBlitzes }
            : m
        )
      );

      const { error } = await supabase.functions.invoke('update-blitz-commitment', {
        body: {
          repNotionPageId: member.notionPageId,
          blitzPageIds: updatedBlitzes
        }
      });

      if (error) throw error;

      toast.success(isCommitted
        ? `${member.name} uncommitted from ${selectedBlitz?.name}`
        : `${member.name} committed to ${selectedBlitz?.name}`
      );
    } catch (error: any) {
      console.error("Error updating commitment:", error);
      toast.error("Failed to update commitment");
      // Revert on error
      fetchTeamMembers();
    }
  };

  const toggleContactedStatus = async (memberPageId: string) => {
    const currentContacted = contactedMembers[selectedBlitzId] || [];
    const isContacted = currentContacted.includes(memberPageId);

    const updatedContacted = isContacted
      ? currentContacted.filter(id => id !== memberPageId)
      : [...currentContacted, memberPageId];

    const newContactedState = {
      ...contactedMembers,
      [selectedBlitzId]: updatedContacted
    };

    setContactedMembers(newContactedState);

    try {
      const { error } = await supabase
        .from('reps')
        .update({ contacted_for_blitz: newContactedState })
        .eq('user_id', repData.user_id);

      if (error) throw error;
    } catch (error: any) {
      console.error("Error updating contacted status:", error);
      toast.error("Failed to update contacted status");
      // Revert on error
      setContactedMembers(contactedMembers);
    }
  };

  const sendIpadRequestEmail = (member: TeamMember) => {
    const subject = `iPad Request for ${member.name} - ${selectedBlitz?.name}`;
    const body = `Hi,%0A%0APlease assign an iPad to ${member.name} for the ${selectedBlitz?.name} blitz (${selectedBlitz?.date} - ${selectedBlitz?.endDate}).%0A%0AThank you!`;
    window.location.href = `mailto:salesassets@vivint.com?cc=Calvin.Schofield@vivint.com&subject=${encodeURIComponent(subject)}&body=${body}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            My Team's Blitz Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (allBlitzes.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          My Team's Blitz Status
        </CardTitle>
        <CardDescription>
          Manage your team's blitz commitments and readiness
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedBlitzId} onValueChange={setSelectedBlitzId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a blitz" />
          </SelectTrigger>
          <SelectContent>
            {allBlitzes.map(blitz => (
              <SelectItem key={blitz.id} value={blitz.id}>
                {blitz.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {committedMembers.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {committedMembers.length} team {committedMembers.length === 1 ? 'member' : 'members'} committed
            </p>
            {committedMembers.map(member => (
              <div
                key={member.notionPageId}
                className="border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {member.year === "Rookie" && (
                      <Badge className="bg-orange-500 text-white border-orange-600">
                        🔥 Rookie
                      </Badge>
                    )}
                    <span className={`font-medium ${member.year === "Rookie" ? "text-orange-600 dark:text-orange-400" : ""}`}>
                      {member.name}
                    </span>
                    {member.year === "Rookie" && (
                      <>
                        {member.blitzReady ? (
                          <Badge variant="default" className="bg-green-500">
                            <Check className="h-3 w-3 mr-1" />
                            Ready
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-orange-500/20 text-orange-700 dark:text-orange-400">
                            {member.onboardingStatus || "In Progress"}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleMemberCommitment(member, true)}
                  >
                    Uncommit
                  </Button>
                </div>
                
                {!member.ipadAssigned && (
                  <div className="flex items-center justify-between">
                    <Badge variant="destructive" className="text-xs">
                      No iPad
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendIpadRequestEmail(member)}
                    >
                      <Mail className="h-4 w-4 mr-1" />
                      Request iPad
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No team members committed yet. Reach out to invite them:
            </p>
            <div className="space-y-2">
              {uncommittedMembers.map(member => {
                const isContacted = (contactedMembers[selectedBlitzId] || []).includes(member.notionPageId);
                return (
                  <div
                    key={member.notionPageId}
                    className="border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleContactedStatus(member.notionPageId)}
                  >
                    <div className="flex items-center gap-2">
                      {isContacted && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                      <span className={isContacted ? "text-muted-foreground" : ""}>
                        {member.name}
                      </span>
                    </div>
                    {isContacted && (
                      <Badge variant="outline" className="text-xs">
                        Contacted
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
