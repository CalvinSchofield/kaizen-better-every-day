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

    // Fetch all mgmt_groups
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

    // Build teams list with lead names for matching
    const teams = teamsData.map(t => ({
      id: t.id,
      name: t.name,
      groupLeadId: t.lead_user_id,
    }));

    // Create a map of lead_user_id -> team for quick lookup
    const userIdToTeam = new Map<string, typeof teams[0]>();
    for (const team of teams) {
      if (team.groupLeadId) {
        userIdToTeam.set(team.groupLeadId, team);
      }
    }

    // Get all reps to build a name -> team mapping based on team_leader field
    const { data: allRepsForMapping } = await supabase
      .from('reps')
      .select('name, user_id, team_leader');

    // Build team leader name -> team mapping
    const teamLeaderNameToTeam = new Map<string, typeof teams[0]>();
    for (const team of teams) {
      if (team.groupLeadId) {
        // Find the rep who is the team lead
        const leadRep = allRepsForMapping?.find(r => r.user_id === team.groupLeadId);
        if (leadRep) {
          // Extract first name from the rep's name (removing emoji prefix if present)
          const leadName = leadRep.name.replace(/^[^\w]*/, '').split(' ')[0].toLowerCase();
          teamLeaderNameToTeam.set(leadName, team);
        }
      }
    }

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

    // Helper to get team info for a rep based on their team_leader field
    const getRepTeamInfo = (rep: any) => {
      // First check if this rep IS a team lead
      const teamAsLead = userIdToTeam.get(rep.user_id);
      if (teamAsLead) {
        const mgmtGroup = mgmtGroups.find(g => g.teamIds.includes(teamAsLead.id));
        return {
          isTeamLead: true,
          teamId: teamAsLead.id,
          teamName: teamAsLead.name,
          mgmtGroupId: mgmtGroup?.id || null,
          mgmtGroupName: mgmtGroup?.name || null,
        };
      }

      // Otherwise look up by team_leader field
      if (rep.team_leader) {
        const leaderName = rep.team_leader.toLowerCase();
        const team = teamLeaderNameToTeam.get(leaderName);
        if (team) {
          const mgmtGroup = mgmtGroups.find(g => g.teamIds.includes(team.id));
          return {
            isTeamLead: false,
            teamId: team.id,
            teamName: team.name,
            mgmtGroupId: mgmtGroup?.id || null,
            mgmtGroupName: mgmtGroup?.name || null,
          };
        }
      }

      return {
        isTeamLead: false,
        teamId: null,
        teamName: rep.team_leader ? `Team ${rep.team_leader}` : null,
        mgmtGroupId: null,
        mgmtGroupName: null,
      };
    };

    // Build rep data for response
    const buildRepData = (rep: any) => {
      const teamInfo = getRepTeamInfo(rep);
      
      return {
        id: rep.id,
        userId: rep.user_id || null,
        name: rep.name,
        notionPageId: rep.notion_page_id,
        phone: rep.phone || null,
        year: rep.year || null,
        stage: rep.stage || null,
        isTeamLead: teamInfo.isTeamLead,
        teamId: teamInfo.teamId,
        teamName: teamInfo.teamName,
        mgmtGroupId: teamInfo.mgmtGroupId,
        mgmtGroupName: teamInfo.mgmtGroupName,
        isGhostRep: !rep.user_id,
        rampPhase1Complete: rep.ramp_phase_1_complete || false,
      };
    };

    let accessibleUserIds: string[] = [];
    let accessibleReps: any[] = [];

    // Fetch all reps for processing
    const { data: allReps } = await supabase
      .from('reps')
      .select('id, user_id, name, notion_page_id, team_leader, phone, year, stage, ramp_phase_1_complete');

    if (accessLevel === 'area_director') {
      // Area directors see ALL reps
      if (allReps) {
        accessibleUserIds = allReps.filter(r => r.user_id).map(r => r.user_id!);
        accessibleReps = allReps.map(buildRepData);
      }
      console.log(`Area director has access to ${accessibleReps.length} reps`);

    } else if (accessLevel === 'mgmt_group_lead') {
      // Get all mgmt groups this user leads
      const userMgmtGroups = mgmtGroups.filter(g => g.groupLeadId === user.id);
      const accessibleTeamIds = userMgmtGroups.flatMap(g => g.teamIds);
      
      if (allReps) {
        for (const rep of allReps) {
          const teamInfo = getRepTeamInfo(rep);
          if (teamInfo.teamId && accessibleTeamIds.includes(teamInfo.teamId)) {
            if (rep.user_id) accessibleUserIds.push(rep.user_id);
            accessibleReps.push(buildRepData(rep));
          }
        }
      }
      console.log(`MGMT group lead has access to ${accessibleTeamIds.length} teams, ${accessibleReps.length} reps`);

    } else if (accessLevel === 'team_lead') {
      // Get the team(s) this user leads
      const userTeams = teams.filter(t => t.groupLeadId === user.id);
      const userTeamIds = userTeams.map(t => t.id);

      if (allReps && userTeamIds.length > 0) {
        for (const rep of allReps) {
          const teamInfo = getRepTeamInfo(rep);
          if (teamInfo.teamId && userTeamIds.includes(teamInfo.teamId)) {
            if (rep.user_id) accessibleUserIds.push(rep.user_id);
            accessibleReps.push(buildRepData(rep));
          }
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
