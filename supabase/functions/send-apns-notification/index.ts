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
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const keyId = Deno.env.get('APNS_KEY_ID');
  const privateKey = Deno.env.get('APNS_PRIVATE_KEY');

  if (!teamId || !keyId || !privateKey) {
    throw new Error('APNs credentials not configured. Need APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY');
  }

  console.log(`[APNs JWT] teamId=${teamId}, keyId=${keyId}, privateKey length=${privateKey.length}`);

  const header = { alg: 'ES256', kid: keyId };
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: teamId, iat: now };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const encodedClaims = btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsignedToken = `${encodedHeader}.${encodedClaims}`;

  // Clean PEM: handle both literal \n and real newlines
  let pemContents = privateKey
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  console.log(`[APNs JWT] PEM base64 length after cleaning: ${pemContents.length}`);

  let binaryKey: Uint8Array;
  try {
    binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    console.log(`[APNs JWT] Binary key length: ${binaryKey.length} bytes`);
  } catch (e) {
    console.error('[APNs JWT] Failed to decode base64 PEM:', e);
    throw new Error('Failed to decode APNS_PRIVATE_KEY base64');
  }

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey.buffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
    console.log('[APNs JWT] Key imported successfully');
  } catch (e) {
    console.error('[APNs JWT] importKey failed:', e);
    throw new Error(`Failed to import APNS private key: ${e instanceof Error ? e.message : e}`);
  }

  let signature: ArrayBuffer;
  try {
    signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      new TextEncoder().encode(unsignedToken)
    );
    console.log(`[APNs JWT] Signature created, ${signature.byteLength} bytes`);
  } catch (e) {
    console.error('[APNs JWT] sign failed:', e);
    throw new Error(`Failed to sign JWT: ${e instanceof Error ? e.message : e}`);
  }

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
  const productionRaw = (Deno.env.get('APNS_PRODUCTION') ?? '').trim().toLowerCase();
  const isProduction = productionRaw === 'true' || productionRaw === '1' || productionRaw === 'yes';
  const apnsHost = isProduction ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';

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
    console.log('[APNs] Getting auth token...');
    const authToken = await getAPNsAuthToken();
    console.log('[APNs] Auth token obtained, building payload...');

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
        
        // Remove truly invalid tokens
        // NOTE: "BadDeviceToken" can also happen when APNS_PRODUCTION is wrong (sandbox vs prod),
        // so we DO NOT delete tokens on BadDeviceToken.
        if (result.error.includes('Unregistered') || result.error.startsWith('410:')) {
          await supabase
            .from('apns_device_tokens')
            .delete()
            .eq('device_token', device_token);
          console.log('Removed unregistered token:', device_token.substring(0, 20) + '...');
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
