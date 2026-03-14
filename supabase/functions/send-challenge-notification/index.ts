import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush, PushSubscription, PushPayload } from "../_shared/web-push.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: 'challenge_invite' | 'challenge_started' | 'challenge_accepted' | 'challenge_declined' | 'challenge_completed' | 'incentive_created' | 'incentive_completed' | string;
  targetUserIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

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

    const payload: NotificationRequest = await req.json();
    const { type, targetUserIds, title, body, data } = payload;

    console.log(`[send-challenge-notification] Type: ${type}, targeting ${targetUserIds.length} users`);

    if (!targetUserIds?.length) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No target users' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let webSuccessCount = 0;
    let webFailCount = 0;
    let apnsSuccessCount = 0;
    let apnsFailCount = 0;

    // ========== Web Push ==========
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', targetUserIds);

    if (subError) {
      console.error('[send-challenge-notification] Error fetching web subscriptions:', subError);
    }

    console.log(`[send-challenge-notification] Found ${subscriptions?.length || 0} web push subscriptions`);

    for (const sub of subscriptions || []) {
      try {
        const pushSubscription: PushSubscription = {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        };

        const notificationPayload: PushPayload = {
          title,
          body,
          url: '/compete',
          type,
        };

        const result = await sendWebPush(
          pushSubscription, 
          notificationPayload, 
          vapidPublicKey, 
          vapidPrivateKey
        );

        if (result.success) {
          webSuccessCount++;
        } else {
          webFailCount++;
          console.error(`[send-challenge-notification] Web push failed for user ${sub.user_id}:`, result.error);
          
          if (result.error?.includes('410') || result.error?.includes('404')) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            console.log(`[send-challenge-notification] Deleted invalid web subscription ${sub.id}`);
          }
        }
      } catch (err) {
        webFailCount++;
        console.error(`[send-challenge-notification] Web push error for user ${sub.user_id}:`, err);
      }
    }

    // ========== APNs Push (native iOS) ==========
    const apnsConfigured = Deno.env.get('APNS_TEAM_ID') && Deno.env.get('APNS_KEY_ID') && Deno.env.get('APNS_PRIVATE_KEY');

    if (apnsConfigured) {
      const { data: deviceTokens, error: tokenError } = await supabase
        .from('apns_device_tokens')
        .select('*')
        .in('user_id', targetUserIds);

      if (tokenError) {
        console.error('[send-challenge-notification] Error fetching APNs tokens:', tokenError);
      }

      console.log(`[send-challenge-notification] Found ${deviceTokens?.length || 0} APNs device tokens`);

      for (const token of deviceTokens || []) {
        try {
          const apnsResponse = await fetch(`${supabaseUrl}/functions/v1/send-apns-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              deviceToken: token.device_token,
              title,
              body,
              url: '/compete',
              type,
              sound: 'default',
            }),
          });

          if (apnsResponse.ok) {
            apnsSuccessCount++;
            console.log(`[send-challenge-notification] APNs sent to user ${token.user_id}`);
          } else {
            apnsFailCount++;
            const errText = await apnsResponse.text();
            console.error(`[send-challenge-notification] APNs failed for user ${token.user_id}:`, errText);
          }
        } catch (err) {
          apnsFailCount++;
          console.error(`[send-challenge-notification] APNs error for user ${token.user_id}:`, err);
        }
      }
    } else {
      console.log('[send-challenge-notification] APNs not configured, skipping native push');
    }

    // ========== Log notifications ==========
    const totalSent = webSuccessCount + apnsSuccessCount;
    for (const userId of targetUserIds) {
      try {
        await supabase.from('notification_logs').insert({
          user_id: userId,
          recipient_user_id: userId,
          notification_type: `challenge_${type}`,
          entry_date: new Date().toISOString().split('T')[0],
          metadata: { title, body, type, webSent: webSuccessCount > 0, apnsSent: apnsSuccessCount > 0 },
        });
      } catch (logErr) {
        // Non-fatal
      }
    }

    console.log(`[send-challenge-notification] Complete: Web ${webSuccessCount}/${webSuccessCount + webFailCount}, APNs ${apnsSuccessCount}/${apnsSuccessCount + apnsFailCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        web: { sent: webSuccessCount, failed: webFailCount },
        apns: { sent: apnsSuccessCount, failed: apnsFailCount },
        totalSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-challenge-notification] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
