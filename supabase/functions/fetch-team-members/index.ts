import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { leaderUserId, fetchAllForAccessLevel } = body;

    if (!leaderUserId) {
      return new Response(
        JSON.stringify({ teamMembers: [], isTeamLead: false }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`Fetching team members from Supabase for user: ${leaderUserId}, accessLevel: ${fetchAllForAccessLevel || 'team_lead'}`);

    // Check access level
    const { data: isAreaDir } = await supabase.rpc('is_area_director', { _user_id: leaderUserId });
    const { data: isMgmtLead } = await supabase.rpc('is_mgmt_group_lead', { _user_id: leaderUserId });
    const { data: isTeamLead } = await supabase.rpc('is_team_lead', { _user_id: leaderUserId });

    // Get accessible team IDs
    const { data: accessibleTeamIds } = await supabase.rpc('get_accessible_team_ids', { _user_id: leaderUserId });

    // Get all teams and mgmt groups for mapping
    const { data: teams } = await supabase.from('teams').select('id, name, lead_user_id');
    const { data: mgmtGroups } = await supabase.from('mgmt_groups').select('id, name, lead_user_id');
    const { data: teamMgmtGroups } = await supabase.from('team_mgmt_groups').select('team_id, mgmt_group_id');

    // Build team to mgmt group mapping
    const teamToMgmtGroup = new Map<string, { mgmtGroupId: string; mgmtGroupName: string }>();
    for (const tmg of teamMgmtGroups || []) {
      const mgmtGroup = mgmtGroups?.find(g => g.id === tmg.mgmt_group_id);
      if (mgmtGroup) {
        teamToMgmtGroup.set(tmg.team_id, { mgmtGroupId: mgmtGroup.id, mgmtGroupName: mgmtGroup.name });
      }
    }

    const teamMap = new Map(teams?.map(t => [t.id, t.name]) || []);

    // Build base query for reps
    let repsQuery = supabase
      .from('reps')
      .select(`
        id,
        user_id,
        name,
        email,
        phone,
        stage,
        year,
        recruiter,
        onboarding_complete,
        trainings_complete,
        slack_joined,
        ramp_phase_1_complete,
        ramp_phase_2_complete,
        ramp_phase_3_complete,
        ramp_phase_4_complete,
        ramp_to_blitz_phase,
        ipad_assigned,
        blitz_ready,
        blitz_trip_date,
        blitz_trip_end_date,
        blitz_trip_name,
        blitz_trip_location,
        committed_blitzes
      `);

    // For non-area-directors, we need to filter by accessible teams
    let repIds: string[] = [];
    
    if (isAreaDir || fetchAllForAccessLevel === 'area_director') {
      // Area directors see all reps - no filter needed
    } else if ((isMgmtLead || isTeamLead) && accessibleTeamIds && accessibleTeamIds.length > 0) {
      // Get reps from recruits table that are in accessible teams
      const { data: teamRecruits } = await supabase
        .from('recruits')
        .select('id')
        .in('team_id', accessibleTeamIds);
      
      repIds = teamRecruits?.map(r => r.id).filter(Boolean) || [];
      if (repIds.length === 0) {
        return new Response(
          JSON.stringify({ teamMembers: [], isTeamLead: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      repsQuery = repsQuery.in('id', repIds);
    } else if (!isAreaDir && !isMgmtLead && !isTeamLead) {
      // Not a leader
      return new Response(
        JSON.stringify({ teamMembers: [], isTeamLead: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const { data: repsData, error: repsError } = await repsQuery;

    if (repsError) {
      console.error('Error fetching reps:', repsError);
      throw repsError;
    }

    // Get team assignments from recruits table
    const allRepIds = (repsData || []).map(r => r.id).filter(Boolean);
    const { data: recruitTeams } = await supabase
      .from('recruits')
      .select('id, team_id, mgmt_group_id')
      .in('id', allRepIds.length > 0 ? allRepIds : ['none']);

    const teamByRepId = new Map(recruitTeams?.map(r => [r.id, { teamId: r.team_id, mgmtGroupId: r.mgmt_group_id }]) || []);

    // Transform reps to expected format
    const teamMembers = (repsData || []).map(rep => {
      const recruit = teamByRepId.get(rep.id);
      const teamId = recruit?.teamId;
      const teamName = teamId ? teamMap.get(teamId) : null;
      const mgmtInfo = teamId ? teamToMgmtGroup.get(teamId) : null;

      return {
        id: rep.id,
        userId: rep.user_id,
        name: rep.name,
        email: rep.email,
        phone: rep.phone,
        stage: rep.stage,
        year: rep.year,
        recruiter: rep.recruiter,
        onboardingStatus: rep.ramp_to_blitz_phase,
        onboardingComplete: rep.onboarding_complete ?? false,
        trainingsComplete: rep.trainings_complete ?? false,
        slackJoined: rep.slack_joined ?? false,
        phase1Complete: rep.ramp_phase_1_complete ?? false,
        phase2Complete: rep.ramp_phase_2_complete ?? false,
        phase3Complete: rep.ramp_phase_3_complete ?? false,
        phase4Complete: rep.ramp_phase_4_complete ?? false,
        ipadAssigned: rep.ipad_assigned ?? false,
        blitzReady: rep.blitz_ready ?? false,
        committedBlitzes: rep.committed_blitzes || [],
        teamId,
        teamName,
        mgmtGroupId: mgmtInfo?.mgmtGroupId || recruit?.mgmtGroupId,
        mgmtGroupName: mgmtInfo?.mgmtGroupName,
      };
    });

    console.log(`Fetched ${teamMembers.length} team members from Supabase`);

    return new Response(
      JSON.stringify({ teamMembers, isTeamLead: isTeamLead || isMgmtLead || isAreaDir }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in fetch-team-members:", errorMessage);
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: "Check function logs for more information",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
