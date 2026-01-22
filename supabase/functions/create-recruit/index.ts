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

    const { 
      name, 
      phone, 
      email,
      location, 
      recruitmentSource,
      teamId,
      mgmtGroupId,
      stage,
      spouseName,
      cautionNotes,
    } = await req.json();

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Creating recruit in Supabase: ${name}, phone: ${phone}, location: ${location}`);

    // Check for duplicate email if provided
    if (email && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      
      // Check in recruits table
      const { data: existingRecruit } = await supabase
        .from('recruits')
        .select('id, name')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (existingRecruit) {
        console.log(`Duplicate email found in recruits: ${normalizedEmail} -> ${existingRecruit.name}`);
        return new Response(JSON.stringify({ 
          error: `A recruit with this email already exists: ${existingRecruit.name}`,
          duplicateEmail: true,
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check in reps table
      const { data: existingRep } = await supabase
        .from('reps')
        .select('id, name')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (existingRep) {
        console.log(`Duplicate email found in reps: ${normalizedEmail} -> ${existingRep.name}`);
        return new Response(JSON.stringify({ 
          error: `A rep with this email already exists: ${existingRep.name}`,
          duplicateEmail: true,
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get current user's team info if not provided
    let finalTeamId = teamId;
    let finalMgmtGroupId = mgmtGroupId;

    if (!finalTeamId) {
      // Try to get team from user's accessible teams
      const { data: accessibleTeams } = await supabase
        .rpc('get_accessible_team_ids', { _user_id: user.id });
      
      if (accessibleTeams && accessibleTeams.length > 0) {
        finalTeamId = accessibleTeams[0];
      }
    }

    // Determine stage - default to '100 List' if not provided
    const finalStage = stage || '100 List';

    // Create the recruit in Supabase
    const { data: newRecruit, error: insertError } = await supabase
      .from('recruits')
      .insert({
        name,
        phone: phone || null,
        email: email?.trim() || null,
        location: location || null,
        recruitment_source: recruitmentSource || null,
        stage: finalStage,
        year: 'Rookie',
        recruiter_user_id: user.id,
        team_id: finalTeamId || null,
        mgmt_group_id: finalMgmtGroupId || null,
        spouse_name: spouseName || null,
        caution_notes: cautionNotes || null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating recruit:', insertError);
      throw new Error(`Failed to create recruit: ${insertError.message}`);
    }

    console.log(`Successfully created recruit ${name} with ID: ${newRecruit.id}`);

    // Log the creation as an activity
    await supabase
      .from('recruit_activities')
      .insert({
        recruit_id: newRecruit.id,
        activity_type: 'note',
        logged_by_user_id: user.id,
        notes: `Added to ${finalStage}`,
      });

    return new Response(JSON.stringify({ 
      success: true, 
      recruitId: newRecruit.id,
      name 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating recruit:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
