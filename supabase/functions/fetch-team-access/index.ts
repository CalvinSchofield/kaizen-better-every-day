import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AREA_DIRECTOR_EMAIL = 'calvinjschofield@gmail.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current user's rep data
    const { data: repData } = await supabase
      .from('reps')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!repData) {
      return new Response(JSON.stringify({ 
        accessLevel: 'none',
        mgmtGroups: [],
        teams: [],
        accessibleUserIds: [],
        accessibleReps: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userEmail = user.email?.toLowerCase();
    const isAreaDirector = userEmail === AREA_DIRECTOR_EMAIL;

    // Fetch all mgmt_groups with their teams via team_mgmt_groups junction
    const { data: mgmtGroupsRaw } = await supabase
      .from('mgmt_groups')
      .select('id, name, lead_user_id, notion_page_id');

    // Fetch all teams
    const { data: teamsRaw } = await supabase
      .from('teams')
      .select('id, name, lead_user_id, notion_page_id');

    // Fetch team-mgmt_group relationships
    const { data: teamMgmtGroupsRaw } = await supabase
      .from('team_mgmt_groups')
      .select('team_id, mgmt_group_id');

    const mgmtGroupsData = mgmtGroupsRaw || [];
    const teamsData = teamsRaw || [];
    const teamMgmtGroups = teamMgmtGroupsRaw || [];

    // Build mgmt groups with their team IDs
    const mgmtGroups = mgmtGroupsData.map(g => {
      const teamIds = teamMgmtGroups
        .filter(tmg => tmg.mgmt_group_id === g.id)
        .map(tmg => tmg.team_id);
      return {
        id: g.id,
        name: g.name,
        teamIds,
        groupLeadId: g.lead_user_id,
      };
    });

    // Build teams list
    const teams = teamsData.map(t => ({
      id: t.id,
      name: t.name,
      groupLeadId: t.lead_user_id,
    }));

    // Determine access level
    let accessLevel = 'none';

    // Check if user is a mgmt group lead
    const isMgmtGroupLead = mgmtGroupsData.some(g => g.lead_user_id === user.id);
    if (isMgmtGroupLead) {
      accessLevel = 'mgmt_group_lead';
    }

    // Check if user is a team lead
    const isTeamLead = teamsData.some(t => t.lead_user_id === user.id);
    if (isTeamLead && accessLevel === 'none') {
      accessLevel = 'team_lead';
    }

    // Area director overrides everything
    if (isAreaDirector) {
      accessLevel = 'area_director';
    }

    // Helper to get team and mgmt group info for a rep
    const getRepTeamInfo = (teamId: string | null, mgmtGroupId: string | null) => {
      const team = teamId ? teams.find(t => t.id === teamId) : null;
      const mgmtGroup = mgmtGroupId 
        ? mgmtGroups.find(g => g.id === mgmtGroupId)
        : team 
          ? mgmtGroups.find(g => g.teamIds.includes(team.id))
          : null;

      return {
        teamId: team?.id || null,
        teamName: team?.name || null,
        mgmtGroupId: mgmtGroup?.id || null,
        mgmtGroupName: mgmtGroup?.name || null,
      };
    };

    // Build rep data for response
    const buildRepData = (rep: any) => {
      const teamInfo = getRepTeamInfo(rep.team_id, rep.mgmt_group_id);
      const isRepTeamLead = teams.some(t => t.groupLeadId === rep.user_id);
      
      return {
        id: rep.id,
        userId: rep.user_id || null,
        name: rep.name,
        notionPageId: rep.notion_page_id,
        phone: rep.phone || null,
        year: rep.year || null,
        stage: rep.stage || null,
        isTeamLead: isRepTeamLead,
        teamId: teamInfo.teamId,
        teamName: teamInfo.teamName || (rep.team_leader ? `Team ${rep.team_leader}` : null),
        mgmtGroupId: teamInfo.mgmtGroupId,
        mgmtGroupName: teamInfo.mgmtGroupName,
        isGhostRep: !rep.user_id,
        rampPhase1Complete: rep.ramp_phase_1_complete || false,
      };
    };

    let accessibleUserIds: string[] = [];
    let accessibleReps: any[] = [];

    if (accessLevel === 'area_director') {
      // Area directors see ALL reps
      const { data: allReps } = await supabase
        .from('reps')
        .select('id, user_id, name, notion_page_id, team_leader, phone, year, stage, ramp_phase_1_complete, team_id, mgmt_group_id');
      
      if (allReps) {
        accessibleUserIds = allReps.filter(r => r.user_id).map(r => r.user_id!);
        accessibleReps = allReps.map(buildRepData);
      }
      console.log(`Area director has access to ${accessibleReps.length} reps`);

    } else if (accessLevel === 'mgmt_group_lead') {
      // Get all mgmt groups this user leads
      const userMgmtGroups = mgmtGroups.filter(g => g.groupLeadId === user.id);
      const accessibleTeamIds = userMgmtGroups.flatMap(g => g.teamIds);
      
      // Fetch reps that belong to accessible teams
      const { data: teamReps } = await supabase
        .from('reps')
        .select('id, user_id, name, notion_page_id, team_leader, phone, year, stage, ramp_phase_1_complete, team_id, mgmt_group_id')
        .in('team_id', accessibleTeamIds.length > 0 ? accessibleTeamIds : ['00000000-0000-0000-0000-000000000000']);

      if (teamReps) {
        accessibleUserIds = teamReps.filter(r => r.user_id).map(r => r.user_id!);
        accessibleReps = teamReps.map(buildRepData);
      }
      console.log(`MGMT group lead has access to ${accessibleTeamIds.length} teams, ${accessibleReps.length} reps`);

    } else if (accessLevel === 'team_lead') {
      // Get the team(s) this user leads
      const userTeams = teams.filter(t => t.groupLeadId === user.id);
      const userTeamIds = userTeams.map(t => t.id);

      if (userTeamIds.length > 0) {
        const { data: teamReps } = await supabase
          .from('reps')
          .select('id, user_id, name, notion_page_id, team_leader, phone, year, stage, ramp_phase_1_complete, team_id, mgmt_group_id')
          .in('team_id', userTeamIds);

        if (teamReps) {
          accessibleUserIds = teamReps.filter(r => r.user_id).map(r => r.user_id!);
          accessibleReps = teamReps.map(buildRepData);
        }
        console.log(`Team lead (${userTeams.map(t => t.name).join(', ')}) has access to ${accessibleReps.length} reps`);
      }
    }

    return new Response(JSON.stringify({ 
      accessLevel, 
      mgmtGroups, 
      teams, 
      accessibleUserIds, 
      accessibleReps 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in fetch-team-access:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
