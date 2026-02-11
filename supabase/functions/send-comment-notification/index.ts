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

    const { activityId, commenterId, commenterName, commentContent, mentionedUserIds = [], recruitId } = await req.json();

    if (!activityId || !commenterId) {
      return new Response(
        JSON.stringify({ error: "Missing activityId or commenterId" }),
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
    if (targetUserId === commenterId) {
      return new Response(
        JSON.stringify({ message: "Skipping self-comment" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Don't double-notify if the activity owner is already being @mentioned
    if (mentionedUserIds.includes(targetUserId)) {
      return new Response(
        JSON.stringify({ message: "User already mentioned, skipping comment notification" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get recruit name for context
    const finalRecruitId = recruitId || activity.recruit_id;
    let recruitName = "";
    if (finalRecruitId) {
      const { data: recruit } = await supabase
        .from("recruits")
        .select("name, phone")
        .eq("id", finalRecruitId)
        .single();
      recruitName = recruit?.name || "";
    }

    // Get push subscriptions and APNs tokens
    const [{ data: subscriptions }, { data: apnsTokens }] = await Promise.all([
      supabase.from("push_subscriptions").select("*").eq("user_id", targetUserId),
      supabase.from("apns_device_tokens").select("device_token").eq("user_id", targetUserId),
    ]);

    if ((!subscriptions || subscriptions.length === 0) && (!apnsTokens || apnsTokens.length === 0)) {
      return new Response(
        JSON.stringify({ message: "No push subscription for target user" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const title = `💬 ${commenterName || "Someone"} commented on your activity`;
    const preview = commentContent ? commentContent.substring(0, 80) : "";
    const body = recruitName
      ? `On ${recruitName}: "${preview}${commentContent?.length > 80 ? "..." : ""}"`
      : `"${preview}${commentContent?.length > 80 ? "..." : ""}"`;

    const deepLinkUrl = finalRecruitId
      ? `/my-group?recruitId=${finalRecruitId}&activityId=${activityId}&openComments=true`
      : "/my-group";

    let successCount = 0;

    // Send web push
    for (const sub of subscriptions || []) {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          title,
          body,
          url: deepLinkUrl,
          type: "comment",
          activityId,
          recruitId: finalRecruitId,
        },
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
      const apnsConfigured = Deno.env.get("APNS_TEAM_ID") && Deno.env.get("APNS_KEY_ID") && Deno.env.get("APNS_PRIVATE_KEY");
      if (apnsConfigured) {
        try {
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
              type: "comment",
            }),
          });
          if (apnsResponse.ok) successCount++;
          else await apnsResponse.text();
        } catch (e) {
          console.error("APNs call failed:", e);
        }
      }
    }

    // Log notification
    if (successCount > 0) {
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("notification_logs").insert({
        user_id: commenterId,
        recipient_user_id: targetUserId,
        notification_type: "comment",
        entry_date: today,
        metadata: {
          commenter_name: commenterName,
          recruit_name: recruitName,
          activity_id: activityId,
          recruit_id: finalRecruitId,
        },
      });
    }

    return new Response(
      JSON.stringify({ success: true, sent: successCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-comment-notification] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
