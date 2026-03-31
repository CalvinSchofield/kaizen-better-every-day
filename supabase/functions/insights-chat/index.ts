import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function buildSystemPrompt(rep: any, entries: any[], officialTotals: any[], goals: any[]) {
  const name = rep?.name || "Rep";
  const year = rep?.year || "Rookie";

  // Summarize entries by day of week
  const dowStats: Record<string, { days: number; doors: number; dm: number; pitches: number; transitions: number; presentations: number; closes: number; fp: number; prmr: number }> = {};
  const weeklyBuckets: Record<string, any> = {};
  const monthlyBuckets: Record<string, any> = {};

  for (const e of entries) {
    const d = new Date(e.entry_date + "T12:00:00");
    const dow = DAY_NAMES[d.getDay()];
    if (!dowStats[dow]) dowStats[dow] = { days: 0, doors: 0, dm: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0, fp: 0, prmr: 0 };
    dowStats[dow].days++;
    dowStats[dow].doors += e.doors_knocked || 0;
    dowStats[dow].dm += e.decision_makers || 0;
    dowStats[dow].pitches += e.pitches || 0;
    dowStats[dow].transitions += e.transitions || 0;
    dowStats[dow].presentations += e.presentations || 0;
    dowStats[dow].closes += e.closes || 0;
    dowStats[dow].fp += e.fp_plus || 0;
    dowStats[dow].prmr += e.prmr || 0;

    // Weekly bucket (ISO week start Sunday)
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const wk = weekStart.toISOString().slice(0, 10);
    if (!weeklyBuckets[wk]) weeklyBuckets[wk] = { days: 0, doors: 0, closes: 0, fp: 0, prmr: 0 };
    weeklyBuckets[wk].days++;
    weeklyBuckets[wk].doors += e.doors_knocked || 0;
    weeklyBuckets[wk].closes += e.closes || 0;
    weeklyBuckets[wk].fp += e.fp_plus || 0;
    weeklyBuckets[wk].prmr += e.prmr || 0;

    // Monthly bucket
    const mo = e.entry_date.slice(0, 7);
    if (!monthlyBuckets[mo]) monthlyBuckets[mo] = { days: 0, doors: 0, closes: 0, fp: 0, prmr: 0 };
    monthlyBuckets[mo].days++;
    monthlyBuckets[mo].doors += e.doors_knocked || 0;
    monthlyBuckets[mo].closes += e.closes || 0;
    monthlyBuckets[mo].fp += e.fp_plus || 0;
    monthlyBuckets[mo].prmr += e.prmr || 0;
  }

  // Sales log time-of-day analysis
  const salesByHour: Record<number, number> = {};
  for (const e of entries) {
    if (e.sales_log && Array.isArray(e.sales_log)) {
      for (const sale of e.sales_log) {
        if (sale.install_status === "cancelled" || sale.install_status === "never_installed") continue;
        const ts = sale.timestamp || sale.created_at;
        if (ts) {
          const hour = new Date(ts).getHours();
          salesByHour[hour] = (salesByHour[hour] || 0) + 1;
        }
      }
    }
  }

  // Season totals
  const totalDays = entries.length;
  const totalDoors = entries.reduce((s, e) => s + (e.doors_knocked || 0), 0);
  const totalDM = entries.reduce((s, e) => s + (e.decision_makers || 0), 0);
  const totalPitches = entries.reduce((s, e) => s + (e.pitches || 0), 0);
  const totalTransitions = entries.reduce((s, e) => s + (e.transitions || 0), 0);
  const totalPresentations = entries.reduce((s, e) => s + (e.presentations || 0), 0);
  const totalCloses = entries.reduce((s, e) => s + (e.closes || 0), 0);
  const totalFP = entries.reduce((s, e) => s + (e.fp_plus || 0), 0);
  const totalPRMR = entries.reduce((s, e) => s + (e.prmr || 0), 0);

  // Goals
  const goalInfo = goals.length > 0
    ? `Season goals: ${JSON.stringify(goals.map(g => ({ metric: g.metric, target: g.target_value })))}`
    : "";

  // Official totals from past seasons
  const pastSeasons = officialTotals.length > 0
    ? `Past season official totals:\n${officialTotals.map(o => `  ${o.season_type} ${o.season_year}: FP=${o.fp_plus ?? o.fp_sold ?? "?"}, PRMR=${o.prmr ?? "?"}, Days=${o.knocking_days ?? "?"}`).join("\n")}`
    : "";

  // Weekly summary (last 6 weeks)
  const sortedWeeks = Object.entries(weeklyBuckets).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  const weeklySummary = sortedWeeks.map(([wk, d]) =>
    `  Week of ${wk}: ${d.days} days, ${d.doors} doors, ${d.closes} closes, ${d.fp.toFixed(1)} FP+, $${d.prmr.toFixed(0)} PRMR`
  ).join("\n");

  // Monthly summary
  const monthlySummary = Object.entries(monthlyBuckets).sort((a, b) => b[0].localeCompare(a[0])).map(([mo, d]) =>
    `  ${mo}: ${d.days} days, ${d.doors} doors, ${d.closes} closes, ${d.fp.toFixed(1)} FP+, $${d.prmr.toFixed(0)} PRMR`
  ).join("\n");

  // Day of week summary
  const dowSummary = Object.entries(dowStats).map(([dow, d]) =>
    `  ${dow}: ${d.days} days, avg ${(d.doors / d.days).toFixed(0)} doors, avg ${(d.fp / d.days).toFixed(2)} FP+, avg $${(d.prmr / d.days).toFixed(0)} PRMR`
  ).join("\n");

  // Time of day
  const timeSummary = Object.entries(salesByHour).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 5)
    .map(([h, c]) => `  ${Number(h) > 12 ? Number(h) - 12 : h}${Number(h) >= 12 ? "pm" : "am"}: ${c} sales`)
    .join("\n");

  return `You are an AI sales coach for Vivint SmartHome door-to-door reps. You're chatting with ${name}, a ${year} rep.

## YOUR VIBE
- Talk like a supportive teammate — like a buddy at the gym who also happens to know all their numbers. Casual, encouraging, real.
- Keep it SHORT and punchy. No walls of text. No corporate speak. No "data analyst" energy.
- Be hype when their numbers are good 🔥. Be constructive and encouraging when they're not — never negative.
- Use "you" and "your" — make it personal. Say things like "dude your Tuesdays are actually fire" not "the data indicates Tuesday performance is above average."
- The goal is to EMPOWER the rep — help them walk into their next 1-on-1 with their leader armed with insights. You're not replacing their leader, you're helping the rep show up prepared.
- If something looks off, frame it as an opportunity: "Hey there might be some easy wins hiding in your [X]" not "your [X] rate is below average."
- Sprinkle in emoji naturally but don't overdo it. You're texting a friend, not writing a report.
- Keep responses under 150 words unless they specifically ask for a deep dive.
- ONLY use the actual data below. Never make up numbers. If you don't have data for something, just say so.

## VIVINT D2D BASICS
- Product: Home security, cameras, smart home (doorbell cams, smart locks, thermostats, etc.)
- Schedule: Mon-Fri noon to 8-9pm, Sat 9-10am to 8-9pm. Sunday off.
- Season goals: Rookie 100+ FP, Soph 200+ FP, Vet 300+ FP. These are hard to hit — celebrate progress.
- FP+ = New FP + (Upgrade PRMR / 85). The core metric.
- EFP = Total PRMR / 85
- PRMR = Planned Monthly Recurring Revenue. Company avg is $85/account. Higher = more money per deal.
- Adders boost PRMR (extra cameras, sensors, smart devices).
- Funnel: Doors → DMs → Pitches → Transitions (inside home) → Presentations (full demo) → Closes (signed)
- Sales: "installed" = funded, "pending" = scheduled, "cancelled"/"never_installed" = doesn't count
- Great close rate: 1 per 25-35 doors. Solid day: 80-120+ doors, 2-4+ closes.
- Reps are independent contractors. Tiered pay scale based on cumulative FP+. Higher PRMR = bigger checks.

## ${name.toUpperCase()}'S NUMBERS

### Overview
- Year: ${year} | Days worked: ${totalDays}
- Doors: ${totalDoors} | DMs: ${totalDM} | Pitches: ${totalPitches}
- Transitions: ${totalTransitions} | Presentations: ${totalPresentations} | Closes: ${totalCloses}
- FP+: ${totalFP.toFixed(2)} | PRMR: $${totalPRMR.toFixed(0)}
- Avg PRMR/close: $${totalCloses > 0 ? (totalPRMR / totalCloses).toFixed(0) : "N/A"}
- Doors/day: ${totalDays > 0 ? (totalDoors / totalDays).toFixed(0) : "N/A"} | FP+/day: ${totalDays > 0 ? (totalFP / totalDays).toFixed(2) : "N/A"}

### Funnel Rates
- DM rate: ${totalDoors > 0 ? ((totalDM / totalDoors) * 100).toFixed(1) : "N/A"}%
- Pitch rate: ${totalDM > 0 ? ((totalPitches / totalDM) * 100).toFixed(1) : "N/A"}%
- Transition rate: ${totalPitches > 0 ? ((totalTransitions / totalPitches) * 100).toFixed(1) : "N/A"}%
- Presentation rate: ${totalTransitions > 0 ? ((totalPresentations / totalTransitions) * 100).toFixed(1) : "N/A"}%
- Close rate: ${totalPresentations > 0 ? ((totalCloses / totalPresentations) * 100).toFixed(1) : "N/A"}%
- Doors/close: ${totalCloses > 0 ? (totalDoors / totalCloses).toFixed(0) : "N/A"}

### By Day of Week
${dowSummary || "No data"}

### Recent Weeks
${weeklySummary || "No data"}

### Monthly
${monthlySummary || "No data"}

### Best Selling Hours
${timeSummary || "No time data"}

${goalInfo}
${pastSeasons}

## KEY RULES
- Reference real numbers. Bold the key ones with **markdown**.
- When comparing periods, show both numbers side by side.
- For pacing: calculate based on days remaining and current rate.
- Always end on something positive or actionable — leave them pumped to go knock.
- If they want to talk to their leader about something, help them frame it: "You could bring this up in your 1-on-1: [specific insight]"
- Never say "I don't have access to your data" — you DO have it above.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub;

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch user data in parallel using service role for full access
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [repResult, entriesResult, officialsResult, goalsResult] = await Promise.all([
      serviceClient.from("reps").select("name, year, email, stage").eq("user_id", userId).maybeSingle(),
      serviceClient.from("daily_entries").select("entry_date, doors_knocked, decision_makers, pitches, transitions, presentations, closes, fp_plus, prmr, upgrade_prmr, work_start_time, work_end_time, sales_log, is_finalized, counter_timestamps").eq("user_id", userId).order("entry_date", { ascending: true }),
      serviceClient.from("official_totals").select("season_type, season_year, fp_plus, fp_sold, prmr, knocking_days").eq("user_id", userId).order("season_year", { ascending: false }),
      serviceClient.from("rep_goals").select("metric, target_value, season_type, season_year").eq("user_id", userId),
    ]);

    const rep = repResult.data;
    const entries = (entriesResult.data || []).filter((e: any) => e.is_finalized || (e.doors_knocked && e.doors_knocked > 0));
    const officials = officialsResult.data || [];
    const goals = goalsResult.data || [];

    const systemPrompt = buildSystemPrompt(rep, entries, officials, goals);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact your admin." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("insights-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
