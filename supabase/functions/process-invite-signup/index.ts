import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normalizeIdentityName = (value: string | null | undefined) =>
  (value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildLooseNamePattern = (value: string) => {
  const normalized = normalizeIdentityName(value);
  if (!normalized) return null;

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) return null;

  return `%${tokens.join('%')}%`;
};

/**
 * Called after a user signs up with an invite code.
 * Creates the recruit + rep records and links them to the inviter.
 * 
 * For DOWNLINE invites: sets approval_status = 'pending', auto-assigns org placement.
 * For LATERAL invites WITH pre_assigned_role: auto-approves, assigns role, leaves
 *   recruiter/team/group null — the invited leader sets up their own structure.
 * For LATERAL invites WITHOUT pre_assigned_role: falls back to pending (legacy).
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
    const preAssignedRole = invite.pre_assigned_role || null;
    // ALL signups require explicit approval — roles can be pre-assigned but approval stays pending
    const shouldAutoApprove = false;

    // 2. Get inviter's rep record for team info
    const { data: inviterRep } = await supabase
      .from('reps')
      .select('id, name, phone, user_id, team_leader, team_leader_phone')
      .eq('user_id', invite.inviter_user_id)
      .maybeSingle();

    // 2b. Resolve org placement
    let resolvedTeamId: string | null = null;
    let resolvedMgmtGroupId: string | null = null;
    let resolvedOfficeId: string | null = null;
    // For lateral invites, don't set recruiter — the leader's
    // actual recruiter is their upline who may not be onboarded yet
    let resolvedRecruiterUserId: string | null = isLateralInvite ? null : invite.inviter_user_id;

    if (!isLateralInvite) {
      // Standard downline flow — auto-assign org placement
      resolvedTeamId = invite.team_id || null;
      resolvedMgmtGroupId = invite.mgmt_group_id || null;

      if (inviterRep && (!resolvedTeamId || !resolvedMgmtGroupId)) {
        const { data: inviterRecruit } = await supabase
          .from('recruits')
          .select('team_id, mgmt_group_id, office_id')
          .eq('id', inviterRep.id)
          .maybeSingle();

        if (inviterRecruit) {
          if (!resolvedTeamId && inviterRecruit.team_id) resolvedTeamId = inviterRecruit.team_id;
          if (!resolvedMgmtGroupId && inviterRecruit.mgmt_group_id) resolvedMgmtGroupId = inviterRecruit.mgmt_group_id;
          if (inviterRecruit.office_id) resolvedOfficeId = inviterRecruit.office_id;
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

    // 2c. Resolve office_id via cascading logic: recruit > team > mgmt_group > inviter's office_staff
    if (!resolvedOfficeId && resolvedTeamId) {
      const { data: teamData } = await supabase
        .from('teams')
        .select('office_id')
        .eq('id', resolvedTeamId)
        .maybeSingle();
      if (teamData?.office_id) resolvedOfficeId = teamData.office_id;
    }
    if (!resolvedOfficeId && resolvedMgmtGroupId) {
      const { data: mgData } = await supabase
        .from('mgmt_groups')
        .select('office_id')
        .eq('id', resolvedMgmtGroupId)
        .maybeSingle();
      if (mgData?.office_id) resolvedOfficeId = mgData.office_id;
    }
    if (!resolvedOfficeId) {
      // Check if inviter is an Area Director — inherit their office
      const { data: adStaff } = await supabase
        .from('office_staff')
        .select('office_id')
        .eq('user_id', invite.inviter_user_id)
        .eq('role', 'area_director')
        .maybeSingle();
      if (adStaff?.office_id) resolvedOfficeId = adStaff.office_id;
    }
    if (!resolvedOfficeId && inviterRep) {
      // Fallback: check inviter's own recruit record for office_id
      const { data: inviterRecruitOffice } = await supabase
        .from('recruits')
        .select('office_id')
        .eq('id', inviterRep.id)
        .maybeSingle();
      if (inviterRecruitOffice?.office_id) resolvedOfficeId = inviterRecruitOffice.office_id;
    }

    const finalName = name || user.user_metadata?.name || user.email?.split('@')[0] || 'New Rep';
    // Allow all invitees to specify their experience level
    const finalYear = year || 'Rookie';
    const approvalStatus = shouldAutoApprove ? 'approved' : 'pending';

    // 3. Check if recruit/rep already exists (linked user, email match, or safe unique name match)
    const nowIso = new Date().toISOString();
    const target = await resolveExistingInviteTarget(
      supabase,
      user.id,
      user.email ?? null,
      finalName,
      resolvedTeamId,
      resolvedMgmtGroupId,
      resolvedRecruiterUserId,
    );

    if (target.rep?.user_id && target.rep.user_id !== user.id) {
      return new Response(JSON.stringify({
        error: 'This recruit is already linked to another app account. Please contact your leader.',
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (target.recruit?.id || target.rep?.id) {
      const claimedId = target.recruit?.id || target.rep?.id;
      const stage = target.recruit?.stage || target.rep?.stage || 'Signed';
      const claimedPhone = phone || target.recruit?.phone || target.rep?.phone || null;
      const claimedYear = year || target.recruit?.year || target.rep?.year || 'Rookie';

      if (target.rep) {
        await supabase
          .from('reps')
          .update({
            user_id: user.id,
            name: finalName,
            email: user.email,
            phone: claimedPhone,
            year: claimedYear,
            stage,
            intro_seen: false,
            invite_code_used: inviteCode,
            office_id: resolvedOfficeId ?? target.recruit?.office_id ?? null,
            team_leader: isLateralInvite ? null : (inviterRep?.name || target.rep.team_leader || null),
            team_leader_phone: isLateralInvite ? null : (inviterRep?.phone || target.rep.team_leader_phone || null),
            // Lateral invites: clear recruiter field since they're peers/upline, not subordinates
            recruiter: isLateralInvite ? null : (target.rep.recruiter ?? null),
            updated_at: nowIso,
          })
          .eq('id', target.rep.id);
      } else {
        await supabase
          .from('reps')
          .insert({
            id: claimedId,
            name: finalName,
            email: user.email,
            phone: claimedPhone,
            stage,
            year: claimedYear,
            user_id: user.id,
            intro_seen: false,
            invite_code_used: inviteCode,
            office_id: resolvedOfficeId ?? target.recruit?.office_id ?? null,
            team_leader: isLateralInvite ? null : (inviterRep?.name || null),
            team_leader_phone: isLateralInvite ? null : (inviterRep?.phone || null),
          });
      }

      if (target.recruit) {
        await supabase
          .from('recruits')
          .update({
            name: finalName,
            email: user.email,
            phone: claimedPhone,
            year: claimedYear,
            stage,
            recruiter_user_id: resolvedRecruiterUserId ?? target.recruit.recruiter_user_id ?? null,
            team_id: resolvedTeamId ?? target.recruit.team_id ?? null,
            mgmt_group_id: resolvedMgmtGroupId ?? target.recruit.mgmt_group_id ?? null,
            office_id: resolvedOfficeId ?? target.recruit.office_id ?? null,
            invite_code_used: inviteCode,
            approval_status: approvalStatus,
            approved_at: shouldAutoApprove ? nowIso : null,
            approved_by_user_id: shouldAutoApprove ? invite.inviter_user_id : null,
            updated_at: nowIso,
          })
          .eq('id', target.recruit.id);
      } else {
        await supabase
          .from('recruits')
          .insert({
            id: claimedId,
            name: finalName,
            email: user.email,
            phone: claimedPhone,
            stage,
            year: claimedYear,
            recruiter_user_id: resolvedRecruiterUserId,
            team_id: resolvedTeamId,
            mgmt_group_id: resolvedMgmtGroupId,
            office_id: resolvedOfficeId,
            invite_code_used: inviteCode,
            approval_status: approvalStatus,
            approved_at: shouldAutoApprove ? nowIso : null,
            approved_by_user_id: shouldAutoApprove ? invite.inviter_user_id : null,
          });
      }

      if (shouldAutoApprove && preAssignedRole) {
        await assignRole(supabase, user.id, preAssignedRole);
      }

      await supabase
        .from('invite_codes')
        .update({ uses_count: invite.uses_count + 1 })
        .eq('id', invite.id);

      if (!shouldAutoApprove) {
        await notifyUplineOfPendingApproval(supabase, invite.inviter_user_id, finalName, claimedId, isLateralInvite);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Existing pipeline record linked',
        repId: claimedId,
        pendingApproval: !shouldAutoApprove,
        isLateralInvite,
        autoApproved: shouldAutoApprove,
        assignedRole: preAssignedRole,
        matchSource: target.matchSource,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Create recruit record
    const recruitData: Record<string, unknown> = {
      name: finalName,
      email: user.email,
      phone: phone || null,
      stage: 'Signed',
      year: finalYear,
      recruiter_user_id: resolvedRecruiterUserId,
      team_id: resolvedTeamId,
      mgmt_group_id: resolvedMgmtGroupId,
      invite_code_used: inviteCode,
      approval_status: approvalStatus,
      ...(shouldAutoApprove ? {
        approved_at: new Date().toISOString(),
        approved_by_user_id: invite.inviter_user_id,
      } : {}),
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
          pendingApproval: !shouldAutoApprove,
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
          office_id: resolvedOfficeId,
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
          office_id: resolvedOfficeId,
          team_leader: isLateralInvite ? null : (inviterRep?.name || null),
          team_leader_phone: isLateralInvite ? null : (inviterRep?.phone || null),
        });
    }

    // 5b. Assign role if pre-assigned (auto-approve path)
    if (shouldAutoApprove && preAssignedRole) {
      await assignRole(supabase, user.id, preAssignedRole);
    }

    // 6. Increment invite code usage
    await supabase
      .from('invite_codes')
      .update({ uses_count: invite.uses_count + 1 })
      .eq('id', invite.id);

    // 7. Log activity
    const activityNote = shouldAutoApprove
      ? `Joined via leader invite from ${inviterRep?.name || 'recruiter'} — auto-approved as ${preAssignedRole}`
      : isLateralInvite
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

    // 8. Notify (only for pending approvals)
    if (!shouldAutoApprove) {
      await notifyUplineOfPendingApproval(supabase, invite.inviter_user_id, finalName, newRecruit.id, isLateralInvite);
    }

    console.log(`[process-invite-signup] Created recruit+rep for ${finalName} via ${isLateralInvite ? 'lateral' : 'downline'} invite code ${inviteCode} (${shouldAutoApprove ? 'auto-approved as ' + preAssignedRole : 'pending approval'})`);

    return new Response(JSON.stringify({ 
      success: true, 
      recruitId: newRecruit.id,
      inviterName: inviterRep?.name,
      teamId: resolvedTeamId,
      pendingApproval: !shouldAutoApprove,
      isLateralInvite,
      autoApproved: shouldAutoApprove,
      assignedRole: preAssignedRole,
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
 * Assign a role to a user via the user_roles table.
 * Maps role strings to the app_role enum values.
 */
async function assignRole(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  role: string,
) {
  // Map display/config roles to app_role enum values
  const roleMap: Record<string, string> = {
    'assistant_manager': 'assistant_manager',
    'team_lead': 'team_lead',
    'manager': 'manager',
    'senior_manager': 'senior_manager',
    'mgmt_group_lead': 'mgmt_group_lead',
    'area_director': 'area_director',
    'regional': 'regional',
    'sr_regional': 'sr_regional',
    'partner': 'partner',
    'divisional': 'divisional',
    'corporate': 'corporate',
  };

  const mappedRole = roleMap[role];
  if (!mappedRole) {
    console.warn(`[assignRole] Unknown role: ${role}`);
    return;
  }

  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: mappedRole }, { onConflict: 'user_id,role' });

  if (error) {
    console.error(`[assignRole] Error assigning role ${mappedRole} to ${userId}:`, error);
  } else {
    console.log(`[assignRole] Assigned ${mappedRole} to ${userId}`);
  }
}

async function resolveExistingInviteTarget(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userEmail: string | null,
  fullName: string,
  resolvedTeamId: string | null,
  resolvedMgmtGroupId: string | null,
  resolvedRecruiterUserId: string | null,
) {
  const repSelect = 'id, user_id, name, email, phone, year, stage, team_leader, team_leader_phone, office_id';
  const recruitSelect = 'id, name, email, phone, year, stage, recruiter_user_id, team_id, mgmt_group_id, office_id';

  const { data: linkedRep } = await supabase
    .from('reps')
    .select(repSelect)
    .eq('user_id', userId)
    .maybeSingle();

  if (linkedRep) {
    const { data: linkedRecruit } = await supabase
      .from('recruits')
      .select(recruitSelect)
      .eq('id', linkedRep.id)
      .maybeSingle();

    return { rep: linkedRep, recruit: linkedRecruit, matchSource: 'user_id' };
  }

  if (userEmail) {
    const { data: recruitByEmail } = await supabase
      .from('recruits')
      .select(recruitSelect)
      .ilike('email', userEmail)
      .maybeSingle();

    if (recruitByEmail) {
      const { data: repByRecruitId } = await supabase
        .from('reps')
        .select(repSelect)
        .eq('id', recruitByEmail.id)
        .maybeSingle();

      return { rep: repByRecruitId, recruit: recruitByEmail, matchSource: 'email' };
    }

    const { data: repByEmail } = await supabase
      .from('reps')
      .select(repSelect)
      .ilike('email', userEmail)
      .maybeSingle();

    if (repByEmail) {
      const { data: recruitByRepId } = await supabase
        .from('recruits')
        .select(recruitSelect)
        .eq('id', repByEmail.id)
        .maybeSingle();

      return { rep: repByEmail, recruit: recruitByRepId, matchSource: 'email' };
    }
  }

  const namePattern = buildLooseNamePattern(fullName);
  if (!namePattern) {
    return { rep: null, recruit: null, matchSource: null };
  }

  const normalizedTargetName = normalizeIdentityName(fullName);

  const { data: recruitCandidates } = await supabase
    .from('recruits')
    .select(recruitSelect)
    .ilike('name', namePattern)
    .limit(20);

  const normalizedRecruitCandidates = (recruitCandidates || []).filter((candidate) =>
    normalizeIdentityName(candidate.name) === normalizedTargetName
  );

  const scopedRecruitCandidates = normalizedRecruitCandidates.filter((candidate) => {
    if (resolvedRecruiterUserId && candidate.recruiter_user_id === resolvedRecruiterUserId) return true;
    if (resolvedTeamId && candidate.team_id === resolvedTeamId) return true;
    if (resolvedMgmtGroupId && candidate.mgmt_group_id === resolvedMgmtGroupId) return true;
    return !resolvedRecruiterUserId && !resolvedTeamId && !resolvedMgmtGroupId;
  });

  const finalRecruitCandidates = scopedRecruitCandidates.length === 1
    ? scopedRecruitCandidates
    : normalizedRecruitCandidates.length === 1
      ? normalizedRecruitCandidates
      : [];

  if (finalRecruitCandidates.length === 1) {
    const recruit = finalRecruitCandidates[0];
    const { data: rep } = await supabase
      .from('reps')
      .select(repSelect)
      .eq('id', recruit.id)
      .maybeSingle();

    if (!rep || !rep.user_id || rep.user_id === userId) {
      return { rep, recruit, matchSource: 'name' };
    }
  }

  const { data: repCandidates } = await supabase
    .from('reps')
    .select(repSelect)
    .is('user_id', null)
    .ilike('name', namePattern)
    .limit(20);

  const finalRepCandidates = (repCandidates || []).filter((candidate) =>
    normalizeIdentityName(candidate.name) === normalizedTargetName
  );

  if (finalRepCandidates.length === 1) {
    const rep = finalRepCandidates[0];
    const { data: recruit } = await supabase
      .from('recruits')
      .select(recruitSelect)
      .eq('id', rep.id)
      .maybeSingle();

    return { rep, recruit, matchSource: 'name' };
  }

  return { rep: null, recruit: null, matchSource: null };
}

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
