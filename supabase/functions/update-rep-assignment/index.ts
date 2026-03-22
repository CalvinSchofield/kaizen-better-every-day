import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is team_lead or above
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has team_lead+ access (team_lead, mgmt_group_lead, area_director, or explicit role)
    const [
      { data: isTL },
      { data: isMGL },
      { data: isAD },
      { data: hasExplicitRole },
    ] = await Promise.all([
      supabase.rpc('is_team_lead', { _user_id: user.id }),
      supabase.rpc('is_mgmt_group_lead', { _user_id: user.id }),
      supabase.rpc('is_area_director', { _user_id: user.id }),
      supabase.rpc('has_min_role', { _user_id: user.id, _min_role: 'regional' }),
    ]);

    if (!isTL && !isMGL && !isAD && !hasExplicitRole) {
      return new Response(JSON.stringify({ error: 'Access denied. Team Lead or above required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { repId, teamId, recruiterUserId, mgmtGroupId } = await req.json();
    console.log('update-rep-assignment called with:', { repId, teamId, recruiterUserId, mgmtGroupId });

    if (!repId) {
      return new Response(JSON.stringify({ error: 'repId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    
    if (teamId !== undefined) {
      updates.team_id = teamId || null;
    }
    
    if (recruiterUserId !== undefined) {
      updates.recruiter_user_id = recruiterUserId || null;
    }

    if (mgmtGroupId !== undefined) {
      updates.mgmt_group_id = mgmtGroupId || null;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'No updates provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update the recruit record
    const { error: updateError } = await supabase
      .from('recruits')
      .update(updates)
      .eq('id', repId);

    if (updateError) {
      console.error('Error updating rep assignment:', updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in update-rep-assignment:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
