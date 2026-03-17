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
 * Challenge progress update — fires at 6pm local during active challenges.
 * Tells each participant where they stand vs their opponent(s).
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

    console.log("[check-challenge-progress] Starting...");

    // Get active challenges
    const { data: challenges, error: challengeError } = await supabase
      .from("challenges")
      .select("id, metric, start_date, end_date, stakes, creator_timezone, type")
      .eq("status", "active");

    if (challengeError || !challenges || challenges.length === 0) {
      console.log("[check-challenge-progress] No active challenges");
      return new Response(
        JSON.stringify({ message: "No active challenges", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    let totalSent = 0;

    for (const challenge of challenges) {
      const tz = challenge.creator_timezone || "America/Chicago";
      const localHour = getLocalHour(tz);
      const localMinute = getLocalMinute(tz);

      // Only fire at 6pm local (within 15-min window)
      if (localHour !== 18 || localMinute >= 15) continue;

      // Get participants
      const { data: participants } = await supabase
        .from("challenge_participants")
        .select("user_id, role, team, accepted")
        .eq("challenge_id", challenge.id)
        .eq("accepted", true);

      if (!participants || participants.length < 2) continue;

      // Get participant names
      const userIds = participants.map(p => p.user_id);
      const { data: reps } = await supabase
        .from("reps")
        .select("user_id, name, timezone")
        .in("user_id", userIds);

      const repMap = new Map<string, { name: string; timezone: string }>();
      for (const r of reps || []) {
        if (r.user_id) repMap.set(r.user_id, { name: r.name, timezone: r.timezone || tz });
      }

      // Get entries for all participants within the challenge date range
      const { data: entries } = await supabase
        .from("daily_entries")
        .select("user_id, doors_knocked, decision_makers, pitches, presentations, closes, fp_plus, prmr")
        .in("user_id", userIds)
        .gte("entry_date", challenge.start_date)
        .lte("entry_date", challenge.end_date);

      // Calculate totals per participant
      const totals = new Map<string, number>();
      for (const p of participants) {
        totals.set(p.user_id, 0);
      }

      for (const entry of entries || []) {
        const metric = challenge.metric;
        let value = 0;
        if (metric === "doors_knocked") value = entry.doors_knocked || 0;
        else if (metric === "decision_makers") value = entry.decision_makers || 0;
        else if (metric === "pitches") value = entry.pitches || 0;
        else if (metric === "presentations") value = entry.presentations || 0;
        else if (metric === "closes") value = entry.closes || 0;
        else if (metric === "fp_plus") value = Number(entry.fp_plus) || 0;
        else if (metric === "prmr") value = Number(entry.prmr) || 0;

        totals.set(entry.user_id, (totals.get(entry.user_id) || 0) + value);
      }

      // Calculate days remaining
      const endDate = new Date(challenge.end_date + "T23:59:59");
      const nowDate = new Date();
      const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24)));

      // Dedup check for this challenge today
      const { data: existingLog } = await supabase
        .from("notification_logs")
        .select("id")
        .eq("notification_type", "challenge_progress")
        .eq("entry_date", today)
        .eq("metadata->>challenge_id", challenge.id)
        .limit(1);

      if (existingLog && existingLog.length > 0) continue;

      // Send to each participant
      for (const participant of participants) {
        const myTotal = totals.get(participant.user_id) || 0;
        const repInfo = repMap.get(participant.user_id);
        if (!repInfo) continue;

        // Find opponent(s) — for 1v1, get the other person
        const opponents = participants.filter(p => p.user_id !== participant.user_id);
        if (opponents.length === 0) continue;

        const topOpponent = opponents.reduce((best, opp) => {
          const oppTotal = totals.get(opp.user_id) || 0;
          const bestTotal = totals.get(best.user_id) || 0;
          return oppTotal > bestTotal ? opp : best;
        }, opponents[0]);

        const oppTotal = totals.get(topOpponent.user_id) || 0;
        const oppName = repMap.get(topOpponent.user_id)?.name || "opponent";
        const diff = myTotal - oppTotal;

        const metricLabel = challenge.metric.replace(/_/g, " ");

        let title: string;
        let body: string;

        if (diff > 0) {
          title = `🏆 You're winning! +${diff} ${metricLabel}`;
          body = `You: ${myTotal} vs ${oppName}: ${oppTotal}. ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left — keep it up!`;
        } else if (diff < 0) {
          title = `⚡ ${Math.abs(diff)} ${metricLabel} behind!`;
          body = `${oppName}: ${oppTotal} vs You: ${myTotal}. ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left — time to grind!`;
        } else {
          title = `🤝 It's tied! ${myTotal} ${metricLabel} each`;
          body = `You and ${oppName} are neck and neck. ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left!`;
        }

        const url = "/challenges";
        let sent = false;

        // Web push
        if (vapidPublicKey && vapidPrivateKey) {
          const { data: subs } = await supabase
            .from("push_subscriptions")
            .select("*")
            .eq("user_id", participant.user_id);

          for (const sub of subs || []) {
            const result = await sendWebPush(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              { title, body, url, type: "challenge_progress" },
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
          .eq("user_id", participant.user_id);

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
                body: JSON.stringify({ targetUserId: participant.user_id, title, body, url, type: "challenge_progress" }),
              });
              if (resp.ok) sent = true;
              else await resp.text();
            } catch (e) {
              console.error("APNs call failed:", e);
            }
          }
        }

        if (sent) totalSent++;
      }

      // Log once per challenge per day
      await supabase.from("notification_logs").insert({
        user_id: participants[0].user_id,
        notification_type: "challenge_progress",
        entry_date: today,
        metadata: { challenge_id: challenge.id, participants_notified: participants.length },
      });
    }

    console.log(`[check-challenge-progress] Complete. Sent ${totalSent} updates.`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[check-challenge-progress] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
