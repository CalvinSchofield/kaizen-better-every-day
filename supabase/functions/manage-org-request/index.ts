import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Approval chain rules:
 * Create team: mgmt_group_lead -> sr_regional
 * Create mgmt_group: senior_manager -> sr_regional  (sr mgmt group leader = senior_manager)
 * Create sr_mgmt_group: regional -> partner
 * Create region: sr_regional -> divisional
 * Create sr_region: partner -> divisional
 * Create partner: divisional
 * Create division: corporate
 * Corporate can do anything without approval.
 */

const APPROVAL_CHAIN: Record<string, string[]> = {
  create_team: ['mgmt_group_lead', 'sr_regional'],
  create_mgmt_group: ['senior_manager', 'sr_regional'],
  create_sr_mgmt_group: ['regional', 'partner'],
  create_region: ['sr_regional', 'divisional'],
  create_sr_region: ['partner', 'divisional'],
  create_partner: ['divisional'],
  create_division: ['corporate'],
};

const ROLE_WEIGHT: Record<string, number> = {
  none: 0, recruiter: 1, assistant_manager: 2, team_lead: 3,
  manager: 4, senior_manager: 5, mgmt_group_lead: 6, area_director: 7,
  regional: 8, sr_regional: 9, partner: 10, divisional: 11, corporate: 12,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    // ── CREATE REQUEST ─────────────────────────────────────────
    if (action === 'create_request') {
      const { requestType, requestData } = body;

      if (!APPROVAL_CHAIN[requestType]) {
        return new Response(JSON.stringify({ error: 'Invalid request type' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if user is corporate (can bypass approval)
      const { data: isCorp } = await supabase.rpc('is_corporate', { _user_id: user.id });
      if (isCorp) {
        // Corporate: execute directly
        const result = await executeOrgChange(supabase, requestType, requestData);
        return new Response(JSON.stringify({ success: true, directExecution: true, ...result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Find required approvers by walking the upline
      const requiredRoles = APPROVAL_CHAIN[requestType];
      const approvers = await findApprovers(supabase, user.id, requiredRoles);

      if (approvers.length === 0) {
        return new Response(JSON.stringify({ error: 'Could not find required approvers in your upline chain' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create the request
      const { data: request, error: reqError } = await supabase
        .from('org_change_requests')
        .insert({
          requested_by: user.id,
          request_type: requestType,
          request_data: requestData,
          status: 'pending',
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // Create approval records for each required approver
      const approvalInserts = approvers.map(a => ({
        request_id: request.id,
        approver_user_id: a.userId,
        approver_role: a.role,
      }));

      const { error: appError } = await supabase
        .from('org_change_approvals')
        .insert(approvalInserts);

      if (appError) throw appError;

      // Get requester name for notifications
      const { data: reqRep } = await supabase
        .from('reps')
        .select('name')
        .eq('user_id', user.id)
        .single();

      return new Response(JSON.stringify({
        success: true,
        requestId: request.id,
        approversNeeded: approvers.map(a => ({ name: a.name, role: a.role })),
        message: `Request submitted. Awaiting approval from ${approvers.map(a => a.name).join(' and ')}.`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── RESPOND TO REQUEST (approve/reject) ────────────────────
    if (action === 'respond') {
      const { requestId, approved } = body;

      // Verify this user is an approver for this request
      const { data: approval } = await supabase
        .from('org_change_approvals')
        .select('*')
        .eq('request_id', requestId)
        .eq('approver_user_id', user.id)
        .single();

      if (!approval) {
        return new Response(JSON.stringify({ error: 'You are not an approver for this request' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (approval.approved !== null) {
        return new Response(JSON.stringify({ error: 'You have already responded to this request' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update the approval
      await supabase
        .from('org_change_approvals')
        .update({ approved, responded_at: new Date().toISOString() })
        .eq('id', approval.id);

      if (!approved) {
        // If rejected, mark the whole request as rejected
        await supabase
          .from('org_change_requests')
          .update({ status: 'rejected', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', requestId);

        return new Response(JSON.stringify({ success: true, status: 'rejected' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if all approvals are now approved
      const { data: allApprovals } = await supabase
        .from('org_change_approvals')
        .select('*')
        .eq('request_id', requestId);

      const allApproved = allApprovals?.every(a => a.approved === true);

      if (allApproved) {
        // Execute the org change
        const { data: request } = await supabase
          .from('org_change_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (request) {
          await executeOrgChange(supabase, request.request_type, request.request_data);
          await supabase
            .from('org_change_requests')
            .update({ status: 'approved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', requestId);
        }

        return new Response(JSON.stringify({ success: true, status: 'approved', executed: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, status: 'partially_approved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── FETCH PENDING REQUESTS (for approvers) ─────────────────
    if (action === 'fetch_pending') {
      // Get requests where this user is an approver and hasn't responded
      const { data: pendingApprovals } = await supabase
        .from('org_change_approvals')
        .select(`
          id, approved, approver_role,
          request:org_change_requests(
            id, requested_by, request_type, request_data, status, created_at
          )
        `)
        .eq('approver_user_id', user.id)
        .is('approved', null);

      // Also get user's own requests
      const { data: myRequests } = await supabase
        .from('org_change_requests')
        .select(`
          id, request_type, request_data, status, created_at, resolved_at
        `)
        .eq('requested_by', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Get all approvals for user's own requests
      const myRequestIds = (myRequests || []).map(r => r.id);
      let myRequestApprovals: any[] = [];
      if (myRequestIds.length > 0) {
        const { data } = await supabase
          .from('org_change_approvals')
          .select('request_id, approver_user_id, approver_role, approved, responded_at')
          .in('request_id', myRequestIds);
        myRequestApprovals = data || [];
      }

      // Resolve names for requesters
      const requesterIds = new Set<string>();
      (pendingApprovals || []).forEach(a => {
        const req = Array.isArray(a.request) ? a.request[0] : a.request;
        if (req?.requested_by) requesterIds.add(req.requested_by);
      });
      const approverIds = new Set<string>();
      myRequestApprovals.forEach(a => approverIds.add(a.approver_user_id));

      const allIds = [...new Set([...requesterIds, ...approverIds])];
      let nameMap: Record<string, string> = {};
      if (allIds.length > 0) {
        const { data: reps } = await supabase
          .from('reps')
          .select('user_id, name')
          .in('user_id', allIds);
        (reps || []).forEach(r => { nameMap[r.user_id] = r.name; });
      }

      // Format pending approvals for this user
      const pendingForMe = (pendingApprovals || [])
        .filter(a => {
          const req = Array.isArray(a.request) ? a.request[0] : a.request;
          return req?.status === 'pending';
        })
        .map(a => {
          const req = Array.isArray(a.request) ? a.request[0] : a.request;
          return {
            approvalId: a.id,
            requestId: req.id,
            requestType: req.request_type,
            requestData: req.request_data,
            requestedBy: req.requested_by,
            requesterName: nameMap[req.requested_by] || 'Unknown',
            createdAt: req.created_at,
          };
        });

      // Format user's own requests with approval status
      const myRequestsFormatted = (myRequests || []).map(r => ({
        ...r,
        approvals: myRequestApprovals
          .filter(a => a.request_id === r.id)
          .map(a => ({
            approverName: nameMap[a.approver_user_id] || 'Unknown',
            approverRole: a.approver_role,
            approved: a.approved,
            respondedAt: a.responded_at,
          })),
      }));

      return new Response(JSON.stringify({
        pendingForMe,
        myRequests: myRequestsFormatted,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in manage-org-request:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── Find approvers by walking upline ──────────────────────────
async function findApprovers(
  supabase: any,
  userId: string,
  requiredRoles: string[]
): Promise<{ userId: string; name: string; role: string }[]> {
  const approvers: { userId: string; name: string; role: string }[] = [];
  const foundRoles = new Set<string>();

  // Get all user roles
  const { data: allUserRoles } = await supabase
    .from('user_roles')
    .select('user_id, role');

  const rolesByUser = new Map<string, string[]>();
  (allUserRoles || []).forEach((r: any) => {
    const existing = rolesByUser.get(r.user_id) || [];
    existing.push(r.role);
    rolesByUser.set(r.user_id, existing);
  });

  // Also check structural roles
  const [
    { data: mgmtLeads },
    { data: areaDirectors },
    { data: officeStaff },
    { data: regionLeads },
  ] = await Promise.all([
    supabase.from('mgmt_groups').select('lead_user_id').not('lead_user_id', 'is', null),
    supabase.from('area_directors').select('user_id'),
    supabase.from('office_staff').select('user_id, role'),
    supabase.from('regions').select('lead_user_id').not('lead_user_id', 'is', null),
  ]);

  const structuralRoles = new Map<string, Set<string>>();
  const addStructural = (uid: string, role: string) => {
    const s = structuralRoles.get(uid) || new Set();
    s.add(role);
    structuralRoles.set(uid, s);
  };

  (mgmtLeads || []).forEach((m: any) => addStructural(m.lead_user_id, 'mgmt_group_lead'));
  (areaDirectors || []).forEach((a: any) => addStructural(a.user_id, 'area_director'));
  (officeStaff || []).forEach((s: any) => addStructural(s.user_id, s.role || 'area_director'));
  (regionLeads || []).forEach((r: any) => addStructural(r.lead_user_id, 'regional'));

  // Walk up the recruiter chain to find people with required roles
  let currentUserId = userId;
  const visited = new Set<string>();

  for (let hop = 0; hop < 12 && foundRoles.size < requiredRoles.length; hop++) {
    if (visited.has(currentUserId)) break;
    visited.add(currentUserId);

    // Find this person's recruiter
    const { data: rep } = await supabase
      .from('reps')
      .select('user_id, name')
      .eq('user_id', currentUserId)
      .single();

    if (!rep) break;

    const { data: recruit } = await supabase
      .from('recruits')
      .select('recruiter_user_id')
      .ilike('name', rep.name)
      .not('recruiter_user_id', 'is', null)
      .limit(1)
      .single();

    const recruiterUserId = recruit?.recruiter_user_id;
    if (!recruiterUserId) break;

    // Check recruiter's roles
    const recruiterExplicitRoles = rolesByUser.get(recruiterUserId) || [];
    const recruiterStructuralRoles = structuralRoles.get(recruiterUserId) || new Set();
    const allRoles = new Set([...recruiterExplicitRoles, ...recruiterStructuralRoles]);

    // Get highest role weight for this person
    let highestRole = 'none';
    let highestWeight = 0;
    allRoles.forEach(role => {
      const w = ROLE_WEIGHT[role] || 0;
      if (w > highestWeight) {
        highestWeight = w;
        highestRole = role;
      }
    });

    // Check if this person fulfills any required role
    for (const reqRole of requiredRoles) {
      if (foundRoles.has(reqRole)) continue;
      const reqWeight = ROLE_WEIGHT[reqRole] || 0;
      if (highestWeight >= reqWeight) {
        const { data: recruiterRep } = await supabase
          .from('reps')
          .select('name')
          .eq('user_id', recruiterUserId)
          .single();

        approvers.push({
          userId: recruiterUserId,
          name: recruiterRep?.name || 'Unknown',
          role: reqRole,
        });
        foundRoles.add(reqRole);
      }
    }

    currentUserId = recruiterUserId;
  }

  return approvers;
}

// ── Execute an org change after full approval ─────────────────
async function executeOrgChange(
  supabase: any,
  requestType: string,
  requestData: any
): Promise<Record<string, any>> {
  const { name, leadUserId, mgmtGroupId, officeId } = requestData;

  switch (requestType) {
    case 'create_team': {
      const { data: team, error } = await supabase
        .from('teams')
        .insert({ name, lead_user_id: leadUserId || null })
        .select()
        .single();
      if (error) throw error;

      if (mgmtGroupId) {
        await supabase
          .from('team_mgmt_groups')
          .insert({ team_id: team.id, mgmt_group_id: mgmtGroupId });
      }
      return { team };
    }

    case 'create_mgmt_group': {
      const { data: group, error } = await supabase
        .from('mgmt_groups')
        .insert({ name, lead_user_id: leadUserId || null, office_id: officeId || null })
        .select()
        .single();
      if (error) throw error;
      return { group };
    }

    default:
      // For higher-level org changes (region, partner, division), 
      // we'll implement these as needed
      console.log(`Org change type ${requestType} not yet implemented for auto-execution`);
      return { note: `${requestType} recorded but requires manual setup` };
  }
}
