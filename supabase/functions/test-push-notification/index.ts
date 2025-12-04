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

// Base64url encode from Uint8Array
function base64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Base64url decode to Uint8Array  
function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const decoded = atob(base64 + padding);
  return Uint8Array.from(decoded, c => c.charCodeAt(0));
}

// Generate public key from private key
async function getPublicKeyFromPrivate(privateKeyB64url: string): Promise<{ x: string; y: string }> {
  // For P-256, we need to derive the public key from private key
  // This requires importing as a full key pair, but we'll use the provided public key instead
  // Return placeholder - we'll use the VAPID public key directly
  return { x: '', y: '' };
}

// Generate VAPID JWT token using Web Crypto API with JWK format
async function generateVapidJwt(
  audience: string, 
  subject: string, 
  privateKeyBase64url: string,
  publicKeyBase64url: string
): Promise<string> {
  // JWT header
  const header = { typ: 'JWT', alg: 'ES256' };
  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  
  // JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  
  // Unsigned token
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Decode keys
  const privateKeyRaw = base64urlDecode(privateKeyBase64url);
  const publicKeyRaw = base64urlDecode(publicKeyBase64url);
  
  // For P-256 uncompressed public key: 0x04 || x (32 bytes) || y (32 bytes)
  // Total: 65 bytes
  const x = publicKeyRaw.slice(1, 33);
  const y = publicKeyRaw.slice(33, 65);
  
  // Create JWK for the private key
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: base64urlEncode(x),
    y: base64urlEncode(y),
    d: privateKeyBase64url,
  };
  
  console.log('Importing key with JWK...');
  
  // Import private key using JWK
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  console.log('Key imported, signing...');
  
  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );
  
  const signatureB64 = base64urlEncode(new Uint8Array(signature));
  
  return `${unsignedToken}.${signatureB64}`;
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
    const payload = JSON.stringify({ title, body, url, type: 'test' });
    const endpointUrl = new URL(subscription.endpoint);
    const audience = endpointUrl.origin;
    
    console.log('Generating VAPID JWT...');
    const jwt = await generateVapidJwt(
      audience,
      'mailto:support@kaizen-app.com',
      vapidPrivateKey,
      vapidPublicKey
    );
    console.log('JWT generated successfully');
    
    console.log(`Sending to endpoint: ${subscription.endpoint}`);
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
      },
      body: new TextEncoder().encode(payload),
    });

    console.log(`Push response: ${response.status} ${response.statusText}`);
    
    if (response.status === 201 || response.status === 200) {
      console.log('Push notification sent successfully');
      return true;
    } else {
      const errorText = await response.text();
      console.error(`Push failed: ${response.status} - ${errorText}`);
      return false;
    }
    
  } catch (error) {
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
    
    if (targetEmail !== 'calvinjschofield@gmail.com') {
      return new Response(
        JSON.stringify({ error: 'Test only allowed for calvinjschofield@gmail.com' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Testing push for ${targetEmail}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: rep } = await supabase
      .from('reps')
      .select('user_id')
      .eq('email', targetEmail)
      .single();

    if (!rep) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', rep.user_id);

    if (!subscriptions?.length) {
      return new Response(
        JSON.stringify({ error: 'No push subscription. Enable notifications first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} subscription(s)`);

    let sent = 0;
    for (const sub of subscriptions) {
      if (await sendPushNotification(sub, '🧪 Test', 'Push notifications working!', '/track')) {
        sent++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: `Sent ${sent}/${subscriptions.length}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
