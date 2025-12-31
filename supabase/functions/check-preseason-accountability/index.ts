import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from '../_shared/web-push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Weekly preseason accountability reminder
// Sends push notifications to all reps asking them to log their preseason commitment progress

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    console.log(`[${now.toISOString()}] Running weekly preseason accountability check...`);

    // Get all reps with push subscriptions (these are active app users)
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth');

    if (subError) {
      throw new Error(`Error fetching subscriptions: ${subError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found');
      return new Response(JSON.stringify({ message: 'No subscriptions', notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${subscriptions.length} push subscriptions`);

    // Get season_config to check which users have started their summer
    const userIds = subscriptions.map(s => s.user_id);
    
    const { data: seasonConfigs } = await supabase
      .from('season_config')
      .select('user_id, personal_summer_start')
      .in('user_id', userIds);

    const summerStartByUser = new Map<string, string | null>();
    for (const config of seasonConfigs || []) {
      summerStartByUser.set(config.user_id, config.personal_summer_start);
    }

    // Check which users have already been notified this week
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    const { data: existingLogs } = await supabase
      .from('notification_logs')
      .select('user_id')
      .in('user_id', userIds)
      .eq('notification_type', 'preseason_accountability')
      .gte('entry_date', weekStartStr);

    const alreadyNotifiedIds = new Set((existingLogs || []).map(l => l.user_id));

    let notifiedCount = 0;
    let skippedSummerCount = 0;
    const motivationalMessages = [
      "How's your preseason prep going? Log your training, roleplays, and MNL progress!",
      "Champions are made in the preseason! Update your progress to stay on track.",
      "Every rep counts! Take a moment to log your weekly commitment progress.",
      "Building momentum! Check in and track your preseason accountability metrics.",
      "Invest in yourself! Log your training hours and prep activities.",
    ];

    for (const subscription of subscriptions) {
      // Skip if user's summer has started (no longer preseason)
      const summerStart = summerStartByUser.get(subscription.user_id);
      if (summerStart && summerStart <= today) {
        console.log(`User ${subscription.user_id}: Summer has started (${summerStart}), skipping preseason notification`);
        skippedSummerCount++;
        continue;
      }

      if (alreadyNotifiedIds.has(subscription.user_id)) {
        console.log(`User ${subscription.user_id}: Already notified this week, skipping`);
        continue;
      }

      const message = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

      const result = await sendWebPush(
        { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
        {
          title: '📊 Weekly Check-In',
          body: message,
          url: '/goals',
          type: 'preseason_accountability'
        },
        vapidPublicKey,
        vapidPrivateKey
      );

      if (result.success) {
        // Log the notification
        await supabase.from('notification_logs').insert({
          user_id: subscription.user_id,
          entry_date: today,
          notification_type: 'preseason_accountability'
        });

        notifiedCount++;
        console.log(`Sent preseason accountability notification to user ${subscription.user_id}`);
      } else {
        console.error(`Failed to send to user ${subscription.user_id}:`, result.error);
        
        // Clean up expired subscriptions
        if (result.status === 410 || result.status === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
          console.log(`Cleaned up expired subscription for user ${subscription.user_id}`);
        }
      }
    }

    console.log(`Preseason accountability check complete. Notified ${notifiedCount} users, skipped ${skippedSummerCount} (summer started).`);

    return new Response(JSON.stringify({
      message: 'Weekly preseason accountability check complete',
      subscriptions: subscriptions.length,
      notified: notifiedCount,
      skippedSummer: skippedSummerCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in check-preseason-accountability:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
