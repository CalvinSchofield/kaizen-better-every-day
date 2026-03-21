import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Called after a user signs up with an invite code.
 * Creates the recruit + rep records and links them to the inviter.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { inviteCode, name, phone, year } = await req.json();

    if (!inviteCode) {
      return new Response(JSON.stringify({ error: 'Invite code required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Validate invite code
    const { data: invite, error: inviteError } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('code', inviteCode)
      .eq('is_active', true)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: 'Invalid or expired invite code' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This invite code has expired' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check max uses
    if (invite.max_uses && invite.uses_count >= invite.max_uses) {
      return new Response(JSON.stringify({ error: 'This invite code has reached its maximum uses' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get inviter's rep record for team info
    const { data: inviterRep } = await supabase
      .from('reps')
      .select('id, name, phone, user_id, team_leader, team_leader_phone')
      .eq('user_id', invite.inviter_user_id)
      .maybeSingle();

    const finalName = name || user.user_metadata?.name || user.email?.split('@')[0] || 'New Rep';
    const finalYear = year || 'Rookie';

    // 3. Check if rep already exists (ghost rep claim or duplicate)
    const { data: existingRep } = await supabase
      .from('reps')
      .select('id, user_id')
      .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
      .maybeSingle();

    if (existingRep) {
      // Already has a rep record - just link user_id if needed
      if (!existingRep.user_id) {
        await supabase
          .from('reps')
          .update({ user_id: user.id, invite_code_used: inviteCode, updated_at: new Date().toISOString() })
          .eq('id', existingRep.id);
      }

      // Increment invite code usage
      await supabase
        .from('invite_codes')
        .update({ uses_count: invite.uses_count + 1 })
        .eq('id', invite.id);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Existing account linked',
        repId: existingRep.id,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Create recruit record (this auto-creates rep via trigger)
    const recruitData: Record<string, unknown> = {
      name: finalName,
      email: user.email,
      phone: phone || null,
      stage: 'Signed',
      year: finalYear,
      recruiter_user_id: invite.inviter_user_id,
      team_id: invite.team_id || null,
      mgmt_group_id: invite.mgmt_group_id || null,
      invite_code_used: inviteCode,
    };

    const { data: newRecruit, error: recruitError } = await supabase
      .from('recruits')
      .insert(recruitData)
      .select('id')
      .single();

    if (recruitError) {
      console.error('Error creating recruit:', recruitError);
      // If duplicate, try to find and link existing
      if (recruitError.message?.includes('Duplicate') || recruitError.message?.includes('duplicate')) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Account already exists in the system',
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw recruitError;
    }

    // 5. Ensure the rep record exists and is linked to this user
    // The auto_create_rep_from_recruit trigger should have created it,
    // but we need to make sure user_id is set
    const { data: createdRep } = await supabase
      .from('reps')
      .select('id, user_id')
      .eq('id', newRecruit.id)
      .maybeSingle();

    if (createdRep && !createdRep.user_id) {
      await supabase
        .from('reps')
        .update({ 
          user_id: user.id, 
          invite_code_used: inviteCode,
          name: finalName,
          phone: phone || null,
          year: finalYear,
          team_leader: inviterRep?.name || null,
          team_leader_phone: inviterRep?.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', createdRep.id);
    } else if (!createdRep) {
      // Trigger didn't fire (stage wasn't matching) - create rep manually
      await supabase
        .from('reps')
        .insert({
          id: newRecruit.id,
          name: finalName,
          email: user.email,
          phone: phone || null,
          stage: 'Signed',
          year: finalYear,
          user_id: user.id,
          invite_code_used: inviteCode,
          team_leader: inviterRep?.name || null,
          team_leader_phone: inviterRep?.phone || null,
        });
    }

    // 6. Increment invite code usage
    await supabase
      .from('invite_codes')
      .update({ uses_count: invite.uses_count + 1 })
      .eq('id', invite.id);

    // 7. Log activity on the recruit
    await supabase
      .from('recruit_activities')
      .insert({
        recruit_id: newRecruit.id,
        activity_type: 'note',
        logged_by_user_id: invite.inviter_user_id,
        notes: `Joined via invite link from ${inviterRep?.name || 'recruiter'}`,
      });

    console.log(`[process-invite-signup] Created recruit+rep for ${finalName} via invite code ${inviteCode}`);

    return new Response(JSON.stringify({ 
      success: true, 
      recruitId: newRecruit.id,
      inviterName: inviterRep?.name,
      teamId: invite.team_id,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing invite signup:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
