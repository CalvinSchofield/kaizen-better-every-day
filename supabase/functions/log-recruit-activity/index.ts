import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    // Update the recruits table with last contact and next action
    const today = new Date().toISOString().split('T')[0];
    const updateData: any = {};
    
    if (updateLastContact) {
      updateData.last_contact = today;
    }
    
    if (nextAction) {
      updateData.next_action = nextAction;
    }
    
    if (nextActionDue) {
      updateData.next_action_due = nextActionDue;
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('recruits')
        .update(updateData)
        .eq('notion_page_id', recruitNotionId);

      if (updateError) {
        console.error('Error updating recruit:', updateError);
      } else {
        console.log(`Updated recruit ${recruitNotionId} with:`, Object.keys(updateData).join(', '));
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
