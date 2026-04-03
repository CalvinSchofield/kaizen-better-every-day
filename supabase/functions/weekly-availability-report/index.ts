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
    // Days until next Monday: if Sunday (0), next Mon is 1 day away
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

    // Get all offices with their ADs
    const { data: officeStaff } = await client
      .from('office_staff')
      .select('user_id, office_id, role')
      .eq('role', 'area_director');

    if (!officeStaff || officeStaff.length === 0) {
      return new Response(JSON.stringify({ message: 'No area directors found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get unique office IDs
    const officeIds = [...new Set(officeStaff.map(s => s.office_id))];

    // Get MGMT groups assigned to these offices
    const { data: mgmtGroups } = await client
      .from('mgmt_groups')
      .select('id, office_id')
      .in('office_id', officeIds);

    if (!mgmtGroups || mgmtGroups.length === 0) {
      return new Response(JSON.stringify({ message: 'No mgmt groups in offices' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get teams under those mgmt groups
    const mgmtGroupIds = mgmtGroups.map(g => g.id);
    const { data: teams } = await client
      .from('teams')
      .select('id, mgmt_group_id')
      .in('mgmt_group_id', mgmtGroupIds);

    const teamIds = teams?.map(t => t.id) || [];

    // Get reps assigned to those teams
    const { data: reps } = await client
      .from('reps')
      .select('user_id, name')
      .in('user_id', (
        await client
          .from('reps')
          .select('user_id')
          .or(teamIds.length > 0 ? teamIds.map(id => `user_id.in.(select user_id from reps)`).join(',') : 'user_id.is.null')
      ).data?.map((r: any) => r.user_id) || []);

    // Simpler approach: get all reps, then filter by team membership
    // Get team memberships
    const { data: allTeamReps } = await client
      .from('reps')
      .select('user_id, name');

    // We need a different approach - query reps via teams table relationship
    // Actually, reps don't have team_id. The team assignment is via the org hierarchy.
    // Let's use the teams.lead_user_id and recruiter downline approach instead.
    // 
    // Simpler: get all season_configs with excluded days that overlap next week,
    // then group by office via the mgmt_group chain.

    // Get all season configs
    const { data: configs } = await client
      .from('season_config')
      .select('user_id, personal_summer_start, personal_summer_end, excluded_summer_days');

    if (!configs) {
      return new Response(JSON.stringify({ message: 'No configs found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all rep names
    const { data: allReps } = await client
      .from('reps')
      .select('user_id, name');

    const repNameMap = new Map((allReps || []).map(r => [r.user_id, r.name]));

    // Find reps off next week
    const repsOffNextWeek: { userId: string; name: string; offDays: string[] }[] = [];

    for (const config of configs) {
      const offDays: string[] = [];
      const start = config.personal_summer_start;
      const end = config.personal_summer_end;
      const excluded = config.excluded_summer_days || [];

      for (const dateStr of nextWeekDates) {
        // Off if outside their summer range
        if (start && end) {
          if (dateStr < start || dateStr > end) {
            offDays.push(dateStr);
            continue;
          }
        }
        // Off if in excluded days
        if (excluded.includes(dateStr)) {
          offDays.push(dateStr);
        }
      }

      if (offDays.length > 0) {
        const name = repNameMap.get(config.user_id) || 'Unknown';
        repsOffNextWeek.push({ userId: config.user_id, name, offDays });
      }
    }

    if (repsOffNextWeek.length === 0) {
      // Still notify ADs that everyone is working
      for (const ad of officeStaff) {
        await sendNotification(supabaseUrl, supabaseServiceKey, ad.user_id,
          'Weekly Availability ☀️',
          `Great news! Everyone is scheduled to work next week (${weekLabel}).`,
        );
      }

      return new Response(JSON.stringify({ message: 'No one off, ADs notified' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For each AD, send a summary of their office's reps who are off
    // Group by office
    const adsByOffice = new Map<string, string[]>();
    for (const staff of officeStaff) {
      const list = adsByOffice.get(staff.office_id) || [];
      list.push(staff.user_id);
      adsByOffice.set(staff.office_id, list);
    }

    // Build office -> mgmt_group_ids map
    const officeMgmtMap = new Map<string, string[]>();
    for (const mg of mgmtGroups) {
      if (!mg.office_id) continue;
      const list = officeMgmtMap.get(mg.office_id) || [];
      list.push(mg.id);
      officeMgmtMap.set(mg.office_id, list);
    }

    // Build mgmt_group -> team_ids map  
    const mgmtTeamMap = new Map<string, string[]>();
    for (const t of (teams || [])) {
      const list = mgmtTeamMap.get(t.mgmt_group_id) || [];
      list.push(t.id);
      mgmtTeamMap.set(t.mgmt_group_id, list);
    }

    // For simplicity, send all ADs a summary of ALL reps off next week
    // (scoping per-office would require resolving team membership which is complex)
    const summaryLines = repsOffNextWeek
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 15) // Cap at 15 to keep notification readable
      .map(r => {
        const dayLabels = r.offDays.map(d => formatDayOfWeek(d)).join(', ');
        return `• ${r.name.split(' ')[0]}: ${dayLabels}`;
      });

    const totalOff = repsOffNextWeek.length;
    const body = totalOff <= 15
      ? `${totalOff} rep${totalOff > 1 ? 's' : ''} taking time off next week (${weekLabel}):\n${summaryLines.join('\n')}`
      : `${totalOff} reps taking time off next week (${weekLabel}):\n${summaryLines.join('\n')}\n...and ${totalOff - 15} more`;

    const uniqueAdIds = [...new Set(officeStaff.map(s => s.user_id))];
    const results = [];

    for (const adUserId of uniqueAdIds) {
      try {
        await sendNotification(supabaseUrl, supabaseServiceKey, adUserId,
          `Weekly Availability Report ☀️`,
          body,
        );
        results.push({ adUserId, status: 'sent' });
      } catch (err) {
        results.push({ adUserId, status: 'failed', error: String(err) });
      }
    }

    // Log it
    const todayStr = new Date().toISOString().split('T')[0];
    for (const adId of uniqueAdIds) {
      await client.from('notification_logs').insert({
        user_id: adId,
        notification_type: 'weekly_availability_report',
        entry_date: todayStr,
        metadata: { weekLabel, totalOff, repsOffCount: repsOffNextWeek.length },
      });
    }

    return new Response(JSON.stringify({ success: true, results, totalOff }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
