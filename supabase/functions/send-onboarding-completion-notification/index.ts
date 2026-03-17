import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Notifies upline leaders (3 layers up) when a rep marks an onboarding/ramp task
 * as completed and is waiting for approval to advance to the next phase.
 * 
 * Called from the client when a rep completes a ramp phase step.
 * Payload: { repUserId, repName, phase, stepDescription }
 */
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

    const { repUserId, repName, phase, stepDescription } = await req.json();

    if (!repUserId || !repName || !phase) {
      return new Response(
        JSON.stringify({ error: "Missing repUserId, repName, or phase" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-onboarding-completion-notification] ${repName} completed ${phase}: ${stepDescription}`);

    const today = new Date().toISOString().split("T")[0];

    // Find the rep's upline (3 layers up): recruiter → team lead → mgmt group lead
    const uplineUserIds: Set<string> = new Set();

    // Get rep's email to find their recruit record
    const { data: rep } = await supabase
      .from("reps")
      .select("email")
      .eq("user_id", repUserId)
      .maybeSingle();

    if (rep?.email) {
      const { data: recruit } = await supabase
        .from("recruits")
        .select("recruiter_user_id, team_id")
        .ilike("email", rep.email)
        .maybeSingle();

      // Layer 1: Direct recruiter
      if (recruit?.recruiter_user_id) {
        uplineUserIds.add(recruit.recruiter_user_id);
      }

      // Layer 2: Team lead
      if (recruit?.team_id) {
        const { data: team } = await supabase
          .from("teams")
          .select("lead_user_id")
          .eq("id", recruit.team_id)
          .maybeSingle();

        if (team?.lead_user_id) {
          uplineUserIds.add(team.lead_user_id);
        }

        // Layer 3: Mgmt group lead
        const { data: teamMgmtGroups } = await supabase
          .from("team_mgmt_groups")
          .select("mgmt_group_id")
          .eq("team_id", recruit.team_id);

        if (teamMgmtGroups?.length) {
          const { data: mgmtGroups } = await supabase
            .from("mgmt_groups")
            .select("lead_user_id")
            .in("id", teamMgmtGroups.map(t => t.mgmt_group_id));

          mgmtGroups?.forEach(mg => {
            if (mg.lead_user_id) uplineUserIds.add(mg.lead_user_id);
          });
        }
      }
    }

    // Remove the rep themselves
    uplineUserIds.delete(repUserId);

    if (uplineUserIds.size === 0) {
      console.log("[send-onboarding-completion-notification] No upline leaders found");
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phaseLabels: Record<string, string> = {
      phase_1: "Pay & Goals",
      phase_2: "Product & Process",
      phase_3: "Practice & iPad",
      phase_4: "Pack & Prepare",
    };

    const phaseLabel = phaseLabels[phase] || phase;
    const title = `✅ ${repName} completed a ramp step!`;
    const body = stepDescription
      ? `${phaseLabel}: "${stepDescription}" — waiting for your approval`
      : `Completed ${phaseLabel} — waiting for your approval`;
    const url = `/my-group?highlight=${repUserId}`;

    let successCount = 0;

    for (const leaderId of uplineUserIds) {
      let sent = false;

      // Web push
      if (vapidPublicKey && vapidPrivateKey) {
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", leaderId);

        for (const sub of subs || []) {
          const result = await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            { title, body, url, type: "onboarding_completion" },
            vapidPublicKey,
            vapidPrivateKey
          );
          if (result.success) sent = true;
          else if (result.status === 410 || result.status === 404) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      }

      // APNs
      const { data: apnsTokens } = await supabase
        .from("apns_device_tokens")
        .select("device_token")
        .eq("user_id", leaderId);

      if (apnsTokens && apnsTokens.length > 0) {
        const apnsConfigured = Deno.env.get("APNS_TEAM_ID") && Deno.env.get("APNS_KEY_ID") && Deno.env.get("APNS_PRIVATE_KEY");
        if (apnsConfigured) {
          try {
            const resp = await fetch(`${supabaseUrl}/functions/v1/send-apns-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ targetUserId: leaderId, title, body, url, type: "onboarding_completion" }),
            });
            if (resp.ok) sent = true;
            else await resp.text();
          } catch (e) {
            console.error("APNs call failed:", e);
          }
        }
      }

      if (sent) {
        await supabase.from("notification_logs").insert({
          user_id: repUserId,
          recipient_user_id: leaderId,
          notification_type: "onboarding_completion",
          entry_date: today,
          metadata: {
            rep_name: repName,
            phase,
            step_description: stepDescription,
          },
        });
        successCount++;
      }
    }

    console.log(`[send-onboarding-completion-notification] Sent ${successCount} notifications to ${uplineUserIds.size} leaders`);

    return new Response(
      JSON.stringify({ success: true, notified: successCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-onboarding-completion-notification] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
