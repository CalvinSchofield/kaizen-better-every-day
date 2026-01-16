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
      recruitId,
      name,
      phone,
      email,
      stage,
      location,
      recruitmentSource,
      recruiterUserId,
      teamId,
      mgmtGroupId,
      significantOtherName,
      watchOutNotes,
    } = body;

    if (!recruitId) {
      return new Response(JSON.stringify({ error: 'Missing recruitId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Updating recruit properties for recruitId: ${recruitId}`);

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
    if (significantOtherName !== undefined) recruitsUpdates.significant_other_name = significantOtherName || null;
    if (watchOutNotes !== undefined) recruitsUpdates.watch_out_notes = watchOutNotes || null;

    if (Object.keys(recruitsUpdates).length > 0) {
      recruitsUpdates.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('recruits')
        .update(recruitsUpdates)
        .eq('id', recruitId);

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

      // Get the recruit's email to find linked rep
      const { data: recruit } = await supabase
        .from('recruits')
        .select('email')
        .eq('id', recruitId)
        .maybeSingle();

      if (recruit?.email) {
        // Update ghost rep by email match
        await supabase
          .from('reps')
          .update(repsUpdates)
          .ilike('email', recruit.email);
        console.log(`Updated rep by email: ${recruit.email}`);
      }
    }

    console.log('Successfully updated recruit properties');

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
