import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Timezone-aware task reminder system. Called every 15 minutes by cron.
 * 
 * Notifications sent:
 * 1. 9:00 AM local → Daily digest of all tasks due today (including newly assigned)
 * 2. 6:00 PM local → Nudge for tasks due today that aren't completed
 * 3. 9:00 AM local → Past-due task reminders (up to 7 days overdue)
 */

// Common US timezones and their IANA names
const TIMEZONE_OFFSETS: Record<string, string> = {
  "America/New_York": "US Eastern",
  "America/Chicago": "US Central",
  "America/Denver": "US Mountain",
  "America/Los_Angeles": "US Pacific",
  "America/Phoenix": "US Arizona",
  "America/Anchorage": "US Alaska",
  "Pacific/Honolulu": "US Hawaii",
};

function getLocalHour(timezone: string | null): number {
  const tz = timezone || "America/Chicago"; // default Central
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(now), 10);
  } catch {
    return new Date().getUTCHours() - 6; // fallback to Central
  }
}

function getLocalMinute(timezone: string | null): number {
  const tz = timezone || "America/Chicago";
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      minute: "numeric",
    });
    return parseInt(formatter.format(now), 10);
  } catch {
    return new Date().getUTCMinutes();
  }
}

function getLocalDateString(timezone: string | null): string {
  const tz = timezone || "America/Chicago";
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", { // en-CA gives YYYY-MM-DD
      timeZone: tz,
    });
    return formatter.format(now);
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

async function sendNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  body: string,
  url: string,
  notificationType: string,
  metadata: Record<string, unknown>
): Promise<number> {
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  let successCount = 0;

  // Web push
  if (vapidPublicKey && vapidPrivateKey) {
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    for (const sub of subscriptions || []) {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        { title, body, url, type: notificationType },
        vapidPublicKey,
        vapidPrivateKey
      );

      if (result.success) {
        successCount++;
      } else if (result.status === 410 || result.status === 404) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }

  // APNs
  const { data: apnsTokens } = await supabase
    .from("apns_device_tokens")
    .select("device_token")
    .eq("user_id", userId);

  if (apnsTokens && apnsTokens.length > 0) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apnsConfigured = Deno.env.get("APNS_TEAM_ID") && Deno.env.get("APNS_KEY_ID") && Deno.env.get("APNS_PRIVATE_KEY");

    if (apnsConfigured) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-apns-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ targetUserId: userId, title, body, url, type: notificationType }),
        });
        if (resp.ok) successCount++;
        else await resp.text();
      } catch (e) {
        console.error("APNs call failed:", e);
      }
    }
  }

  // Log
  if (successCount > 0) {
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("notification_logs").insert({
      user_id: userId,
      recipient_user_id: userId,
      notification_type: notificationType,
      entry_date: today,
      metadata,
    });
  }

  return successCount;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[check-task-reminders] Starting task reminder check...");

    // Get all reps with user_ids (these are the users who can receive notifications)
    const { data: reps, error: repsError } = await supabase
      .from("reps")
      .select("user_id, name, timezone")
      .not("user_id", "is", null);

    if (repsError || !reps) {
      console.error("[check-task-reminders] Error fetching reps:", repsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch reps" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;
    const processedUsers = new Set<string>();

    for (const rep of reps) {
      if (!rep.user_id || processedUsers.has(rep.user_id)) continue;
      processedUsers.add(rep.user_id);

      const tz = rep.timezone || "America/Chicago";
      const localHour = getLocalHour(tz);
      const localMinute = getLocalMinute(tz);
      const localDate = getLocalDateString(tz);

      // Only process during target windows (within 15 min of target hour)
      const is9am = localHour === 9 && localMinute < 15;
      const is6pm = localHour === 18 && localMinute < 15;

      if (!is9am && !is6pm) continue;

      // Check if we already sent this type today to avoid duplicates
      const today = new Date().toISOString().split("T")[0];

      if (is9am) {
        // Check for already-sent morning digest
        const { data: existingMorning } = await supabase
          .from("notification_logs")
          .select("id")
          .eq("recipient_user_id", rep.user_id)
          .eq("notification_type", "task_morning_digest")
          .eq("entry_date", today)
          .limit(1);

        if (existingMorning && existingMorning.length > 0) continue;

        // ===== 9 AM: Daily digest of tasks due today =====
        const { data: dueTodayTasks } = await supabase
          .from("recruit_activities")
          .select("id, next_action, next_action_due, recruit_id, assignment_status")
          .eq("assigned_to_user_id", rep.user_id)
          .eq("next_action_due", localDate)
          .is("completed_at", null)
          .neq("assignment_status", "completed");

        if (dueTodayTasks && dueTodayTasks.length > 0) {
          // Get recruit names
          const recruitIds = [...new Set(dueTodayTasks.map(t => t.recruit_id).filter(Boolean))];
          const { data: recruits } = await supabase
            .from("recruits")
            .select("id, name")
            .in("id", recruitIds);
          const recruitMap = new Map((recruits || []).map(r => [r.id, r.name]));

          const taskCount = dueTodayTasks.length;
          const firstRecruit = dueTodayTasks[0].recruit_id ? recruitMap.get(dueTodayTasks[0].recruit_id) : null;

          const title = `📋 ${taskCount} task${taskCount > 1 ? "s" : ""} due today`;
          const body = taskCount === 1
            ? `${dueTodayTasks[0].next_action || "Follow up"}${firstRecruit ? ` with ${firstRecruit}` : ""}`
            : `${firstRecruit ? `${dueTodayTasks[0].next_action || "Follow up"} with ${firstRecruit}` : dueTodayTasks[0].next_action || "Follow up"} and ${taskCount - 1} more`;

          const sent = await sendNotification(
            supabase, rep.user_id, title, body,
            "/my-group",
            "task_morning_digest",
            { task_count: taskCount, date: localDate }
          );
          totalSent += sent;
        }

        // ===== 9 AM: Past-due task reminders (up to 7 days overdue) =====
        const { data: existingPastDue } = await supabase
          .from("notification_logs")
          .select("id")
          .eq("recipient_user_id", rep.user_id)
          .eq("notification_type", "task_past_due")
          .eq("entry_date", today)
          .limit(1);

        if (!existingPastDue || existingPastDue.length === 0) {
          // Calculate 7 days ago in local time
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

          const { data: pastDueTasks } = await supabase
            .from("recruit_activities")
            .select("id, next_action, next_action_due, recruit_id")
            .eq("assigned_to_user_id", rep.user_id)
            .is("completed_at", null)
            .neq("assignment_status", "completed")
            .lt("next_action_due", localDate)
            .gte("next_action_due", sevenDaysAgoStr);

          if (pastDueTasks && pastDueTasks.length > 0) {
            const recruitIds = [...new Set(pastDueTasks.map(t => t.recruit_id).filter(Boolean))];
            const { data: recruits } = await supabase
              .from("recruits")
              .select("id, name")
              .in("id", recruitIds);
            const recruitMap = new Map((recruits || []).map(r => [r.id, r.name]));

            const taskCount = pastDueTasks.length;
            const firstRecruit = pastDueTasks[0].recruit_id ? recruitMap.get(pastDueTasks[0].recruit_id) : null;

            const title = `⚠️ ${taskCount} overdue task${taskCount > 1 ? "s" : ""}`;
            const body = taskCount === 1
              ? `${pastDueTasks[0].next_action || "Follow up"}${firstRecruit ? ` with ${firstRecruit}` : ""} was due ${pastDueTasks[0].next_action_due}`
              : `${firstRecruit ? `${firstRecruit}` : "Tasks"} and ${taskCount - 1} more need attention`;

            const sent = await sendNotification(
              supabase, rep.user_id, title, body,
              "/my-group",
              "task_past_due",
              { task_count: taskCount, date: localDate }
            );
            totalSent += sent;
          }
        }
      }

      if (is6pm) {
        // ===== 6 PM: Nudge for incomplete tasks due today =====
        const { data: existingEvening } = await supabase
          .from("notification_logs")
          .select("id")
          .eq("recipient_user_id", rep.user_id)
          .eq("notification_type", "task_evening_nudge")
          .eq("entry_date", today)
          .limit(1);

        if (existingEvening && existingEvening.length > 0) continue;

        const { data: incompleteTasks } = await supabase
          .from("recruit_activities")
          .select("id, next_action, next_action_due, recruit_id")
          .eq("assigned_to_user_id", rep.user_id)
          .eq("next_action_due", localDate)
          .is("completed_at", null)
          .neq("assignment_status", "completed");

        if (incompleteTasks && incompleteTasks.length > 0) {
          const recruitIds = [...new Set(incompleteTasks.map(t => t.recruit_id).filter(Boolean))];
          const { data: recruits } = await supabase
            .from("recruits")
            .select("id, name")
            .in("id", recruitIds);
          const recruitMap = new Map((recruits || []).map(r => [r.id, r.name]));

          const taskCount = incompleteTasks.length;
          const firstRecruit = incompleteTasks[0].recruit_id ? recruitMap.get(incompleteTasks[0].recruit_id) : null;

          const title = `🔔 ${taskCount} task${taskCount > 1 ? "s" : ""} still due today`;
          const body = taskCount === 1
            ? `Don't forget: ${incompleteTasks[0].next_action || "Follow up"}${firstRecruit ? ` with ${firstRecruit}` : ""}`
            : `${firstRecruit ? `${firstRecruit}` : "Tasks"} and ${taskCount - 1} more still need your attention`;

          const sent = await sendNotification(
            supabase, rep.user_id, title, body,
            "/my-group",
            "task_evening_nudge",
            { task_count: taskCount, date: localDate }
          );
          totalSent += sent;
        }
      }
    }

    console.log(`[check-task-reminders] Complete. Sent ${totalSent} notifications.`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, processed: processedUsers.size }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[check-task-reminders] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
