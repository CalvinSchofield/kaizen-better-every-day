import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry helper for Notion API with exponential backoff
async function fetchNotionWithRetry(url: string, options: RequestInit, maxRetries = 5): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 32000);
        console.log(`Rate limited (429). Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error: any) {
      lastError = error;
      console.error(`Fetch attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 32000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error(`Failed after ${maxRetries} attempts`);
}

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
    
    let enrichedReps = reps || [];
    
    if (notionApiKey && reps && reps.length > 0) {
      try {
        const notionHeaders = {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        };

        // First, fetch all teams and build a mapping of team ID -> { teamName, mgmtGroupId }
        const teamsResponse = await fetchNotionWithRetry(
          `https://api.notion.com/v1/databases/${TEAMS_DATABASE_ID}/query`,
          { method: 'POST', headers: notionHeaders, body: JSON.stringify({}) }
        );
        const teamsData = await teamsResponse.json();
        
        const teamById: Record<string, { teamName: string; mgmtGroupId: string | null }> = {};
        for (const team of teamsData.results || []) {
          const teamName = team.properties['Name']?.title?.[0]?.plain_text || null;
          // Try both "MTMT Groups" and "MGMT Group" property names
          const mgmtGroupProp = team.properties['MTMT Groups'] || team.properties['MGMT Group'];
          const mgmtGroupId = mgmtGroupProp?.relation?.[0]?.id || null;
          if (teamName) {
            teamById[team.id] = { teamName, mgmtGroupId };
          }
        }
        console.log('Teams loaded:', Object.keys(teamById).length);

        // Fetch all MGMT groups
        const mgmtResponse = await fetchNotionWithRetry(
          `https://api.notion.com/v1/databases/${MGMT_DATABASE_ID}/query`,
          { method: 'POST', headers: notionHeaders, body: JSON.stringify({}) }
        );
        const mgmtData = await mgmtResponse.json();
        
        const mgmtGroupById: Record<string, string> = {};
        for (const group of mgmtData.results || []) {
          const groupName = group.properties['Name']?.title?.[0]?.plain_text || null;
          if (groupName) {
            mgmtGroupById[group.id] = groupName;
          }
        }
        console.log('MGMT groups loaded:', Object.keys(mgmtGroupById).length);

        // Now fetch each rep's Notion page to get their Teams relation
        const repMappings: Record<string, { teamName: string | null; mgmtGroupName: string | null }> = {};
        
        const repsWithNotion = reps.filter(r => r.notion_page_id);
        console.log('Reps with notion_page_id:', repsWithNotion.length);

        // Process in batches to avoid rate limits
        for (const rep of repsWithNotion) {
          try {
            const repResponse = await fetchNotionWithRetry(
              `https://api.notion.com/v1/pages/${rep.notion_page_id}`,
              { method: 'GET', headers: notionHeaders }
            );
            
            if (repResponse.ok) {
              const repData = await repResponse.json();
              const teamsRelation = repData.properties['Teams']?.relation || [];
              
              if (teamsRelation.length > 0) {
                const teamId = teamsRelation[0].id;
                const teamInfo = teamById[teamId];
                
                if (teamInfo) {
                  const mgmtGroupName = teamInfo.mgmtGroupId ? mgmtGroupById[teamInfo.mgmtGroupId] : null;
                  repMappings[rep.notion_page_id] = {
                    teamName: teamInfo.teamName,
                    mgmtGroupName: mgmtGroupName,
                  };
                  console.log(`Mapped ${rep.name} -> Team: ${teamInfo.teamName}, MGMT: ${mgmtGroupName}`);
                }
              }
            }
          } catch (error) {
            console.error(`Error fetching rep ${rep.name}:`, error);
          }
        }
        
        console.log('Rep mappings created:', Object.keys(repMappings).length);

        // Enrich rep data with team/MGMT group info
        enrichedReps = reps.map(rep => ({
          ...rep,
          teamName: rep.notion_page_id ? (repMappings[rep.notion_page_id]?.teamName || null) : null,
          mgmtGroupName: rep.notion_page_id ? (repMappings[rep.notion_page_id]?.mgmtGroupName || null) : null,
        }));
        
      } catch (error) {
        console.error('Error fetching team/MGMT info:', error);
        // Return reps without enrichment on error
        enrichedReps = reps.map(rep => ({
          ...rep,
          teamName: null,
          mgmtGroupName: null,
        }));
      }
    }

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
