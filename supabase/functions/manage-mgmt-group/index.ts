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

    // Verify user is area director
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is area director
    const { data: isAD } = await supabase.rpc('is_area_director', { _user_id: user.id });
    if (!isAD) {
      return new Response(JSON.stringify({ error: 'Access denied. Area Director only.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, mgmtGroupId, name, leadUserId } = await req.json();
    console.log('manage-mgmt-group called with:', { action, mgmtGroupId, name, leadUserId });

    if (action === 'create') {
      // Create new mgmt group
      const { data: group, error: createError } = await supabase
        .from('mgmt_groups')
        .insert({
          name,
          lead_user_id: leadUserId || null,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating mgmt group:', createError);
        throw createError;
      }

      return new Response(JSON.stringify({ success: true, group }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update') {
      if (!mgmtGroupId) {
        return new Response(JSON.stringify({ error: 'mgmtGroupId required for update' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update mgmt group
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (leadUserId !== undefined) updates.lead_user_id = leadUserId || null;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('mgmt_groups')
          .update(updates)
          .eq('id', mgmtGroupId);

        if (updateError) {
          console.error('Error updating mgmt group:', updateError);
          throw updateError;
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      if (!mgmtGroupId) {
        return new Response(JSON.stringify({ error: 'mgmtGroupId required for delete' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if group has any teams
      const { data: teams } = await supabase
        .from('team_mgmt_groups')
        .select('team_id')
        .eq('mgmt_group_id', mgmtGroupId)
        .limit(1);

      if (teams && teams.length > 0) {
        return new Response(JSON.stringify({ error: 'Cannot delete group with teams assigned' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delete the mgmt group
      const { error: deleteError } = await supabase
        .from('mgmt_groups')
        .delete()
        .eq('id', mgmtGroupId);

      if (deleteError) {
        console.error('Error deleting mgmt group:', deleteError);
        throw deleteError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in manage-mgmt-group:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
