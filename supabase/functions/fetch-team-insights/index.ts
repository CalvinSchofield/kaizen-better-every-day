import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userIds, dateRange, excludeUserIds = [], includeLive = false } = await req.json();

    if (!userIds || !Array.isArray(userIds)) {
      throw new Error('userIds array is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current user for access verification
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- SERVER-SIDE ACCESS VALIDATION ---
    // Determine caller's access level and filter userIds to only those they can access
    const { data: isAreaDir } = await supabase.rpc('is_area_director', { _user_id: user.id });
    const { data: isMgmtLead } = await supabase.rpc('is_mgmt_group_lead', { _user_id: user.id });
    const { data: isTeamLead } = await supabase.rpc('is_team_lead', { _user_id: user.id });
    
    let allowedUserIds: string[] = [];

    if (isAreaDir) {
      // Area directors can see all reps
      const { data: allReps } = await supabase
        .from('reps')
        .select('user_id')
        .not('user_id', 'is', null);
      allowedUserIds = (allReps || []).map(r => r.user_id!);
    } else if (isMgmtLead || isTeamLead) {
      // Leaders can only see reps in their accessible teams
      const { data: accessibleTeamIds } = await supabase.rpc('get_accessible_team_ids', { _user_id: user.id });
      
      if (accessibleTeamIds && accessibleTeamIds.length > 0) {
        // Get recruits in these teams to find their recruiter user IDs
        const { data: teamRecruits } = await supabase
          .from('recruits')
          .select('id, recruiter_user_id')
          .in('team_id', accessibleTeamIds);
        
        const recruitIds = (teamRecruits || []).map(r => r.id);
        const recruiterUserIds = (teamRecruits || []).map(r => r.recruiter_user_id).filter(Boolean);
        
        // Get reps matching these recruit IDs (by email) OR who are recruiters
        const { data: recruitsWithEmails } = await supabase
          .from('recruits')
          .select('email')
          .in('id', recruitIds)
          .not('email', 'is', null);
        
        const emails = (recruitsWithEmails || []).map(r => r.email?.toLowerCase()).filter(Boolean);
        
        // Get reps by email match or recruiter user IDs
        const { data: accessibleReps } = await supabase
          .from('reps')
          .select('user_id, email')
          .not('user_id', 'is', null);
        
        const matchingReps = (accessibleReps || []).filter(rep => 
          recruiterUserIds.includes(rep.user_id) || 
          (rep.email && emails.includes(rep.email.toLowerCase()))
        );
        
        allowedUserIds = [...new Set(matchingReps.map(r => r.user_id).filter(Boolean) as string[])];
      }
    }

    // Reports should be able to include the leader (self) in results
    if (user.id && !allowedUserIds.includes(user.id)) {
      allowedUserIds.push(user.id);
    }
    
    // Filter requested userIds to only those the caller is allowed to access
    const validatedUserIds = userIds.filter((id: string) => allowedUserIds.includes(id));
    
    console.log(`User ${user.email} requested ${userIds.length} userIds, validated ${validatedUserIds.length} (isAD: ${isAreaDir}, isMgmt: ${isMgmtLead}, isTeam: ${isTeamLead})`);
    
    // If no valid user IDs after filtering, return empty
    if (validatedUserIds.length === 0) {
      return new Response(JSON.stringify({ entries: [], reps: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter out excluded users
    const filteredUserIds = validatedUserIds.filter((id: string) => !excludeUserIds.includes(id));

    if (filteredUserIds.length === 0) {
      return new Response(JSON.stringify({ entries: [], reps: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch entries and reps in parallel
    const [entriesResult, repsResult] = await Promise.all([
      (async () => {
        let query = supabase
          .from('daily_entries')
          .select('*')
          .in('user_id', filteredUserIds);

        // Include all entries (finalized and unfinalized) for all views.
        // Previously only live/today included unfinalized, but this caused
        // Yesterday/This Week to show 0 sales when auto-finalize hadn't run yet.

        if (dateRange?.start) {
          query = query.gte('entry_date', dateRange.start);
        }
        if (dateRange?.end) {
          query = query.lte('entry_date', dateRange.end);
        }

        return query;
      })(),
      supabase
        .from('reps')
        .select('user_id, name, year, id, timezone, recruiter')
        .in('user_id', filteredUserIds),
    ]);

    const entries = entriesResult.data || [];
    const reps = repsResult.data || [];

    if (entriesResult.error) {
      throw entriesResult.error;
    }

    // Get team membership via multiple resolution strategies
    // Fetch teams with their lead_user_id
    const { data: allTeamsData } = await supabase
      .from('teams')
      .select('id, name, lead_user_id');
    
    const teamLeadToTeamMap: Record<string, { id: string; name: string }> = {};
    const teamNameMap: Record<string, string> = {};
    
    (allTeamsData || []).forEach(t => {
      teamNameMap[t.id] = t.name;
      if (t.lead_user_id) {
        teamLeadToTeamMap[t.lead_user_id] = { id: t.id, name: t.name };
      }
    });

    // Fetch the rep's own recruit record to get their direct team_id and mgmt_group_id
    const { data: recruitRecords } = await supabase
      .from('recruits')
      .select('id, team_id, mgmt_group_id')
      .in('id', filteredUserIds);

    const recruitTeamMap: Record<string, string> = {};
    const recruitMgmtMap: Record<string, string> = {};
    (recruitRecords || []).forEach(r => {
      if (r.team_id) recruitTeamMap[r.id] = r.team_id;
      if (r.mgmt_group_id) recruitMgmtMap[r.id] = r.mgmt_group_id;
    });
    
    // Build a map of user_id to team info
    // Priority: 1) Rep is a team lead → their team  2) Rep's own recruit record  3) Recruiter relationship fallback
    const userTeamMap: Record<string, string> = {};
    
    // First assign team leads to their own teams
    filteredUserIds.forEach((userId: string) => {
      const leadTeam = teamLeadToTeamMap[userId];
      if (leadTeam) {
        userTeamMap[userId] = leadTeam.id;
      }
    });

    // Then assign from recruit's own team_id
    filteredUserIds.forEach((userId: string) => {
      if (!userTeamMap[userId] && recruitTeamMap[userId]) {
        userTeamMap[userId] = recruitTeamMap[userId];
      }
    });

    // Fetch team IDs we need info for
    const teamIds = [...new Set(Object.values(userTeamMap))];

    // Fetch mgmt group assignments
    const { data: teamMgmtData } = await supabase
      .from('team_mgmt_groups')
      .select('team_id, mgmt_group_id')
      .in('team_id', teamIds);

    const teamMgmtMap: Record<string, string> = {};
    (teamMgmtData || []).forEach(tm => { teamMgmtMap[tm.team_id] = tm.mgmt_group_id; });

    // Fetch mgmt group names
    const mgmtIds = [...new Set(Object.values(teamMgmtMap))];
    const { data: mgmtData } = await supabase
      .from('mgmt_groups')
      .select('id, name')
      .in('id', mgmtIds);

    const mgmtNameMap: Record<string, string> = {};
    (mgmtData || []).forEach(m => { mgmtNameMap[m.id] = m.name; });

    // Enrich rep data with team/MGMT group info
    const enrichedReps = reps.map(rep => {
      const teamId = userTeamMap[rep.user_id];
      const mgmtId = teamId ? teamMgmtMap[teamId] : null;
      
      return {
        ...rep,
        teamId: teamId || null,
        teamName: teamId ? teamNameMap[teamId] : null,
        mgmtGroupId: mgmtId || null,
        mgmtGroupName: mgmtId ? mgmtNameMap[mgmtId] : null,
        recruiterName: rep.recruiter || null,
      };
    });

    console.log(`Returning ${entries.length} entries for ${filteredUserIds.length} users`);

    return new Response(JSON.stringify({
      entries,
      reps: enrichedReps,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in fetch-team-insights:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
