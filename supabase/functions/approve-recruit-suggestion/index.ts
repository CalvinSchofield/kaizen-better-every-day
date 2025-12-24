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

    // Authenticate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { suggestionId, action } = await req.json();

    if (!suggestionId || !action) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from('recruit_suggestions')
      .select('*')
      .eq('id', suggestionId)
      .single();

    if (fetchError || !suggestion) {
      return new Response(JSON.stringify({ error: 'Suggestion not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reject') {
      // Simply update status to rejected
      const { error: updateError } = await supabase
        .from('recruit_suggestions')
        .update({
          status: 'rejected',
          reviewed_by_user_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, action: 'rejected' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'approve') {
      // Get suggester's team info
      const { data: suggesterRep } = await supabase
        .from('reps')
        .select('user_id, notion_page_id')
        .eq('user_id', suggestion.suggested_by_user_id)
        .maybeSingle();

      // Get accessible teams for the suggester to assign the recruit
      const { data: accessibleTeams } = await supabase
        .rpc('get_accessible_team_ids', { _user_id: suggestion.suggested_by_user_id });

      // Create recruit in Supabase
      const { data: newRecruit, error: insertError } = await supabase
        .from('recruits')
        .insert({
          name: suggestion.name,
          phone: suggestion.phone,
          stage: '100 List',
          year: 'Rookie',
          recruiter_user_id: suggestion.suggested_by_user_id,
          team_id: accessibleTeams?.[0] || null,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating recruit:', insertError);
        throw new Error(`Failed to create recruit: ${insertError.message}`);
      }

      console.log(`Created recruit for ${suggestion.name}: ${newRecruit.id}`);

      // Log activity
      await supabase
        .from('recruit_activities')
        .insert({
          rep_notion_page_id: newRecruit.id,
          activity_type: 'note',
          logged_by_user_id: user.id,
          notes: `Approved suggestion from ${suggestion.suggested_by_name}`,
        });

      // Update suggestion as approved
      const { error: updateError } = await supabase
        .from('recruit_suggestions')
        .update({
          status: 'approved',
          reviewed_by_user_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ 
        success: true, 
        action: 'approved',
        recruitId: newRecruit.id 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing suggestion:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
