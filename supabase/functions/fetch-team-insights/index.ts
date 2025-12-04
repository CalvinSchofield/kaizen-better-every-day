import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry helper for Notion API with exponential backoff
async function fetchNotionWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error(`Failed after ${maxRetries} attempts`);
}

// Batch fetch multiple Notion pages in parallel with concurrency limit
async function batchFetchNotionPages(
  pageIds: string[], 
  notionHeaders: Record<string, string>, 
  concurrency = 10
): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
  for (let i = 0; i < pageIds.length; i += concurrency) {
    const batch = pageIds.slice(i, i + concurrency);
    const promises = batch.map(async (pageId) => {
      try {
        const response = await fetchNotionWithRetry(
          `https://api.notion.com/v1/pages/${pageId}`,
          { method: 'GET', headers: notionHeaders }
        );
        if (response.ok) {
          return { pageId, data: await response.json() };
        }
        return { pageId, data: null };
      } catch (error) {
        return { pageId, data: null };
      }
    });
    
    const batchResults = await Promise.all(promises);
    for (const { pageId, data } of batchResults) {
      if (data) results.set(pageId, data);
    }
  }
  
  return results;
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

    // Fetch team and MGMT group information from Notion
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    const TEAMS_DATABASE_ID = '287070fe3bc280e1ab5fec17d5582878';
    const MGMT_DATABASE_ID = '287070fe3bc2804f874bd9dae57bd1b9';
    
    let enrichedReps = reps;
    
    if (notionApiKey && reps.length > 0) {
      try {
        const notionHeaders = {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        };

        // Fetch teams and MGMT groups in parallel
        const [teamsResponse, mgmtResponse] = await Promise.all([
          fetchNotionWithRetry(
            `https://api.notion.com/v1/databases/${TEAMS_DATABASE_ID}/query`,
            { method: 'POST', headers: notionHeaders, body: JSON.stringify({}) }
          ),
          fetchNotionWithRetry(
            `https://api.notion.com/v1/databases/${MGMT_DATABASE_ID}/query`,
            { method: 'POST', headers: notionHeaders, body: JSON.stringify({}) }
          ),
        ]);

        const teamsData = await teamsResponse.json();
        const mgmtData = await mgmtResponse.json();
        
        // Build team mapping
        const teamById: Record<string, { teamName: string; mgmtGroupId: string | null }> = {};
        for (const team of teamsData.results || []) {
          const teamName = team.properties['Name']?.title?.[0]?.plain_text || null;
          const mgmtGroupProp = team.properties['MTMT Groups'] || team.properties['MGMT Group'];
          const mgmtGroupId = mgmtGroupProp?.relation?.[0]?.id || null;
          if (teamName) {
            teamById[team.id] = { teamName, mgmtGroupId };
          }
        }

        // Build MGMT group mapping
        const mgmtGroupById: Record<string, string> = {};
        for (const group of mgmtData.results || []) {
          const groupName = group.properties['Name']?.title?.[0]?.plain_text || null;
          if (groupName) {
            mgmtGroupById[group.id] = groupName;
          }
        }

        console.log(`Loaded ${Object.keys(teamById).length} teams, ${Object.keys(mgmtGroupById).length} MGMT groups`);

        // Batch-fetch all rep Notion pages in parallel
        const repsWithNotion = reps.filter(r => r.notion_page_id);
        const notionPageIds = repsWithNotion.map(r => r.notion_page_id!);
        
        const repPagesData = await batchFetchNotionPages(notionPageIds, notionHeaders, 10);
        console.log(`Batch-fetched ${repPagesData.size} rep pages`);

        // Build rep mappings from batch-fetched data
        const repMappings: Record<string, { teamName: string | null; mgmtGroupName: string | null }> = {};
        
        for (const rep of repsWithNotion) {
          const repData = repPagesData.get(rep.notion_page_id!);
          if (repData) {
            const teamsRelation = repData.properties['Teams']?.relation || [];
            if (teamsRelation.length > 0) {
              const teamInfo = teamById[teamsRelation[0].id];
              if (teamInfo) {
                repMappings[rep.notion_page_id!] = {
                  teamName: teamInfo.teamName,
                  mgmtGroupName: teamInfo.mgmtGroupId ? mgmtGroupById[teamInfo.mgmtGroupId] : null,
                };
              }
            }
          }
        }

        // Enrich rep data with team/MGMT group info
        enrichedReps = reps.map(rep => ({
          ...rep,
          teamName: rep.notion_page_id ? (repMappings[rep.notion_page_id]?.teamName || null) : null,
          mgmtGroupName: rep.notion_page_id ? (repMappings[rep.notion_page_id]?.mgmtGroupName || null) : null,
        }));
        
      } catch (error) {
        console.error('Error fetching team/MGMT info:', error);
        enrichedReps = reps.map(rep => ({
          ...rep,
          teamName: null,
          mgmtGroupName: null,
        }));
      }
    }

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
