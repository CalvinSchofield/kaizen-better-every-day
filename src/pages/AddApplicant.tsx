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

// Stages that qualify a rep to be a recruiter
const RECRUITER_QUALIFYING_STAGES = [
  "Signed",
  "Shadow ✅",
  "Sold 💲",
  "Sold (5+) 💰",
];

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
  const [hasManuallyChangedTeam, setHasManuallyChangedTeam] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Check auth
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  // Get current user's rep info (for auto-populating team/recruiter)
  const { data: currentUserRep } = useQuery({
    queryKey: ["current-user-rep"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase
        .from("reps")
        .select("id, name, user_id, team_leader")
        .eq("user_id", session.user.id)
        .single();
      return data;
    },
    enabled: !!session,
  });

  // Get the current user's team ID from the teams table
  const { data: currentUserTeamId } = useQuery({
    queryKey: ["current-user-team-id"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      // Find team where user is lead
      const { data: leadTeam } = await supabase
        .from("teams")
        .select("id")
        .eq("lead_user_id", session.user.id)
        .maybeSingle();
      if (leadTeam) return leadTeam.id;
      // Otherwise find team via accessible teams
      const { data: teamIds } = await supabase.rpc("get_accessible_team_ids", {
        _user_id: session.user.id,
      });
      return teamIds?.[0] || null;
    },
    enabled: !!session,
  });

  // Use teams from teamAccess (already properly scoped to user's downline)
  const accessibleTeams = useMemo(() => {
    if (!teamAccess?.teams) return [];
    return teamAccess.teams.map((t) => ({ id: t.id, name: t.name }));
  }, [teamAccess]);

  // Fetch eligible recruiters for the selected team
  // Includes ALL reps at qualifying stages on that team (including ghost reps)
  const { data: eligibleRecruiters = [] } = useQuery({
    queryKey: ["eligible-recruiters", selectedTeamId],
    queryFn: async () => {
      if (!selectedTeamId) return [];

      // Get team lead info
      const { data: team } = await supabase
        .from("teams")
        .select("lead_user_id")
        .eq("id", selectedTeamId)
        .single();

      if (!team) return [];

      // Find the team lead rep
      const { data: teamLeadRep } = await supabase
        .from("reps")
        .select("id, name, user_id")
        .eq("user_id", team.lead_user_id)
        .maybeSingle();

      if (!teamLeadRep) return [];

      const teamLeadName = teamLeadRep.name
        ?.replace(/[^\w\s]/g, "")
        .trim()
        .split(" ")[0]
        .toLowerCase();

      // Find all reps on this team (team_leader matches) at qualifying stages
      const { data: reps } = await supabase
        .from("reps")
        .select("id, name, user_id, team_leader, stage")
        .in("stage", RECRUITER_QUALIFYING_STAGES);

      if (!reps) return [];

      // Filter to reps on this team
      const teamReps = reps.filter((rep) => {
        if (!rep.team_leader) return rep.user_id === team.lead_user_id;
        const repLeader = rep.team_leader
          .replace(/[^\w\s]/g, "")
          .trim()
          .split(" ")[0]
          .toLowerCase();
        return repLeader === teamLeadName || rep.user_id === team.lead_user_id;
      });

      // Also include the team lead themselves (even if not at a qualifying stage)
      if (!teamReps.find((r) => r.user_id === team.lead_user_id) && teamLeadRep.user_id) {
        teamReps.unshift({ ...teamLeadRep, stage: "Team Lead", team_leader: "" });
      }

      return teamReps;
    },
    enabled: !!selectedTeamId,
  });

  // Auto-populate team and recruiter on first load
  useEffect(() => {
    if (!hasManuallyChangedTeam && currentUserTeamId && accessibleTeams.length > 0) {
      const userTeamExists = accessibleTeams.some((t) => t.id === currentUserTeamId);
      if (userTeamExists && !selectedTeamId) {
        setSelectedTeamId(currentUserTeamId);
      }
    }
  }, [currentUserTeamId, accessibleTeams, hasManuallyChangedTeam, selectedTeamId]);

  // Auto-select current user as recruiter when their team is selected
  useEffect(() => {
    if (
      !hasManuallyChangedTeam &&
      selectedTeamId &&
      currentUserTeamId === selectedTeamId &&
      session?.user?.id &&
      eligibleRecruiters.length > 0 &&
      !selectedRecruiterId
    ) {
      // Check if current user is in the eligible list
      const currentUserInList = eligibleRecruiters.find(
        (r) => r.user_id === session.user.id
      );
      if (currentUserInList?.user_id) {
        setSelectedRecruiterId(currentUserInList.user_id);
      }
    }
  }, [eligibleRecruiters, selectedTeamId, currentUserTeamId, session, hasManuallyChangedTeam, selectedRecruiterId]);

  // Reset recruiter when team changes manually
  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    setSelectedRecruiterId("");
    setHasManuallyChangedTeam(true);
  };

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
      if (data?.duplicateEmail) throw new Error(data.error);
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
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{name} Added!</h1>
            <p className="text-muted-foreground mt-2">
              Stage: <span className="font-medium text-foreground">{stage}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/my-group")}>
              View My Group
            </Button>
            <Button onClick={() => {
              setIsSuccess(false);
              setName("");
              setPhone("");
              setEmail("");
              setStage("");
              setSelectedTeamId(currentUserTeamId || "");
              setSelectedRecruiterId("");
              setHasManuallyChangedTeam(false);
            }}>
              Add Another
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div>

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
          <Select value={selectedTeamId} onValueChange={handleTeamChange}>
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
              {eligibleRecruiters.map((rep) => (
                <SelectItem 
                  key={rep.user_id || rep.id} 
                  value={rep.user_id || rep.id}
                >
                  {rep.name?.replace(/[^\w\s]/g, "").trim()}
                  {rep.stage && !["Signed", "Shadow ✅", "Sold 💲", "Sold (5+) 💰"].includes(rep.stage) 
                    ? "" 
                    : ` (${rep.stage})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTeamId && eligibleRecruiters.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No eligible recruiters found for this team
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
    </div>
  );
}
