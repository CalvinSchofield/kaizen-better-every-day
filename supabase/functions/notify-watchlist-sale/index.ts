import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush, PushSubscription, PushPayload } from "../_shared/web-push.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WatchlistSaleRequest {
  sellerUserId: string;
  prmr: number;
  fpPlus: number;
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
    const { sellerUserId, prmr, fpPlus }: WatchlistSaleRequest = await req.json();

    console.log(`[notify-watchlist-sale] Seller: ${sellerUserId}, PRMR: $${prmr}, FP+: ${fpPlus}`);

    // Get seller's name
    const { data: sellerRep } = await supabase
      .from('reps')
      .select('name')
      .eq('user_id', sellerUserId)
      .single();

    const sellerFirstName = sellerRep?.name?.split(' ')[0] || 'Someone';

    // Find all users watching this seller
    const { data: watchers, error: watchError } = await supabase
      .from('watchlist')
      .select('user_id')
      .eq('watched_user_id', sellerUserId);

    if (watchError) {
      console.error('[notify-watchlist-sale] Error fetching watchers:', watchError);
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No watchers found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!watchers?.length) {
      console.log('[notify-watchlist-sale] No one watching this user');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No watchers' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const watcherUserIds = watchers.map(w => w.user_id);
    console.log(`[notify-watchlist-sale] Found ${watcherUserIds.length} watchers`);

    // Get today's entry for the seller to show their running total
    const today = new Date().toISOString().split('T')[0];
    const { data: sellerEntry } = await supabase
      .from('daily_entries')
      .select('fp_plus, prmr')
      .eq('user_id', sellerUserId)
      .eq('entry_date', today)
      .maybeSingle();

    const sellerTodayFp = sellerEntry?.fp_plus || fpPlus;

    // Get each watcher's today entry to show relative standing
    const { data: watcherEntries } = await supabase
      .from('daily_entries')
      .select('user_id, fp_plus')
      .in('user_id', watcherUserIds)
      .eq('entry_date', today);

    const watcherFpMap = new Map(
      (watcherEntries || []).map(e => [e.user_id, e.fp_plus || 0])
    );

    let webSuccessCount = 0;
    let apnsSuccessCount = 0;

    for (const watcherUserId of watcherUserIds) {
      const watcherFp = watcherFpMap.get(watcherUserId) || 0;
      const diff = sellerTodayFp - watcherFp;

      let body: string;
      if (diff > 0) {
        body = `$${Math.round(prmr)} PRMR — now at ${Number(sellerTodayFp).toFixed(1)} FP+ today (you: ${Number(watcherFp).toFixed(1)} FP+)`;
      } else {
        body = `$${Math.round(prmr)} PRMR — at ${Number(sellerTodayFp).toFixed(1)} FP+ today. You're still ahead with ${Number(watcherFp).toFixed(1)} FP+!`;
      }

      const title = `👀 ${sellerFirstName} just sold!`;

      // Web Push
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', watcherUserId);

      for (const sub of subs || []) {
        try {
          const pushSub: PushSubscription = {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          };
          const payload: PushPayload = {
            title,
            body,
            url: `/profile/${sellerUserId}`,
            type: 'watchlist_sale',
          };
          const result = await sendWebPush(pushSub, payload, vapidPublicKey, vapidPrivateKey);
          if (result.success) webSuccessCount++;
          else if (result.error?.includes('410') || result.error?.includes('404')) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        } catch (err) {
          console.error(`[notify-watchlist-sale] Web push error for ${watcherUserId}:`, err);
        }
      }

      // APNs Push
      const apnsConfigured = Deno.env.get('APNS_TEAM_ID') && Deno.env.get('APNS_KEY_ID') && Deno.env.get('APNS_PRIVATE_KEY');
      if (apnsConfigured) {
        const { data: tokens } = await supabase
          .from('apns_device_tokens')
          .select('device_token')
          .eq('user_id', watcherUserId);

        for (const token of tokens || []) {
          try {
            const resp = await fetch(`${supabaseUrl}/functions/v1/send-apns-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                deviceToken: token.device_token,
                title,
                body,
                url: `/profile/${sellerUserId}`,
                type: 'watchlist_sale',
                sound: 'default',
              }),
            });
            if (resp.ok) apnsSuccessCount++;
          } catch (err) {
            console.error(`[notify-watchlist-sale] APNs error for ${watcherUserId}:`, err);
          }
        }
      }

      // Log notification
      try {
        await supabase.from('notification_logs').insert({
          user_id: sellerUserId,
          recipient_user_id: watcherUserId,
          notification_type: 'watchlist_sale',
          entry_date: today,
          metadata: { title, body, sellerUserId, prmr, fpPlus },
        });
      } catch (_) { /* non-fatal */ }
    }

    console.log(`[notify-watchlist-sale] Sent: web=${webSuccessCount}, apns=${apnsSuccessCount}`);

    return new Response(
      JSON.stringify({ success: true, web: webSuccessCount, apns: apnsSuccessCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[notify-watchlist-sale] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
