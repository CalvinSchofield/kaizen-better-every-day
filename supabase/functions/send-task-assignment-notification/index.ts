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

    const { assignedToUserId, assignerUserId, recruitId, nextAction, nextActionDue } = await req.json();

    if (!assignedToUserId || !assignerUserId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Don't notify yourself
    if (assignedToUserId === assignerUserId) {
      return new Response(
        JSON.stringify({ message: "Skipping self-assignment" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up assigner name and recruit name server-side
    const [assignerResult, recruitResult] = await Promise.all([
      supabase.from("reps").select("name").eq("user_id", assignerUserId).single(),
      recruitId ? supabase.from("recruits").select("name").eq("id", recruitId).single() : Promise.resolve({ data: null }),
    ]);

    const assignerName = assignerResult.data?.name || "Someone";
    const recruitName = recruitResult.data?.name || "";

    // Format date for display
    let dateStr = "";
    if (nextActionDue) {
      try {
        const d = new Date(nextActionDue);
        dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } catch {
        dateStr = nextActionDue;
      }
    }

    const title = `📋 ${assignerName} assigned you a follow-up`;
    const bodyParts: string[] = [];
    if (recruitName) bodyParts.push(`with ${recruitName}`);
    if (dateStr) bodyParts.push(`for ${dateStr}`);
    if (nextAction) bodyParts.push(`— ${nextAction}`);
    const body = bodyParts.join(" ") || "You have a new task assignment";

    const deepLinkUrl = recruitId
      ? `/my-group?recruitId=${recruitId}`
      : "/my-group";

    // Get push subscriptions and APNs tokens
    const [{ data: subscriptions }, { data: apnsTokens }] = await Promise.all([
      supabase.from("push_subscriptions").select("*").eq("user_id", assignedToUserId),
      supabase.from("apns_device_tokens").select("device_token").eq("user_id", assignedToUserId),
    ]);

    if ((!subscriptions || subscriptions.length === 0) && (!apnsTokens || apnsTokens.length === 0)) {
      return new Response(
        JSON.stringify({ message: "No push subscription for target user" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let successCount = 0;

    // Send web push
    for (const sub of subscriptions || []) {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        { title, body, url: deepLinkUrl, type: "task_assignment" },
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
              targetUserId: assignedToUserId,
              title,
              body,
              url: deepLinkUrl,
              type: "task_assignment",
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
        user_id: assignerUserId,
        recipient_user_id: assignedToUserId,
        notification_type: "task_assignment",
        entry_date: today,
        metadata: {
          assigner_name: assignerName,
          recruit_name: recruitName,
          recruit_id: recruitId,
          next_action: nextAction,
          next_action_due: nextActionDue,
        },
      });
    }

    return new Response(
      JSON.stringify({ success: true, sent: successCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-task-assignment-notification] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
