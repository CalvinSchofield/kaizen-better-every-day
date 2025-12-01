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

    // Build query for daily entries
    let query = supabase
      .from('daily_entries')
      .select('*')
      .in('user_id', filteredUserIds)
      .eq('is_finalized', true);

    // Apply date range filters if provided
    if (dateRange?.start) {
      query = query.gte('entry_date', dateRange.start);
    }
    if (dateRange?.end) {
      query = query.lte('entry_date', dateRange.end);
    }

    const { data: entries, error } = await query;

    if (error) {
      throw error;
    }

    // Get rep information for the user IDs
    const { data: reps } = await supabase
      .from('reps')
      .select('user_id, name, year, notion_page_id')
      .in('user_id', filteredUserIds);

    // Fetch team and MGMT group information from Notion
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    const TEAMS_DATABASE_ID = '287070fe3bc280e1ab5fec17d5582878';
    const MGMT_DATABASE_ID = '287070fe3bc2804f874bd9dae57bd1b9';
    
    let teamMappings: Record<string, { teamName: string; mgmtGroupName: string }> = {};
    
    if (notionApiKey) {
      try {
        // Fetch all teams
        const teamsResponse = await fetch(`https://api.notion.com/v1/databases/${TEAMS_DATABASE_ID}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${notionApiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        const teamsData = await teamsResponse.json();
        
        // Fetch all MGMT groups
        const mgmtResponse = await fetch(`https://api.notion.com/v1/databases/${MGMT_DATABASE_ID}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${notionApiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        const mgmtData = await mgmtResponse.json();
        
        // Build mappings
        const mgmtGroupsById: Record<string, string> = {};
        for (const group of mgmtData.results || []) {
          const nameProperty = group.properties['Name'];
          const groupName = nameProperty?.title?.[0]?.plain_text || 'Unknown Group';
          mgmtGroupsById[group.id] = groupName;
        }
        
        // Map reps to teams and MGMT groups
        for (const team of teamsData.results || []) {
          const teamProps = team.properties;
          const nameProperty = teamProps['Name'];
          const teamName = nameProperty?.title?.[0]?.plain_text || 'Unknown Team';
          
          const repsProperty = teamProps['Reps'];
          const repRelations = repsProperty?.relation || [];
          
          const mgmtGroupProperty = teamProps['MGMT Group'];
          const mgmtGroupId = mgmtGroupProperty?.relation?.[0]?.id;
          const mgmtGroupName = mgmtGroupId ? (mgmtGroupsById[mgmtGroupId] || 'Unknown Group') : 'No Group';
          
          for (const repRelation of repRelations) {
            const repNotionId = repRelation.id;
            teamMappings[repNotionId] = { teamName, mgmtGroupName };
          }
        }
      } catch (error) {
        console.error('Error fetching team/MGMT info:', error);
      }
    }
    
    // Enrich rep data with team/MGMT group info
    const enrichedReps = (reps || []).map(rep => ({
      ...rep,
      teamName: rep.notion_page_id ? (teamMappings[rep.notion_page_id]?.teamName || 'Unknown Team') : 'Unknown Team',
      mgmtGroupName: rep.notion_page_id ? (teamMappings[rep.notion_page_id]?.mgmtGroupName || 'Unknown Group') : 'Unknown Group',
    }));

    console.log(`Fetched ${entries?.length || 0} entries for ${filteredUserIds.length} users`);

    return new Response(JSON.stringify({
      entries: entries || [],
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
