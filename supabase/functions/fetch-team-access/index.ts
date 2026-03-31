import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Role hierarchy for comparison (index = weight)
const ROLE_WEIGHT: Record<string, number> = {
  none: 0,
  recruiter: 1,
  assistant_manager: 2,
  team_lead: 3,
  manager: 4,
  senior_manager: 5,
  mgmt_group_lead: 6,
  area_director: 7,
  regional: 8,
  sr_regional: 9,
  partner: 10,
  divisional: 11,
  corporate: 12,
};

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

    // === ROLE DETECTION ===
    
    // 1. Check explicit user_roles table for assigned roles
    const { data: userRolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const explicitRoles = (userRolesData || []).map(r => r.role as string);
    
    // Find the highest explicit role
    let highestExplicitRole = 'none';
    for (const role of explicitRoles) {
      if ((ROLE_WEIGHT[role] || 0) > (ROLE_WEIGHT[highestExplicitRole] || 0)) {
        highestExplicitRole = role;
      }
    }

    // 2. Check database functions for area_director and corporate
    const { data: isAreaDirector } = await supabase.rpc('is_area_director', { _user_id: user.id });
    const { data: isCorporate } = await supabase.rpc('is_corporate', { _user_id: user.id });

    // 3. Get user's office assignments
    const { data: userOfficeIds } = await supabase.rpc('get_user_office_ids', { _user_id: user.id });
    const officeIds: string[] = userOfficeIds || [];

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

    // Fetch all reps to build mappings
    const { data: allReps } = await supabase
      .from('reps')
      .select('id, user_id, name, team_leader, recruiter, phone, year, stage, ramp_phase_1_complete');

    // Fetch all recruits
    const { data: allRecruits } = await supabase
      .from('recruits')
      .select('id, name, recruiter_user_id, team_id, mgmt_group_id, stage, year, phone');

    const mgmtGroupsData = mgmtGroupsRaw || [];
    const teamsData = teamsRaw || [];
    const teamMgmtGroups = teamMgmtGroupsRaw || [];
    const repsData = allReps || [];
    const recruitsData = allRecruits || [];

    // HELPER: Get recursive downline recruits
    const getDownlineRecruits = (recruiterId: string, alreadyAddedIds: Set<string>, depth: number = 0): any[] => {
      if (depth > 6) return [];
      
      const directRecruits = recruitsData.filter(r => r.recruiter_user_id === recruiterId);
      const result: any[] = [];
      
      for (const recruit of directRecruits) {
        if (alreadyAddedIds.has(recruit.id)) continue;
        alreadyAddedIds.add(recruit.id);
        
        result.push(recruit);
        
        const recruitRep = repsData.find(r => r.id === recruit.id);
        if (recruitRep?.user_id) {
          const indirectRecruits = getDownlineRecruits(recruitRep.user_id, alreadyAddedIds, depth + 1);
          result.push(...indirectRecruits);
        }
      }
      
      return result;
    };

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

    // Build rep.id → recruit map for formal team/group assignments
    const repIdToRecruit = new Map<string, typeof recruitsData[0]>();
    for (const recruit of recruitsData) {
      repIdToRecruit.set(recruit.id, recruit);
    }

    // Build teams list
    const teams = teamsData.map(t => ({
      id: t.id,
      name: t.name,
      groupLeadId: t.lead_user_id,
    }));

    const userIdToTeams = new Map<string, typeof teams[0][]>();
    for (const team of teams) {
      if (team.groupLeadId) {
        const existing = userIdToTeams.get(team.groupLeadId) || [];
        existing.push(team);
        userIdToTeams.set(team.groupLeadId, existing);
      }
    }

    // === REP TEAM INFO — formal table lookups only (no name heuristics) ===
    const getRepTeamInfo = (rep: any) => {
      // 1. Team lead?
      if (rep.user_id) {
        const teamsAsLead = userIdToTeams.get(rep.user_id);
        if (teamsAsLead && teamsAsLead.length > 0) {
          const primaryTeam = teamsAsLead[0];
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

      // 2. MGMT group lead?
      if (rep.user_id) {
        const ledGroup = mgmtGroupsData.find(g => g.lead_user_id === rep.user_id);
        if (ledGroup) {
          return {
            isTeamLead: false,
            teamId: null,
            teamName: null,
            mgmtGroupId: ledGroup.id,
            mgmtGroupName: ledGroup.name,
          };
        }
      }

      // 3. Formal recruit record (rep.id = recruit.id)
      const recruit = repIdToRecruit.get(rep.id);
      if (recruit) {
        let teamId = recruit.team_id || null;
        let teamName: string | null = null;
        let mgmtGroupId = recruit.mgmt_group_id || null;
        let mgmtGroupName: string | null = null;

        if (teamId) {
          const team = teamsData.find(t => t.id === teamId);
          teamName = team?.name || null;
          if (!mgmtGroupId) {
            const tmg = teamMgmtGroups.find(t => t.team_id === teamId);
            mgmtGroupId = tmg?.mgmt_group_id || null;
          }
        }

        if (mgmtGroupId) {
          const mg = mgmtGroupsData.find(g => g.id === mgmtGroupId);
          mgmtGroupName = mg?.name || null;
        }

        return { isTeamLead: false, teamId, teamName, mgmtGroupId, mgmtGroupName };
      }

      // 4. No formal assignment
      return { isTeamLead: false, teamId: null, teamName: null, mgmtGroupId: null, mgmtGroupName: null };
    };

    // Helper: get recruiter name
    const getRecruiterName = (rep: any): string | null => {
      if (rep.recruiter) return rep.recruiter;
      const recruit = recruitsData.find(r => r.id === rep.id);
      if (recruit?.recruiter_user_id) {
        const recruiterRep = repsData.find(r => r.user_id === recruit.recruiter_user_id);
        if (recruiterRep) return recruiterRep.name;
      }
      return null;
    };

    // Build rep data for response
    const buildRepData = (rep: any) => {
      const teamInfo = getRepTeamInfo(rep);
      const recruiterName = getRecruiterName(rep);
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
        recruiterName,
      };
    };

    const buildRecruitAsRepData = (recruit: any) => {
      const matchingRep = repsData.find(r => r.id === recruit.id || r.user_id === recruit.id);
      const team = teamsData.find(t => t.id === recruit.team_id);
      const mgmtGroup = mgmtGroupsData.find(g => g.id === recruit.mgmt_group_id);
      let recruiterName: string | null = null;
      if (recruit.recruiter_user_id) {
        const recruiterRep = repsData.find(r => r.user_id === recruit.recruiter_user_id);
        if (recruiterRep) recruiterName = recruiterRep.name;
      }
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
        recruiterName,
      };
    };

    let accessibleUserIds: string[] = [];
    let accessibleReps: any[] = [];

    const currentUserRepId = repData.id;
    const directRecruitIds = new Set<string>();
    const directRecruits = recruitsData.filter(r => r.recruiter_user_id === user.id);
    for (const recruit of directRecruits) {
      directRecruitIds.add(recruit.id);
    }

    // === DATA SCOPING BASED ON ACCESS LEVEL ===
    
    // Regional+ and Corporate see everything
    if (['corporate', 'divisional', 'partner', 'sr_regional', 'regional'].includes(accessLevel)) {
      for (const rep of repsData) {
        if (rep.user_id) accessibleUserIds.push(rep.user_id);
        accessibleReps.push({
          ...buildRepData(rep),
          isDirectRecruit: directRecruitIds.has(rep.id),
        });
      }
      console.log(`${accessLevel} user has access to ${accessibleReps.length} reps (all)`);

    } else if (accessLevel === 'area_director') {
      // Area directors see reps scoped to their office(s) + recruiter downline
      const officeTeamIds = new Set<string>();
      const officeMgmtGroupIds = new Set<string>();
      
      if (officeIds.length > 0) {
        const { data: officeTeams } = await supabase
          .from('teams')
          .select('id')
          .in('office_id', officeIds);
        for (const t of (officeTeams || [])) officeTeamIds.add(t.id);
        
        const { data: officeMgmtGroups } = await supabase
          .from('mgmt_groups')
          .select('id')
          .in('office_id', officeIds);
        for (const g of (officeMgmtGroups || [])) officeMgmtGroupIds.add(g.id);
        
        for (const tmg of teamMgmtGroups) {
          if (officeMgmtGroupIds.has(tmg.mgmt_group_id)) {
            officeTeamIds.add(tmg.team_id);
          }
        }
      }
      
      const addedIds = new Set<string>();
      
      addedIds.add(currentUserRepId);
      if (repData.user_id) accessibleUserIds.push(repData.user_id);
      accessibleReps.push({ ...buildRepData(repData), isDirectRecruit: false });
      
      for (const rep of repsData) {
        if (addedIds.has(rep.id)) continue;
        
        if (officeIds.length > 0) {
          const teamInfo = getRepTeamInfo(rep);
          const inOffice = (teamInfo.teamId && officeTeamIds.has(teamInfo.teamId)) ||
                           (teamInfo.mgmtGroupId && officeMgmtGroupIds.has(teamInfo.mgmtGroupId));
          if (!inOffice) continue;
        }
        
        addedIds.add(rep.id);
        if (rep.user_id) accessibleUserIds.push(rep.user_id);
        accessibleReps.push({
          ...buildRepData(rep),
          isDirectRecruit: directRecruitIds.has(rep.id),
        });
      }
      
      // Also include recruiter downline (cross-office)
      const downlineRecruits = getDownlineRecruits(user.id, addedIds);
      for (const recruit of downlineRecruits) {
        const matchingRep = repsData.find(r => r.id === recruit.id);
        if (matchingRep) {
          if (matchingRep.user_id && !accessibleUserIds.includes(matchingRep.user_id)) {
            accessibleUserIds.push(matchingRep.user_id);
          }
          accessibleReps.push({
            ...buildRepData(matchingRep),
            isDirectRecruit: directRecruitIds.has(matchingRep.id),
          });
        } else {
          accessibleReps.push({
            ...buildRecruitAsRepData(recruit),
            isDirectRecruit: directRecruitIds.has(recruit.id),
          });
        }
      }
      
      console.log(`Area director has access to ${accessibleReps.length} reps (${officeIds.length} offices)`);

    } else if (accessLevel === 'mgmt_group_lead') {
      const userMgmtGroups = mgmtGroups.filter(g => g.groupLeadId === user.id);
      const accessibleTeamIds = userMgmtGroups.flatMap(g => g.teamIds);
      const addedIds = new Set<string>();
      
      addedIds.add(currentUserRepId);
      if (repData.user_id) accessibleUserIds.push(repData.user_id);
      accessibleReps.push({ ...buildRepData(repData), isDirectRecruit: false });
      
      for (const rep of repsData) {
        if (rep.id === currentUserRepId) continue;
        const teamInfo = getRepTeamInfo(rep);
        if (teamInfo.teamId && accessibleTeamIds.includes(teamInfo.teamId)) {
          if (!addedIds.has(rep.id)) {
            addedIds.add(rep.id);
            if (rep.user_id) accessibleUserIds.push(rep.user_id);
            accessibleReps.push({
              ...buildRepData(rep),
              isDirectRecruit: directRecruitIds.has(rep.id),
            });
          }
        }
      }
      
      const downlineRecruits = getDownlineRecruits(user.id, addedIds);
      for (const recruit of downlineRecruits) {
        const matchingRep = repsData.find(r => r.id === recruit.id);
        if (matchingRep) {
          if (matchingRep.user_id && !accessibleUserIds.includes(matchingRep.user_id)) {
            accessibleUserIds.push(matchingRep.user_id);
          }
          accessibleReps.push({
            ...buildRepData(matchingRep),
            isDirectRecruit: directRecruitIds.has(matchingRep.id),
          });
        } else {
          accessibleReps.push({
            ...buildRecruitAsRepData(recruit),
            isDirectRecruit: directRecruitIds.has(recruit.id),
          });
        }
      }
      
      console.log(`MGMT group lead has access to ${accessibleTeamIds.length} teams, ${accessibleReps.length} reps`);

    } else if (accessLevel === 'team_lead') {
      const userTeams = teams.filter(t => t.groupLeadId === user.id);
      const userTeamIds = userTeams.map(t => t.id);
      const addedIds = new Set<string>();

      addedIds.add(currentUserRepId);
      if (repData.user_id) accessibleUserIds.push(repData.user_id);
      accessibleReps.push({ ...buildRepData(repData), isDirectRecruit: false });

      if (userTeamIds.length > 0) {
        for (const rep of repsData) {
          if (rep.id === currentUserRepId) continue;
          const teamInfo = getRepTeamInfo(rep);
          if (teamInfo.teamId && userTeamIds.includes(teamInfo.teamId)) {
            if (!addedIds.has(rep.id)) {
              addedIds.add(rep.id);
              if (rep.user_id) accessibleUserIds.push(rep.user_id);
              accessibleReps.push({
                ...buildRepData(rep),
                isDirectRecruit: directRecruitIds.has(rep.id),
              });
            }
          }
        }
      }
      
      const downlineRecruits = getDownlineRecruits(user.id, addedIds);
      for (const recruit of downlineRecruits) {
        const matchingRep = repsData.find(r => r.id === recruit.id);
        if (matchingRep) {
          if (matchingRep.user_id && !accessibleUserIds.includes(matchingRep.user_id)) {
            accessibleUserIds.push(matchingRep.user_id);
          }
          accessibleReps.push({
            ...buildRepData(matchingRep),
            isDirectRecruit: directRecruitIds.has(matchingRep.id),
          });
        } else {
          accessibleReps.push({
            ...buildRecruitAsRepData(recruit),
            isDirectRecruit: directRecruitIds.has(recruit.id),
          });
        }
      }
      
      console.log(`Team lead has ${accessibleReps.length} total reps`);
      
    } else if (accessLevel === 'assistant_manager' || accessLevel === 'recruiter') {
      // Both assistant_manager and recruiter see their recruiter downline
      const addedIds = new Set<string>();
      
      addedIds.add(currentUserRepId);
      if (repData.user_id) accessibleUserIds.push(repData.user_id);
      accessibleReps.push({ ...buildRepData(repData), isDirectRecruit: false });
      
      const allDownlineRecruits = getDownlineRecruits(user.id, addedIds);
      
      for (const recruit of allDownlineRecruits) {
        const matchingRep = repsData.find(r => r.id === recruit.id);
        if (matchingRep) {
          if (matchingRep.user_id) accessibleUserIds.push(matchingRep.user_id);
          accessibleReps.push({
            ...buildRepData(matchingRep),
            isDirectRecruit: directRecruitIds.has(matchingRep.id),
          });
        } else {
          accessibleReps.push({
            ...buildRecruitAsRepData(recruit),
            isDirectRecruit: directRecruitIds.has(recruit.id),
          });
        }
      }
      
      console.log(`${accessLevel} has access to ${accessibleReps.length} reps (downline)`);
    }

    // Log team counts
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
