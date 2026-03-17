import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getLocalHour(timezone: string | null): number {
  const tz = timezone || "America/Chicago";
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(new Date()), 10);
  } catch {
    return new Date().getUTCHours() - 6;
  }
}

function getLocalMinute(timezone: string | null): number {
  const tz = timezone || "America/Chicago";
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      minute: "numeric",
    });
    return parseInt(formatter.format(new Date()), 10);
  } catch {
    return new Date().getUTCMinutes();
  }
}

function getLocalDateString(timezone: string | null): string {
  const tz = timezone || "America/Chicago";
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

/**
 * "Start Your Day" nudge — fires at noon local on planned work days
 * if the rep hasn't started tracking yet (no work_start_time).
 * Runs every 15 minutes via cron.
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

    console.log("[check-start-day-reminders] Starting...");

    // Get all reps with user_ids
    const { data: reps, error: repsError } = await supabase
      .from("reps")
      .select("user_id, name, timezone")
      .not("user_id", "is", null);

    if (repsError || !reps) {
      throw new Error(`Error fetching reps: ${repsError?.message}`);
    }

    let totalSent = 0;
    const today = new Date().toISOString().split("T")[0];

    for (const rep of reps) {
      if (!rep.user_id) continue;

      const tz = rep.timezone || "America/Chicago";
      const localHour = getLocalHour(tz);
      const localMinute = getLocalMinute(tz);

      // Only fire at noon local (within 15-min window)
      if (localHour !== 12 || localMinute >= 15) continue;

      const localDate = getLocalDateString(tz);

      // Check if today is a planned work day
      const { data: plannedDay } = await supabase
        .from("planned_work_days")
        .select("id")
        .eq("user_id", rep.user_id)
        .eq("planned_date", localDate)
        .maybeSingle();

      if (!plannedDay) continue;

      // Check if they already have a daily entry with work_start_time
      const { data: entry } = await supabase
        .from("daily_entries")
        .select("id, work_start_time")
        .eq("user_id", rep.user_id)
        .eq("entry_date", localDate)
        .maybeSingle();

      if (entry?.work_start_time) continue; // Already started

      // Check deduplication
      const { data: existingLog } = await supabase
        .from("notification_logs")
        .select("id")
        .eq("recipient_user_id", rep.user_id)
        .eq("notification_type", "start_day_nudge")
        .eq("entry_date", today)
        .limit(1);

      if (existingLog && existingLog.length > 0) continue;

      const title = "🌞 Time to Start Your Day!";
      const body = `You planned to work today — tap here to start tracking and make it count!`;
      const url = "/track";

      let sent = false;

      // Web push
      if (vapidPublicKey && vapidPrivateKey) {
        const { data: subscriptions } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", rep.user_id);

        for (const sub of subscriptions || []) {
          const result = await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            { title, body, url, type: "start_day_nudge" },
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
        .eq("user_id", rep.user_id);

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
              body: JSON.stringify({ targetUserId: rep.user_id, title, body, url, type: "start_day_nudge" }),
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
          user_id: rep.user_id,
          recipient_user_id: rep.user_id,
          notification_type: "start_day_nudge",
          entry_date: today,
          metadata: { rep_name: rep.name },
        });
        totalSent++;
        console.log(`[check-start-day-reminders] Sent nudge to ${rep.name}`);
      }
    }

    console.log(`[check-start-day-reminders] Complete. Sent ${totalSent} nudges.`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[check-start-day-reminders] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
