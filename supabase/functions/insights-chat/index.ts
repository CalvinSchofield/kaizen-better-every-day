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

function buildSystemPrompt(
  rep: any,
  entries: any[],
  officialTotals: any[],
  repGoals: any,
  plannedDays: string[],
  seasonConfig: any,
) {
  const name = rep?.name || "Rep";
  const year = rep?.year || "Rookie";

  // EFP mode - declared early so summaries can use it
  const isVet = year === "Vet";
  const efpModeEnabled = isVet && (rep?.efp_mode_enabled || false);
  const efpFromPrmr = (prmr: number) => Number((prmr / 85).toFixed(2));

  // Summarize entries by day of week
  const dowStats: Record<string, { days: number; doors: number; dm: number; pitches: number; transitions: number; presentations: number; closes: number; fp: number; prmr: number; hours: number }> = {};
  const weeklyBuckets: Record<string, any> = {};
  const monthlyBuckets: Record<string, any> = {};

  for (const e of entries) {
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
    if (e.work_start_time && e.work_end_time) {
      const hrs = (new Date(e.work_end_time).getTime() - new Date(e.work_start_time).getTime()) / 3600000;
      if (hrs > 0 && hrs < 18) dowStats[dow].hours += hrs;
    }

    // Weekly bucket
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

  // Sales log time-of-day analysis + per-customer breakdown
  const salesByHour: Record<number, number> = {};
  let totalFpSales = 0;
  let totalUpgradeSales = 0;
  
  // Customer-level detail
  interface CustomerDetail {
    date: string;
    type: string;
    prmr: number;
    status: string;
    hour: number | null;
    customerName?: string;
  }
  const allSales: CustomerDetail[] = [];
  
  for (const e of entries) {
    if (e.sales_log && Array.isArray(e.sales_log)) {
      const entryTz = e.timezone || rep?.timezone || null;
      for (const sale of e.sales_log) {
        const status = typeof sale.install_status === 'string' ? sale.install_status.toLowerCase().trim() : '';
        if (status === 'cancelled' || status === 'canceled' || status === 'never_installed') continue;

        if (sale.type === 'fp') totalFpSales++;
        else if (sale.type === 'upgrade') totalUpgradeSales++;

        const ts = sale.timestamp || sale.created_at;
        let hour: number | null = null;
        if (ts) {
          hour = getLocalHour(ts, entryTz);
          salesByHour[hour] = (salesByHour[hour] || 0) + 1;
        }
        
        allSales.push({
          date: e.entry_date,
          type: sale.type || 'fp',
          prmr: sale.prmr || 0,
          status: sale.install_status || 'unknown',
          hour,
          customerName: sale.customer_name || sale.name || undefined,
        });
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
  const totalUpgradePRMR = entries.reduce((s, e) => s + (e.upgrade_prmr || 0), 0);
  const totalEfp = efpFromPrmr(totalPRMR);
  const primaryMetric = efpModeEnabled ? "EFP" : "FP+";
  const primaryValue = efpModeEnabled ? totalEfp : totalFP;

  // Total hours
  let totalHours = 0;
  for (const e of entries) {
    if (e.work_start_time && e.work_end_time) {
      const hrs = (new Date(e.work_end_time).getTime() - new Date(e.work_start_time).getTime()) / 3600000;
      if (hrs > 0 && hrs < 18) totalHours += hrs;
    }
  }

  // --- Goals section ---
  let goalsSection = "";
  if (repGoals) {
    const g = repGoals;
    const goalLines: string[] = [];
    if (g.preseason_fp_goal) goalLines.push(`Preseason ${primaryMetric} goal: ${g.preseason_fp_goal}`);
    if (g.must_do_fp_goal) goalLines.push(`Must-do ${primaryMetric} goal: ${g.must_do_fp_goal}`);
    if (g.will_do_fp_goal) goalLines.push(`Will-do ${primaryMetric} goal: ${g.will_do_fp_goal}`);
    if (g.could_do_fp_goal) goalLines.push(`Could-do ${primaryMetric} goal: ${g.could_do_fp_goal}`);
    if (g.upgrade_fp_goal) goalLines.push(`Upgrade FP goal: ${g.upgrade_fp_goal}`);
    if (g.focus_tier) goalLines.push(`Focus tier: ${g.focus_tier}`);
    if (g.weeks_working) goalLines.push(`Planned weeks working: ${g.weeks_working}`);
    if (g.months_off) goalLines.push(`Months off (not selling): ${g.months_off}`);
    if (g.monthly_expenses) goalLines.push(`Monthly expenses: $${g.monthly_expenses}`);
    if (g.rent_type) goalLines.push(`Housing type: ${g.rent_type}`);
    if (g.cancel_rate) goalLines.push(`Expected cancel rate: ${g.cancel_rate}%`);
    if (g.avg_prmr_per_fp) goalLines.push(`Target avg PRMR/FP: $${g.avg_prmr_per_fp}`);
    if (g.custom_fp_pace) goalLines.push(`Custom daily FP pace: ${g.custom_fp_pace}`);
    if (g.purpose_statement) goalLines.push(`Purpose statement: "${g.purpose_statement}"`);
    if (goalLines.length > 0) {
      goalsSection = `### Goals & Plan\n${goalLines.join("\n")}`;
    }
  }

  // --- Planned days & pace ---
  const today = new Date().toISOString().slice(0, 10);
  const futurePlannedDays = plannedDays.filter(d => d >= today);
  const pastPlannedDays = plannedDays.filter(d => d < today);
  
  let paceSection = "";
  if (futurePlannedDays.length > 0 || pastPlannedDays.length > 0) {
    const lines: string[] = [];
    lines.push(`Total planned days (entire season): ${plannedDays.length}`);
    lines.push(`Planned days remaining: ${futurePlannedDays.length}`);
    lines.push(`Planned days already past: ${pastPlannedDays.length}`);
    
    // Calculate pace
    const willDoGoal = repGoals?.will_do_fp_goal || repGoals?.must_do_fp_goal || 0;
    if (willDoGoal > 0 && futurePlannedDays.length > 0) {
      const remaining = willDoGoal - primaryValue;
      const neededPerDay = remaining / futurePlannedDays.length;
      lines.push(`${primaryMetric} remaining to will-do goal: ${remaining.toFixed(2)}`);
      lines.push(`Needed ${primaryMetric}/day to hit will-do: ${neededPerDay.toFixed(2)}`);
      if (totalDays > 0) {
        const currentPace = primaryValue / totalDays;
        lines.push(`Current avg ${primaryMetric}/day: ${currentPace.toFixed(2)}`);
        const projectedTotal = currentPace * (totalDays + futurePlannedDays.length);
        lines.push(`Projected season total at current pace: ${projectedTotal.toFixed(2)} ${primaryMetric}`);
      }
    }
    paceSection = `### Pace & Planned Days\n${lines.join("\n")}`;
  }

  // --- Season config ---
  let scheduleSection = "";
  if (seasonConfig) {
    const lines: string[] = [];
    if (seasonConfig.personal_summer_start) lines.push(`Personal summer start: ${seasonConfig.personal_summer_start}`);
    if (seasonConfig.personal_summer_end) lines.push(`Personal summer end: ${seasonConfig.personal_summer_end}`);
    if (seasonConfig.excluded_summer_days?.length) lines.push(`Excluded summer days: ${seasonConfig.excluded_summer_days.length} days off`);
    if (lines.length > 0) {
      scheduleSection = `### Season Schedule\n${lines.join("\n")}`;
    }
  }

  // Official totals from past seasons
  const pastSeasons = officialTotals.length > 0
    ? `### Past Season Totals\n${officialTotals.map(o => `  ${o.season_type} ${o.season_year}: FP=${o.fp_plus ?? o.fp_sold ?? "?"}, PRMR=${o.prmr ?? "?"}, Days=${o.knocking_days ?? "?"}`).join("\n")}`
    : "";

  // Weekly summary (last 6 weeks)
  const sortedWeeks = Object.entries(weeklyBuckets).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  const weeklySummary = sortedWeeks.map(([wk, d]) => {
    const metricVal = efpModeEnabled ? efpFromPrmr(d.prmr).toFixed(2) : d.fp.toFixed(1);
    return `  Week of ${wk}: ${d.days} days, ${d.doors} doors, ${d.closes} closes, ${metricVal} ${primaryMetric}, $${d.prmr.toFixed(0)} PRMR`;
  }).join("\n");

  // Monthly summary
  const monthlySummary = Object.entries(monthlyBuckets).sort((a, b) => b[0].localeCompare(a[0])).map(([mo, d]) => {
    const metricVal = efpModeEnabled ? efpFromPrmr(d.prmr).toFixed(2) : d.fp.toFixed(1);
    return `  ${mo}: ${d.days} days, ${d.doors} doors, ${d.closes} closes, ${metricVal} ${primaryMetric}, $${d.prmr.toFixed(0)} PRMR`;
  }).join("\n");

  // Day of week summary
  const dowSummary = Object.entries(dowStats).map(([dow, d]) => {
    const avgMetric = efpModeEnabled ? efpFromPrmr(d.prmr / d.days).toFixed(2) : (d.fp / d.days).toFixed(2);
    const avgHrs = d.hours > 0 ? (d.hours / d.days).toFixed(1) : "?";
    return `  ${dow}: ${d.days} days, avg ${(d.doors / d.days).toFixed(0)} doors, avg ${avgMetric} ${primaryMetric}, avg ${avgHrs}h, avg $${(d.prmr / d.days).toFixed(0)} PRMR`;
  }).join("\n");

  // Time of day
  const timeSummary = Object.entries(salesByHour).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 8)
    .map(([h, c]) => {
      const hr = Number(h);
      const display = hr === 0 ? "12am" : hr < 12 ? `${hr}am` : hr === 12 ? "12pm" : `${hr - 12}pm`;
      return `  ${display}: ${c} sales`;
    })
    .join("\n");

  // Per-sale detail — include ALL sales so the AI can answer any customer-specific question
  let salesDetailSection = "";
  if (allSales.length > 0) {
    const salesLines = allSales.map(s => {
      const hourStr = s.hour !== null ? `${s.hour > 12 ? s.hour - 12 : s.hour}${s.hour >= 12 ? 'pm' : 'am'}` : '?';
      const nameStr = s.customerName ? ` "${s.customerName}"` : '';
      const acctStr = s.accountNumber ? ` acct#${s.accountNumber}` : '';
      const ttsStr = s.timeToSell ? ` ${s.timeToSell}min` : '';
      const spentStr = s.moneySpent ? ` $${s.moneySpent}spent` : '';
      return `  ${s.date} ${hourStr}: ${s.type} $${s.prmr.toFixed(0)} PRMR [${s.status}]${nameStr}${acctStr}${ttsStr}${spentStr}`;
    }).join("\n");
    salesDetailSection = `### All Sales (${allSales.length} total)\n${salesLines}`;
  }

  // Upgrade analysis
  let upgradeSection = "";
  const upgradeSales = allSales.filter(s => s.type === 'upgrade');
  if (upgradeSales.length > 0) {
    const avgUpgradePrmr = upgradeSales.reduce((s, u) => s + u.prmr, 0) / upgradeSales.length;
    const upgradesByHour: Record<number, number> = {};
    for (const u of upgradeSales) {
      if (u.hour !== null) upgradesByHour[u.hour] = (upgradesByHour[u.hour] || 0) + 1;
    }
    const bestUpgradeHours = Object.entries(upgradesByHour).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 3)
      .map(([h, c]) => { const hr = Number(h); return `${hr > 12 ? hr - 12 : hr}${hr >= 12 ? 'pm' : 'am'} (${c})`; }).join(", ");
    upgradeSection = `### Upgrade Analysis\n  Total upgrades: ${upgradeSales.length}\n  Total upgrade PRMR: $${totalUpgradePRMR.toFixed(0)}\n  Avg upgrade PRMR: $${avgUpgradePrmr.toFixed(0)}\n  Best hours for upgrades: ${bestUpgradeHours || "N/A"}`;
  }

  return `You are an AI sales coach for Vivint SmartHome door-to-door reps. You're chatting with ${name}, a ${year} rep.

## YOUR VIBE
- Be clear, direct, and encouraging. Sound like a sharp, professional coach — not a hype man, not a buddy, not overly casual.
- No slang like "bro," "dude," "fire," "killing it," etc. Keep it professional but warm.
- Keep it SHORT and to the point. No walls of text. No corporate jargon either.
- When numbers are strong, acknowledge it simply: "Strong week" or "That's solid." When they're not, be constructive: "There's room to improve here" — never negative, never fake-hype.
- Use "you" and "your" — make it personal and direct.
- The goal is to EMPOWER the rep — help them walk into their next 1-on-1 with their leader armed with clear insights. You're not replacing their leader, you're helping the rep show up prepared.
- If something looks off, frame it as an opportunity: "There might be some easy wins in your [X]" — straightforward, not sugarcoated.
- Use emoji sparingly — one or two max per response, only when it genuinely adds something.
- Keep responses under 150 words unless they specifically ask for a deep dive.
- ONLY use the actual data below. Never make up numbers. If you don't have data for something, just say so.

## IMPORTANT: METRIC PREFERENCE
${efpModeEnabled
  ? `This rep uses **EFP mode** (Effective Families Protected = Total PRMR / 85). When they ask about "sales", "production", or "how many did I sell", answer in **EFP** (not raw sale count or FP+). Always say "EFP" not "sales" or "FP+". Their current EFP is ${totalEfp.toFixed(2)}.`
  : `This rep tracks **FP+** (Families Protected Plus). When they ask about "sales", "production", or "how many did I sell", answer in **FP+** (not raw sale count). FP+ counts new installs as 1 each, plus upgrade PRMR/85 for upgrades. Always say "FP+" not "sales". Their current FP+ is ${totalFP.toFixed(2)}.`
}
- There are two types of sales: "fp" (new installs, count as 1 FP+ each) and "upgrade" (count as PRMR/85 toward FP+). This rep has ${totalFpSales} new install sales and ${totalUpgradeSales} upgrade sales.
- When discussing time-of-day patterns, the "Best Selling Hours" data below is already in the rep's LOCAL timezone. Do NOT adjust or convert it.
- You have access to individual sale details including PRMR, type, time, and status. Use this to answer questions about ROI, best/worst deals, upgrade timing, etc.

## VIVINT D2D BASICS
- Product: Home security, cameras, smart home (doorbell cams, smart locks, thermostats, etc.)
- Schedule: Mon-Fri noon to 8-9pm, Sat 9-10am to 8-9pm. Sunday off.
- 2026 Season: Sept 29, 2025 – Sept 27, 2026. Preseason: Sept 29 – Apr 12. Summer: Apr 13 – Aug 30. Extension: Aug 31 – Sept 27.
- Season goals: Rookie 100+ FP, Soph 200+ FP, Vet 300+ FP. These are hard to hit — celebrate progress.
- A Rookie is someone who didn't sell 10+ FPs in a prior season.
- FP+ = Funded new installs + (Funded Upgrade PRMR / 85) + (DTH leads closed by NIS × 0.5 if consent given). Upgrades/upsells only count if sold 90+ days after initial activation.
- EFP = Effective Families Protected = Total PRMR / 85. NOT "Earned FP."
- PRMR = Planned Monthly Recurring Revenue = Customer Monthly Payment − Exclusions + PRMR Adders − PRMR Reductions.
- Company avg PRMR is $85/account. Higher PRMR = more money per deal.
- Funnel: Doors → DMs → Pitches → Transitions (inside home) → Presentations (full demo) → Closes (signed)
- Sales: "installed" = funded, "pending" = scheduled, "cancelled"/"never_installed" = doesn't count
- Great close rate: 1 per 25-35 doors. Solid day: 80-120+ doors, 2-4+ closes.

## 2026 PAY SCALE (per FP+ level reached)
| Level | Base Rate | Total Commission/FP |
|-------|-----------|---------------------|
| 0     | $5.76     | $490                |
| 20    | $6.41     | $545                |
| 40    | $6.88     | $585                |
| 60    | $7.41     | $630                |
| 80    | $7.88     | $670                |
| 100   | $8.47     | $720                |
| 120   | $8.71     | $740                |
| 140   | $8.94     | $760                |
| 160   | $9.18     | $780                |
| 200   | $9.65     | $820                |
| 220   | $9.88     | $840                |
| 240   | $10.12    | $860                |
| 260   | $10.35    | $880                |
| 300   | $10.59    | $900                |

- Reps are paid $4/dollar of funded PRMR upfront. Remaining commission reconciled on backend.
- Must complete summer season to earn accelerated rate above $4.
- Rent bonus kicks in at 60 FP+ ($3,750), increases at 200 FP+ ($5,500).

## PRMR ADDERS
- $1,799.99 Premium Kit: +$2 PRMR
- Financed Install Fee: $199 → +$3.32, $299 → +$4.98, $399 → +$6.65
- Upfront Install Fee: $199 → +$3.32, $299 → +$4.98, $399 → +$6.65
- Upfront Payment: $200-499 → +$5, $500-999 → +$10, $1K-2K → +$15, $2K-3K → +$20, $3K-4K → +$25, $4K+ → +$30
- Protection Plan: VPP ($7.99) → +$5, VPP Mobile ($27.99) → +$10, VPP Mobile+ ($32.99) → +$12
- Install fee can be waived without deduction on: PIF accounts, upfront payment ≥$250, 36-mo loans, Pay-in-Four.

## PRMR REDUCTIONS
- Non-premium kit (<$1,799.99): −$5 PRMR (exceptions: DIY, PIF, APR>0%, credit limit <$4K, $3K+ equipment)
- Low RMR discount: −$2 per dollar discounted below floor ($24.99 premium, $44.99 non-premium)
- Deduction accounts (credit <650, Smart Start/DIY): −$20 PRMR
- 3rd Look financing: −$35 PRMR (requires 25% down, min $250)
- Hardware discounts: discount amount / 15 = PRMR reduction
- Moves (before 2nd backend): −$35 PRMR (Smart Start/DIY excluded)
- NIS leads closed by DTH: −$10 PRMR
- Home Protect new subs: −$5 additional (−$10 total)

## UPGRADES
- Commission = rate × (Upgrade PRMR / 85)
- Upgrade PRMR = New RMR − Base Service Fee
- Base Service Fee (Legacy) = max(old RMR × 75%, $44.99)
- Addon upgrades (no new agreement): (equipment / 60) + camera service fees = PRMR. Only counts toward FP+ if 90+ days after original install.

## HOUSING (Summer)
- Shared room: $200/wk + $35 utilities
- Own room: $375/wk + $45 utilities
- Married/family 1BR: $400/wk, 2BR: $425/wk, 3BR: $450/wk + $50 utilities
- One-time cleaning: $75 (single) or $125 (family)

## OTHER KEY RULES
- Contract buyouts: rep covers 100% over $1,000. Buyout PRMR reductions based on discount tier.
- Waived first month service: rep charged full cost unless PIF >600 credit or upfront ≥$800.
- Customer gift cards: up to $300, rep charged 100%.
- RIC (Retail Installment Contract): no upfront pay, commissions paid residually after Jan/Feb backend.
- Rep Assist: rookie gets $4/PRMR upfront but account doesn't count toward their level; assisting rep gets level credit + full backend minus $4/PRMR.
- Backend timing: 1st backend by Nov 30 (70% of deposit). 2nd backend by Feb 28 (100%).

## ${name.toUpperCase()}'S NUMBERS

### Overview
- Year: ${year} | Days worked: ${totalDays} | Total hours: ${totalHours.toFixed(1)}
- Doors: ${totalDoors} | DMs: ${totalDM} | Pitches: ${totalPitches}
- Transitions: ${totalTransitions} | Presentations: ${totalPresentations} | Closes: ${totalCloses}
- ${primaryMetric}: ${primaryValue.toFixed(2)} | PRMR: $${totalPRMR.toFixed(0)}${efpModeEnabled ? `` : ` | EFP: ${totalEfp.toFixed(2)}`}
- Upgrade PRMR: $${totalUpgradePRMR.toFixed(0)}
- Avg PRMR/close: $${totalCloses > 0 ? (totalPRMR / totalCloses).toFixed(0) : "N/A"}
- Doors/day: ${totalDays > 0 ? (totalDoors / totalDays).toFixed(0) : "N/A"} | ${primaryMetric}/day: ${totalDays > 0 ? (primaryValue / totalDays).toFixed(2) : "N/A"}
- Avg hours/day: ${totalDays > 0 ? (totalHours / totalDays).toFixed(1) : "N/A"}

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

${goalsSection}

${paceSection}

${scheduleSection}

${pastSeasons}

${upgradeSection}

${salesDetailSection}

## KEY RULES
- Reference real numbers. Bold the key ones with **markdown**.
- When comparing periods, show both numbers side by side.
- For pacing: use the Pace & Planned Days data above. Calculate based on remaining planned days and current rate.
- When asked about goals, reference their specific must-do/will-do/could-do goals.
- When asked about specific customers or sales, use the Recent Sales data.
- When asked about upgrade strategy or timing, use the Upgrade Analysis data.
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

    const { messages, stream = true } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (typeof stream !== "boolean") {
      return new Response(JSON.stringify({ error: "stream must be a boolean" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch user data in parallel using service role for full access
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [repResult, entriesResult, officialsResult, repGoalsResult, plannedDaysResult, seasonConfigResult] = await Promise.all([
      serviceClient.from("reps").select("name, year, email, stage, efp_mode_enabled, timezone").eq("user_id", userId).maybeSingle(),
      serviceClient.from("daily_entries").select("entry_date, doors_knocked, decision_makers, pitches, transitions, presentations, closes, fp_plus, prmr, upgrade_prmr, work_start_time, work_end_time, sales_log, is_finalized, counter_timestamps, timezone").eq("user_id", userId).order("entry_date", { ascending: true }),
      serviceClient.from("official_totals").select("season_type, season_year, fp_plus, fp_sold, prmr, knocking_days").eq("user_id", userId).order("season_year", { ascending: false }),
      serviceClient.from("rep_goals").select("*").eq("user_id", userId).maybeSingle(),
      serviceClient.from("planned_work_days").select("planned_date").eq("user_id", userId).order("planned_date", { ascending: true }),
      serviceClient.from("season_config").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    const rep = repResult.data;
    const entries = (entriesResult.data || []).filter((e: any) => e.is_finalized || (e.doors_knocked && e.doors_knocked > 0));
    const officials = officialsResult.data || [];
    const repGoals = repGoalsResult.data;
    const plannedDays = (plannedDaysResult.data || []).map((d: any) => d.planned_date);
    const seasonConfig = seasonConfigResult.data;

    const systemPrompt = buildSystemPrompt(rep, entries, officials, repGoals, plannedDays, seasonConfig);

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
    console.error("insights-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
