import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web-push.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Ramp phase messages
const PHASE_MESSAGES: Record<string, { title: string; body: string }> = {
  phase_1: {
    title: "Get Started! 🚀",
    body: "Complete your goal setup to unlock Phase 2 of your Ramp to Blitz journey"
  },
  phase_2: {
    title: "Keep the Momentum! 💪",
    body: "Finish your practice pitches to move forward in Ramp to Blitz"
  },
  phase_3: {
    title: "Almost There! 🎯",
    body: "One more phase to go — you're so close to being blitz ready!"
  },
  phase_4: {
    title: "Final Stretch! 🏁",
    body: "Complete Phase 4 to unlock blitzes and join the team in the field"
  }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[check-ramp-progress] Starting daily ramp progress check');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Find rookies who are not blitz ready
    // Join with reps table to get user_id for notifications
    const { data: recruits, error: recruitsError } = await supabase
      .from('recruits')
      .select(`
        id,
        name,
        email,
        year,
        blitz_ready,
        ramp_phase_1_complete,
        ramp_phase_2_complete,
        ramp_phase_3_complete,
        ramp_phase_4_complete,
        updated_at
      `)
      .eq('year', 'Rookie')
      .eq('blitz_ready', false)
      .lt('updated_at', threeDaysAgo);

    if (recruitsError) {
      console.error('[check-ramp-progress] Error fetching recruits:', recruitsError);
      throw recruitsError;
    }

    console.log(`[check-ramp-progress] Found ${recruits?.length || 0} inactive rookies`);

    let notificationsSent = 0;
    let skippedDueToRecent = 0;

    for (const recruit of recruits || []) {
      // Find their user_id from reps table
      const { data: rep } = await supabase
        .from('reps')
        .select('user_id')
        .ilike('email', recruit.email || '')
        .maybeSingle();

      if (!rep?.user_id) {
        console.log(`[check-ramp-progress] No user_id found for ${recruit.name}, skipping`);
        continue;
      }

      const userId = rep.user_id;

      // Check if we've already sent a ramp nudge this week
      const { data: recentNudge } = await supabase
        .from('notification_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('notification_type', 'ramp_nudge')
        .gte('entry_date', oneWeekAgo)
        .limit(1);

      if (recentNudge && recentNudge.length > 0) {
        console.log(`[check-ramp-progress] Already nudged ${recruit.name} this week, skipping`);
        skippedDueToRecent++;
        continue;
      }

      // Determine which phase they're stuck on
      let stuckPhase = '';
      if (!recruit.ramp_phase_1_complete) {
        stuckPhase = 'phase_1';
      } else if (!recruit.ramp_phase_2_complete) {
        stuckPhase = 'phase_2';
      } else if (!recruit.ramp_phase_3_complete) {
        stuckPhase = 'phase_3';
      } else if (!recruit.ramp_phase_4_complete) {
        stuckPhase = 'phase_4';
      }

      if (!stuckPhase) {
        console.log(`[check-ramp-progress] ${recruit.name} has all phases complete but not blitz_ready, skipping`);
        continue;
      }

      console.log(`[check-ramp-progress] ${recruit.name} is stuck on ${stuckPhase}`);

      // Get their push subscription
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`[check-ramp-progress] No push subscription for ${recruit.name}`);
        continue;
      }

      const message = PHASE_MESSAGES[stuckPhase];
      const payload = {
        title: message.title,
        body: message.body,
        url: '/ramp-to-blitz',
        tag: `ramp-nudge-${userId}-${today}`,
      };

      // Send to all their subscriptions
      for (const sub of subscriptions) {
        try {
          const result = await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payload,
            vapidPublicKey,
            vapidPrivateKey
          );

          if (result.success) {
            notificationsSent++;
            console.log(`[check-ramp-progress] Sent nudge to ${recruit.name}`);

            // Log the notification
            await supabase.from('notification_logs').insert({
              user_id: userId,
              recipient_user_id: userId,
              notification_type: 'ramp_nudge',
              entry_date: today,
              metadata: {
                stuck_phase: stuckPhase,
                recruit_name: recruit.name,
                days_inactive: Math.floor((Date.now() - new Date(recruit.updated_at).getTime()) / (24 * 60 * 60 * 1000))
              }
            });

            // Only log once per user even if multiple subscriptions
            break;
          }
        } catch (err) {
          console.error(`[check-ramp-progress] Error sending to ${recruit.name}:`, err);
        }
      }
    }

    console.log(`[check-ramp-progress] Complete: ${notificationsSent} sent, ${skippedDueToRecent} skipped (recent nudge)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: notificationsSent,
        skipped: skippedDueToRecent,
        totalInactive: recruits?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-ramp-progress] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
