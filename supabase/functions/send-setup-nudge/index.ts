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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'Missing targetUserId' }), { status: 400, headers: corsHeaders });
    }

    // Get leader's name for the notification
    const { data: leaderRep } = await supabase
      .from('reps')
      .select('name')
      .eq('user_id', user.id)
      .maybeSingle();

    const leaderName = leaderRep?.name?.split(' ')[0] || 'Your leader';

    const payload = {
      title: '📋 Complete Your Setup',
      body: `${leaderName} wants you to sync your numbers and set your goals in Kaizen.`,
      data: { url: '/goals' },
    };

    // Send web push
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', targetUserId);

    let webSent = 0;
    for (const sub of subs || []) {
      try {
        const result = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
        );
        if (result.success) webSent++;
      } catch (err) {
        console.error('[send-setup-nudge] Web push error:', err);
      }
    }

    // Send APNs if configured
    let apnsSent = 0;
    const apnsConfigured = Deno.env.get('APNS_TEAM_ID') && Deno.env.get('APNS_KEY_ID') && Deno.env.get('APNS_PRIVATE_KEY');
    if (apnsConfigured) {
      const { data: deviceTokens } = await supabase
        .from('apns_device_tokens')
        .select('*')
        .eq('user_id', targetUserId);

      for (const token of deviceTokens || []) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/send-apns-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              deviceToken: token.device_token,
              title: payload.title,
              body: payload.body,
              data: payload.data,
            }),
          });
          if (response.ok) apnsSent++;
        } catch (err) {
          console.error('[send-setup-nudge] APNs error:', err);
        }
      }
    }

    // Log the notification
    await supabase.from('notification_logs').insert({
      user_id: user.id,
      recipient_user_id: targetUserId,
      notification_type: 'setup_nudge',
      entry_date: new Date().toISOString().split('T')[0],
      metadata: { webSent, apnsSent },
    });

    return new Response(
      JSON.stringify({ success: true, webSent, apnsSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[send-setup-nudge] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
