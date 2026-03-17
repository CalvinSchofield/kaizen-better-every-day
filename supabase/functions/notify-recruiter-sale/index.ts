import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush, PushSubscription, PushPayload } from "../_shared/web-push.ts";

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

    const { sellerUserId, prmr, fpPlus } = await req.json();
    console.log(`[notify-recruiter-sale] Seller: ${sellerUserId}, PRMR: $${prmr}, FP+: ${fpPlus}`);

    // Find the seller's recruit record to get recruiter_user_id
    const { data: recruit } = await supabase
      .from('recruits')
      .select('recruiter_user_id, name')
      .or(`user_id.eq.${sellerUserId}`)
      .limit(1);

    // Also check reps table if recruit not found by user_id
    let recruiterUserId: string | null = null;
    let sellerName = 'Someone';

    if (recruit && recruit.length > 0 && recruit[0].recruiter_user_id) {
      recruiterUserId = recruit[0].recruiter_user_id;
      sellerName = recruit[0].name || sellerName;
    } else {
      // Fallback: check reps table for name, then recruits by email match
      const { data: rep } = await supabase
        .from('reps')
        .select('name, email')
        .eq('user_id', sellerUserId)
        .maybeSingle();

      if (rep) {
        sellerName = rep.name?.split(' ')[0] || sellerName;
        if (rep.email) {
          const { data: recruitByEmail } = await supabase
            .from('recruits')
            .select('recruiter_user_id')
            .ilike('email', rep.email)
            .maybeSingle();
          recruiterUserId = recruitByEmail?.recruiter_user_id || null;
        }
      }
    }

    if (!recruiterUserId) {
      console.log('[notify-recruiter-sale] No recruiter found for this seller');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No recruiter found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Don't notify yourself
    if (recruiterUserId === sellerUserId) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Seller is own recruiter' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check notification preferences
    const { data: pref } = await supabase
      .from('notification_preferences')
      .select('enabled')
      .eq('user_id', recruiterUserId)
      .eq('notification_type', 'recruit_sale')
      .maybeSingle();

    if (pref && pref.enabled === false) {
      console.log('[notify-recruiter-sale] Recruiter has disabled recruit_sale notifications');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Notification disabled by preference' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firstName = sellerName.split(' ')[0];
    const title = `🎉 ${firstName} just sold!`;
    const body = `$${Math.round(prmr)} PRMR — ${Number(fpPlus).toFixed(1)} FP+ today`;

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
          { title, body, url: `/profile/${sellerUserId}`, type: 'recruit_sale' },
          vapidPublicKey, vapidPrivateKey
        );
        if (result.success) webSuccess++;
        else if (result.error?.includes('410') || result.error?.includes('404')) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      } catch (err) {
        console.error('[notify-recruiter-sale] Web push error:', err);
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
              url: `/profile/${sellerUserId}`, type: 'recruit_sale', sound: 'default',
            }),
          });
          if (resp.ok) apnsSuccess++;
        } catch (err) {
          console.error('[notify-recruiter-sale] APNs error:', err);
        }
      }
    }

    // Log
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('notification_logs').insert({
      user_id: sellerUserId,
      recipient_user_id: recruiterUserId,
      notification_type: 'recruit_sale',
      entry_date: today,
      metadata: { title, body, sellerUserId, prmr, fpPlus },
    }).catch(() => {});

    console.log(`[notify-recruiter-sale] Sent: web=${webSuccess}, apns=${apnsSuccess}`);
    return new Response(
      JSON.stringify({ success: true, web: webSuccess, apns: apnsSuccess }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[notify-recruiter-sale] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
