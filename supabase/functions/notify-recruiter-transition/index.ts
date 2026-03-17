import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web-push.ts";

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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { repUserId } = await req.json();
    console.log(`[notify-recruiter-transition] Rep: ${repUserId}`);

    // Check if rep is a rookie
    const { data: rep } = await supabase
      .from('reps')
      .select('name, year, email')
      .eq('user_id', repUserId)
      .maybeSingle();

    if (!rep || rep.year !== 'Rookie') {
      console.log('[notify-recruiter-transition] Not a rookie, skipping');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Not a rookie' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find recruiter via recruits table
    let recruiterUserId: string | null = null;
    
    // Try by email match
    if (rep.email) {
      const { data: recruit } = await supabase
        .from('recruits')
        .select('recruiter_user_id')
        .ilike('email', rep.email)
        .maybeSingle();
      recruiterUserId = recruit?.recruiter_user_id || null;
    }

    if (!recruiterUserId) {
      console.log('[notify-recruiter-transition] No recruiter found');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No recruiter found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (recruiterUserId === repUserId) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Self-recruiter' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicate: max 1 per day per rep
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('user_id', repUserId)
      .eq('recipient_user_id', recruiterUserId)
      .eq('notification_type', 'recruit_transition')
      .eq('entry_date', today)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('[notify-recruiter-transition] Already notified today');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Already notified today' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check notification preferences
    const { data: pref } = await supabase
      .from('notification_preferences')
      .select('enabled')
      .eq('user_id', recruiterUserId)
      .eq('notification_type', 'recruit_transition')
      .maybeSingle();

    if (pref && pref.enabled === false) {
      console.log('[notify-recruiter-transition] Recruiter disabled this notification type');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Disabled by preference' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firstName = rep.name?.split(' ')[0] || 'Your rookie';
    const title = `🏠 ${firstName} just transitioned!`;
    const body = `${firstName} just transitioned into a home. Keep coaching them!`;

    let webSuccess = 0;
    let apnsSuccess = 0;

    // Web Push
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', recruiterUserId);

    for (const sub of subs || []) {
      try {
        const result = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          { title, body, url: `/profile/${repUserId}`, type: 'recruit_transition' },
          vapidPublicKey, vapidPrivateKey
        );
        if (result.success) webSuccess++;
        else if (result.error?.includes('410') || result.error?.includes('404')) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      } catch (err) {
        console.error('[notify-recruiter-transition] Web push error:', err);
      }
    }

    // APNs
    const apnsConfigured = Deno.env.get('APNS_TEAM_ID') && Deno.env.get('APNS_KEY_ID') && Deno.env.get('APNS_PRIVATE_KEY');
    if (apnsConfigured) {
      const { data: tokens } = await supabase
        .from('apns_device_tokens')
        .select('device_token')
        .eq('user_id', recruiterUserId);

      for (const token of tokens || []) {
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/send-apns-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              deviceToken: token.device_token, title, body,
              url: `/profile/${repUserId}`, type: 'recruit_transition', sound: 'default',
            }),
          });
          if (resp.ok) apnsSuccess++;
        } catch (err) {
          console.error('[notify-recruiter-transition] APNs error:', err);
        }
      }
    }

    // Log
    await supabase.from('notification_logs').insert({
      user_id: repUserId,
      recipient_user_id: recruiterUserId,
      notification_type: 'recruit_transition',
      entry_date: today,
      metadata: { title, body, repUserId },
    }).catch(() => {});

    console.log(`[notify-recruiter-transition] Sent: web=${webSuccess}, apns=${apnsSuccess}`);
    return new Response(
      JSON.stringify({ success: true, web: webSuccess, apns: apnsSuccess }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[notify-recruiter-transition] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
