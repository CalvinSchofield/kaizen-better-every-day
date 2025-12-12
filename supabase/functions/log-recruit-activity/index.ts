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
      assignedToUserId
    } = await req.json();

    // Auto-set updateLastContact for phone_call and in_person activities
    const updateLastContact = activityType === 'phone_call' || activityType === 'in_person';

    if (!recruitNotionId || !activityType) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert activity
    const insertData: any = {
      rep_notion_page_id: recruitNotionId,
      activity_type: activityType,
      logged_by_user_id: user.id,
      notes,
      next_action: nextAction,
      next_action_due: nextActionDue,
    };

    // Add assignment if specified
    if (assignedToUserId) {
      insertData.assigned_to_user_id = assignedToUserId;
      insertData.assignment_status = 'pending';
      console.log(`Task assigned to user ${assignedToUserId}`);
    }

    const { data: activity, error: insertError } = await supabase
      .from('recruit_activities')
      .insert(insertData)
      .select()
      .single();

    if (insertError) throw insertError;

    // Update Notion with last contact, last phone call, and next action if applicable
    if (notionApiKey) {
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
      
      // Update Next Action (which is a DATE property in Notion, not text)
      // The property is just called "Next Action" and stores the date directly
      if (nextActionDue) {
        // Append noon time to prevent timezone shifts from pushing the date to previous day
        // Notion interprets dates without time as midnight UTC, which shifts backward in US timezones
        const dateWithNoon = `${nextActionDue}T12:00:00`;
        console.log(`Setting Next Action date to: ${dateWithNoon} (original: ${nextActionDue})`);
        properties['Next Action'] = {
          date: { start: dateWithNoon }
        };
      }
      
      // Store next action text in Next Steps property (rich_text) if provided
      if (nextAction) {
        console.log(`Setting Next Steps to: "${nextAction}"`);
        properties['Next Steps'] = {
          rich_text: [{ text: { content: nextAction } }]
        };
      }

      if (Object.keys(properties).length > 0) {
        console.log(`Updating Notion page ${recruitNotionId} with properties:`, JSON.stringify(properties));
        
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
          console.error('Response status:', notionResponse.status);
        } else {
          console.log(`Successfully updated Notion properties for ${recruitNotionId}:`, Object.keys(properties).join(', '));
        }
      } else {
        console.log('No Notion properties to update');
      }
    } else {
      console.log('No NOTION_API_KEY found, skipping Notion update');
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
