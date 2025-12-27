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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated and is a leader
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is a leader (team lead, mgmt group lead, or area director)
    const { data: isLeader } = await supabase.rpc('is_team_lead', { _user_id: user.id });
    const { data: isMgmtLead } = await supabase.rpc('is_mgmt_group_lead', { _user_id: user.id });
    const { data: isAreaDirector } = await supabase.rpc('is_area_director', { _user_id: user.id });

    if (!isLeader && !isMgmtLead && !isAreaDirector) {
      return new Response(JSON.stringify({ error: 'Unauthorized - must be a leader' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { recruitId, recruitNotionPageId } = await req.json();
    
    if (!recruitId || !recruitNotionPageId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[delete-recruit] Deleting recruit ${recruitId} (${recruitNotionPageId}) by user ${user.id}`);

    // Delete in order to respect foreign key constraints
    // 1. Delete recruit_activities
    const { error: activitiesError } = await supabase
      .from('recruit_activities')
      .delete()
      .eq('rep_notion_page_id', recruitNotionPageId);
    
    if (activitiesError) {
      console.error('[delete-recruit] Error deleting activities:', activitiesError);
    }

    // 2. Delete recruit_blitzes
    const { error: blitzesError } = await supabase
      .from('recruit_blitzes')
      .delete()
      .eq('recruit_id', recruitId);
    
    if (blitzesError) {
      console.error('[delete-recruit] Error deleting blitzes:', blitzesError);
    }

    // 3. Delete from recruits table (preferred)
    const { data: deletedRecruits, error: recruitError } = await supabase
      .from('recruits')
      .delete()
      .eq('id', recruitId)
      .select('id');

    if (recruitError) {
      console.error('[delete-recruit] Error deleting recruit:', recruitError);
      return new Response(JSON.stringify({ error: 'Failed to delete recruit' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Also delete from reps (source of truth for the group list) for "ghost" reps (no app account).
    // This prevents deleted recruits from reappearing after refresh.
    let deletedRepsCount = 0;

    const { data: deletedRepsById, error: repDeleteByIdError } = await supabase
      .from('reps')
      .delete()
      .eq('id', recruitId)
      .is('user_id', null)
      .select('id');

    if (repDeleteByIdError) {
      console.error('[delete-recruit] Error deleting rep by id:', repDeleteByIdError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete recruit', details: repDeleteByIdError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    deletedRepsCount += deletedRepsById?.length ?? 0;

    const { data: deletedRepsByNotion, error: repDeleteByNotionError } = await supabase
      .from('reps')
      .delete()
      .eq('notion_page_id', recruitNotionPageId)
      .is('user_id', null)
      .select('id');

    if (repDeleteByNotionError) {
      console.error('[delete-recruit] Error deleting rep by notion_page_id:', repDeleteByNotionError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete recruit', details: repDeleteByNotionError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    deletedRepsCount += deletedRepsByNotion?.length ?? 0;

    console.log(
      `[delete-recruit] Deleted recruits rows: ${deletedRecruits?.length ?? 0}, deleted reps rows: ${deletedRepsCount}`
    );

    console.log(`[delete-recruit] Successfully deleted recruit ${recruitId}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[delete-recruit] Unexpected error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
