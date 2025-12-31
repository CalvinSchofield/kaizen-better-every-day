import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from '../_shared/web-push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Blitz RSVP reminder notifications
// First window: 21 days before blitz (initial ask)
// Second window: 10 days before blitz (confirmation ask)
// Sends to ALL reps including those already committed for double-confirmation

interface Blitz {
  id: string;
  name: string;
  date: string;
  location: string | null;
}

interface Rep {
  user_id: string;
  name: string;
  rsvp_first_window_ack_blitz_ids: string[];
  rsvp_second_window_ack_blitz_ids: string[];
}

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

    console.log(`[${now.toISOString()}] Running blitz RSVP reminder check...`);

    // Get all upcoming blitzes
    const { data: blitzes, error: blitzError } = await supabase
      .from('blitzes')
      .select('id, name, date, location')
      .gte('date', today)
      .order('date', { ascending: true });

    if (blitzError) {
      throw new Error(`Error fetching blitzes: ${blitzError.message}`);
    }

    if (!blitzes || blitzes.length === 0) {
      console.log('No upcoming blitzes found');
      return new Response(JSON.stringify({ message: 'No upcoming blitzes', notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find blitzes in the RSVP windows (matching CTA logic)
    // First window: 21-14 days before (initial ask)
    // Second window: 10-0 days before (confirmation ask)
    const blitzesInWindow: { blitz: Blitz; window: 'first' | 'second' }[] = [];
    
    for (const blitz of blitzes as Blitz[]) {
      const blitzDate = new Date(blitz.date + 'T00:00:00');
      const daysUntil = Math.floor((blitzDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // First window: 21 days before (start of first window)
      if (daysUntil === 21) {
        blitzesInWindow.push({ blitz, window: 'first' });
        console.log(`Blitz "${blitz.name}" is 21 days away - first window reminder (21-14 day window starts)`);
      }
      // Second window: 10 days before (start of second window)
      else if (daysUntil === 10) {
        blitzesInWindow.push({ blitz, window: 'second' });
        console.log(`Blitz "${blitz.name}" is 10 days away - second window reminder (10-0 day window starts)`);
      }
    }

    if (blitzesInWindow.length === 0) {
      console.log('No blitzes in RSVP windows today');
      return new Response(JSON.stringify({ message: 'No blitzes in RSVP windows', notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all reps with their RSVP acknowledgement status
    const { data: reps, error: repsError } = await supabase
      .from('reps')
      .select('user_id, name, rsvp_first_window_ack_blitz_ids, rsvp_second_window_ack_blitz_ids')
      .not('user_id', 'is', null);

    if (repsError) {
      throw new Error(`Error fetching reps: ${repsError.message}`);
    }

    if (!reps || reps.length === 0) {
      console.log('No reps found');
      return new Response(JSON.stringify({ message: 'No reps', notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get push subscriptions
    const userIds = reps.map(r => r.user_id).filter(Boolean);
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', userIds);

    if (subError) {
      throw new Error(`Error fetching subscriptions: ${subError.message}`);
    }

    const subscriptionsByUser = new Map<string, typeof subscriptions>();
    for (const sub of subscriptions || []) {
      if (!subscriptionsByUser.has(sub.user_id)) {
        subscriptionsByUser.set(sub.user_id, []);
      }
      subscriptionsByUser.get(sub.user_id)!.push(sub);
    }

    let notifiedCount = 0;

    for (const { blitz, window } of blitzesInWindow) {
      for (const rep of reps as Rep[]) {
        if (!rep.user_id) continue;

        const userSubs = subscriptionsByUser.get(rep.user_id);
        if (!userSubs || userSubs.length === 0) {
          console.log(`User ${rep.user_id} (${rep.name}): No push subscription`);
          continue;
        }

        // Check if already acknowledged this window for this blitz
        const firstWindowAcks = rep.rsvp_first_window_ack_blitz_ids || [];
        const secondWindowAcks = rep.rsvp_second_window_ack_blitz_ids || [];

        if (window === 'first' && firstWindowAcks.includes(blitz.id)) {
          console.log(`User ${rep.name}: Already ack'd first window for ${blitz.name}`);
          continue;
        }

        if (window === 'second' && secondWindowAcks.includes(blitz.id)) {
          console.log(`User ${rep.name}: Already ack'd second window for ${blitz.name}`);
          continue;
        }

        // Check if we already sent this notification today
        const { data: existingLog } = await supabase
          .from('notification_logs')
          .select('id')
          .eq('user_id', rep.user_id)
          .eq('entry_date', today)
          .eq('notification_type', `blitz_rsvp_${window}`)
          .single();

        if (existingLog) {
          console.log(`User ${rep.name}: Already notified today for ${window} window`);
          continue;
        }

        // Compose notification
        const isFirstWindow = window === 'first';
        const title = isFirstWindow ? '📍 Blitz Coming Up!' : '⏰ Confirm Your Blitz!';
        const body = isFirstWindow
          ? `${blitz.name} is 3 weeks away${blitz.location ? ` in ${blitz.location}` : ''}! Are you in?`
          : `${blitz.name} is in 10 days${blitz.location ? ` (${blitz.location})` : ''}! Confirm your attendance.`;

        // Send to all subscriptions for this user
        let sent = false;
        for (const sub of userSubs) {
          const result = await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            {
              title,
              body,
              url: '/',
              type: `blitz_rsvp_${window}`
            },
            vapidPublicKey,
            vapidPrivateKey
          );

          if (result.success) {
            sent = true;
          } else if (result.status === 410 || result.status === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            console.log(`Cleaned up expired subscription for user ${rep.user_id}`);
          }
        }

        if (sent) {
          await supabase.from('notification_logs').insert({
            user_id: rep.user_id,
            entry_date: today,
            notification_type: `blitz_rsvp_${window}`,
            metadata: { blitz_id: blitz.id, blitz_name: blitz.name }
          });

          notifiedCount++;
          console.log(`Sent ${window} window RSVP reminder to ${rep.name} for ${blitz.name}`);
        }
      }
    }

    console.log(`Blitz RSVP reminder check complete. Notified ${notifiedCount} users.`);

    return new Response(JSON.stringify({
      message: 'Blitz RSVP reminder check complete',
      blitzesInWindow: blitzesInWindow.length,
      notified: notifiedCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in check-blitz-rsvp-reminders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
