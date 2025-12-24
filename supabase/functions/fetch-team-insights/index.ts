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
    const { userIds, dateRange, excludeUserIds = [] } = await req.json();

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

    // Filter out excluded users
    const filteredUserIds = userIds.filter(id => !excludeUserIds.includes(id));

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
          .in('user_id', filteredUserIds)
          .eq('is_finalized', true);

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
        .select('user_id, name, year, notion_page_id')
        .in('user_id', filteredUserIds),
    ]);

    const entries = entriesResult.data || [];
    const reps = repsResult.data || [];

    if (entriesResult.error) {
      throw entriesResult.error;
    }

    // Fetch team assignments from recruits table for these reps
    const repNotionIds = reps.filter(r => r.notion_page_id).map(r => r.notion_page_id);
    
    // Get recruiter assignments to determine team membership
    const { data: recruiterData } = await supabase
      .from('recruits')
      .select('recruiter_user_id, team_id')
      .in('recruiter_user_id', filteredUserIds);

    // Build a map of user_id to team_id
    const userTeamMap: Record<string, string> = {};
    (recruiterData || []).forEach(r => {
      if (r.recruiter_user_id && r.team_id) {
        userTeamMap[r.recruiter_user_id] = r.team_id;
      }
    });

    // Fetch team names
    const teamIds = [...new Set(Object.values(userTeamMap))];
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', teamIds);

    const teamNameMap: Record<string, string> = {};
    (teamsData || []).forEach(t => { teamNameMap[t.id] = t.name; });

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
        teamName: teamId ? teamNameMap[teamId] : null,
        mgmtGroupName: mgmtId ? mgmtNameMap[mgmtId] : null,
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
