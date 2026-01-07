import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush, PushSubscription, PushPayload } from "../_shared/web-push.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: 'challenge_invite' | 'challenge_accepted' | 'challenge_declined' | 'challenge_completed' | 'incentive_created' | 'incentive_completed';
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

    // Fetch push subscriptions for target users
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', targetUserIds);

    if (subError) {
      console.error('[send-challenge-notification] Error fetching subscriptions:', subError);
      throw subError;
    }

    console.log(`[send-challenge-notification] Found ${subscriptions?.length || 0} subscriptions`);

    let successCount = 0;
    let failCount = 0;

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
          url: '/leaderboard',
          type,
        };

        const result = await sendWebPush(
          pushSubscription, 
          notificationPayload, 
          vapidPublicKey, 
          vapidPrivateKey
        );

        if (result.success) {
          successCount++;
          console.log(`[send-challenge-notification] Sent to user ${sub.user_id}`);

          // Log the notification
          await supabase.from('notification_logs').insert({
            user_id: sub.user_id,
            recipient_user_id: sub.user_id,
            notification_type: `challenge_${type}`,
            entry_date: new Date().toISOString().split('T')[0],
            metadata: { title, body, type },
          });
        } else {
          failCount++;
          console.error(`[send-challenge-notification] Failed for user ${sub.user_id}:`, result.error);
          
          // Delete invalid subscription
          if (result.error?.includes('410') || result.error?.includes('404')) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            console.log(`[send-challenge-notification] Deleted invalid subscription ${sub.id}`);
          }
        }
      } catch (err) {
        failCount++;
        console.error(`[send-challenge-notification] Error for user ${sub.user_id}:`, err);
      }
    }

    console.log(`[send-challenge-notification] Complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({ success: true, sent: successCount, failed: failCount }),
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
