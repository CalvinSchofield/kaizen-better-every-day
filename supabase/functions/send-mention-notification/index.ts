import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to send web push
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; status?: number }> {
  try {
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "TTL": "86400",
      },
      body: JSON.stringify(payload),
    });

    return { success: response.ok, status: response.status };
  } catch (error) {
    console.error("Push notification error:", error);
    return { success: false };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { mentionedUserIds, commenterId, commenterName, recruitName, activityId, commentContent } = await req.json();

    if (!mentionedUserIds || mentionedUserIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No mentions to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-mention-notification] Processing ${mentionedUserIds.length} mentions from ${commenterName}`);

    let successCount = 0;
    const today = new Date().toISOString().split("T")[0];

    for (const mentionedUserId of mentionedUserIds) {
      // Don't notify yourself
      if (mentionedUserId === commenterId) {
        console.log(`[send-mention-notification] Skipping self-mention for ${mentionedUserId}`);
        continue;
      }

      // Get push subscriptions for the mentioned user
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", mentionedUserId);

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`[send-mention-notification] No push subscription for user ${mentionedUserId}`);
        
        // Also check APNs tokens for native apps
        const { data: apnsTokens } = await supabase
          .from("apns_device_tokens")
          .select("*")
          .eq("user_id", mentionedUserId);

        if (!apnsTokens || apnsTokens.length === 0) {
          console.log(`[send-mention-notification] No APNs token for user ${mentionedUserId} either`);
          continue;
        }
      }

      // Compose notification
      const title = `💬 ${commenterName} mentioned you`;
      const body = recruitName 
        ? `In a comment on ${recruitName}'s activity: "${commentContent.substring(0, 50)}${commentContent.length > 50 ? '...' : ''}"`
        : `"${commentContent.substring(0, 80)}${commentContent.length > 80 ? '...' : ''}"`;

      // Send to web push subscriptions
      for (const sub of subscriptions || []) {
        const result = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          {
            title,
            body,
            url: "/my-group",
            type: "mention",
            data: { activityId },
          },
          vapidPublicKey || "",
          vapidPrivateKey || ""
        );

        if (result.success) {
          successCount++;
          console.log(`[send-mention-notification] Sent to user ${mentionedUserId}`);

          // Log the notification
          await supabase.from("notification_logs").insert({
            user_id: commenterId,
            recipient_user_id: mentionedUserId,
            notification_type: "mention",
            entry_date: today,
            metadata: {
              commenter_name: commenterName,
              recruit_name: recruitName,
              activity_id: activityId,
            },
          });
        } else if (result.status === 410 || result.status === 404) {
          // Clean up expired subscription
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          console.log(`[send-mention-notification] Cleaned up expired subscription for user ${mentionedUserId}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${successCount} mention notifications`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-mention-notification] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
