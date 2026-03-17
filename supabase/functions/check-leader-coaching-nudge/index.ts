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

/**
 * Leader coaching nudge — fires at 9am local.
 * Notifies leaders when a rep in their direct downline has knocked doors for 2+ days
 * but hasn't logged any FP+ or PRMR (sold nothing).
 * Notifies 2 layers up: team lead + mgmt group lead.
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

    console.log("[check-leader-coaching-nudge] Starting...");

    // Get all team leads
    const { data: teams } = await supabase
      .from("teams")
      .select("id, lead_user_id")
      .not("lead_user_id", "is", null);

    if (!teams || teams.length === 0) {
      return new Response(
        JSON.stringify({ message: "No teams found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get leader timezones
    const leaderUserIds = teams.map(t => t.lead_user_id!).filter(Boolean);
    const { data: leaderReps } = await supabase
      .from("reps")
      .select("user_id, name, timezone")
      .in("user_id", leaderUserIds);

    const leaderTimezoneMap = new Map<string, string>();
    const leaderNameMap = new Map<string, string>();
    for (const lr of leaderReps || []) {
      if (lr.user_id) {
        leaderTimezoneMap.set(lr.user_id, lr.timezone || "America/Chicago");
        leaderNameMap.set(lr.user_id, lr.name);
      }
    }

    const today = new Date().toISOString().split("T")[0];
    let totalSent = 0;

    for (const team of teams) {
      if (!team.lead_user_id) continue;

      const tz = leaderTimezoneMap.get(team.lead_user_id) || "America/Chicago";
      const localHour = getLocalHour(tz);
      const localMinute = getLocalMinute(tz);

      // Only fire at 9am local (within 15-min window)
      if (localHour !== 9 || localMinute >= 15) continue;

      // Get reps on this team
      const { data: teamReps } = await supabase
        .from("reps")
        .select("user_id, name")
        .not("user_id", "is", null);

      // Get team members by checking reps table — reps whose team_leader matches
      // Actually need to find reps belonging to this team via the teams/reps relationship
      // Reps don't have a team_id directly, but we can use the recruits table or
      // check if team lead matches. Let's look at daily_entries for reps who have been active.

      // Get all reps with user_ids
      const { data: allReps } = await supabase
        .from("reps")
        .select("user_id, name, team_leader")
        .not("user_id", "is", null);

      // Filter to reps whose team_leader matches this team's lead
      const teamLeaderName = leaderNameMap.get(team.lead_user_id) || "";
      const directReports = (allReps || []).filter(r => 
        r.team_leader === teamLeaderName && r.user_id !== team.lead_user_id
      );

      if (directReports.length === 0) continue;

      // Check last 3 days of entries for each direct report
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split("T")[0];

      for (const rep of directReports) {
        if (!rep.user_id) continue;

        // Get their recent entries
        const { data: recentEntries } = await supabase
          .from("daily_entries")
          .select("entry_date, doors_knocked, pitches, presentations, fp_plus, prmr, is_finalized")
          .eq("user_id", rep.user_id)
          .gte("entry_date", threeDaysAgoStr)
          .order("entry_date", { ascending: false });

        if (!recentEntries || recentEntries.length < 2) continue;

        // Check if they've knocked doors but not sold in 2+ consecutive days
        const knockedButNotSold = recentEntries.filter(
          e => (e.doors_knocked || 0) > 0 && (e.fp_plus || 0) === 0 && (e.prmr || 0) === 0
        );

        if (knockedButNotSold.length < 2) continue;

        // Dedup check
        const { data: existingLog } = await supabase
          .from("notification_logs")
          .select("id")
          .eq("notification_type", "leader_coaching_nudge")
          .eq("entry_date", today)
          .eq("metadata->>rep_user_id", rep.user_id)
          .limit(1);

        if (existingLog && existingLog.length > 0) continue;

        // Calculate total stats across dry days for richer context
        const totalDoors = knockedButNotSold.reduce((sum, e) => sum + (e.doors_knocked || 0), 0);
        const totalPitches = knockedButNotSold.reduce((sum, e) => sum + (e.pitches || 0), 0);

        // Get rep's phone for call/text actions
        const { data: repDetails } = await supabase
          .from("reps")
          .select("phone")
          .eq("user_id", rep.user_id)
          .maybeSingle();

        const title = `🎯 ${rep.name} needs coaching`;
        const body = `${knockedButNotSold.length} days, ${totalDoors} doors, ${totalPitches} pitches — no sales. Give ${rep.name} a call!`;
        const url = `/my-group?highlight=${rep.user_id}`;

        // Build list of leaders to notify (2 layers up)
        const leadersToNotify: Set<string> = new Set();
        leadersToNotify.add(team.lead_user_id);

        // Get mgmt group lead (layer 2)
        const { data: teamMgmtGroups } = await supabase
          .from("team_mgmt_groups")
          .select("mgmt_group_id")
          .eq("team_id", team.id);

        if (teamMgmtGroups?.length) {
          const { data: mgmtGroups } = await supabase
            .from("mgmt_groups")
            .select("lead_user_id")
            .in("id", teamMgmtGroups.map(t => t.mgmt_group_id));

          mgmtGroups?.forEach(mg => {
            if (mg.lead_user_id) leadersToNotify.add(mg.lead_user_id);
          });
        }

        for (const leaderId of leadersToNotify) {
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
                { title, body, url, type: "leader_coaching_nudge", repUserId: rep.user_id, phone: repDetails?.phone || null },
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
                  body: JSON.stringify({ targetUserId: leaderId, title, body, url, type: "leader_coaching_nudge" }),
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
              recipient_user_id: leaderId,
              notification_type: "leader_coaching_nudge",
              entry_date: today,
              metadata: {
                rep_name: rep.name,
                rep_user_id: rep.user_id,
                days_without_sale: knockedButNotSold.length,
              },
            });
            totalSent++;
          }
        }
      }
    }

    console.log(`[check-leader-coaching-nudge] Complete. Sent ${totalSent} nudges.`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[check-leader-coaching-nudge] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
