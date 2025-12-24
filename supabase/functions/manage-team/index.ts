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

    const { action, teamId, name, leadUserId, mgmtGroupId } = await req.json();
    console.log('manage-team called with:', { action, teamId, name, leadUserId, mgmtGroupId });

    if (action === 'create') {
      // Create new team
      const { data: team, error: createError } = await supabase
        .from('teams')
        .insert({
          name,
          lead_user_id: leadUserId || null,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating team:', createError);
        throw createError;
      }

      // If mgmtGroupId provided, add to junction table
      if (mgmtGroupId) {
        await supabase
          .from('team_mgmt_groups')
          .insert({
            team_id: team.id,
            mgmt_group_id: mgmtGroupId,
          });
      }

      return new Response(JSON.stringify({ success: true, team }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update') {
      if (!teamId) {
        return new Response(JSON.stringify({ error: 'teamId required for update' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update team
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (leadUserId !== undefined) updates.lead_user_id = leadUserId || null;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('teams')
          .update(updates)
          .eq('id', teamId);

        if (updateError) {
          console.error('Error updating team:', updateError);
          throw updateError;
        }
      }

      // Update mgmt group assignment if provided
      if (mgmtGroupId !== undefined) {
        // First remove any existing assignments
        await supabase
          .from('team_mgmt_groups')
          .delete()
          .eq('team_id', teamId);

        // Add new assignment if mgmtGroupId is not null
        if (mgmtGroupId) {
          await supabase
            .from('team_mgmt_groups')
            .insert({
              team_id: teamId,
              mgmt_group_id: mgmtGroupId,
            });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      if (!teamId) {
        return new Response(JSON.stringify({ error: 'teamId required for delete' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if team has any recruits
      const { data: recruits } = await supabase
        .from('recruits')
        .select('id')
        .eq('team_id', teamId)
        .limit(1);

      if (recruits && recruits.length > 0) {
        return new Response(JSON.stringify({ error: 'Cannot delete team with recruits assigned' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Remove from junction table first
      await supabase
        .from('team_mgmt_groups')
        .delete()
        .eq('team_id', teamId);

      // Delete the team
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (deleteError) {
        console.error('Error deleting team:', deleteError);
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
    console.error('Error in manage-team:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
