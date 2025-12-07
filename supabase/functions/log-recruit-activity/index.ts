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
      recruitNotionId, 
      activityType, 
      notes, 
      nextAction, 
      nextActionDue,
      updateLastContact = false 
    } = await req.json();

    if (!recruitNotionId || !activityType) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert activity
    const { data: activity, error: insertError } = await supabase
      .from('recruit_activities')
      .insert({
        rep_notion_page_id: recruitNotionId,
        activity_type: activityType,
        logged_by_user_id: user.id,
        notes,
        next_action: nextAction,
        next_action_due: nextActionDue,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update Notion with last contact, last phone call, and next action if applicable
    if (notionApiKey && (updateLastContact || nextAction)) {
      const properties: any = {};
      const today = new Date().toISOString().split('T')[0];
      
      if (updateLastContact) {
        properties['Last Contact'] = {
          date: { start: today }
        };
        
        // Also update Last Phone Call for phone_call or in_person activities
        if (activityType === 'phone_call' || activityType === 'in_person') {
          properties['Last Phone Call'] = {
            date: { start: today }
          };
        }
      }
      
      if (nextAction) {
        properties['Next Action'] = {
          rich_text: [{ text: { content: nextAction } }]
        };
      }
      
      if (nextActionDue) {
        properties['Next Action Due'] = {
          date: { start: nextActionDue }
        };
      }

      if (Object.keys(properties).length > 0) {
        const notionResponse = await fetch(`https://api.notion.com/v1/pages/${recruitNotionId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${notionApiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties }),
        });

        if (!notionResponse.ok) {
          const errorText = await notionResponse.text();
          console.error('Notion API error:', errorText);
        } else {
          console.log(`Updated Notion properties for ${recruitNotionId}:`, Object.keys(properties).join(', '));
        }
      }
    }

    console.log(`Logged ${activityType} activity for recruit ${recruitNotionId}`);

    return new Response(JSON.stringify({ success: true, activity }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
