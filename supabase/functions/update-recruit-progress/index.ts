import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map of property names to their Notion checkbox property names
const PROPERTY_MAP: Record<string, string> = {
  'onboardingComplete': 'Onboarding Video',
  'trainingsComplete': 'Required trainings',
  'slackJoined': 'Slack',
  'ipadAssigned': 'iPad Assigned',
  'rampPhase1Complete': 'Phase 1 Complete',
  'rampPhase2Complete': 'Phase 2 Complete',
  'rampPhase3Complete': 'Phase 3 Complete',
  'rampPhase4Complete': 'Phase 4 Complete',
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

    if (!notionApiKey) {
      return new Response(JSON.stringify({ error: 'Notion API key not configured' }), {
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

    const { recruitNotionId, property, value } = await req.json();

    if (!recruitNotionId || !property || value === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields: recruitNotionId, property, value' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notionPropertyName = PROPERTY_MAP[property];
    if (!notionPropertyName) {
      return new Response(JSON.stringify({ error: `Unknown property: ${property}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update the property in Notion
    const notionResponse = await fetch(`https://api.notion.com/v1/pages/${recruitNotionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          [notionPropertyName]: {
            checkbox: value === true
          }
        }
      }),
    });

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text();
      console.error('Notion API error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to update Notion', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If recruit has a user account, also update the reps table
    const { data: repData } = await supabase
      .from('reps')
      .select('user_id')
      .eq('notion_page_id', recruitNotionId)
      .single();

    if (repData) {
      // Map property name to reps table column
      const columnMap: Record<string, string> = {
        'onboardingComplete': 'onboarding_complete',
        'trainingsComplete': 'trainings_complete',
        'slackJoined': 'slack_joined',
        'ipadAssigned': 'ipad_assigned',
        'rampPhase1Complete': 'ramp_phase_1_complete',
        'rampPhase2Complete': 'ramp_phase_2_complete',
        'rampPhase3Complete': 'ramp_phase_3_complete',
        'rampPhase4Complete': 'ramp_phase_4_complete',
      };

      const column = columnMap[property];
      if (column) {
        await supabase
          .from('reps')
          .update({ [column]: value })
          .eq('notion_page_id', recruitNotionId);
      }
    }

    console.log(`Updated ${property} to ${value} for recruit ${recruitNotionId}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating recruit progress:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
