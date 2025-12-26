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
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { 
      recruitNotionPageId,
      recruitId, // Support both Notion ID and Supabase ID
      name,
      phone,
      email,
      stage,
      location,
      recruitmentSource,
      recruiterUserId,
      teamId,
      mgmtGroupId,
    } = body;

    // Need either notion page ID or Supabase ID
    if (!recruitNotionPageId && !recruitId) {
      return new Response(JSON.stringify({ error: 'Missing recruitNotionPageId or recruitId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Updating recruit properties in Supabase...`, { recruitNotionPageId, recruitId });

    // Build updates object for recruits table
    const recruitsUpdates: Record<string, any> = {};
    if (name !== undefined) recruitsUpdates.name = name;
    if (phone !== undefined) recruitsUpdates.phone = phone;
    if (email !== undefined) recruitsUpdates.email = email;
    if (stage !== undefined) recruitsUpdates.stage = stage;
    if (location !== undefined) {
      recruitsUpdates.location = Array.isArray(location) ? location.join(', ') : location;
    }
    if (recruitmentSource !== undefined) {
      recruitsUpdates.recruitment_source = Array.isArray(recruitmentSource) ? recruitmentSource.join(', ') : recruitmentSource;
    }
    if (recruiterUserId !== undefined) recruitsUpdates.recruiter_user_id = recruiterUserId || null;
    if (teamId !== undefined) recruitsUpdates.team_id = teamId || null;
    if (mgmtGroupId !== undefined) recruitsUpdates.mgmt_group_id = mgmtGroupId || null;

    if (Object.keys(recruitsUpdates).length > 0) {
      recruitsUpdates.updated_at = new Date().toISOString();

      // Update by notion_page_id or id
      let updateQuery = supabase.from('recruits').update(recruitsUpdates);
      
      if (recruitId) {
        updateQuery = updateQuery.eq('id', recruitId);
      } else {
        updateQuery = updateQuery.eq('notion_page_id', recruitNotionPageId);
      }

      const { error: updateError } = await updateQuery;

      if (updateError) {
        console.error('Supabase recruits update error:', updateError);
        throw new Error(`Failed to update recruit: ${updateError.message}`);
      }
    }

    // Also update reps table if this recruit has a linked rep record
    const repsUpdates: Record<string, any> = {};
    if (name !== undefined) repsUpdates.name = name;
    if (phone !== undefined) repsUpdates.phone = phone;
    if (email !== undefined) repsUpdates.email = email;
    if (stage !== undefined) repsUpdates.stage = stage;

    if (Object.keys(repsUpdates).length > 0) {
      repsUpdates.updated_at = new Date().toISOString();

      // Try to find and update the linked rep
      // First by notion_page_id, then by email match for ghost reps
      let repsUpdated = false;

      if (recruitNotionPageId) {
        const { error: repsUpdateError, count } = await supabase
          .from('reps')
          .update(repsUpdates)
          .eq('notion_page_id', recruitNotionPageId);

        if (!repsUpdateError) {
          repsUpdated = true;
          console.log(`Updated reps by notion_page_id: ${recruitNotionPageId}`);
        }
      }

      // If no notion_page_id or update didn't match, try by recruit ID lookup
      if (!repsUpdated && recruitId) {
        // Get the recruit's notion_page_id and email
        const { data: recruit } = await supabase
          .from('recruits')
          .select('notion_page_id, email')
          .eq('id', recruitId)
          .maybeSingle();

        if (recruit?.notion_page_id) {
          await supabase
            .from('reps')
            .update(repsUpdates)
            .eq('notion_page_id', recruit.notion_page_id);
          console.log(`Updated reps by recruit's notion_page_id: ${recruit.notion_page_id}`);
        } else if (recruit?.email) {
          // Try matching ghost rep by email
          await supabase
            .from('reps')
            .update(repsUpdates)
            .is('user_id', null)
            .ilike('email', recruit.email);
          console.log(`Updated ghost rep by email: ${recruit.email}`);
        }
      }
    }

    console.log('Successfully updated recruit properties in Supabase');

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating recruit properties:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
