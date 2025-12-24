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

    let accessibleReps: TeamMember[] = [];

    if (scope === "you") {
      // Personal view - no team members
      accessibleReps = [];
    } else {
      // Get teams this user has access to
      let accessibleTeamIds: string[] = [];

      if (isAreaDirector || scope === "office") {
        // Area Director sees all teams
        const { data: allTeams } = await supabase.from("teams").select("id, name");
        accessibleTeamIds = (allTeams || []).map(t => t.id);
      } else if (ledMgmtGroups && ledMgmtGroups.length > 0) {
        // MGMT lead - get teams in their mgmt groups
        const mgmtGroupIds = ledMgmtGroups.map(m => m.id);
        const { data: teamMgmtGroups } = await supabase
          .from("team_mgmt_groups")
          .select("team_id")
          .in("mgmt_group_id", mgmtGroupIds);
        accessibleTeamIds = (teamMgmtGroups || []).map(t => t.team_id);
      } else if (ledTeams && ledTeams.length > 0) {
        // Team lead
        accessibleTeamIds = ledTeams.map(t => t.id);
      }

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

      // Fetch recruit-blitz commitments
      const recruitIds = (recruitsData || []).map(r => r.id);
      const { data: recruitBlitzes } = await supabase
        .from("recruit_blitzes")
        .select("recruit_id, blitz_id")
        .in("recruit_id", recruitIds);

      // Build commitment map
      const commitmentMap: Record<string, string[]> = {};
      (recruitBlitzes || []).forEach(rb => {
        if (!commitmentMap[rb.recruit_id]) {
          commitmentMap[rb.recruit_id] = [];
        }
        commitmentMap[rb.recruit_id].push(rb.blitz_id);
      });

      // Map recruits to team members format
      for (const recruit of recruitsData || []) {
        const onboardingComplete = recruit.ramp_phase_4_complete;
        const onboardingStatus = recruit.ramp_phase_4_complete ? "Phase 4 Complete" :
          recruit.ramp_phase_3_complete ? "Phase 3 Complete" :
          recruit.ramp_phase_2_complete ? "Phase 2 Complete" :
          recruit.ramp_phase_1_complete ? "Phase 1 Complete" : null;

        accessibleReps.push({
          notionPageId: recruit.notion_page_id || recruit.id,
          recruitId: recruit.id,
          name: recruit.name,
          email: recruit.email,
          phone: recruit.phone,
          blitzReady: recruit.blitz_ready || false,
          committedBlitzes: commitmentMap[recruit.id] || [],
          ipadAssigned: recruit.ipad_assigned || false,
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
