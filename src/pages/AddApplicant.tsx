import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { EdgeSwipeContainer } from "@/components/EdgeSwipeContainer";

const STAGES = ["Evaluating", "Signed"] as const;

export default function AddApplicant() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: teamAccess, isLoading: teamAccessLoading } = useTeamAccess();

  // Pre-fill from URL params
  const [name, setName] = useState(searchParams.get("name") || "");
  const [phone, setPhone] = useState(searchParams.get("phone") || "");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [stage, setStage] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState(false);

  // Check auth
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  // Fetch teams the user has access to
  const { data: teams } = useQuery({
    queryKey: ["accessible-teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name, lead_user_id");
      if (error) throw error;
      return data || [];
    },
    enabled: !!session,
  });

  // Fetch all reps to find team members
  const { data: allReps } = useQuery({
    queryKey: ["all-reps-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select("id, name, user_id, team_leader, email");
      if (error) throw error;
      return data || [];
    },
    enabled: !!session,
  });

  // Filter teams to ones the user can access
  const accessibleTeams = useMemo(() => {
    if (!teams || !teamAccess) return [];
    // Area directors can see all teams
    if (teamAccess.accessLevel === "area_director") return teams;
    // Get team IDs from the teams array in teamAccess
    const accessibleTeamIds = teamAccess.teams?.map((t) => t.id) || [];
    return teams.filter((t) => accessibleTeamIds.includes(t.id));
  }, [teams, teamAccess]);

  // Get potential recruiters based on selected team
  const potentialRecruiters = useMemo(() => {
    if (!allReps || !selectedTeamId || !teams) return [];
    
    const selectedTeam = teams.find((t) => t.id === selectedTeamId);
    if (!selectedTeam) return [];

    // Find the team lead
    const teamLead = allReps.find((r) => r.user_id === selectedTeam.lead_user_id);
    if (!teamLead) return [];

    // Get team lead name for matching
    const teamLeadName = teamLead.name?.replace(/[^\w\s]/g, "").trim().split(" ")[0].toLowerCase();

    // Find all reps whose team_leader matches this team lead
    const teamMembers = allReps.filter((rep) => {
      if (!rep.team_leader) return false;
      const repTeamLeader = rep.team_leader.replace(/[^\w\s]/g, "").trim().split(" ")[0].toLowerCase();
      return repTeamLeader === teamLeadName || rep.user_id === selectedTeam.lead_user_id;
    });

    // Include the team lead themselves
    if (!teamMembers.find((m) => m.user_id === selectedTeam.lead_user_id)) {
      teamMembers.unshift(teamLead);
    }

    return teamMembers.filter((r) => r.user_id); // Only reps with user_id can be recruiters
  }, [allReps, selectedTeamId, teams]);

  // Reset recruiter when team changes
  useEffect(() => {
    setSelectedRecruiterId("");
  }, [selectedTeamId]);

  // Create recruit mutation
  const createRecruitMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Find the team's mgmt_group_id
      const { data: teamMgmtGroup } = await supabase
        .from("team_mgmt_groups")
        .select("mgmt_group_id")
        .eq("team_id", selectedTeamId)
        .single();

      const { data, error } = await supabase.functions.invoke("create-recruit", {
        body: {
          name,
          phone: phone || null,
          email: email || null,
          stage,
          teamId: selectedTeamId,
          mgmtGroupId: teamMgmtGroup?.mgmt_group_id || null,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      // Handle duplicate email error specifically
      if (data?.duplicateEmail) {
        throw new Error(data.error);
      }
      if (data?.error) throw new Error(data.error);

      // Update the recruiter_user_id if different from current user
      if (selectedRecruiterId && data.recruitId) {
        const { error: updateError } = await supabase
          .from("recruits")
          .update({ recruiter_user_id: selectedRecruiterId })
          .eq("id", data.recruitId);

        if (updateError) {
          console.error("Failed to update recruiter:", updateError);
        }
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch group-recruits immediately
      queryClient.invalidateQueries({ queryKey: ["group-recruits"] });
      queryClient.refetchQueries({ queryKey: ["group-recruits"] });
      setIsSuccess(true);
      toast.success(`${name} added successfully!`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to add applicant");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!stage) {
      toast.error("Please select a stage");
      return;
    }
    if (!selectedTeamId) {
      toast.error("Please select a team");
      return;
    }
    if (!selectedRecruiterId) {
      toast.error("Please select a recruiter");
      return;
    }
    createRecruitMutation.mutate();
  };

  // Loading state
  if (sessionLoading || teamAccessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Sign In Required</h1>
          <p className="text-muted-foreground">
            Please sign in to add this applicant to your team.
          </p>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6"
        >
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{name} Added!</h1>
            <p className="text-muted-foreground mt-2">
              Stage: <span className="font-medium text-foreground">{stage}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/mygroup")}>
              View My Group
            </Button>
            <Button onClick={() => {
              setIsSuccess(false);
              setName("");
              setPhone("");
              setEmail("");
              setStage("");
              setSelectedTeamId("");
              setSelectedRecruiterId("");
            }}>
              Add Another
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <EdgeSwipeContainer>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Add Applicant</h1>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6 max-w-md mx-auto">
        <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-xl">
          <UserPlus className="w-6 h-6 text-primary" />
          <div>
            <p className="font-medium">New Team Applicant</p>
            <p className="text-sm text-muted-foreground">
              From landing page form
            </p>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            type="tel"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            type="email"
          />
        </div>

        {/* Stage */}
        <div className="space-y-2">
          <Label>Stage *</Label>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger>
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Team */}
        <div className="space-y-2">
          <Label>Team *</Label>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger>
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              {accessibleTeams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Recruiter */}
        <div className="space-y-2">
          <Label>Recruiter *</Label>
          <Select
            value={selectedRecruiterId}
            onValueChange={setSelectedRecruiterId}
            disabled={!selectedTeamId}
          >
            <SelectTrigger>
              <SelectValue placeholder={selectedTeamId ? "Select recruiter" : "Select a team first"} />
            </SelectTrigger>
            <SelectContent>
              {potentialRecruiters.map((rep) => (
                <SelectItem key={rep.user_id} value={rep.user_id!}>
                  {rep.name?.replace(/[^\w\s]/g, "").trim()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTeamId && potentialRecruiters.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No recruiters found for this team
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full"
          disabled={createRecruitMutation.isPending}
        >
          {createRecruitMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              Add to Team
            </>
          )}
        </Button>
      </form>
    </EdgeSwipeContainer>
  );
}
