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

    // Fetch all reps to build mappings
    const { data: allReps } = await supabase
      .from('reps')
      .select('id, user_id, name, notion_page_id, team_leader, recruiter, phone, year, stage, ramp_phase_1_complete');

    const mgmtGroupsData = mgmtGroupsRaw || [];
    const teamsData = teamsRaw || [];
    const teamMgmtGroups = teamMgmtGroupsRaw || [];
    const repsData = allReps || [];

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

    // Build a map of a rep's team_leader (first-name) -> team
    // Prefer mapping by team name (more reliable than lead_user_id, which can be null or duplicated)
    const normalizeFirstToken = (name: string | null | undefined) => {
      if (!name) return null;
      // Remove emoji/prefix chars then take the first "word"
      const cleanName = name.replace(/^[^\p{L}]*/u, '').trim();
      const firstToken = cleanName.split(/\s+/)[0]?.toLowerCase();
      return firstToken || null;
    };

    const normalizeFullName = (name: string | null | undefined) => {
      if (!name) return null;
      const clean = name.replace(/^[^\p{L}]*/u, '').trim();
      return clean.toLowerCase();
    };

    const teamKeyToTeam = new Map<string, typeof teamsData[0]>();

    // 1) Map by team name
    for (const team of teamsData) {
      const key = normalizeFirstToken(team.name);
      if (!key) continue;
      if (!teamKeyToTeam.has(key)) {
        teamKeyToTeam.set(key, team);
      } else {
        console.warn(`Duplicate team key "${key}" from team name "${team.name}". Keeping the first mapping.`);
      }
    }

    // 2) Map by lead rep first name (fill in missing keys only)
    for (const team of teamsData) {
      if (!team.lead_user_id) continue;
      const leadRep = repsData.find(r => r.user_id === team.lead_user_id);
      const key = normalizeFirstToken(leadRep?.name);
      if (!key) continue;
      if (!teamKeyToTeam.has(key)) {
        teamKeyToTeam.set(key, team);
      }
    }

    // Special handling: Levi's group needs to include Levi's "downline" (recruits of recruits)
    // even when team_leader data is inconsistent.
    const leviTeam = teamKeyToTeam.get('levi');
    const leviDownlineNotionIds = new Set<string>();

    if (leviTeam) {
      const rootKey = 'levi tingey';
      const nameToNotionId = new Map<string, string>();

      for (const rep of repsData) {
        const key = normalizeFullName(rep.name);
        if (key && rep.notion_page_id) {
          // Keep first match; names should be unique enough for our usage.
          if (!nameToNotionId.has(key)) nameToNotionId.set(key, rep.notion_page_id);
        }
      }

      const rootNotionId = nameToNotionId.get(rootKey);
      if (rootNotionId) {
        leviDownlineNotionIds.add(rootNotionId);

        // Build downline set: any rep whose recruiter matches someone already in the set.
        const knownNames = new Set<string>([rootKey]);
        let frontier = new Set<string>([rootKey]);

        for (let depth = 0; depth < 6; depth++) {
          const nextFrontier = new Set<string>();
          for (const rep of repsData) {
            const recruiterKey = normalizeFullName(rep.recruiter);
            if (!recruiterKey || !frontier.has(recruiterKey)) continue;

            const repKey = normalizeFullName(rep.name);
            if (!repKey || knownNames.has(repKey)) continue;

            knownNames.add(repKey);
            nextFrontier.add(repKey);
            if (rep.notion_page_id) leviDownlineNotionIds.add(rep.notion_page_id);
          }
          if (nextFrontier.size === 0) break;
          frontier = nextFrontier;
        }

        console.log(`Levi downline computed: ${leviDownlineNotionIds.size} reps`);
      } else {
        console.warn('Levi team detected but could not find root rep "Levi Tingey" in reps table');
      }
    }

    // Build teams list
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

    console.log(`User ${user.email} has accessLevel: ${accessLevel}`);

    // Helper to get team info for a rep
    // 1) If rep is in Levi downline, force the Levi team
    // 2) If rep is a team lead (by user_id), use that
    // 3) Otherwise, map by rep.team_leader (first name)
    const getRepTeamInfo = (rep: any) => {
      // Force Levi team based on recruiter lineage
      if (leviTeam && rep.notion_page_id && leviDownlineNotionIds.has(rep.notion_page_id)) {
        const mgmtGroup = mgmtGroups.find(g => g.teamIds.includes(leviTeam.id));
        return {
          isTeamLead: false,
          teamId: leviTeam.id,
          teamName: leviTeam.name,
          mgmtGroupId: mgmtGroup?.id || null,
          mgmtGroupName: mgmtGroup?.name || null,
        };
      }

      // First check if this rep IS a team lead
      if (rep.user_id) {
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
      }

      // Otherwise look up by team_leader field
      if (rep.team_leader) {
        const leaderName = rep.team_leader.toLowerCase().trim();
        const team = teamKeyToTeam.get(leaderName);
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

    if (accessLevel === 'area_director') {
      // Area directors see ALL reps
      accessibleUserIds = repsData.filter(r => r.user_id).map(r => r.user_id!);
      accessibleReps = repsData.map(buildRepData);
      console.log(`Area director has access to ${accessibleReps.length} reps`);

    } else if (accessLevel === 'mgmt_group_lead') {
      // Get all mgmt groups this user leads
      const userMgmtGroups = mgmtGroups.filter(g => g.groupLeadId === user.id);
      const accessibleTeamIds = userMgmtGroups.flatMap(g => g.teamIds);
      
      for (const rep of repsData) {
        const teamInfo = getRepTeamInfo(rep);
        if (teamInfo.teamId && accessibleTeamIds.includes(teamInfo.teamId)) {
          if (rep.user_id) accessibleUserIds.push(rep.user_id);
          accessibleReps.push(buildRepData(rep));
        }
      }
      console.log(`MGMT group lead has access to ${accessibleTeamIds.length} teams, ${accessibleReps.length} reps`);

    } else if (accessLevel === 'team_lead') {
      // Get the team(s) this user leads
      const userTeams = teams.filter(t => t.groupLeadId === user.id);
      const userTeamIds = userTeams.map(t => t.id);

      if (userTeamIds.length > 0) {
        for (const rep of repsData) {
          const teamInfo = getRepTeamInfo(rep);
          if (teamInfo.teamId && userTeamIds.includes(teamInfo.teamId)) {
            if (rep.user_id) accessibleUserIds.push(rep.user_id);
            accessibleReps.push(buildRepData(rep));
          }
        }
        console.log(`Team lead (${userTeams.map(t => t.name).join(', ')}) has access to ${accessibleReps.length} reps`);
      }
    }

    // Log team counts for debugging
    const teamCounts = new Map<string, number>();
    for (const rep of accessibleReps) {
      const teamId = rep.teamId || 'unassigned';
      teamCounts.set(teamId, (teamCounts.get(teamId) || 0) + 1);
    }
    console.log('Team counts:', Object.fromEntries(teamCounts));

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
