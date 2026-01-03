import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface APNsPayload {
  aps: {
    alert: {
      title: string;
      body: string;
    };
    sound?: string;
    badge?: number;
    'mutable-content'?: number;
    'content-available'?: number;
    category?: string;
  };
  // Custom data
  url?: string;
  type?: string;
  [key: string]: unknown;
}

async function getAPNsAuthToken(): Promise<string> {
  // For APNs, you need either:
  // 1. A p8 key file (recommended for server-to-server)
  // 2. A p12 certificate
  
  // This uses the JWT-based authentication with p8 key
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const keyId = Deno.env.get('APNS_KEY_ID');
  const privateKey = Deno.env.get('APNS_PRIVATE_KEY');

  if (!teamId || !keyId || !privateKey) {
    throw new Error('APNs credentials not configured. Need APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY');
  }

  // Create JWT for APNs
  const header = {
    alg: 'ES256',
    kid: keyId
  };

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: teamId,
    iat: now
  };

  // Encode header and claims
  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const encodedClaims = btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  const unsignedToken = `${encodedHeader}.${encodedClaims}`;

  // Import the private key and sign
  const pemContents = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert signature to base64url
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${unsignedToken}.${signatureB64}`;
}

async function sendAPNs(
  deviceToken: string,
  payload: APNsPayload,
  authToken: string,
  bundleId: string
): Promise<{ success: boolean; error?: string }> {
  // Use production APNs server (use api.sandbox.push.apple.com for development)
  const isProduction = Deno.env.get('APNS_PRODUCTION') === 'true';
  const apnsHost = isProduction 
    ? 'api.push.apple.com' 
    : 'api.sandbox.push.apple.com';

  const url = `https://${apnsHost}/3/device/${deviceToken}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'authorization': `bearer ${authToken}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': '0',
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 200) {
      return { success: true };
    } else {
      const errorBody = await response.text();
      console.error(`APNs error ${response.status}:`, errorBody);
      return { success: false, error: `${response.status}: ${errorBody}` };
    }
  } catch (error) {
    console.error('APNs fetch error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetUserId, targetEmail, title, body, url, type } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const bundleId = Deno.env.get('APNS_BUNDLE_ID') || 'app.lovable.00427502ff944cc991616496e2600071';
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find user by ID or email
    let userId = targetUserId;
    if (!userId && targetEmail) {
      const { data: rep } = await supabase
        .from('reps')
        .select('user_id')
        .eq('email', targetEmail)
        .single();
      
      if (rep?.user_id) {
        userId = rep.user_id;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get device tokens for this user
    const { data: tokens, error: tokensError } = await supabase
      .from('apns_device_tokens')
      .select('device_token')
      .eq('user_id', userId);

    if (tokensError || !tokens?.length) {
      console.log('No APNs tokens found for user:', userId);
      return new Response(
        JSON.stringify({ error: 'No device tokens found. User needs to enable notifications in the app.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${tokens.length} APNs token(s) for user ${userId}`);

    // Check if APNs is configured
    const apnsConfigured = Deno.env.get('APNS_TEAM_ID') && 
                          Deno.env.get('APNS_KEY_ID') && 
                          Deno.env.get('APNS_PRIVATE_KEY');

    if (!apnsConfigured) {
      return new Response(
        JSON.stringify({ 
          error: 'APNs not configured. Need APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY secrets.',
          tokens_found: tokens.length
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token
    const authToken = await getAPNsAuthToken();

    // Build payload
    const payload: APNsPayload = {
      aps: {
        alert: {
          title: title || 'Kaizen',
          body: body || 'You have a new notification'
        },
        sound: 'default',
        'mutable-content': 1,
        category: type || 'default'
      },
      url: url || '/',
      type: type || 'default'
    };

    // Send to all device tokens
    let sent = 0;
    const errors: string[] = [];

    for (const { device_token } of tokens) {
      const result = await sendAPNs(device_token, payload, authToken, bundleId);
      if (result.success) {
        sent++;
      } else if (result.error) {
        errors.push(result.error);
        
        // Remove invalid tokens
        if (result.error.includes('BadDeviceToken') || result.error.includes('Unregistered')) {
          await supabase
            .from('apns_device_tokens')
            .delete()
            .eq('device_token', device_token);
          console.log('Removed invalid token:', device_token.substring(0, 20) + '...');
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: sent > 0, 
        message: `Sent ${sent}/${tokens.length} notifications`,
        errors: errors.length > 0 ? errors : undefined
      }),
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
