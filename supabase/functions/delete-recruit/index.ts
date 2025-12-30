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

    // Check if user is an area director (only area directors can delete)
    const { data: isAreaDirector } = await supabase.rpc('is_area_director', { _user_id: user.id });

    if (!isAreaDirector) {
      return new Response(JSON.stringify({ error: 'Unauthorized - only area directors can delete recruits' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { recruitId } = await req.json();
    
    if (!recruitId) {
      return new Response(JSON.stringify({ error: 'Missing recruitId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[delete-recruit] Deleting recruit ${recruitId} by user ${user.id}`);

    // Get recruit email to find linked rep
    const { data: recruit } = await supabase
      .from('recruits')
      .select('email')
      .eq('id', recruitId)
      .maybeSingle();

    // Delete in order to respect foreign key constraints
    // 1. Delete recruit_activities
    const { error: activitiesError } = await supabase
      .from('recruit_activities')
      .delete()
      .eq('recruit_id', recruitId);

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

    // 3. Delete from recruits table
    const { data: deletedRecruits, error: recruitDeleteError } = await supabase
      .from('recruits')
      .delete()
      .eq('id', recruitId)
      .select('id');

    if (recruitDeleteError) {
      console.error('[delete-recruit] Error deleting recruit:', recruitDeleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete recruit', details: recruitDeleteError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const deletedRecruitsCount = deletedRecruits?.length ?? 0;

    // Also delete from reps table by email match
    let deletedRepsCount = 0;
    if (recruit?.email) {
      const { data: deletedReps, error: repDeleteError } = await supabase
        .from('reps')
        .delete()
        .ilike('email', recruit.email)
        .select('id');

      if (repDeleteError) {
        console.error('[delete-recruit] Error deleting rep by email:', repDeleteError);
      } else {
        deletedRepsCount = deletedReps?.length ?? 0;
      }
    }

    console.log(
      `[delete-recruit] Deleted recruits rows: ${deletedRecruitsCount}, deleted reps rows: ${deletedRepsCount}`
    );

    if (deletedRecruitsCount === 0 && deletedRepsCount === 0) {
      return new Response(
        JSON.stringify({ error: 'Nothing to delete (already deleted or not found)' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[delete-recruit] Successfully deleted recruit ${recruitId}`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: { recruits: deletedRecruitsCount, reps: deletedRepsCount },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[delete-recruit] Unexpected error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
