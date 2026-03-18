import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface APNsPayload {
  aps: {
    alert: { title: string; body: string; };
    sound: string;
    badge?: number;
  };
}

async function getAPNsAuthToken(): Promise<string> {
  const teamId = Deno.env.get('APNS_TEAM_ID')!;
  const keyId = Deno.env.get('APNS_KEY_ID')!;
  const privateKey = Deno.env.get('APNS_PRIVATE_KEY')!;

  const header = { alg: 'ES256', kid: keyId };
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: teamId, iat: now };

  const encode = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${encode(header)}.${encode(claims)}`;

  const pemContents = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8', binaryKey.buffer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsignedToken)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${unsignedToken}.${sig}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const bundleId = Deno.env.get('APNS_BUNDLE_ID') || 'app.lovable.00427502ff944cc991616496e2600071';

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get ALL device tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('apns_device_tokens')
      .select('device_token, user_id');

    if (tokensError) throw tokensError;

    if (!tokens?.length) {
      return new Response(
        JSON.stringify({ message: 'No device tokens registered', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Broadcasting to ${tokens.length} device(s)`);

    const authToken = await getAPNsAuthToken();

    const productionRaw = (Deno.env.get('APNS_PRODUCTION') ?? '').trim().toLowerCase();
    const isProduction = productionRaw === 'true' || productionRaw === '1';
    const apnsHost = isProduction ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';

    const payload: APNsPayload = {
      aps: {
        alert: {
          title: '⚠️ Track Page Bug Fix',
          body: 'We found and fixed a syncing bug on the Track page. Your data today may have been affected. Please close the app completely and reopen it to force a refresh. Sorry for the inconvenience!',
        },
        sound: 'default',
      },
    };

    const results: { user_id: string; success: boolean; error?: string }[] = [];

    for (const token of tokens) {
      try {
        const url = `https://${apnsHost}/3/device/${token.device_token}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'authorization': `bearer ${authToken}`,
            'apns-topic': bundleId,
            'apns-push-type': 'alert',
            'apns-priority': '10',
            'apns-expiration': '0',
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          results.push({ user_id: token.user_id, success: true });
        } else {
          const errorBody = await response.text();
          results.push({ user_id: token.user_id, success: false, error: `${response.status}: ${errorBody}` });
        }
      } catch (e) {
        results.push({ user_id: token.user_id, success: false, error: e instanceof Error ? e.message : 'Unknown' });
      }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success);

    console.log(`Broadcast complete: ${sent} sent, ${failed.length} failed`);
    if (failed.length) console.log('Failures:', JSON.stringify(failed));

    return new Response(
      JSON.stringify({ sent, failed: failed.length, total: tokens.length, details: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Broadcast error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
