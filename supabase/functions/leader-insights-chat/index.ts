import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getLocalHour(timestamp: string, timezone: string | null): number {
  const tz = timezone || "America/Chicago";
  try {
    const d = new Date(timestamp);
    const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).formatToParts(d);
    const hourPart = parts.find(p => p.type === "hour");
    return hourPart ? parseInt(hourPart.value, 10) : d.getHours();
  } catch {
    return new Date(timestamp).getHours();
  }
}

function fmtHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

function buildLeaderSystemPrompt(
  leaderName: string,
  accessLevel: string,
  orgStructure: { teams: any[]; mgmtGroups: any[] },
  repsData: any[],
  goalsMap: Record<string, any>,
  plannedDaysMap: Record<string, string[]>,
  seasonConfigMap: Record<string, any>,
  entriesMap: Record<string, any[]>,
) {
  const today = new Date().toISOString().slice(0, 10);

  // --- Per-rep summaries ---
  const repSummaries: string[] = [];
  const allSales: any[] = [];
  const weeklyBucketsByRep: Record<string, Record<string, any>> = {};
  const monthlyBucketsByRep: Record<string, Record<string, any>> = {};

  // Group totals
  let groupDoors = 0, groupDM = 0, groupPitches = 0, groupTransitions = 0;
  let groupPresentations = 0, groupCloses = 0, groupFP = 0, groupPRMR = 0;
  let groupDays = 0, groupHours = 0;

  for (const rep of repsData) {
    const uid = rep.user_id;
    const entries = entriesMap[uid] || [];
    const goals = goalsMap[uid];
    const planned = plannedDaysMap[uid] || [];
    const seasonCfg = seasonConfigMap[uid];

    const isVet = rep.year === "Vet";
    const efpMode = isVet && rep.efp_mode_enabled;

    // Season totals
    let doors = 0, dm = 0, pitches = 0, transitions = 0, presentations = 0, closes = 0;
    let fp = 0, prmr = 0, upgradePrmr = 0, hours = 0;
    const weeklyBuckets: Record<string, any> = {};
    const monthlyBuckets: Record<string, any> = {};
    const dowStats: Record<string, any> = {};

    for (const e of entries) {
      doors += e.doors_knocked || 0;
      dm += e.decision_makers || 0;
      pitches += e.pitches || 0;
      transitions += e.transitions || 0;
      presentations += e.presentations || 0;
      closes += e.closes || 0;
      fp += e.fp_plus || 0;
      prmr += e.prmr || 0;
      upgradePrmr += e.upgrade_prmr || 0;

      if (e.work_start_time && e.work_end_time) {
        const hrs = (new Date(e.work_end_time).getTime() - new Date(e.work_start_time).getTime()) / 3600000;
        if (hrs > 0 && hrs < 18) hours += hrs;
      }

      // Weekly bucket
      const d = new Date(e.entry_date + "T12:00:00");
      const dow = DAY_NAMES[d.getDay()];
      if (!dowStats[dow]) dowStats[dow] = { days: 0, doors: 0, dm: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0, fp: 0, prmr: 0, hours: 0 };
      dowStats[dow].days++;
      dowStats[dow].doors += e.doors_knocked || 0;
      dowStats[dow].dm += e.decision_makers || 0;
      dowStats[dow].pitches += e.pitches || 0;
      dowStats[dow].transitions += e.transitions || 0;
      dowStats[dow].presentations += e.presentations || 0;
      dowStats[dow].closes += e.closes || 0;
      dowStats[dow].fp += e.fp_plus || 0;
      dowStats[dow].prmr += e.prmr || 0;

      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const wk = weekStart.toISOString().slice(0, 10);
      if (!weeklyBuckets[wk]) weeklyBuckets[wk] = { days: 0, doors: 0, dm: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0, fp: 0, prmr: 0 };
      weeklyBuckets[wk].days++;
      weeklyBuckets[wk].doors += e.doors_knocked || 0;
      weeklyBuckets[wk].dm += e.decision_makers || 0;
      weeklyBuckets[wk].pitches += e.pitches || 0;
      weeklyBuckets[wk].transitions += e.transitions || 0;
      weeklyBuckets[wk].presentations += e.presentations || 0;
      weeklyBuckets[wk].closes += e.closes || 0;
      weeklyBuckets[wk].fp += e.fp_plus || 0;
      weeklyBuckets[wk].prmr += e.prmr || 0;

      const mo = e.entry_date.slice(0, 7);
      if (!monthlyBuckets[mo]) monthlyBuckets[mo] = { days: 0, doors: 0, closes: 0, fp: 0, prmr: 0 };
      monthlyBuckets[mo].days++;
      monthlyBuckets[mo].doors += e.doors_knocked || 0;
      monthlyBuckets[mo].closes += e.closes || 0;
      monthlyBuckets[mo].fp += e.fp_plus || 0;
      monthlyBuckets[mo].prmr += e.prmr || 0;

      // Sales
      if (e.sales_log && Array.isArray(e.sales_log)) {
        for (const sale of e.sales_log) {
          const status = typeof sale.install_status === 'string' ? sale.install_status.toLowerCase().trim() : '';
          if (status === 'cancelled' || status === 'canceled' || status === 'never_installed') continue;
          const ts = sale.timestamp || sale.created_at;
          let hour: number | null = null;
          if (ts) hour = getLocalHour(ts, e.timezone || rep.timezone);
          allSales.push({
            repName: rep.name,
            date: e.entry_date,
            type: sale.type || 'fp',
            prmr: sale.prmr || 0,
            status: sale.install_status || 'unknown',
            hour,
            customerName: sale.customer_name || sale.name || undefined,
            timeToSell: sale.time_to_sell_minutes || undefined,
            moneySpent: sale.money_spent || undefined,
            dayOfWeek: dow,
          });
        }
      }
    }

    weeklyBucketsByRep[uid] = weeklyBuckets;
    monthlyBucketsByRep[uid] = monthlyBuckets;

    groupDoors += doors; groupDM += dm; groupPitches += pitches; groupTransitions += transitions;
    groupPresentations += presentations; groupCloses += closes; groupFP += fp; groupPRMR += prmr;
    groupDays += entries.length; groupHours += hours;

    // Find team/group name
    const teamName = orgStructure.teams.find(t => {
      // check accessibleReps for teamId
      return false; // handled below
    })?.name || rep.teamName || "Unknown";

    const totalDays = entries.length;
    const primaryMetric = efpMode ? "EFP" : "FP+";
    const primaryVal = efpMode ? Number((prmr / 85).toFixed(2)) : fp;
    const futurePlanned = planned.filter(d => d >= today);

    // Goals
    const willDoGoal = goals?.will_do_fp_goal || goals?.must_do_fp_goal || 0;
    let paceStr = "";
    if (willDoGoal > 0 && totalDays > 0 && futurePlanned.length > 0) {
      const remaining = willDoGoal - primaryVal;
      const currentPace = primaryVal / totalDays;
      const neededPerDay = remaining / futurePlanned.length;
      const projected = currentPace * (totalDays + futurePlanned.length);
      paceStr = ` | Pace: ${currentPace.toFixed(2)}/day, need ${neededPerDay.toFixed(2)}/day, projected ${projected.toFixed(1)}`;
    }

    // Season averages (funnel rates)
    const dmRate = doors > 0 ? ((dm / doors) * 100).toFixed(1) : "?";
    const pitchRate = dm > 0 ? ((pitches / dm) * 100).toFixed(1) : "?";
    const transRate = pitches > 0 ? ((transitions / pitches) * 100).toFixed(1) : "?";
    const presRate = transitions > 0 ? ((presentations / transitions) * 100).toFixed(1) : "?";
    const closeRate = presentations > 0 ? ((closes / presentations) * 100).toFixed(1) : "?";
    const doorsPerClose = closes > 0 ? (doors / closes).toFixed(0) : "?";

    // Weekly trend (last 4 weeks)
    const sortedWeeks = Object.entries(weeklyBuckets).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4);
    const weekTrend = sortedWeeks.map(([wk, d]) => {
      const val = efpMode ? (d.prmr / 85).toFixed(2) : d.fp.toFixed(1);
      return `${wk}:${d.days}d/${d.doors}dk/${val}${primaryMetric}`;
    }).join(" | ");

    // Monthly trend
    const sortedMonths = Object.entries(monthlyBuckets).sort((a, b) => b[0].localeCompare(a[0]));
    const monthTrend = sortedMonths.map(([mo, d]) => {
      const val = efpMode ? (d.prmr / 85).toFixed(2) : d.fp.toFixed(1);
      return `${mo}:${d.days}d/${d.doors}dk/${val}${primaryMetric}`;
    }).join(" | ");

    // DOW averages
    const dowLine = Object.entries(dowStats).map(([dow, d]) => {
      const avgDoors = (d.doors / d.days).toFixed(0);
      const avgMetric = efpMode ? ((d.prmr / 85) / d.days).toFixed(2) : (d.fp / d.days).toFixed(2);
      return `${dow}:${avgDoors}dk/${avgMetric}${primaryMetric}avg`;
    }).join(" | ");

    const goalsLine = goals ? `Goals: must=${goals.must_do_fp_goal || "?"} will=${goals.will_do_fp_goal || "?"} could=${goals.could_do_fp_goal || "?"}` : "Goals: not set";
    const plannedLine = `Planned days total=${planned.length} remaining=${futurePlanned.length}`;
    
    let schedLine = "";
    if (seasonCfg) {
      if (seasonCfg.personal_summer_start) schedLine += ` start=${seasonCfg.personal_summer_start}`;
      if (seasonCfg.personal_summer_end) schedLine += ` end=${seasonCfg.personal_summer_end}`;
      if (seasonCfg.excluded_summer_days?.length) schedLine += ` off=${seasonCfg.excluded_summer_days.length}days`;
    }

    repSummaries.push(
`### ${rep.name} (${rep.year || "?"}, team: ${rep.teamName || "?"})
Season: ${totalDays}d, ${doors}dk, ${dm}DM, ${pitches}pitch, ${transitions}trans, ${presentations}pres, ${closes}close, ${primaryVal}${primaryMetric}, $${prmr.toFixed(0)}PRMR, ${hours.toFixed(1)}hrs
Funnel: DM%=${dmRate} Pitch%=${pitchRate} Trans%=${transRate} Pres%=${presRate} Close%=${closeRate} DrsPerClose=${doorsPerClose}
AvgPRMR/close: $${closes > 0 ? (prmr / closes).toFixed(0) : "?"} | AvgDoors/day: ${totalDays > 0 ? (doors / totalDays).toFixed(0) : "?"} | Avg${primaryMetric}/day: ${totalDays > 0 ? (primaryVal / totalDays).toFixed(2) : "?"} | AvgHrs/day: ${totalDays > 0 ? (hours / totalDays).toFixed(1) : "?"}
${goalsLine}${paceStr}
${plannedLine}${schedLine ? ` | Schedule:${schedLine}` : ""}
Weeks: ${weekTrend || "none"}
Months: ${monthTrend || "none"}
DOW: ${dowLine || "none"}`
    );
  }

  // --- Org structure ---
  const teamLines = orgStructure.teams.map(t => `  Team "${t.name}" (id:${t.id}): ${repsData.filter(r => r.teamId === t.id).map(r => r.name).join(", ") || "no reps"}`).join("\n");
  const groupLines = orgStructure.mgmtGroups.map(g => `  MGMT Group "${g.name}" (id:${g.id}): teams=[${g.teamIds?.map((tid: string) => orgStructure.teams.find(t => t.id === tid)?.name || tid).join(", ")}]`).join("\n");

  // --- Group-level funnel ---
  const gDmRate = groupDoors > 0 ? ((groupDM / groupDoors) * 100).toFixed(1) : "?";
  const gPitchRate = groupDM > 0 ? ((groupPitches / groupDM) * 100).toFixed(1) : "?";
  const gTransRate = groupPitches > 0 ? ((groupTransitions / groupPitches) * 100).toFixed(1) : "?";
  const gPresRate = groupTransitions > 0 ? ((groupPresentations / groupTransitions) * 100).toFixed(1) : "?";
  const gCloseRate = groupPresentations > 0 ? ((groupCloses / groupPresentations) * 100).toFixed(1) : "?";

  // --- Deal analytics ---
  const salesByHour: Record<number, { fp: number; upgrade: number; prmr: number; spent: number; tts: number; ttsCount: number }> = {};
  const salesByDow: Record<string, { fp: number; upgrade: number; prmr: number; spent: number }> = {};
  let totalFpSales = 0, totalUpgradeSales = 0;

  for (const s of allSales) {
    if (s.type === 'fp') totalFpSales++; else if (s.type === 'upgrade') totalUpgradeSales++;
    if (s.hour !== null) {
      if (!salesByHour[s.hour]) salesByHour[s.hour] = { fp: 0, upgrade: 0, prmr: 0, spent: 0, tts: 0, ttsCount: 0 };
      salesByHour[s.hour].prmr += s.prmr;
      if (s.type === 'fp') salesByHour[s.hour].fp++;
      else salesByHour[s.hour].upgrade++;
      if (s.moneySpent) salesByHour[s.hour].spent += Number(s.moneySpent) || 0;
      if (s.timeToSell) { salesByHour[s.hour].tts += Number(s.timeToSell); salesByHour[s.hour].ttsCount++; }
    }
    const dow = s.dayOfWeek;
    if (dow) {
      if (!salesByDow[dow]) salesByDow[dow] = { fp: 0, upgrade: 0, prmr: 0, spent: 0 };
      if (s.type === 'fp') salesByDow[dow].fp++;
      else salesByDow[dow].upgrade++;
      salesByDow[dow].prmr += s.prmr;
      if (s.moneySpent) salesByDow[dow].spent += Number(s.moneySpent) || 0;
    }
  }

  const hourSummary = Object.entries(salesByHour)
    .sort((a, b) => (b[1].fp + b[1].upgrade) - (a[1].fp + a[1].upgrade))
    .slice(0, 10)
    .map(([h, d]) => {
      const avgTts = d.ttsCount > 0 ? `${(d.tts / d.ttsCount).toFixed(0)}min` : "?";
      return `  ${fmtHour(Number(h))}: ${d.fp}FP ${d.upgrade}upg $${d.prmr.toFixed(0)}PRMR $${d.spent.toFixed(0)}spent avgTTS=${avgTts}`;
    }).join("\n");

  const dowSalesSummary = Object.entries(salesByDow)
    .map(([dow, d]) => `  ${dow}: ${d.fp}FP ${d.upgrade}upg $${d.prmr.toFixed(0)}PRMR $${d.spent.toFixed(0)}spent`)
    .join("\n");

  // Cap sale details to most recent 300 to avoid token overflow
  const recentSales = allSales.slice(-300);
  const salesDetail = recentSales.map(s => {
    const hourStr = s.hour !== null ? fmtHour(s.hour) : '?';
    const ttsStr = s.timeToSell ? ` ${s.timeToSell}min` : '';
    const spentStr = s.moneySpent ? ` $${s.moneySpent}spent` : '';
    return `  ${s.date} ${hourStr} ${s.repName}: ${s.type} $${s.prmr.toFixed(0)}PRMR [${s.status}]${ttsStr}${spentStr}`;
  }).join("\n");

  // --- Group forecast ---
  let forecastSection = "";
  {
    const lines: string[] = [];
    let groupProjected = 0;
    let groupWillDo = 0;
    for (const rep of repsData) {
      const uid = rep.user_id;
      const entries = entriesMap[uid] || [];
      const goals = goalsMap[uid];
      const planned = plannedDaysMap[uid] || [];
      const futurePlanned = planned.filter(d => d >= today);
      const totalDays = entries.length;
      const fp = entries.reduce((s: number, e: any) => s + (e.fp_plus || 0), 0);
      if (totalDays > 0 && futurePlanned.length > 0) {
        const pace = fp / totalDays;
        const projected = pace * (totalDays + futurePlanned.length);
        groupProjected += projected;
      } else {
        groupProjected += fp;
      }
      groupWillDo += goals?.will_do_fp_goal || goals?.must_do_fp_goal || 0;
    }
    lines.push(`Group projected FP+ total: ${groupProjected.toFixed(1)}`);
    lines.push(`Group combined will-do goal: ${groupWillDo}`);
    if (groupWillDo > 0) lines.push(`Group on-pace: ${groupProjected >= groupWillDo ? "YES ✅" : "NO ⚠️"} (${((groupProjected / groupWillDo) * 100).toFixed(0)}%)`);
    forecastSection = `### Group Forecast\n${lines.join("\n")}`;
  }

  return `You are an AI leadership coach for Vivint SmartHome door-to-door sales leaders. You're chatting with ${leaderName}, a ${accessLevel}-level leader.

## YOUR VIBE
- Be clear, direct, and data-driven. Sound like a sharp executive coach — not a buddy, not a hype man.
- No slang. Professional but warm.
- Keep responses under 200 words unless they ask for a deep dive.
- ONLY use the actual data below. Never make up numbers. If you don't have data, say so.
- When comparing, always show both numbers side by side.
- Prescribe coaching actions: "Their door-to-DM ratio dropped 50% this week vs last — talk about prospecting."
- When asked about specific reps, give actionable coaching insights, not just numbers.
- Frame weaknesses as opportunities. Be constructive, never negative.
- Use emoji sparingly — one or two max per response.
- The leader is INCLUDED in all group totals and forecasts.

## COMPARISON RULES
- DEFAULT: Compare reps/teams against their OWN season averages (not group averages or hardcoded standards).
- If the user says "recent average" or "rolling average" or "last 2 weeks", use the most recent 14 days of data.
- If asked "this week vs last week" — compare those two weekly buckets directly.
- If asked "this month vs last month" — compare monthly buckets.
- Weekly and monthly data is available per rep in their sections below.
- Day-of-week averages per rep are also available for questions like "how does Monday compare to Friday."
- You can derive week-over-week trends from the weekly buckets to show progression through the season.
- For team-level comparisons, aggregate the individual rep data for the requested teams.

## VIVINT D2D BASICS
- Product: Home security, cameras, smart home
- Schedule: Mon-Fri noon to 8-9pm, Sat 9-10am to 8-9pm. Sunday off.
- 2026 Season: Sept 29, 2025 – Sept 27, 2026. Preseason: Sept 29 – Apr 12. Summer: Apr 13 – Aug 30. Extension: Aug 31 – Sept 27.
- FP+ = Funded installs + (Upgrade PRMR / 85). EFP = Total PRMR / 85.
- PRMR = Planned Monthly Recurring Revenue. Company avg $85/account.
- Funnel: Doors → DMs → Pitches → Transitions → Presentations → Closes

## 2026 PAY SCALE (per FP+ level reached)
| Level | Commission/FP |
|-------|---------------|
| 0 | $490 | 20 | $545 | 40 | $585 | 60 | $630 | 80 | $670 |
| 100 | $720 | 120 | $740 | 140 | $760 | 160 | $780 | 200 | $820 |
| 220 | $840 | 240 | $860 | 260 | $880 | 300 | $900 |

## ORG STRUCTURE
### Teams
${teamLines || "No teams"}

### MGMT Groups
${groupLines || "No MGMT groups"}

## GROUP TOTALS (${repsData.length} reps including you)
- Days: ${groupDays} | Doors: ${groupDoors} | DMs: ${groupDM} | Pitches: ${groupPitches}
- Transitions: ${groupTransitions} | Presentations: ${groupPresentations} | Closes: ${groupCloses}
- FP+: ${groupFP.toFixed(2)} | PRMR: $${groupPRMR.toFixed(0)} | Hours: ${groupHours.toFixed(0)}
- Group funnel: DM%=${gDmRate} Pitch%=${gPitchRate} Trans%=${gTransRate} Pres%=${gPresRate} Close%=${gCloseRate}
- Avg doors/rep/day: ${groupDays > 0 ? (groupDoors / groupDays).toFixed(0) : "?"} | Avg FP+/rep/day: ${groupDays > 0 ? (groupFP / groupDays).toFixed(2) : "?"}

${forecastSection}

## DEAL ANALYTICS (${allSales.length} total sales: ${totalFpSales} FP, ${totalUpgradeSales} upgrades)
### By Hour of Day
${hourSummary || "No sales data"}

### By Day of Week
${dowSalesSummary || "No sales data"}

### Recent Sales Detail
${salesDetail || "No sales"}

## INDIVIDUAL REP DATA
${repSummaries.join("\n\n")}

## KEY RULES
- Reference real numbers. Bold key ones with **markdown**.
- When asked "who's off pace" — check each rep's projected total vs their will-do goal.
- When asked about planned days — reference each rep's planned days and schedule info.
- When asked about skill gaps — compare a rep's current week funnel rates vs their season averages.
- When asked about coaching priorities — identify the reps with the biggest funnel drops vs their own averages and suggest specific conversation topics.
- When asked about time-of-day patterns — use the Deal Analytics section.
- When asked for a forecast — use the Group Forecast section + individual projections.
- Include the leader in group totals.
- Never say "I don't have access to data" — you DO have it above.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub;

    const { messages, stream = true } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step 1: Get team access via the existing edge function
    const teamAccessResp = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/fetch-team-access`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
          "Content-Type": "application/json",
        },
      }
    );

    if (!teamAccessResp.ok) {
      console.error("fetch-team-access failed:", teamAccessResp.status);
      return new Response(JSON.stringify({ error: "Could not determine team access" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const teamAccess = await teamAccessResp.json();
    const accessLevel = teamAccess.accessLevel;
    if (accessLevel === "none") {
      return new Response(JSON.stringify({ error: "No leadership access" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Include the leader themselves
    const allUserIds: string[] = [...new Set([userId, ...(teamAccess.accessibleUserIds || [])])];

    // Step 2: Bulk fetch data in parallel
    // Batch userIds into chunks of 100 for the IN filter
    const fetchEntries = async () => {
      const all: any[] = [];
      for (let i = 0; i < allUserIds.length; i += 50) {
        const batch = allUserIds.slice(i, i + 50);
        const { data } = await serviceClient
          .from("daily_entries")
          .select("user_id, entry_date, doors_knocked, decision_makers, pitches, transitions, presentations, closes, fp_plus, prmr, upgrade_prmr, work_start_time, work_end_time, sales_log, is_finalized, timezone")
          .in("user_id", batch)
          .order("entry_date", { ascending: true })
          .limit(5000);
        if (data) all.push(...data);
      }
      return all;
    };

    const fetchReps = async () => {
      const { data } = await serviceClient
        .from("reps")
        .select("user_id, name, year, timezone, efp_mode_enabled, email, stage, recruiter")
        .in("user_id", allUserIds)
        .limit(500);
      return data || [];
    };

    const fetchGoals = async () => {
      const all: any[] = [];
      for (let i = 0; i < allUserIds.length; i += 50) {
        const batch = allUserIds.slice(i, i + 50);
        const { data } = await serviceClient
          .from("rep_goals")
          .select("user_id, must_do_fp_goal, will_do_fp_goal, could_do_fp_goal, preseason_fp_goal, upgrade_fp_goal, focus_tier, weeks_working, months_off, monthly_expenses, rent_type, cancel_rate, avg_prmr_per_fp, custom_fp_pace, purpose_statement")
          .in("user_id", batch)
          .limit(500);
        if (data) all.push(...data);
      }
      return all;
    };

    const fetchPlannedDays = async () => {
      const all: any[] = [];
      for (let i = 0; i < allUserIds.length; i += 50) {
        const batch = allUserIds.slice(i, i + 50);
        const { data } = await serviceClient
          .from("planned_work_days")
          .select("user_id, planned_date")
          .in("user_id", batch)
          .order("planned_date", { ascending: true })
          .limit(5000);
        if (data) all.push(...data);
      }
      return all;
    };

    const fetchSeasonConfig = async () => {
      const { data } = await serviceClient
        .from("season_config")
        .select("user_id, personal_summer_start, personal_summer_end, excluded_summer_days")
        .in("user_id", allUserIds)
        .limit(500);
      return data || [];
    };

    const [allEntries, repsRaw, goalsRaw, plannedRaw, seasonConfigRaw] = await Promise.all([
      fetchEntries(),
      fetchReps(),
      fetchGoals(),
      fetchPlannedDays(),
      fetchSeasonConfig(),
    ]);

    // Build maps
    const entriesMap: Record<string, any[]> = {};
    for (const e of allEntries) {
      if (!e.is_finalized && !(e.doors_knocked > 0)) continue;
      if (!entriesMap[e.user_id]) entriesMap[e.user_id] = [];
      entriesMap[e.user_id].push(e);
    }

    const goalsMap: Record<string, any> = {};
    for (const g of goalsRaw) goalsMap[g.user_id] = g;

    const plannedDaysMap: Record<string, string[]> = {};
    for (const p of plannedRaw) {
      if (!plannedDaysMap[p.user_id]) plannedDaysMap[p.user_id] = [];
      plannedDaysMap[p.user_id].push(p.planned_date);
    }

    const seasonConfigMap: Record<string, any> = {};
    for (const sc of seasonConfigRaw) seasonConfigMap[sc.user_id] = sc;

    // Enrich reps with team info from teamAccess.accessibleReps
    const accessibleRepsMap: Record<string, any> = {};
    for (const ar of (teamAccess.accessibleReps || [])) {
      if (ar.userId) accessibleRepsMap[ar.userId] = ar;
    }

    const repsData = repsRaw.map(r => ({
      ...r,
      teamId: accessibleRepsMap[r.user_id]?.teamId || null,
      teamName: accessibleRepsMap[r.user_id]?.teamName || null,
      mgmtGroupId: accessibleRepsMap[r.user_id]?.mgmtGroupId || null,
      mgmtGroupName: accessibleRepsMap[r.user_id]?.mgmtGroupName || null,
    }));

    const leaderRep = repsData.find(r => r.user_id === userId);
    const leaderName = leaderRep?.name || "Leader";

    const systemPrompt = buildLeaderSystemPrompt(
      leaderName,
      accessLevel,
      { teams: teamAccess.teams || [], mgmtGroups: teamAccess.mgmtGroups || [] },
      repsData,
      goalsMap,
      plannedDaysMap,
      seasonConfigMap,
      entriesMap,
    );

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
        stream,
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

    if (!stream) {
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("leader-insights-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
