import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    // Hardcode the Reps database ID
    const notionRepsDbId = '99130d187a8c4bbda60c77a230ddc364';

    if (!notionApiKey) {
      return new Response(JSON.stringify({ error: 'Notion API key missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { 
      name, 
      phone, 
      location, 
      recruitmentSource, 
      recruiterNotionId,
      teamNotionId,
      mgmtNotionId,
      downlineNotionId 
    } = await req.json();

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Creating Notion recruit: ${name}, phone: ${phone}, location: ${location}`);

    // Build the properties object for Notion
    const properties: Record<string, any> = {
      'Name': {
        title: [{ text: { content: name } }]
      },
      'Stage': {
        select: { name: '100 List' }
      },
      'Year': {
        select: { name: 'Rookie' }
      }
    };

    // Add phone if provided
    if (phone) {
      properties['Phone'] = {
        phone_number: phone
      };
    }

    // Add location/state if provided (multi_select)
    if (location) {
      properties['Location'] = {
        multi_select: [{ name: location }]
      };
    }

    // Add recruitment source if provided (multi_select)
    if (recruitmentSource) {
      properties['How did you recruit them?'] = {
        multi_select: [{ name: recruitmentSource }]
      };
    }

    // Add recruiter if provided (select, not relation)
    if (recruiterNotionId) {
      // Note: Recruiter is a select field, we need the recruiter name not ID
      // Skip for now - would need recruiter name passed in
    }
    // Add team relation if provided
    if (teamNotionId) {
      properties['Teams'] = {
        relation: [{ id: teamNotionId }]
      };
    }

    // Add MGMT relation if provided (upline MGMT group)
    if (mgmtNotionId) {
      properties['MGMT'] = {
        relation: [{ id: mgmtNotionId }]
      };
    }

    // Note: Downline is a people field, not relation - skip for now
    // Would need the person's Notion user ID, not page ID

    console.log('Creating Notion page with properties:', JSON.stringify(properties, null, 2));

    const notionResponse = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: notionRepsDbId },
        properties,
      }),
    });

    if (!notionResponse.ok) {
      const errorData = await notionResponse.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Notion API error:', JSON.stringify(errorData, null, 2));
      console.error('Notion response status:', notionResponse.status);
      return new Response(JSON.stringify({ 
        error: 'Failed to create recruit in Notion',
        details: errorData.message || JSON.stringify(errorData),
        notionError: errorData,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notionData = await notionResponse.json();
    console.log(`Successfully created Notion page for ${name}: ${notionData.id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      notionPageId: notionData.id,
      name 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating recruit:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
