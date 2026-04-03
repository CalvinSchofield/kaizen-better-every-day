import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const client = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate next week's Mon-Sat dates
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun
    const daysUntilNextMon = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    const nextMonday = new Date(now);
    nextMonday.setUTCDate(now.getUTCDate() + daysUntilNextMon);

    const nextWeekDates: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(nextMonday);
      d.setUTCDate(nextMonday.getUTCDate() + i);
      nextWeekDates.push(d.toISOString().split('T')[0]);
    }

    const weekLabel = `${formatShortDate(nextWeekDates[0])} – ${formatShortDate(nextWeekDates[5])}`;

    // Get all season configs with excluded days
    const { data: configs } = await client
      .from('season_config')
      .select('user_id, personal_summer_start, personal_summer_end, excluded_summer_days');

    if (!configs) {
      return jsonResponse({ message: 'No configs found' });
    }

    // Get all rep names
    const { data: allReps } = await client
      .from('reps')
      .select('user_id, name');
    const repNameMap = new Map((allReps || []).map(r => [r.user_id, r.name]));

    // Find reps with EXPLICIT excluded days next week (not out-of-range)
    const repsOffNextWeek: { userId: string; name: string; offDays: string[] }[] = [];

    for (const config of configs) {
      const excluded = config.excluded_summer_days || [];
      const offDays = nextWeekDates.filter(dateStr => excluded.includes(dateStr));

      if (offDays.length > 0) {
        const name = repNameMap.get(config.user_id) || 'Unknown';
        repsOffNextWeek.push({ userId: config.user_id, name, offDays });
      }
    }

    // --- Gather recipients: Area Directors + MGMT Group Leaders ---

    // 1. Area Directors - get all office ADs
    const { data: officeStaff } = await client
      .from('office_staff')
      .select('user_id, office_id, role')
      .eq('role', 'area_director');

    // 2. MGMT Group Leaders
    const { data: mgmtGroups } = await client
      .from('mgmt_groups')
      .select('id, lead_user_id, office_id');

    // 3. Teams under mgmt groups (for scoping)
    const mgmtGroupIds = (mgmtGroups || []).filter(g => g.lead_user_id).map(g => g.id);
    const { data: teams } = await client
      .from('teams')
      .select('id, mgmt_group_id, lead_user_id');

    // 4. Get recruiter chains to resolve which reps belong to which mgmt groups
    const { data: recruits } = await client
      .from('recruits')
      .select('recruiter_user_id, team_id');

    // Build team -> mgmt_group mapping
    const teamToMgmt = new Map<string, string>();
    for (const t of (teams || [])) {
      if (t.mgmt_group_id) teamToMgmt.set(t.id, t.mgmt_group_id);
    }

    // Build mgmt_group -> rep user_ids mapping (via team leads + recruits on those teams)
    const mgmtGroupReps = new Map<string, Set<string>>();
    // Add team leads
    for (const t of (teams || [])) {
      if (t.mgmt_group_id && t.lead_user_id) {
        if (!mgmtGroupReps.has(t.mgmt_group_id)) mgmtGroupReps.set(t.mgmt_group_id, new Set());
        mgmtGroupReps.get(t.mgmt_group_id)!.add(t.lead_user_id);
      }
    }
    // Add recruits assigned to teams
    for (const r of (recruits || [])) {
      if (r.team_id && teamToMgmt.has(r.team_id) && r.recruiter_user_id) {
        const mgId = teamToMgmt.get(r.team_id)!;
        if (!mgmtGroupReps.has(mgId)) mgmtGroupReps.set(mgId, new Set());
        mgmtGroupReps.get(mgId)!.add(r.recruiter_user_id);
      }
    }

    const results: { recipientId: string; role: string; status: string; error?: string }[] = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const offUserIdSet = new Set(repsOffNextWeek.map(r => r.userId));

    // --- Send to Area Directors (all reps in their office) ---
    const uniqueAdIds = [...new Set((officeStaff || []).map(s => s.user_id))];
    for (const adUserId of uniqueAdIds) {
      // ADs get the full report (all reps off)
      const body = buildReportBody(repsOffNextWeek, weekLabel);
      try {
        await sendNotification(supabaseUrl, supabaseServiceKey, adUserId,
          `Weekly Availability Report ☀️`, body);
        results.push({ recipientId: adUserId, role: 'area_director', status: 'sent' });
      } catch (err) {
        results.push({ recipientId: adUserId, role: 'area_director', status: 'failed', error: String(err) });
      }
      await logNotification(client, adUserId, todayStr, weekLabel, repsOffNextWeek.length);
    }

    // --- Send to MGMT Group Leaders (scoped to their downline) ---
    for (const mg of (mgmtGroups || [])) {
      if (!mg.lead_user_id) continue;
      // Skip if this leader is already an AD (already received full report)
      if (uniqueAdIds.includes(mg.lead_user_id)) continue;

      const downlineUserIds = mgmtGroupReps.get(mg.id);
      if (!downlineUserIds || downlineUserIds.size === 0) continue;

      // Filter off reps to just this leader's downline
      const scopedOff = repsOffNextWeek.filter(r => downlineUserIds.has(r.userId));

      if (scopedOff.length === 0) {
        // Send "all good" message
        try {
          await sendNotification(supabaseUrl, supabaseServiceKey, mg.lead_user_id,
            'Weekly Availability ☀️',
            `Great news! Everyone in your group is scheduled to work next week (${weekLabel}).`);
          results.push({ recipientId: mg.lead_user_id, role: 'mgmt_group_lead', status: 'sent' });
        } catch (err) {
          results.push({ recipientId: mg.lead_user_id, role: 'mgmt_group_lead', status: 'failed', error: String(err) });
        }
      } else {
        const body = buildReportBody(scopedOff, weekLabel);
        try {
          await sendNotification(supabaseUrl, supabaseServiceKey, mg.lead_user_id,
            `Weekly Availability Report ☀️`, body);
          results.push({ recipientId: mg.lead_user_id, role: 'mgmt_group_lead', status: 'sent' });
        } catch (err) {
          results.push({ recipientId: mg.lead_user_id, role: 'mgmt_group_lead', status: 'failed', error: String(err) });
        }
      }
      await logNotification(client, mg.lead_user_id, todayStr, weekLabel, scopedOff.length);
    }

    // If no one is off, still notify ADs
    if (repsOffNextWeek.length === 0) {
      for (const adUserId of uniqueAdIds) {
        try {
          await sendNotification(supabaseUrl, supabaseServiceKey, adUserId,
            'Weekly Availability ☀️',
            `Great news! Everyone is scheduled to work next week (${weekLabel}).`);
        } catch (_) { /* ignore */ }
      }
    }

    return jsonResponse({ success: true, results, totalOff: repsOffNextWeek.length });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildReportBody(repsOff: { name: string; offDays: string[] }[], weekLabel: string): string {
  const sorted = [...repsOff].sort((a, b) => a.name.localeCompare(b.name));
  const lines = sorted
    .slice(0, 15)
    .map(r => {
      const dayLabels = r.offDays.map(d => formatDayOfWeek(d)).join(', ');
      return `• ${r.name.split(' ')[0]}: ${dayLabels}`;
    });

  const total = repsOff.length;
  return total <= 15
    ? `${total} rep${total > 1 ? 's' : ''} taking time off next week (${weekLabel}):\n${lines.join('\n')}`
    : `${total} reps taking time off next week (${weekLabel}):\n${lines.join('\n')}\n...and ${total - 15} more`;
}

async function logNotification(client: any, userId: string, todayStr: string, weekLabel: string, count: number) {
  await client.from('notification_logs').insert({
    user_id: userId,
    notification_type: 'weekly_availability_report',
    entry_date: todayStr,
    metadata: { weekLabel, repsOffCount: count },
  });
}

async function sendNotification(supabaseUrl: string, serviceKey: string, targetUserId: string, title: string, body: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-apns-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      targetUserId,
      title,
      body,
      url: '/my-group',
      type: 'weekly_availability_report',
    }),
  });
  return response.json();
}

function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${day}`;
}

function formatDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getUTCDay()];
}
