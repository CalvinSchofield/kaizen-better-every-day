import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Called after a user signs up with an invite code.
 * Creates the recruit + rep records and links them to the inviter.
 * Sets approval_status = 'pending' so a leader must approve before full access.
 * 
 * For lateral invites (invite_type = 'lateral'), skips auto-recruiter/team/group
 * assignment — the approver must manually set these during approval.
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

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This invite code has expired' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (invite.max_uses && invite.uses_count >= invite.max_uses) {
      return new Response(JSON.stringify({ error: 'This invite code has reached its maximum uses' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isLateralInvite = invite.invite_type === 'lateral';

    // 2. Get inviter's rep record for team info
    const { data: inviterRep } = await supabase
      .from('reps')
      .select('id, name, phone, user_id, team_leader, team_leader_phone')
      .eq('user_id', invite.inviter_user_id)
      .maybeSingle();

    // 2b. For DOWNLINE invites, auto-resolve team_id and mgmt_group_id from inviter
    // For LATERAL invites, leave these NULL — approver sets them manually
    let resolvedTeamId: string | null = null;
    let resolvedMgmtGroupId: string | null = null;
    let resolvedRecruiterUserId: string | null = null;

    if (!isLateralInvite) {
      // Standard downline flow — auto-assign recruiter and org placement
      resolvedRecruiterUserId = invite.inviter_user_id;
      resolvedTeamId = invite.team_id || null;
      resolvedMgmtGroupId = invite.mgmt_group_id || null;

      if (inviterRep && (!resolvedTeamId || !resolvedMgmtGroupId)) {
        const { data: inviterRecruit } = await supabase
          .from('recruits')
          .select('team_id, mgmt_group_id')
          .eq('id', inviterRep.id)
          .maybeSingle();

        if (inviterRecruit) {
          if (!resolvedTeamId && inviterRecruit.team_id) resolvedTeamId = inviterRecruit.team_id;
          if (!resolvedMgmtGroupId && inviterRecruit.mgmt_group_id) resolvedMgmtGroupId = inviterRecruit.mgmt_group_id;
        }

        if (!resolvedTeamId) {
          const { data: ledTeam } = await supabase
            .from('teams')
            .select('id')
            .eq('lead_user_id', invite.inviter_user_id)
            .limit(1)
            .maybeSingle();
          if (ledTeam) resolvedTeamId = ledTeam.id;
        }

        if (!resolvedMgmtGroupId) {
          const { data: ledGroup } = await supabase
            .from('mgmt_groups')
            .select('id')
            .eq('lead_user_id', invite.inviter_user_id)
            .limit(1)
            .maybeSingle();
          if (ledGroup) resolvedMgmtGroupId = ledGroup.id;
        }

        if (resolvedTeamId && !resolvedMgmtGroupId) {
          const { data: teamMgmt } = await supabase
            .from('team_mgmt_groups')
            .select('mgmt_group_id')
            .eq('team_id', resolvedTeamId)
            .maybeSingle();
          if (teamMgmt) resolvedMgmtGroupId = teamMgmt.mgmt_group_id;
        }
      }
    }

    const finalName = name || user.user_metadata?.name || user.email?.split('@')[0] || 'New Rep';
    const finalYear = year || 'Rookie';

    // 3. Check if rep already exists (ghost rep claim or duplicate)
    const { data: existingRep } = await supabase
      .from('reps')
      .select('id, user_id')
      .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
      .maybeSingle();

    if (existingRep) {
      if (!existingRep.user_id) {
        await supabase
          .from('reps')
          .update({ user_id: user.id, invite_code_used: inviteCode, updated_at: new Date().toISOString() })
          .eq('id', existingRep.id);
      }

      await supabase
        .from('recruits')
        .update({ approval_status: 'pending' })
        .eq('id', existingRep.id)
        .eq('approval_status', 'approved');

      await supabase
        .from('invite_codes')
        .update({ uses_count: invite.uses_count + 1 })
        .eq('id', invite.id);

      await notifyUplineOfPendingApproval(supabase, invite.inviter_user_id, finalName, existingRep.id, isLateralInvite);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Existing account linked',
        repId: existingRep.id,
        pendingApproval: true,
        isLateralInvite,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Create recruit record with approval_status = 'pending'
    const recruitData: Record<string, unknown> = {
      name: finalName,
      email: user.email,
      phone: phone || null,
      stage: 'Signed',
      year: finalYear,
      recruiter_user_id: resolvedRecruiterUserId, // NULL for lateral invites
      team_id: resolvedTeamId, // NULL for lateral invites
      mgmt_group_id: resolvedMgmtGroupId, // NULL for lateral invites
      invite_code_used: inviteCode,
      approval_status: 'pending',
    };

    const { data: newRecruit, error: recruitError } = await supabase
      .from('recruits')
      .insert(recruitData)
      .select('id')
      .single();

    if (recruitError) {
      console.error('Error creating recruit:', recruitError);
      if (recruitError.message?.includes('Duplicate') || recruitError.message?.includes('duplicate')) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Account already exists in the system',
          pendingApproval: true,
          isLateralInvite,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw recruitError;
    }

    // 5. Ensure the rep record exists and is linked to this user
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
          // For lateral invites, don't set team_leader info from inviter
          team_leader: isLateralInvite ? null : (inviterRep?.name || null),
          team_leader_phone: isLateralInvite ? null : (inviterRep?.phone || null),
          updated_at: new Date().toISOString(),
        })
        .eq('id', createdRep.id);
    } else if (!createdRep) {
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
          team_leader: isLateralInvite ? null : (inviterRep?.name || null),
          team_leader_phone: isLateralInvite ? null : (inviterRep?.phone || null),
        });
    }

    // 6. Increment invite code usage
    await supabase
      .from('invite_codes')
      .update({ uses_count: invite.uses_count + 1 })
      .eq('id', invite.id);

    // 7. Log activity
    const activityNote = isLateralInvite
      ? `Joined via lateral invite link from ${inviterRep?.name || 'recruiter'} — pending approval (manual placement required)`
      : `Joined via invite link from ${inviterRep?.name || 'recruiter'} — pending approval`;

    await supabase
      .from('recruit_activities')
      .insert({
        recruit_id: newRecruit.id,
        activity_type: 'note',
        logged_by_user_id: invite.inviter_user_id,
        notes: activityNote,
      });

    // 8. Notify inviter and upline
    await notifyUplineOfPendingApproval(supabase, invite.inviter_user_id, finalName, newRecruit.id, isLateralInvite);

    console.log(`[process-invite-signup] Created recruit+rep for ${finalName} via ${isLateralInvite ? 'lateral' : 'downline'} invite code ${inviteCode} (pending approval)`);

    return new Response(JSON.stringify({ 
      success: true, 
      recruitId: newRecruit.id,
      inviterName: inviterRep?.name,
      teamId: resolvedTeamId,
      pendingApproval: true,
      isLateralInvite,
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

/**
 * Send push notifications to the inviter and their upline (up to MGMT group lead)
 * about a new signup that needs approval.
 */
async function notifyUplineOfPendingApproval(
  supabase: ReturnType<typeof createClient>,
  inviterUserId: string,
  newRepName: string,
  recruitId: string,
  isLateralInvite: boolean,
) {
  try {
    const notifyUserIds = new Set<string>();
    notifyUserIds.add(inviterUserId);

    const { data: inviterRep } = await supabase
      .from('reps')
      .select('id')
      .eq('user_id', inviterUserId)
      .maybeSingle();

    let mgmtGroupLeadUserId: string | null = null;

    if (inviterRep) {
      const { data: inviterRecruit } = await supabase
        .from('recruits')
        .select('mgmt_group_id')
        .eq('id', inviterRep.id)
        .maybeSingle();

      if (inviterRecruit?.mgmt_group_id) {
        const { data: mgmt } = await supabase
          .from('mgmt_groups')
          .select('lead_user_id')
          .eq('id', inviterRecruit.mgmt_group_id)
          .maybeSingle();
        if (mgmt?.lead_user_id) {
          mgmtGroupLeadUserId = mgmt.lead_user_id;
        }
      }
    }

    // Walk the recruiter chain from the inviter up to the MGMT group lead
    let currentUserId: string | null = inviterUserId;
    const maxDepth = 10;
    let depth = 0;

    while (currentUserId && depth < maxDepth) {
      if (mgmtGroupLeadUserId && currentUserId === mgmtGroupLeadUserId) {
        notifyUserIds.add(currentUserId);
        break;
      }

      const { data: rep } = await supabase
        .from('reps')
        .select('id')
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (!rep) break;

      const { data: recruit } = await supabase
        .from('recruits')
        .select('recruiter_user_id')
        .eq('id', rep.id)
        .maybeSingle();

      if (!recruit?.recruiter_user_id) break;

      notifyUserIds.add(recruit.recruiter_user_id);
      currentUserId = recruit.recruiter_user_id;
      depth++;
    }

    if (mgmtGroupLeadUserId) {
      notifyUserIds.add(mgmtGroupLeadUserId);
    }

    console.log(`[notify-upline] Notifying ${notifyUserIds.size} users for pending approval of ${newRepName} (${isLateralInvite ? 'lateral' : 'downline'})`);

    const notificationTitle = isLateralInvite
      ? 'Lateral Invite — Needs Manual Placement'
      : 'New Signup Needs Approval';

    const notificationBody = isLateralInvite
      ? `${newRepName} joined via a lateral invite and needs recruiter/team assignment.`
      : `${newRepName} signed up via invite link and needs your approval.`;

    for (const userId of notifyUserIds) {
      const { data: tokens } = await supabase
        .from('apns_device_tokens')
        .select('device_token')
        .eq('user_id', userId);

      if (tokens && tokens.length > 0) {
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              userId,
              title: notificationTitle,
              body: notificationBody,
              data: { type: 'pending_approval', recruitId },
            },
          });
        } catch (e) {
          console.error(`Failed to notify ${userId}:`, e);
        }
      }
    }
  } catch (error) {
    console.error('Error notifying upline:', error);
  }
}
