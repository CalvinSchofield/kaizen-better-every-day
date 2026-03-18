import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { repUserId, leaderUserId } = await req.json();
    if (!repUserId || !leaderUserId) {
      return new Response(JSON.stringify({ error: "Missing repUserId or leaderUserId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get leader name
    const { data: leaderRep } = await supabase
      .from("reps")
      .select("name")
      .eq("user_id", leaderUserId)
      .maybeSingle();

    const leaderName = leaderRep?.name || "Your leader";

    // Get rep's device tokens for push notification
    const { data: tokens } = await supabase
      .from("apns_device_tokens")
      .select("device_token")
      .eq("user_id", repUserId);

    if (tokens && tokens.length > 0) {
      // Send APNS push notification (best effort)
      const apnsKeyId = Deno.env.get("APNS_KEY_ID");
      const apnsTeamId = Deno.env.get("APNS_TEAM_ID");
      const apnsBundleId = Deno.env.get("APNS_BUNDLE_ID");
      const apnsPrivateKey = Deno.env.get("APNS_PRIVATE_KEY");
      const isProduction = Deno.env.get("APNS_PRODUCTION") === "true";

      if (apnsKeyId && apnsTeamId && apnsBundleId && apnsPrivateKey) {
        // Build JWT for APNS
        const encoder = new TextEncoder();
        const header = { alg: "ES256", kid: apnsKeyId };
        const payload = { iss: apnsTeamId, iat: Math.floor(Date.now() / 1000) };

        const encode64url = (data: Uint8Array) =>
          btoa(String.fromCharCode(...data))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        const headerB64 = encode64url(encoder.encode(JSON.stringify(header)));
        const payloadB64 = encode64url(encoder.encode(JSON.stringify(payload)));
        const signingInput = `${headerB64}.${payloadB64}`;

        // Import the private key
        const pemContents = apnsPrivateKey
          .replace("-----BEGIN PRIVATE KEY-----", "")
          .replace("-----END PRIVATE KEY-----", "")
          .replace(/\s/g, "");
        const keyData = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

        const key = await crypto.subtle.importKey(
          "pkcs8",
          keyData,
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["sign"]
        );

        const signature = await crypto.subtle.sign(
          { name: "ECDSA", hash: "SHA-256" },
          key,
          encoder.encode(signingInput)
        );

        const jwt = `${signingInput}.${encode64url(new Uint8Array(signature))}`;

        const apnsHost = isProduction
          ? "https://api.push.apple.com"
          : "https://api.sandbox.push.apple.com";

        const apnsPayload = {
          aps: {
            alert: {
              title: "Goal Review Suggested",
              body: `${leaderName} suggested reviewing your goals. Tap to update your plan.`,
            },
            sound: "default",
            "thread-id": "goal-review",
          },
          deepLink: "/goals",
        };

        for (const token of tokens) {
          try {
            await fetch(`${apnsHost}/3/device/${token.device_token}`, {
              method: "POST",
              headers: {
                authorization: `bearer ${jwt}`,
                "apns-topic": apnsBundleId,
                "apns-push-type": "alert",
                "apns-priority": "10",
              },
              body: JSON.stringify(apnsPayload),
            });
          } catch {
            // best effort
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
