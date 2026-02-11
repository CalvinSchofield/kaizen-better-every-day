import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { activityId, reactorUserId, reactorName, reactionType } = await req.json();

    if (!activityId || !reactorUserId) {
      return new Response(
        JSON.stringify({ error: "Missing activityId or reactorUserId" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the activity to find who logged it
    const { data: activity } = await supabase
      .from("recruit_activities")
      .select("logged_by_user_id, recruit_id")
      .eq("id", activityId)
      .single();

    if (!activity) {
      return new Response(
        JSON.stringify({ error: "Activity not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetUserId = activity.logged_by_user_id;

    // Don't notify yourself
    if (targetUserId === reactorUserId) {
      return new Response(
        JSON.stringify({ message: "Skipping self-reaction" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get recruit name for context
    let recruitName = "";
    if (activity.recruit_id) {
      const { data: recruit } = await supabase
        .from("recruits")
        .select("name")
        .eq("id", activity.recruit_id)
        .single();
      recruitName = recruit?.name || "";
    }

    // Get push subscriptions
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", targetUserId);

    // Get APNs tokens
    const { data: apnsTokens } = await supabase
      .from("apns_device_tokens")
      .select("device_token")
      .eq("user_id", targetUserId);

    if ((!subscriptions || subscriptions.length === 0) && (!apnsTokens || apnsTokens.length === 0)) {
      return new Response(
        JSON.stringify({ message: "No push subscription for target user" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emojiMap: Record<string, string> = { like: "👍", helpful: "💡", thumbsup: "👏" };
    const emoji = emojiMap[reactionType] || "👍";

    const title = `${emoji} ${reactorName} reacted to your activity`;
    const body = recruitName
      ? `Liked your activity on ${recruitName}`
      : "Liked your recruiting activity";

    const deepLinkUrl = activity.recruit_id
      ? `/my-group?recruitId=${activity.recruit_id}&activityId=${activityId}`
      : "/my-group";

    let successCount = 0;
    const today = new Date().toISOString().split("T")[0];

    // Send web push
    for (const sub of subscriptions || []) {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        { title, body, url: deepLinkUrl, type: "reaction" },
        vapidPublicKey,
        vapidPrivateKey
      );

      if (result.success) {
        successCount++;
      } else if (result.status === 410 || result.status === 404) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }

    // Send APNs
    if (apnsTokens && apnsTokens.length > 0) {
      const bundleId = Deno.env.get("APNS_BUNDLE_ID") || "app.lovable.00427502ff944cc991616496e2600071";
      const apnsConfigured = Deno.env.get("APNS_TEAM_ID") && Deno.env.get("APNS_KEY_ID") && Deno.env.get("APNS_PRIVATE_KEY");

      if (apnsConfigured) {
        try {
          // Call the send-apns-notification function
          const apnsResponse = await fetch(`${supabaseUrl}/functions/v1/send-apns-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              targetUserId,
              title,
              body,
              url: deepLinkUrl,
              type: "reaction",
            }),
          });
          if (apnsResponse.ok) successCount++;
          else await apnsResponse.text(); // consume body
        } catch (e) {
          console.error("APNs call failed:", e);
        }
      }
    }

    // Log notification
    if (successCount > 0) {
      await supabase.from("notification_logs").insert({
        user_id: reactorUserId,
        recipient_user_id: targetUserId,
        notification_type: "reaction",
        entry_date: today,
        metadata: {
          reactor_name: reactorName,
          activity_id: activityId,
          recruit_id: activity.recruit_id,
          reaction_type: reactionType,
        },
      });
    }

    return new Response(
      JSON.stringify({ success: true, sent: successCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-reaction-notification] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
