import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTION_REPS_DB_ID = '99130d187a8c4bbda60c77a230ddc364';
const NOTION_TEAMS_DB_ID = 'f7c3f4e0c8d34e6d9a9b7c5e1f2a3b4c'; // Placeholder - will be fetched from schema
const NOTION_MGMT_DB_ID = 'a1b2c3d4e5f6789012345678901234ab'; // Placeholder - will be fetched from schema

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
      console.log(`Rate limited, waiting ${retryAfter}s...`);
      await delay(retryAfter * 1000);
      continue;
    }
    return response;
  }
  throw new Error('Max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const notionApiKey = Deno.env.get('NOTION_API_KEY');

    if (!notionApiKey) {
      return new Response(JSON.stringify({ error: 'Notion configuration missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notionHeaders = {
      'Authorization': `Bearer ${notionApiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };

    console.log('Fetching Notion database schema for property options...');

    // Fetch reps database schema
    const repsResponse = await fetchWithRetry(
      `https://api.notion.com/v1/databases/${NOTION_REPS_DB_ID}`,
      { headers: notionHeaders }
    );

    if (!repsResponse.ok) {
      const errorText = await repsResponse.text();
      console.error('Notion API error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch Notion database' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const repsData = await repsResponse.json();
    const properties = repsData.properties;

    // Extract Location options
    const locationProp = properties['Location'];
    let locationOptions: string[] = [];
    if (locationProp?.type === 'select' && locationProp.select?.options) {
      locationOptions = locationProp.select.options.map((opt: any) => opt.name).sort();
    } else if (locationProp?.type === 'multi_select' && locationProp.multi_select?.options) {
      locationOptions = locationProp.multi_select.options.map((opt: any) => opt.name).sort();
    }

    // Extract "How did you recruit them?" options
    const recruitmentSourceProp = properties['How did you recruit them?'];
    let recruitmentSourceOptions: string[] = [];
    if (recruitmentSourceProp?.type === 'select' && recruitmentSourceProp.select?.options) {
      recruitmentSourceOptions = recruitmentSourceProp.select.options.map((opt: any) => opt.name);
    } else if (recruitmentSourceProp?.type === 'multi_select' && recruitmentSourceProp.multi_select?.options) {
      recruitmentSourceOptions = recruitmentSourceProp.multi_select.options.map((opt: any) => opt.name);
    }

    // Extract Stage options
    const stageProp = properties['Stage'];
    let stageOptions: string[] = [];
    if (stageProp?.type === 'select' && stageProp.select?.options) {
      stageOptions = stageProp.select.options.map((opt: any) => opt.name);
    } else if (stageProp?.type === 'status' && stageProp.status?.options) {
      stageOptions = stageProp.status.options.map((opt: any) => opt.name);
    }

    // Extract Recruiter options (select property)
    const recruiterProp = properties['Recruiter'];
    let recruiterOptions: string[] = [];
    if (recruiterProp?.type === 'select' && recruiterProp.select?.options) {
      recruiterOptions = recruiterProp.select.options.map((opt: any) => opt.name).sort();
    }

    // Get Teams relation database ID and fetch teams
    const teamsProp = properties['Teams'];
    let teamsOptions: { id: string; name: string }[] = [];
    if (teamsProp?.type === 'relation' && teamsProp.relation?.database_id) {
      const teamsDbId = teamsProp.relation.database_id;
      console.log('Fetching teams from database:', teamsDbId);
      
      await delay(350); // Rate limit protection
      
      try {
        const teamsResponse = await fetchWithRetry(
          `https://api.notion.com/v1/databases/${teamsDbId}/query`,
          {
            method: 'POST',
            headers: notionHeaders,
            body: JSON.stringify({ page_size: 100 }),
          }
        );
        
        if (teamsResponse.ok) {
          const teamsData = await teamsResponse.json();
          teamsOptions = teamsData.results.map((page: any) => {
            const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
            const name = titleProp?.title?.[0]?.plain_text || 'Unnamed Team';
            return { id: page.id, name };
          }).sort((a: any, b: any) => a.name.localeCompare(b.name));
        }
      } catch (e) {
        console.error('Failed to fetch teams:', e);
      }
    }

    // Get MGMT relation database ID and fetch MGMT groups
    const mgmtProp = properties['MGMT'];
    let mgmtOptions: { id: string; name: string }[] = [];
    if (mgmtProp?.type === 'relation' && mgmtProp.relation?.database_id) {
      const mgmtDbId = mgmtProp.relation.database_id;
      console.log('Fetching MGMT groups from database:', mgmtDbId);
      
      await delay(350); // Rate limit protection
      
      try {
        const mgmtResponse = await fetchWithRetry(
          `https://api.notion.com/v1/databases/${mgmtDbId}/query`,
          {
            method: 'POST',
            headers: notionHeaders,
            body: JSON.stringify({ page_size: 100 }),
          }
        );
        
        if (mgmtResponse.ok) {
          const mgmtData = await mgmtResponse.json();
          mgmtOptions = mgmtData.results.map((page: any) => {
            const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
            const name = titleProp?.title?.[0]?.plain_text || 'Unnamed MGMT Group';
            return { id: page.id, name };
          }).sort((a: any, b: any) => a.name.localeCompare(b.name));
        }
      } catch (e) {
        console.error('Failed to fetch MGMT groups:', e);
      }
    }

    console.log(`Found ${locationOptions.length} locations, ${recruitmentSourceOptions.length} sources, ${stageOptions.length} stages, ${recruiterOptions.length} recruiters, ${teamsOptions.length} teams, ${mgmtOptions.length} MGMT groups`);

    return new Response(JSON.stringify({
      locationOptions,
      recruitmentSourceOptions,
      stageOptions,
      recruiterOptions,
      teamsOptions,
      mgmtOptions,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching property options:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
