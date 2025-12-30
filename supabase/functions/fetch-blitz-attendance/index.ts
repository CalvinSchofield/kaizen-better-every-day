import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  blitzReady: boolean;
  committedBlitzes: string[];
  ipadAssigned: boolean;
  year: string | null;
  stage: string | null;
  onboardingStatus: string | null;
  userId?: string | null;
  teamId?: string | null;
  teamName?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { scope, mgmtGroupId, teamId } = await req.json();
    
    if (!scope) {
      throw new Error("Missing required parameter: scope");
    }

    console.log(`Fetching blitz attendance for scope: ${scope}`);

    // Fetch current user's rep data
    const { data: repData, error: repError } = await supabase
      .from("reps")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (repError || !repData) {
      console.error("Rep data error:", repError);
      throw new Error("Rep data not found");
    }

    // Determine access level using database functions for consistency
    const { data: isAreaDirector } = await supabase.rpc('is_area_director', { _user_id: user.id });
    const { data: isMgmtGroupLeadDb } = await supabase.rpc('is_mgmt_group_lead', { _user_id: user.id });
    const { data: isTeamLeadDb } = await supabase.rpc('is_team_lead', { _user_id: user.id });

    // Check if user is a team lead - get their specific teams
    const { data: ledTeams } = await supabase
      .from("teams")
      .select("id, name")
      .eq("lead_user_id", user.id);

    // Check if user is a mgmt group lead - get their specific groups
    const { data: ledMgmtGroups } = await supabase
      .from("mgmt_groups")
      .select("id, name")
      .eq("lead_user_id", user.id);

    // Use database function results for access level determination
    const isMgmtGroupLead = Boolean(isMgmtGroupLeadDb);
    const isTeamLead = Boolean(isTeamLeadDb);

    // Validate requested scope against user's actual permissions
    // Users can only access scopes they're authorized for
    let effectiveScope = scope;
    if (scope === "office" && !isAreaDirector) {
      console.log(`User requested 'office' scope but is not AD. Downgrading to allowed scope.`);
      effectiveScope = isMgmtGroupLead ? "mgmt" : (isTeamLead ? "team" : "you");
    }
    if (scope === "mgmt" && !isMgmtGroupLead && !isAreaDirector) {
      console.log(`User requested 'mgmt' scope but is not MGMT lead. Downgrading to 'team'.`);
      effectiveScope = isTeamLead ? "team" : "you";
    }
    if (scope === "team" && !isTeamLead && !isMgmtGroupLead && !isAreaDirector) {
      console.log(`User requested 'team' scope but is not a leader. Downgrading to 'you'.`);
      effectiveScope = "you";
    }

    console.log(`Scope requested: ${scope}, effective scope: ${effectiveScope}, isAD: ${isAreaDirector}, isMgmt: ${isMgmtGroupLead}, isTeam: ${isTeamLead}, mgmtGroupId: ${mgmtGroupId}, teamId: ${teamId}`);

    let accessibleReps: TeamMember[] = [];

    if (effectiveScope === "you") {
      // Personal view - no team members
      accessibleReps = [];
    } else {
      // Get teams this user has access to based on THEIR actual permissions
      let accessibleTeamIds: string[] = [];

      if (effectiveScope === "office" && isAreaDirector) {
        // Area Director sees all teams
        const { data: allTeams } = await supabase.from("teams").select("id, name");
        accessibleTeamIds = (allTeams || []).map(t => t.id);
      } else if (effectiveScope === "mgmt") {
        // MGMT scope - get teams for a specific MGMT group
        if (mgmtGroupId) {
          // Specific MGMT group requested - verify access
          const { data: teamMgmtGroups } = await supabase
            .from("team_mgmt_groups")
            .select("team_id")
            .eq("mgmt_group_id", mgmtGroupId);
          accessibleTeamIds = (teamMgmtGroups || []).map(t => t.team_id);
        } else if (isMgmtGroupLead) {
          // MGMT lead with no specific group - use their led groups
          const mgmtGroupIds = (ledMgmtGroups || []).map(m => m.id);
          const { data: teamMgmtGroups } = await supabase
            .from("team_mgmt_groups")
            .select("team_id")
            .in("mgmt_group_id", mgmtGroupIds);
          accessibleTeamIds = (teamMgmtGroups || []).map(t => t.team_id);
        } else if (isAreaDirector && ledMgmtGroups && ledMgmtGroups.length > 0) {
          // AD who also leads a MGMT group - use their led groups
          const mgmtGroupIds = (ledMgmtGroups || []).map(m => m.id);
          const { data: teamMgmtGroups } = await supabase
            .from("team_mgmt_groups")
            .select("team_id")
            .in("mgmt_group_id", mgmtGroupIds);
          accessibleTeamIds = (teamMgmtGroups || []).map(t => t.team_id);
        }
      } else if (effectiveScope === "team") {
        // Team lead scope - specific team or user's led teams
        if (teamId) {
          // Specific team requested
          accessibleTeamIds = [teamId];
        } else if (isTeamLead || ledTeams?.length) {
          // Use their led team(s)
          accessibleTeamIds = (ledTeams || []).map(t => t.id);
        } else if (isMgmtGroupLead) {
          // MGMT lead selecting team scope - use first led team from their mgmt groups
          const mgmtGroupIds = (ledMgmtGroups || []).map(m => m.id);
          const { data: teamMgmtGroups } = await supabase
            .from("team_mgmt_groups")
            .select("team_id")
            .in("mgmt_group_id", mgmtGroupIds);
          accessibleTeamIds = (teamMgmtGroups || []).map(t => t.team_id);
        }
      }

      console.log(`Accessible team IDs for ${effectiveScope} scope: ${accessibleTeamIds.length} teams`);

      // Fetch team names
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", accessibleTeamIds);
      
      const teamNameMap: Record<string, string> = {};
      (teamsData || []).forEach(t => { teamNameMap[t.id] = t.name; });

      // Fetch recruits for these teams
      const { data: recruitsData } = await supabase
        .from("recruits")
        .select("*")
        .in("team_id", accessibleTeamIds);

      // Enrich recruit records with progress from reps table (when a matching rep exists)
      // This keeps Blitz Machine consistent with My Group for signed-up users.
      const recruitEmails = [...new Set(
        (recruitsData || [])
          .map((r) => (r.email ? String(r.email).toLowerCase().trim() : null))
          .filter((e): e is string => !!e)
      )];

      // Match recruits to reps by email for progress data
      const repByEmail: Record<string, any> = {};

      const repSelect =
        "id, email, onboarding_complete, trainings_complete, slack_joined, ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete, ipad_assigned, blitz_ready";

      if (recruitEmails.length > 0) {
        const { data: repsByEmail } = await supabase
          .from("reps")
          .select(repSelect)
          .in("email", recruitEmails);

        (repsByEmail || []).forEach((r) => {
          if (r.email) repByEmail[String(r.email).toLowerCase().trim()] = r;
        });
      }

      // Fetch recruit-blitz commitments
      const recruitIds = (recruitsData || []).map(r => r.id);
      const { data: recruitBlitzes } = await supabase
        .from("recruit_blitzes")
        .select("recruit_id, blitz_id")
        .in("recruit_id", recruitIds);

      // Build commitment map using blitz IDs
      const commitmentMap: Record<string, string[]> = {};
      (recruitBlitzes || []).forEach(rb => {
        if (!commitmentMap[rb.recruit_id]) {
          commitmentMap[rb.recruit_id] = [];
        }
        commitmentMap[rb.recruit_id].push(rb.blitz_id);
      });

      // Get current user's email for self-exclusion
      const currentUserEmail = repData.email ? String(repData.email).toLowerCase().trim() : null;

      // Map recruits to team members format
      for (const recruit of recruitsData || []) {
        const emailKey = recruit.email ? String(recruit.email).toLowerCase().trim() : null;
        
        // Exclude current user from appearing in their own list
        if (emailKey && currentUserEmail && emailKey === currentUserEmail) {
          console.log(`Excluding current user (${recruit.name}) from blitz attendance list`);
          continue;
        }
        
        const repProgress = emailKey ? repByEmail[emailKey] : null;
        const progress = repProgress || recruit;

        // Compute onboardingStatus with proper progression check
        let onboardingStatus: string | null = null;

        if (progress.ramp_phase_4_complete) {
          onboardingStatus = "Phase 4 Complete";
        } else if (progress.ramp_phase_3_complete) {
          onboardingStatus = "Phase 3 Complete";
        } else if (progress.ramp_phase_2_complete) {
          onboardingStatus = "Phase 2 Complete";
        } else if (progress.ramp_phase_1_complete) {
          onboardingStatus = "Phase 1 Complete";
        } else if (progress.slack_joined) {
          onboardingStatus = "Slack Joined";
        } else if (progress.trainings_complete) {
          onboardingStatus = "Required Trainings Complete";
        } else if (progress.onboarding_complete) {
          onboardingStatus = "Onboarding Complete";
        }

        accessibleReps.push({
          id: recruit.id,
          name: recruit.name,
          email: recruit.email,
          phone: recruit.phone,
          blitzReady: Boolean((progress as any).blitz_ready),
          committedBlitzes: commitmentMap[recruit.id] || [],
          ipadAssigned: Boolean((progress as any).ipad_assigned),
          year: recruit.year,
          stage: recruit.stage,
          onboardingStatus,
          userId: recruit.recruiter_user_id,
          teamId: recruit.team_id,
          teamName: recruit.team_id ? teamNameMap[recruit.team_id] : null,
        });
      }

      console.log(`Found ${accessibleReps.length} accessible reps`);
    }

    // Fetch invite status from blitz_invites table
    const { data: inviteData } = await supabase
      .from("blitz_invites")
      .select("*");

    const contactedForBlitz: { [blitzId: string]: string[] } = {};
    (inviteData || []).forEach(invite => {
      if (!contactedForBlitz[invite.blitz_id]) {
        contactedForBlitz[invite.blitz_id] = [];
      }
      // Use rep_id (recruit ID) for tracking contacts
      if (invite.rep_id) {
        contactedForBlitz[invite.blitz_id].push(invite.rep_id);
      }
    });

    // Fetch declined status from blitz_declines table
    const { data: declineData } = await supabase
      .from("blitz_declines")
      .select("*");

    const declinedForBlitz: { [blitzId: string]: string[] } = {};
    (declineData || []).forEach(decline => {
      if (!declinedForBlitz[decline.blitz_id]) {
        declinedForBlitz[decline.blitz_id] = [];
      }
      // Use rep_id (recruit ID) for tracking declines
      if (decline.rep_id) {
        declinedForBlitz[decline.blitz_id].push(decline.rep_id);
      }
    });

    return new Response(
      JSON.stringify({
        teamMembers: accessibleReps,
        contactedForBlitz,
        declinedForBlitz,
        accessibleUserIds: accessibleReps.filter(r => r.userId).map(r => r.userId),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in fetch-blitz-attendance:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: "Check function logs for more information",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
