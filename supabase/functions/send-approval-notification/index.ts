import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web-push.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recruitId } = await req.json();

    if (!recruitId) {
      throw new Error('recruitId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the rep's user_id from the recruit/rep record
    const { data: rep } = await supabase
      .from('reps')
      .select('user_id, name')
      .eq('id', recruitId)
      .maybeSingle();

    if (!rep?.user_id) {
      console.log('[send-approval-notification] No user_id found for recruit', recruitId);
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'No user_id linked yet' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetUserId = rep.user_id;
    const payload = {
      title: '🎉 You\'re in!',
      body: 'Your account has been approved. Welcome to Kaizen!',
      url: '/',
      type: 'approval_granted',
    };

    let successCount = 0;
    let failCount = 0;

    // Web push
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', targetUserId);

    for (const sub of subscriptions || []) {
      try {
        const result = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey
        );
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          if (result.status === 410 || result.status === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      } catch {
        failCount++;
      }
    }

    // APNs
    const apnsConfigured = Deno.env.get('APNS_TEAM_ID') && Deno.env.get('APNS_KEY_ID') && Deno.env.get('APNS_PRIVATE_KEY');
    if (apnsConfigured) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-apns-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            targetUserId,
            title: payload.title,
            body: payload.body,
            url: payload.url,
            type: 'approval_granted',
          }),
        });
        if (resp.ok) successCount++;
        else console.error('[send-approval-notification] APNs error:', await resp.text());
      } catch (e) {
        console.error('[send-approval-notification] APNs call failed:', e);
      }
    }

    // Log notification
    await supabase.from('notification_logs').insert({
      user_id: targetUserId,
      recipient_user_id: targetUserId,
      notification_type: 'approval_granted',
      entry_date: new Date().toISOString().split('T')[0],
      metadata: { recruit_id: recruitId },
    });

    console.log(`[send-approval-notification] Complete: ${successCount} sent, ${failCount} failed for ${rep.name}`);

    return new Response(
      JSON.stringify({ success: true, notified: successCount, failed: failCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[send-approval-notification] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
