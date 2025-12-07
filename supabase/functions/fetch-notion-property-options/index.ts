import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    const notionRepsDbId = Deno.env.get('NOTION_REPS_DATABASE_ID') || '99130d187a8c4bbda60c77a230ddc364';

    if (!notionApiKey) {
      return new Response(JSON.stringify({ error: 'Notion configuration missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching Notion database schema for property options...');

    // Fetch database schema to get property options
    const response = await fetch(`https://api.notion.com/v1/databases/${notionRepsDbId}`, {
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Notion API error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch Notion database' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const properties = data.properties;

    // Extract Location options (can be select or multi_select)
    const locationProp = properties['Location'];
    let locationOptions: string[] = [];
    if (locationProp?.type === 'select' && locationProp.select?.options) {
      locationOptions = locationProp.select.options.map((opt: any) => opt.name).sort();
    } else if (locationProp?.type === 'multi_select' && locationProp.multi_select?.options) {
      locationOptions = locationProp.multi_select.options.map((opt: any) => opt.name).sort();
    }

    // Extract "How did you recruit them?" options (can be select or multi_select)
    const recruitmentSourceProp = properties['How did you recruit them?'];
    let recruitmentSourceOptions: string[] = [];
    if (recruitmentSourceProp?.type === 'select' && recruitmentSourceProp.select?.options) {
      recruitmentSourceOptions = recruitmentSourceProp.select.options.map((opt: any) => opt.name);
    } else if (recruitmentSourceProp?.type === 'multi_select' && recruitmentSourceProp.multi_select?.options) {
      recruitmentSourceOptions = recruitmentSourceProp.multi_select.options.map((opt: any) => opt.name);
    }

    console.log(`Found ${locationOptions.length} location options, ${recruitmentSourceOptions.length} recruitment source options`);

    return new Response(JSON.stringify({
      locationOptions,
      recruitmentSourceOptions,
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
