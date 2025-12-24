import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamMember {
  notionPageId: string;
  recruitId?: string | null;
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

    const { scope } = await req.json();
    
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

    // Determine access level
    const areaDirectorEmails = ["calvinjschofield@gmail.com", "calvin.schofield@vivint.com"];
    const isAreaDirector = repData.email && areaDirectorEmails.includes(repData.email.toLowerCase());

    // Check if user is a team lead
    const { data: ledTeams } = await supabase
      .from("teams")
      .select("id, name")
      .eq("lead_user_id", user.id);

    // Check if user is a mgmt group lead
    const { data: ledMgmtGroups } = await supabase
      .from("mgmt_groups")
      .select("id, name")
      .eq("lead_user_id", user.id);

    // Determine the user's actual access level
    const isMgmtGroupLead = ledMgmtGroups && ledMgmtGroups.length > 0;
    const isTeamLead = ledTeams && ledTeams.length > 0;

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

    console.log(`Scope requested: ${scope}, effective scope: ${effectiveScope}, isAD: ${isAreaDirector}, isMgmt: ${isMgmtGroupLead}, isTeam: ${isTeamLead}`);

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
      } else if (effectiveScope === "mgmt" && (isMgmtGroupLead || isAreaDirector)) {
        // MGMT lead - get teams in their mgmt groups
        if (isAreaDirector) {
          // AD viewing mgmt scope - show all teams
          const { data: allTeams } = await supabase.from("teams").select("id, name");
          accessibleTeamIds = (allTeams || []).map(t => t.id);
        } else {
          const mgmtGroupIds = (ledMgmtGroups || []).map(m => m.id);
          const { data: teamMgmtGroups } = await supabase
            .from("team_mgmt_groups")
            .select("team_id")
            .in("mgmt_group_id", mgmtGroupIds);
          accessibleTeamIds = (teamMgmtGroups || []).map(t => t.team_id);
        }
      } else if (effectiveScope === "team") {
        // Team lead scope - only their teams
        if (isAreaDirector) {
          // AD can pick any team scope but we'll show all if they select 'team'
          const { data: allTeams } = await supabase.from("teams").select("id, name");
          accessibleTeamIds = (allTeams || []).map(t => t.id);
        } else if (isMgmtGroupLead) {
          // MGMT lead selecting team scope - show only their directly led teams (if any) or first mgmt group's teams
          if (ledTeams && ledTeams.length > 0) {
            accessibleTeamIds = ledTeams.map(t => t.id);
          } else {
            // Fallback to their mgmt group teams
            const mgmtGroupIds = (ledMgmtGroups || []).map(m => m.id);
            const { data: teamMgmtGroups } = await supabase
              .from("team_mgmt_groups")
              .select("team_id")
              .in("mgmt_group_id", mgmtGroupIds);
            accessibleTeamIds = (teamMgmtGroups || []).map(t => t.team_id);
          }
        } else if (isTeamLead) {
          // Pure team lead - only their team(s)
          accessibleTeamIds = (ledTeams || []).map(t => t.id);
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

      const recruitNotionIds = [...new Set(
        (recruitsData || [])
          .map((r) => (r.notion_page_id ? String(r.notion_page_id).trim() : null))
          .filter((id): id is string => !!id)
      )];

      const repByNotionId: Record<string, any> = {};
      const repByEmail: Record<string, any> = {};

      const repSelect =
        "notion_page_id, email, onboarding_complete, trainings_complete, slack_joined, ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete, ipad_assigned, blitz_ready";

      if (recruitNotionIds.length > 0) {
        const { data: repsByNotionId } = await supabase
          .from("reps")
          .select(repSelect)
          .in("notion_page_id", recruitNotionIds);

        (repsByNotionId || []).forEach((r) => {
          if (r.notion_page_id) repByNotionId[String(r.notion_page_id).trim()] = r;
          if (r.email) repByEmail[String(r.email).toLowerCase().trim()] = r;
        });
      }

      if (recruitEmails.length > 0) {
        const { data: repsByEmail } = await supabase
          .from("reps")
          .select(repSelect)
          .in("email", recruitEmails);

        (repsByEmail || []).forEach((r) => {
          if (r.notion_page_id) repByNotionId[String(r.notion_page_id).trim()] = r;
          if (r.email) repByEmail[String(r.email).toLowerCase().trim()] = r;
        });
      }

      // Fetch recruit-blitz commitments
      const recruitIds = (recruitsData || []).map(r => r.id);
      const { data: recruitBlitzes } = await supabase
        .from("recruit_blitzes")
        .select("recruit_id, blitz_id")
        .in("recruit_id", recruitIds);

      // Get all blitz IDs from commitments to fetch their notion_page_ids
      const blitzSupabaseIds = [...new Set((recruitBlitzes || []).map(rb => rb.blitz_id))];
      const { data: blitzesData } = await supabase
        .from("blitzes")
        .select("id, notion_page_id")
        .in("id", blitzSupabaseIds);

      // Map Supabase blitz ID -> Notion page ID (or fallback to Supabase ID)
      const blitzIdToNotionId: Record<string, string> = {};
      (blitzesData || []).forEach(b => {
        blitzIdToNotionId[b.id] = b.notion_page_id || b.id;
      });

      // Build commitment map using Notion IDs (to match UI)
      const commitmentMap: Record<string, string[]> = {};
      (recruitBlitzes || []).forEach(rb => {
        if (!commitmentMap[rb.recruit_id]) {
          commitmentMap[rb.recruit_id] = [];
        }
        // Convert to notion page ID
        const notionId = blitzIdToNotionId[rb.blitz_id] || rb.blitz_id;
        commitmentMap[rb.recruit_id].push(notionId);
      });

      // Map recruits to team members format
      for (const recruit of recruitsData || []) {
        const emailKey = recruit.email ? String(recruit.email).toLowerCase().trim() : null;
        const notionKey = recruit.notion_page_id ? String(recruit.notion_page_id).trim() : null;

        const repProgress =
          (notionKey ? repByNotionId[notionKey] : null) ||
          (emailKey ? repByEmail[emailKey] : null);

        const progress = repProgress || recruit;

        // Compute onboardingStatus with proper progression check
        // Order of completion: Onboarding -> Trainings -> Slack -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4
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
        // null means Not Started

        accessibleReps.push({
          notionPageId: recruit.notion_page_id || recruit.id,
          recruitId: recruit.id,
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
      contactedForBlitz[invite.blitz_id].push(invite.rep_notion_page_id);
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
      declinedForBlitz[decline.blitz_id].push(decline.rep_notion_page_id);
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
