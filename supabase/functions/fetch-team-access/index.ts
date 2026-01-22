import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Note: Area Director detection now uses database function is_area_director()

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

    // Use database function to determine if user is Area Director
    const { data: isAreaDirector } = await supabase.rpc('is_area_director', { _user_id: user.id });

    // Fetch all mgmt_groups
    const { data: mgmtGroupsRaw } = await supabase
      .from('mgmt_groups')
      .select('id, name, lead_user_id');

    // Fetch all teams
    const { data: teamsRaw } = await supabase
      .from('teams')
      .select('id, name, lead_user_id');

    // Fetch team-mgmt_group relationships
    const { data: teamMgmtGroupsRaw } = await supabase
      .from('team_mgmt_groups')
      .select('team_id, mgmt_group_id');

    // Fetch all reps to build mappings (using id as primary identifier)
    const { data: allReps } = await supabase
      .from('reps')
      .select('id, user_id, name, team_leader, recruiter, phone, year, stage, ramp_phase_1_complete');

    // Fetch all recruits to check for recruiter relationships
    const { data: allRecruits } = await supabase
      .from('recruits')
      .select('id, name, recruiter_user_id, team_id, mgmt_group_id, stage, year, phone');

    const mgmtGroupsData = mgmtGroupsRaw || [];
    const teamsData = teamsRaw || [];
    const teamMgmtGroups = teamMgmtGroupsRaw || [];
    const repsData = allReps || [];
    const recruitsData = allRecruits || [];

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
    const leviDownlineIds = new Set<string>();

    if (leviTeam) {
      const rootKey = 'levi tingey';
      const nameToId = new Map<string, string>();

      for (const rep of repsData) {
        const key = normalizeFullName(rep.name);
        if (key && rep.id) {
          // Keep first match; names should be unique enough for our usage.
          if (!nameToId.has(key)) nameToId.set(key, rep.id);
        }
      }

      const rootId = nameToId.get(rootKey);
      if (rootId) {
        leviDownlineIds.add(rootId);

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
            if (rep.id) leviDownlineIds.add(rep.id);
          }
          if (nextFrontier.size === 0) break;
          frontier = nextFrontier;
        }

        console.log(`Levi downline computed: ${leviDownlineIds.size} reps`);
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

    // Create a map of lead_user_id -> teams (plural, since one person can lead multiple)
    const userIdToTeams = new Map<string, typeof teams[0][]>();
    for (const team of teams) {
      if (team.groupLeadId) {
        const existing = userIdToTeams.get(team.groupLeadId) || [];
        existing.push(team);
        userIdToTeams.set(team.groupLeadId, existing);
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

    // NEW: Check if user has recruited anyone (grants 'recruiter' access if no formal role)
    if (accessLevel === 'none') {
      const directRecruits = recruitsData.filter(r => r.recruiter_user_id === user.id);
      if (directRecruits.length > 0) {
        accessLevel = 'recruiter';
        console.log(`User ${user.email} granted recruiter access (${directRecruits.length} direct recruits)`);
      }
    }

    console.log(`User ${user.email} has accessLevel: ${accessLevel}`);

    // Helper to get team info for a rep
    // 1) If rep is in Levi downline, force the Levi team
    // 2) If rep is a team lead, use their "primary" team (the one matching their name, or first one)
    // 3) Otherwise, map by rep.team_leader (first name)
    const getRepTeamInfo = (rep: any) => {
      // First check if this rep IS a team lead - they should show their PRIMARY team
      // (the one that matches their name, not all teams they manage)
      if (rep.user_id) {
        const teamsAsLead = userIdToTeams.get(rep.user_id);
        if (teamsAsLead && teamsAsLead.length > 0) {
          // Find the team that matches the rep's name (their "home" team)
          const repNameKey = normalizeFirstToken(rep.name);
          const primaryTeam = teamsAsLead.find(t => normalizeFirstToken(t.name) === repNameKey) || teamsAsLead[0];
          
          const mgmtGroup = mgmtGroups.find(g => g.teamIds.includes(primaryTeam.id));
          return {
            isTeamLead: true,
            teamId: primaryTeam.id,
            teamName: primaryTeam.name,
            mgmtGroupId: mgmtGroup?.id || null,
            mgmtGroupName: mgmtGroup?.name || null,
          };
        }
      }

      // Force Levi team based on recruiter lineage (only for non-team-leads)
      if (leviTeam && rep.id && leviDownlineIds.has(rep.id)) {
        const mgmtGroup = mgmtGroups.find(g => g.teamIds.includes(leviTeam.id));
        return {
          isTeamLead: false,
          teamId: leviTeam.id,
          teamName: leviTeam.name,
          mgmtGroupId: mgmtGroup?.id || null,
          mgmtGroupName: mgmtGroup?.name || null,
        };
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

        // team_leader doesn't match a known team - trace up the recruiter chain
        // to find the first person who IS on a known team
        const recruiterKey = normalizeFullName(rep.recruiter);
        if (recruiterKey) {
          let current = repsData.find(r => normalizeFullName(r.name) === recruiterKey);
          for (let depth = 0; depth < 6 && current; depth++) {
            // Check if current rep's team_leader matches a known team
            if (current.team_leader) {
              const currentLeaderName = current.team_leader.toLowerCase().trim();
              const currentTeam = teamKeyToTeam.get(currentLeaderName);
              if (currentTeam) {
                const mgmtGroup = mgmtGroups.find(g => g.teamIds.includes(currentTeam.id));
                console.log(`Resolved ${rep.name} to ${currentTeam.name} via recruiter lineage (${current.name})`);
                return {
                  isTeamLead: false,
                  teamId: currentTeam.id,
                  teamName: currentTeam.name,
                  mgmtGroupId: mgmtGroup?.id || null,
                  mgmtGroupName: mgmtGroup?.name || null,
                };
              }
            }

            // Check if current rep is themselves a team lead
            if (current.user_id) {
              const currentTeamsAsLead = userIdToTeams.get(current.user_id);
              if (currentTeamsAsLead && currentTeamsAsLead.length > 0) {
                const currentTeam = currentTeamsAsLead[0];
                const mgmtGroup = mgmtGroups.find(g => g.teamIds.includes(currentTeam.id));
                console.log(`Resolved ${rep.name} to ${currentTeam.name} via recruiter who is team lead (${current.name})`);
                return {
                  isTeamLead: false,
                  teamId: currentTeam.id,
                  teamName: currentTeam.name,
                  mgmtGroupId: mgmtGroup?.id || null,
                  mgmtGroupName: mgmtGroup?.name || null,
                };
              }
            }

            // Go up one level in the recruiter chain
            const nextKey = normalizeFullName(current.recruiter);
            current = nextKey ? repsData.find(r => normalizeFullName(r.name) === nextKey) : undefined;
          }
        }
      }

      // No matching team found - group under "Other" instead of fake "Team [Name]"
      return {
        isTeamLead: false,
        teamId: null,
        teamName: null,
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

    // Helper to build recruit data (for recruiter access level)
    const buildRecruitAsRepData = (recruit: any) => {
      // Find matching rep if exists
      const matchingRep = repsData.find(r => r.id === recruit.id || r.user_id === recruit.id);
      
      // Get team/mgmt info from recruit record
      const team = teamsData.find(t => t.id === recruit.team_id);
      const mgmtGroup = mgmtGroupsData.find(g => g.id === recruit.mgmt_group_id);
      
      return {
        id: recruit.id,
        userId: matchingRep?.user_id || null,
        name: recruit.name,
        phone: recruit.phone || matchingRep?.phone || null,
        year: recruit.year || matchingRep?.year || null,
        stage: recruit.stage || matchingRep?.stage || null,
        isTeamLead: false,
        teamId: recruit.team_id || null,
        teamName: team?.name || null,
        mgmtGroupId: recruit.mgmt_group_id || null,
        mgmtGroupName: mgmtGroup?.name || null,
        isGhostRep: !matchingRep?.user_id,
        rampPhase1Complete: matchingRep?.ramp_phase_1_complete || false,
      };
    };

    let accessibleUserIds: string[] = [];
    let accessibleReps: any[] = [];

    // Get current user's rep id to exclude self from accessible reps
    const currentUserRepId = repData.id;

    if (accessLevel === 'area_director') {
      // Area directors see ALL reps except themselves
      for (const rep of repsData) {
        // Skip the current user
        if (rep.user_id === user.id || rep.id === currentUserRepId) continue;
        
        if (rep.user_id) accessibleUserIds.push(rep.user_id);
        accessibleReps.push(buildRepData(rep));
      }
      console.log(`Area director has access to ${accessibleReps.length} reps (excluding self)`);

    } else if (accessLevel === 'mgmt_group_lead') {
      // Get all mgmt groups this user leads
      const userMgmtGroups = mgmtGroups.filter(g => g.groupLeadId === user.id);
      const accessibleTeamIds = userMgmtGroups.flatMap(g => g.teamIds);
      
      for (const rep of repsData) {
        // Skip the current user
        if (rep.user_id === user.id || rep.id === currentUserRepId) continue;
        
        const teamInfo = getRepTeamInfo(rep);
        if (teamInfo.teamId && accessibleTeamIds.includes(teamInfo.teamId)) {
          if (rep.user_id) accessibleUserIds.push(rep.user_id);
          accessibleReps.push(buildRepData(rep));
        }
      }
      console.log(`MGMT group lead has access to ${accessibleTeamIds.length} teams, ${accessibleReps.length} reps (excluding self)`);

    } else if (accessLevel === 'team_lead') {
      // Get the team(s) this user leads
      const userTeams = teams.filter(t => t.groupLeadId === user.id);
      const userTeamIds = userTeams.map(t => t.id);

      if (userTeamIds.length > 0) {
        for (const rep of repsData) {
          // Skip the current user
          if (rep.user_id === user.id || rep.id === currentUserRepId) continue;
          
          const teamInfo = getRepTeamInfo(rep);
          if (teamInfo.teamId && userTeamIds.includes(teamInfo.teamId)) {
            if (rep.user_id) accessibleUserIds.push(rep.user_id);
            accessibleReps.push(buildRepData(rep));
          }
        }
        console.log(`Team lead (${userTeams.map(t => t.name).join(', ')}) has access to ${accessibleReps.length} reps (excluding self)`);
      }
    } else if (accessLevel === 'recruiter') {
      // NEW: Recruiters see their direct and indirect recruits
      const addedIds = new Set<string>();
      
      // Helper to recursively get recruits downline
      const getDownlineRecruits = (recruiterId: string, depth: number = 0): any[] => {
        if (depth > 6) return []; // Prevent infinite recursion
        
        const directRecruits = recruitsData.filter(r => r.recruiter_user_id === recruiterId);
        const result: any[] = [];
        
        for (const recruit of directRecruits) {
          if (addedIds.has(recruit.id)) continue;
          addedIds.add(recruit.id);
          
          result.push(recruit);
          
          // Recursively get recruits of this recruit
          const indirectRecruits = getDownlineRecruits(recruit.id, depth + 1);
          result.push(...indirectRecruits);
        }
        
        return result;
      };
      
      const allDownlineRecruits = getDownlineRecruits(user.id);
      
      for (const recruit of allDownlineRecruits) {
        // Find matching rep record if exists
        const matchingRep = repsData.find(r => r.id === recruit.id);
        
        if (matchingRep) {
          if (matchingRep.user_id) accessibleUserIds.push(matchingRep.user_id);
          accessibleReps.push(buildRepData(matchingRep));
        } else {
          // Use recruit data directly if no rep record
          accessibleReps.push(buildRecruitAsRepData(recruit));
        }
      }
      
      console.log(`Recruiter has access to ${accessibleReps.length} recruits in their downline`);
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
