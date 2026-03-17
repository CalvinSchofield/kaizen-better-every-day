import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendWebPush, PushSubscription } from '../_shared/web-push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Realistic test payloads for each notification type
function getTestPayload(type: string): Record<string, unknown> {
  const testRecruitId = '00000000-0000-0000-0000-000000000001';
  const testActivityId = '00000000-0000-0000-0000-000000000002';

  switch (type) {
    case 'comment':
      return {
        title: '💬 New Comment',
        body: 'Jake Miller commented: "Great progress on this recruit!"',
        url: `/my-group?recruitId=${testRecruitId}&activityId=${testActivityId}&openComments=true`,
        type: 'comment',
        recruitId: testRecruitId,
        activityId: testActivityId,
      };
    case 'mention':
      return {
        title: '🔔 You were mentioned',
        body: 'Jake Miller mentioned you: "@Calvin can you follow up on this?"',
        url: `/my-group?recruitId=${testRecruitId}&activityId=${testActivityId}&openComments=true`,
        type: 'mention',
        recruitId: testRecruitId,
        activityId: testActivityId,
      };
    case 'task_assignment':
      return {
        title: '📋 New Task Assigned',
        body: 'Follow up call with David Johnson — assigned by Jake Miller',
        url: `/my-group?recruitId=${testRecruitId}`,
        type: 'task_assignment',
        recruitId: testRecruitId,
        activityId: testActivityId,
      };
    case 'task_single_reminder':
      return {
        title: '⏰ Task Reminder',
        body: 'Call David Johnson — follow up on shadow day',
        url: `/my-group?recruitId=${testRecruitId}`,
        type: 'task_single_reminder',
        recruitId: testRecruitId,
        recruitPhone: '8015551234',
      };
    case 'inactivity_save':
      return {
        title: '🌙 Save Your Day?',
        body: "It's getting late — save your numbers before the day resets!",
        url: '/track?prompt=save',
        type: 'inactivity_save',
      };
    case 'blitz_rsvp_first':
      return {
        title: '🔥 Blitz Trip: Salt Lake City',
        body: 'Jan 15–19 — Are you in? RSVP now!',
        url: '/',
        type: 'blitz_rsvp_first',
      };
    case 'reaction':
      return {
        title: '🔥 New Reaction',
        body: 'Jake Miller reacted 🔥 to your activity',
        url: `/my-group?recruitId=${testRecruitId}&activityId=${testActivityId}`,
        type: 'reaction',
        recruitId: testRecruitId,
        activityId: testActivityId,
      };
    case 'install_reminder_eve':
      return {
        title: '📅 Install Tomorrow',
        body: 'Smith family install is scheduled for tomorrow at 10am',
        url: '/customers',
        type: 'install_reminder_eve',
        recruitPhone: '8015559876',
      };
    case 'access_request':
      return {
        title: '👋 New Rep Joined',
        body: 'David Johnson just signed up and needs team access',
        url: '/',
        type: 'access_request',
      };
    default:
      return {
        title: '🧪 Test Notification',
        body: 'This is a rich test notification with action buttons!',
        url: '/track',
        type: 'test_rich',
      };
  }
}

// Build APNs payload from test data
function buildApnsPayload(data: Record<string, unknown>) {
  return {
    aps: {
      alert: {
        title: data.title as string,
        body: data.body as string,
      },
      sound: 'default',
      'mutable-content': 1,
      category: (data.type as string) || 'default',
    },
    url: data.url || '/',
    type: data.type || 'default',
    recruitId: data.recruitId || null,
    activityId: data.activityId || null,
    recruitPhone: data.recruitPhone || null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetEmail, type } = await req.json();

    if (targetEmail !== 'calvinjschofield@gmail.com') {
      return new Response(
        JSON.stringify({ error: 'Test only allowed for calvinjschofield@gmail.com' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const testPayload = getTestPayload(type || 'test_rich');
    console.log(`Testing "${type || 'test_rich'}" push for ${targetEmail}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: rep } = await supabase
      .from('reps')
      .select('user_id')
      .eq('email', targetEmail)
      .single();

    if (!rep?.user_id) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch both web push and APNs tokens in parallel
    const [webSubsResult, apnsTokensResult] = await Promise.all([
      supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', rep.user_id),
      supabase
        .from('apns_device_tokens')
        .select('device_token')
        .eq('user_id', rep.user_id),
    ]);

    const webSubs = webSubsResult.data || [];
    const apnsTokens = apnsTokensResult.data || [];

    if (!webSubs.length && !apnsTokens.length) {
      return new Response(
        JSON.stringify({ error: 'No push subscriptions found. Enable notifications first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${webSubs.length} web sub(s), ${apnsTokens.length} APNs token(s)`);

    let webSent = 0;
    let apnsSent = 0;
    const errors: string[] = [];

    // === Web Push ===
    if (webSubs.length) {
      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

      if (vapidPublicKey && vapidPrivateKey) {
        for (const sub of webSubs) {
          const result = await sendWebPush(
            sub as PushSubscription,
            testPayload as any,
            vapidPublicKey,
            vapidPrivateKey
          );
          if (result.success) webSent++;
          else if (result.error) errors.push(`web: ${result.error}`);
        }
      } else {
        errors.push('VAPID keys not configured');
      }
    }

    // === APNs === (delegate to send-apns-notification for full logging)
    if (apnsTokens.length) {
      console.log(`[APNs] Delegating to send-apns-notification for user ${rep.user_id}`);
      try {
        const { data: apnsResult, error: apnsError } = await supabase.functions.invoke('send-apns-notification', {
          body: {
            targetUserId: rep.user_id,
            title: testPayload.title,
            body: testPayload.body,
            url: testPayload.url,
            type: testPayload.type,
          },
        });

        console.log('[APNs] Response:', JSON.stringify(apnsResult));
        if (apnsError) {
          console.error('[APNs] Invoke error:', apnsError);
          errors.push(`apns invoke: ${apnsError.message || apnsError}`);
        } else if (apnsResult?.success) {
          apnsSent = apnsTokens.length; // send-apns-notification handles all tokens
        } else {
          errors.push(`apns: ${apnsResult?.error || apnsResult?.message || 'unknown'}`);
          if (apnsResult?.errors) {
            errors.push(...apnsResult.errors);
          }
        }
      } catch (e) {
        console.error('[APNs] Exception:', e);
        errors.push(`apns: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    const totalSent = webSent + apnsSent;
    return new Response(
      JSON.stringify({
        success: totalSent > 0,
        type: type || 'test_rich',
        message: `Web: ${webSent}/${webSubs.length}, APNs: ${apnsSent}/${apnsTokens.length}`,
        errors: errors.length ? errors : undefined,
      }),
      {
        status: totalSent > 0 ? 200 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
