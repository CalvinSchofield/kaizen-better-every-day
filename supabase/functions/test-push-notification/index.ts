import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendPushNotification(
  subscription: PushSubscription,
  title: string,
  body: string,
  url: string
): Promise<boolean> {
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  
  if (!vapidPrivateKey || !vapidPublicKey) {
    console.error('VAPID keys not configured');
    return false;
  }

  try {
    // Import web-push compatible library for Deno
    const { default: webpush } = await import('https://esm.sh/web-push@3.6.7');
    
    webpush.setVapidDetails(
      'mailto:support@kaizen-app.com',
      vapidPublicKey,
      vapidPrivateKey
    );
    
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    };
    
    const payload = JSON.stringify({
      title,
      body,
      url,
      type: 'test'
    });
    
    await webpush.sendNotification(pushSubscription, payload);
    console.log('Test push notification sent successfully');
    return true;
    
  } catch (error: unknown) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetEmail } = await req.json();
    
    // Only allow testing with specific email for safety
    const allowedEmail = 'calvinjschofield@gmail.com';
    if (targetEmail !== allowedEmail) {
      return new Response(
        JSON.stringify({ error: 'Test notifications only allowed for calvinjschofield@gmail.com' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Testing push notification for ${targetEmail}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find user by email in reps table
    const { data: rep, error: repError } = await supabase
      .from('reps')
      .select('user_id')
      .eq('email', targetEmail)
      .single();

    if (repError || !rep) {
      console.log('Rep not found with email:', targetEmail);
      return new Response(
        JSON.stringify({ error: 'User not found with that email in reps table' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found user_id: ${rep.user_id}`);

    // Get push subscription for this user
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', rep.user_id);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Error fetching push subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No push subscription found. Make sure you enabled notifications in the app on your phone first.',
          user_id: rep.user_id
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} subscription(s)`);

    // Send test notification to all subscriptions
    let sent = 0;
    for (const sub of subscriptions) {
      const success = await sendPushNotification(
        sub,
        '🧪 Test Notification',
        'Push notifications are working! You\'ll get reminders to save your work.',
        '/track'
      );
      if (success) sent++;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${sent} notification(s) to ${targetEmail}`,
        subscriptionsFound: subscriptions.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in test-push-notification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
