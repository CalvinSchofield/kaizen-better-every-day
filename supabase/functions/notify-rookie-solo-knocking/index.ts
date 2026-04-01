import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Notifies upline leaders (recruiter → team lead → MGMT group leader + area director)
 * when a rookie starts knocking OUTSIDE of an active blitz.
 *
 * Deduplicated per rookie per day via notification_logs.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Authenticate
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rookieUserId = user.id;
    const today = new Date().toISOString().split("T")[0];

    // 1. Get rep data — must be a Rookie
    const { data: rep } = await supabase
      .from("reps")
      .select("name, year, email, committed_blitzes")
      .eq("user_id", rookieUserId)
      .maybeSingle();

    if (!rep || rep.year !== "Rookie") {
      return new Response(JSON.stringify({ skipped: true, reason: "not_rookie" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check if rookie is on an active blitz today
    const blitzes = Array.isArray(rep.committed_blitzes) ? rep.committed_blitzes : [];
    const isOnBlitzToday = blitzes.some((b: any) => {
      if (!b?.date) return false;
      if (today === b.date) return true;
      if (b.endDate && today >= b.date && today <= b.endDate) return true;
      return false;
    });

    if (isOnBlitzToday) {
      return new Response(JSON.stringify({ skipped: true, reason: "on_blitz" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Dedup — only one notification per rookie per day
    const { data: existing } = await supabase
      .from("notification_logs")
      .select("id")
      .eq("user_id", rookieUserId)
      .eq("notification_type", "rookie_solo_knocking")
      .eq("entry_date", today)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "already_sent_today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Resolve upline: recruiter → team lead → MGMT group leader + area director
    const uplineUserIds: Set<string> = new Set();

    const { data: recruit } = await supabase
      .from("recruits")
      .select("recruiter_user_id, team_id, mgmt_group_id")
      .eq("id", (await supabase.from("reps").select("id").eq("user_id", rookieUserId).maybeSingle()).data?.id || "")
      .maybeSingle();

    // Direct recruiter
    if (recruit?.recruiter_user_id) {
      uplineUserIds.add(recruit.recruiter_user_id);
    }

    // Team lead
    if (recruit?.team_id) {
      const { data: team } = await supabase
        .from("teams")
        .select("lead_user_id")
        .eq("id", recruit.team_id)
        .maybeSingle();
      if (team?.lead_user_id) uplineUserIds.add(team.lead_user_id);

      // MGMT group leader(s) via team_mgmt_groups
      const { data: tmgs } = await supabase
        .from("team_mgmt_groups")
        .select("mgmt_group_id")
        .eq("team_id", recruit.team_id);

      if (tmgs?.length) {
        const { data: mgs } = await supabase
          .from("mgmt_groups")
          .select("lead_user_id, office_id")
          .in("id", tmgs.map((t) => t.mgmt_group_id));

        const officeIds: Set<string> = new Set();
        mgs?.forEach((mg) => {
          if (mg.lead_user_id) uplineUserIds.add(mg.lead_user_id);
          if (mg.office_id) officeIds.add(mg.office_id);
        });

        // Area directors for those offices
        if (officeIds.size > 0) {
          const { data: ads } = await supabase
            .from("area_directors")
            .select("user_id");
          // Area directors who are office_staff for relevant offices
          const { data: officeStaff } = await supabase
            .from("office_staff")
            .select("user_id")
            .in("office_id", [...officeIds]);
          
          // Add area directors who are staff at these offices
          if (ads && officeStaff) {
            const adUserIds = new Set(ads.map((a) => a.user_id));
            officeStaff.forEach((os) => {
              if (adUserIds.has(os.user_id)) uplineUserIds.add(os.user_id);
            });
          }
        }
      }
    }

    // Remove self
    uplineUserIds.delete(rookieUserId);

    if (uplineUserIds.size === 0) {
      console.log("[notify-rookie-solo-knocking] No upline found");
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Send notifications
    const title = `🔥 ${rep.name} is out knocking solo!`;
    const body = "Your rookie is putting in extra work outside of a blitz. Send some encouragement!";
    const url = "/my-group";

    let successCount = 0;
    const apnsConfigured = Deno.env.get("APNS_TEAM_ID") && Deno.env.get("APNS_KEY_ID") && Deno.env.get("APNS_PRIVATE_KEY");

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
            { title, body, url, type: "rookie_solo_knocking" },
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
      if (apnsConfigured) {
        const { data: apnsTokens } = await supabase
          .from("apns_device_tokens")
          .select("device_token")
          .eq("user_id", leaderId);

        if (apnsTokens && apnsTokens.length > 0) {
          try {
            const resp = await fetch(`${supabaseUrl}/functions/v1/send-apns-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                targetUserId: leaderId,
                title,
                body,
                url,
                type: "rookie_solo_knocking",
              }),
            });
            if (resp.ok) sent = true;
          } catch (e) {
            console.error("[notify-rookie-solo-knocking] APNs error:", e);
          }
        }
      }

      if (sent) successCount++;
    }

    // 6. Log (one row per rookie per day, not per recipient)
    await supabase.from("notification_logs").insert({
      user_id: rookieUserId,
      notification_type: "rookie_solo_knocking",
      entry_date: today,
      metadata: {
        rep_name: rep.name,
        notified_leaders: [...uplineUserIds],
        notified_count: successCount,
      },
    });

    console.log(`[notify-rookie-solo-knocking] ${rep.name} solo knocking → notified ${successCount}/${uplineUserIds.size} leaders`);

    return new Response(JSON.stringify({ success: true, notified: successCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[notify-rookie-solo-knocking] Error:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
