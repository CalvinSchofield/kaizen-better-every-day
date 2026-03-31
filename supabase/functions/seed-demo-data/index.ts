import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Demo date - Sunday Feb 1, 2026
const DEMO_DATE = "2026-02-01";
const TIMEZONE = "America/Denver";

// Your user ID (Calvin Schofield - excluded from data generation)
const YOUR_USER_ID = "843dac61-139d-4511-a057-c3bf359a9c07";

// Target reps for demo data (23 total)
const DEMO_REPS = {
  // Rookies (Sold/Sold 5+) - 8 total
  rookies: [
    { userId: "c8055f1f-1871-4995-82ae-8f44289b356d", name: "Bryson Bradshaw" },
    { userId: "a79bcce8-0bd7-4812-9a2c-1ac96cf2fcd5", name: "Izaiah Martinez" },
    { userId: "3ab2ef67-df50-436d-a7b9-8e179b84307f", name: "Jackson Jennings" },
    { userId: "8ea77d54-223e-490d-b720-5a5c18667315", name: "Jay Tingey" },
    { userId: "5076efe0-a115-440f-92fa-93f4f819519d", name: "JP Perales" },
    { userId: "8efaac75-4e91-4989-9ce5-6da02ce462b5", name: "Noah Delgado" },
    { userId: "67c22aa0-2cdd-4636-a15d-1425910ed042", name: "Trevor Allan" },
    { userId: "d37d3df9-5657-4a7d-8ac3-742ab07f3fac", name: "Weston" },
  ],
  // Sophomores - 11 total (including Johnny Gadasay)
  sophomores: [
    { userId: "dde01bfc-6f28-4ef3-914f-dd2602b61e7e", name: "Abi Cunningham" },
    { userId: "4180229c-27e4-4a0a-9f45-b3a399950dd6", name: "Ammon Allan" },
    { userId: "a848bd1a-886c-4ea6-b093-060117a89dd3", name: "Ansel Severson" },
    { userId: "b38b47e4-af04-4c4f-9c0c-d7b2f81964fa", name: "Austin Clayton" },
    { userId: "393c450a-2241-4d03-91a7-f046d8019ec1", name: "Christian Fabian" },
    { userId: "68f129d0-fd1b-4154-8ab5-74bdc7ef6388", name: "Ephraim Wilde" },
    { userId: "bcf3761d-9d3c-4d59-9175-7232a4084187", name: "Jack Mair" },
    { userId: "1123659a-5e6c-4a07-bf2d-3ada4237b5da", name: "Javier Estrada" },
    { userId: "37a5b01f-ad30-4ce7-b350-286d314aac21", name: "Johnny Gadasay" }, // Correct user_id
    { userId: "a9f5a317-e9cd-433a-bd93-e7c413ba5cc6", name: "Jose Pineda" },
    { userId: "ae5e1425-6b6b-4f6b-9ef4-af8289e84efa", name: "RJ Ashton" },
  ],
  // Vets (excluding Calvin) - 4 total
  vets: [
    { userId: "1712a7f8-0b37-4095-916c-67e03ce169df", name: "Adam Schofield" },
    { userId: "fc0a08d5-14bb-4690-96d6-2e48d0645de9", name: "Calder Severson" },
    { userId: "373d13e3-24ea-49b8-8327-13cedae789d0", name: "Misael Sanchez" },
    { userId: "69c2fc5c-f6c0-4926-9d73-e5db117cd5ce", name: "Quinn Gleed" },
  ],
};

// Bell curve distribution with specific PRMR requirements
// Highest FP PRMR: $192, Lowest FP PRMR: $56
// Highest upgrade PRMR: $81, Lowest upgrade PRMR: $24
const PREDEFINED_STATS: Record<string, {
  doors: number;
  fpPlus: number;
  prmr: number;
  upgradePrmr: number; // Separate upgrade PRMR tracking
  decisionMakers: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
}> = {
  // STARS (Top 3)
  "Calder Severson": { doors: 78, fpPlus: 4.0, prmr: 192, upgradePrmr: 0, decisionMakers: 24, pitches: 20, transitions: 11, presentations: 7, closes: 4 },
  "Ammon Allan": { doors: 72, fpPlus: 3.4, prmr: 175, upgradePrmr: 0, decisionMakers: 22, pitches: 18, transitions: 10, presentations: 6, closes: 4 },
  "Bryson Bradshaw": { doors: 65, fpPlus: 3.2, prmr: 165, upgradePrmr: 0, decisionMakers: 20, pitches: 16, transitions: 9, presentations: 5, closes: 4 },

  // MID-HIGH PERFORMERS
  "Adam Schofield": { doors: 70, fpPlus: 2.8, prmr: 145, upgradePrmr: 0, decisionMakers: 21, pitches: 17, transitions: 9, presentations: 5, closes: 3 },
  "Quinn Gleed": { doors: 68, fpPlus: 2.2, prmr: 115, upgradePrmr: 0, decisionMakers: 20, pitches: 16, transitions: 8, presentations: 4, closes: 3 },
  "Noah Delgado": { doors: 58, fpPlus: 2.0, prmr: 105, upgradePrmr: 0, decisionMakers: 18, pitches: 14, transitions: 7, presentations: 4, closes: 2 },

  // MID PERFORMERS
  "Misael Sanchez": { doors: 60, fpPlus: 1.8, prmr: 0, upgradePrmr: 81, decisionMakers: 17, pitches: 13, transitions: 6, presentations: 3, closes: 2 }, // Highest upgrade PRMR, 6 transitions for 1v1
  "Weston": { doors: 55, fpPlus: 1.5, prmr: 78, upgradePrmr: 0, decisionMakers: 16, pitches: 12, transitions: 6, presentations: 3, closes: 2 },
  "Trevor Allan": { doors: 52, fpPlus: 1.2, prmr: 65, upgradePrmr: 0, decisionMakers: 15, pitches: 11, transitions: 5, presentations: 3, closes: 2 },
  "Jay Tingey": { doors: 48, fpPlus: 1.0, prmr: 56, upgradePrmr: 0, decisionMakers: 14, pitches: 10, transitions: 5, presentations: 2, closes: 1 },
  "Ansel Severson": { doors: 50, fpPlus: 0.8, prmr: 56, upgradePrmr: 0, decisionMakers: 15, pitches: 11, transitions: 5, presentations: 2, closes: 1 }, // Lowest FP PRMR

  // LOWER PRODUCTION
  "Izaiah Martinez": { doors: 52, fpPlus: 0.6, prmr: 45, upgradePrmr: 0, decisionMakers: 14, pitches: 10, transitions: 4, presentations: 2, closes: 1 },
  "JP Perales": { doors: 45, fpPlus: 0.5, prmr: 38, upgradePrmr: 0, decisionMakers: 12, pitches: 9, transitions: 4, presentations: 2, closes: 1 },
  "Jack Mair": { doors: 48, fpPlus: 0.4, prmr: 32, upgradePrmr: 0, decisionMakers: 13, pitches: 9, transitions: 4, presentations: 2, closes: 1 },
  "Abi Cunningham": { doors: 50, fpPlus: 0.3, prmr: 0, upgradePrmr: 24, decisionMakers: 14, pitches: 10, transitions: 4, presentations: 1, closes: 1 }, // Lowest upgrade PRMR
  "Johnny Gadasay": { doors: 42, fpPlus: 0.3, prmr: 28, upgradePrmr: 0, decisionMakers: 11, pitches: 8, transitions: 3, presentations: 1, closes: 1 },
  "RJ Ashton": { doors: 46, fpPlus: 0.2, prmr: 18, upgradePrmr: 0, decisionMakers: 12, pitches: 8, transitions: 3, presentations: 1, closes: 1 },
  "Jose Pineda": { doors: 40, fpPlus: 0.1, prmr: 12, upgradePrmr: 0, decisionMakers: 10, pitches: 7, transitions: 3, presentations: 1, closes: 0 },
  "Jackson Jennings": { doors: 55, fpPlus: 0, prmr: 0, upgradePrmr: 0, decisionMakers: 16, pitches: 12, transitions: 3, presentations: 0, closes: 0 }, // 3 transitions for 1v1 vs Misael's 6

  // ZERO SALES (Grinding Hard)
  "Austin Clayton": { doors: 65, fpPlus: 0, prmr: 0, upgradePrmr: 0, decisionMakers: 18, pitches: 14, transitions: 6, presentations: 0, closes: 0 },
  "Christian Fabian": { doors: 58, fpPlus: 0, prmr: 0, upgradePrmr: 0, decisionMakers: 16, pitches: 12, transitions: 5, presentations: 0, closes: 0 },
  "Ephraim Wilde": { doors: 52, fpPlus: 0, prmr: 0, upgradePrmr: 0, decisionMakers: 14, pitches: 10, transitions: 4, presentations: 0, closes: 0 },
  "Javier Estrada": { doors: 48, fpPlus: 0, prmr: 0, upgradePrmr: 0, decisionMakers: 13, pitches: 9, transitions: 3, presentations: 0, closes: 0 },
};

// Team Red (12 members - WINNING with ~20.1 FP+)
const TEAM_RED = [
  "fc0a08d5-14bb-4690-96d6-2e48d0645de9", // Calder Severson (4.0) - Captain
  "4180229c-27e4-4a0a-9f45-b3a399950dd6", // Ammon Allan (3.4)
  "c8055f1f-1871-4995-82ae-8f44289b356d", // Bryson Bradshaw (3.2)
  "1712a7f8-0b37-4095-916c-67e03ce169df", // Adam Schofield (2.8)
  "8efaac75-4e91-4989-9ce5-6da02ce462b5", // Noah Delgado (2.0)
  "d37d3df9-5657-4a7d-8ac3-742ab07f3fac", // Weston (1.5)
  "8ea77d54-223e-490d-b720-5a5c18667315", // Jay Tingey (1.0)
  "a848bd1a-886c-4ea6-b093-060117a89dd3", // Ansel Severson (0.8)
  "a79bcce8-0bd7-4812-9a2c-1ac96cf2fcd5", // Izaiah Martinez (0.6)
  "5076efe0-a115-440f-92fa-93f4f819519d", // JP Perales (0.5)
  "37a5b01f-ad30-4ce7-b350-286d314aac21", // Johnny Gadasay (0.3)
  "b38b47e4-af04-4c4f-9c0c-d7b2f81964fa", // Austin Clayton (0)
];

// Team Blue (11 members - ~6.2 FP+)
const TEAM_BLUE = [
  "69c2fc5c-f6c0-4926-9d73-e5db117cd5ce", // Quinn Gleed (2.2) - Captain
  "373d13e3-24ea-49b8-8327-13cedae789d0", // Misael Sanchez (1.8)
  "67c22aa0-2cdd-4636-a15d-1425910ed042", // Trevor Allan (1.2)
  "bcf3761d-9d3c-4d59-9175-7232a4084187", // Jack Mair (0.4)
  "dde01bfc-6f28-4ef3-914f-dd2602b61e7e", // Abi Cunningham (0.3)
  "ae5e1425-6b6b-4f6b-9ef4-af8289e84efa", // RJ Ashton (0.2)
  "a9f5a317-e9cd-433a-bd93-e7c413ba5cc6", // Jose Pineda (0.1)
  "3ab2ef67-df50-436d-a7b9-8e179b84307f", // Jackson Jennings (0)
  "393c450a-2241-4d03-91a7-f046d8019ec1", // Christian Fabian (0)
  "68f129d0-fd1b-4154-8ab5-74bdc7ef6388", // Ephraim Wilde (0)
  "1123659a-5e6c-4a07-bf2d-3ada4237b5da", // Javier Estrada (0)
];

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateWorkStartTime(): string {
  // Between 9:15 AM and 9:45 AM Mountain Time (around 9:30)
  const minute = randomInt(15, 45);
  return `${DEMO_DATE}T09:${String(minute).padStart(2, "0")}:00-07:00`;
}

function generateWorkEndTime(): string {
  // Latest activity around 8:15 PM (some variation)
  const hour = 20;
  const minute = randomInt(0, 30); // 8:00 - 8:30 PM
  return `${DEMO_DATE}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-07:00`;
}

function generateSalesLog(fpPlus: number, prmr: number, upgradePrmr: number): object[] {
  const sales = [];
  
  if (fpPlus === 0 && prmr === 0 && upgradePrmr === 0) return [];
  
  // Handle FP sales
  if (prmr > 0) {
    const numFpSales = Math.ceil(fpPlus > 0 ? fpPlus : 0);
    const avgPrmrPerSale = numFpSales > 0 ? prmr / numFpSales : 0;
    
    for (let i = 0; i < numFpSales; i++) {
      const hour = randomInt(10, 19);
      const minute = randomInt(0, 59);
      const timestamp = `${DEMO_DATE}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-07:00`;
      const salePrmr = Math.round(avgPrmrPerSale * (0.8 + Math.random() * 0.4));
      const isPartial = i === numFpSales - 1 && fpPlus % 1 !== 0;
      
      sales.push({
        id: `demo-sale-${generateUUID()}`,
        type: "fp",
        prmr: salePrmr,
        timestamp,
        install_status: "installed",
        installed_same_day: Math.random() > 0.3,
        fp_value: isPartial ? fpPlus % 1 : 1,
      });
    }
  }
  
  // Handle upgrade sales
  if (upgradePrmr > 0) {
    const hour = randomInt(10, 19);
    const minute = randomInt(0, 59);
    const timestamp = `${DEMO_DATE}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-07:00`;
    
    sales.push({
      id: `demo-sale-${generateUUID()}`,
      type: "upgrade",
      prmr: upgradePrmr,
      timestamp,
      install_status: "installed",
      installed_same_day: true,
    });
  }
  
  return sales;
}

// Generate realistic "interaction clusters" where events happen in sequence
function generateRealisticTimestamps(stats: typeof PREDEFINED_STATS["Calder Severson"]): object {
  const timestamps: Record<string, string[]> = {
    doors_knocked: [],
    decision_makers: [],
    pitches: [],
    transitions: [],
    presentations: [],
    closes: [],
  };
  
  // Work day: 9:30 AM to 8:15 PM 
  const workStartMinutes = 9 * 60 + 30;
  const workEndMinutes = 20 * 60 + 15; // 8:15 PM
  const totalWorkMinutes = workEndMinutes - workStartMinutes;
  
  const totalDoors = stats.doors;
  const avgMinutesBetweenDoors = totalWorkMinutes / totalDoors;
  
  const dmRate = stats.decisionMakers / stats.doors;
  const pitchRate = stats.pitches / stats.doors;
  const transitionRate = stats.transitions / stats.doors;
  const presentationRate = stats.presentations / stats.doors;
  const closeRate = stats.closes / stats.doors;
  
  let currentMinute = workStartMinutes + randomInt(0, 15);
  
  for (let doorIdx = 0; doorIdx < totalDoors; doorIdx++) {
    const doorHour = Math.floor(currentMinute / 60);
    const doorMin = currentMinute % 60;
    const doorSecond = randomInt(0, 59);
    const doorTimestamp = `${DEMO_DATE}T${String(doorHour).padStart(2, "0")}:${String(doorMin).padStart(2, "0")}:${String(doorSecond).padStart(2, "0")}-07:00`;
    timestamps.doors_knocked.push(doorTimestamp);
    
    const rand = Math.random();
    let interactionDuration = 0;
    
    if (rand < dmRate) {
      const dmOffset = randomInt(10, 60);
      const dmMinute = currentMinute + Math.floor(dmOffset / 60);
      const dmSecond = doorSecond + (dmOffset % 60);
      const actualDmMinute = dmMinute + Math.floor(dmSecond / 60);
      const actualDmSecond = dmSecond % 60;
      const dmHour = Math.floor(actualDmMinute / 60);
      const dmMin = actualDmMinute % 60;
      timestamps.decision_makers.push(
        `${DEMO_DATE}T${String(dmHour).padStart(2, "0")}:${String(dmMin).padStart(2, "0")}:${String(actualDmSecond).padStart(2, "0")}-07:00`
      );
      interactionDuration = 1;
      
      if (rand < pitchRate) {
        const pitchOffset = randomInt(30, 90);
        const pitchTotalSeconds = dmOffset + pitchOffset;
        const pitchMinute = currentMinute + Math.floor(pitchTotalSeconds / 60);
        const pitchSecond = (doorSecond + pitchTotalSeconds) % 60;
        const pitchHour = Math.floor(pitchMinute / 60);
        const pitchMin = pitchMinute % 60;
        timestamps.pitches.push(
          `${DEMO_DATE}T${String(pitchHour).padStart(2, "0")}:${String(pitchMin).padStart(2, "0")}:${String(pitchSecond).padStart(2, "0")}-07:00`
        );
        interactionDuration = 2;
        
        if (rand < transitionRate) {
          const transitionOffset = randomInt(2 * 60, 5 * 60);
          const transitionTotalSeconds = pitchTotalSeconds + transitionOffset;
          const transitionMinute = currentMinute + Math.floor(transitionTotalSeconds / 60);
          const transitionSecond = (doorSecond + transitionTotalSeconds) % 60;
          const transitionHour = Math.floor(transitionMinute / 60);
          const transitionMin = transitionMinute % 60;
          timestamps.transitions.push(
            `${DEMO_DATE}T${String(transitionHour).padStart(2, "0")}:${String(transitionMin).padStart(2, "0")}:${String(transitionSecond).padStart(2, "0")}-07:00`
          );
          interactionDuration = Math.floor(transitionTotalSeconds / 60);
          
          if (rand < presentationRate) {
            const presentationOffset = randomInt(20 * 60, 60 * 60);
            const presentationTotalSeconds = transitionTotalSeconds + presentationOffset;
            const presentationMinute = currentMinute + Math.floor(presentationTotalSeconds / 60);
            const presentationSecond = (doorSecond + presentationTotalSeconds) % 60;
            const presentationHour = Math.floor(presentationMinute / 60);
            const presentationMin = presentationMinute % 60;
            timestamps.presentations.push(
              `${DEMO_DATE}T${String(presentationHour).padStart(2, "0")}:${String(presentationMin).padStart(2, "0")}:${String(presentationSecond).padStart(2, "0")}-07:00`
            );
            interactionDuration = Math.floor(presentationTotalSeconds / 60);
            
            if (rand < closeRate) {
              const closeOffset = randomInt(5 * 60, 15 * 60);
              const closeTotalSeconds = presentationTotalSeconds + closeOffset;
              const closeMinute = currentMinute + Math.floor(closeTotalSeconds / 60);
              const closeSecond = (doorSecond + closeTotalSeconds) % 60;
              const closeHour = Math.floor(closeMinute / 60);
              const closeMin = closeMinute % 60;
              timestamps.closes.push(
                `${DEMO_DATE}T${String(closeHour).padStart(2, "0")}:${String(closeMin).padStart(2, "0")}:${String(closeSecond).padStart(2, "0")}-07:00`
              );
              interactionDuration = Math.floor(closeTotalSeconds / 60);
            }
          }
        }
      }
    }
    
    const nextDoorDelay = avgMinutesBetweenDoors * (0.5 + Math.random()) + interactionDuration;
    currentMinute += Math.max(1, Math.floor(nextDoorDelay));
    
    if (currentMinute >= workEndMinutes) break;
  }
  
  Object.keys(timestamps).forEach(key => {
    timestamps[key].sort();
  });
  
  return timestamps;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      dailyEntries: 0,
      challenges: 0,
      challengeParticipants: 0,
      incentives: 0,
      incentiveEligibleReps: 0,
      errors: [] as string[],
    };

    // Get all reps to process
    const allReps = [
      ...DEMO_REPS.rookies,
      ...DEMO_REPS.sophomores,
      ...DEMO_REPS.vets,
    ];

    // ============================================
    // PHASE 1: Create Daily Entries
    // ============================================
    console.log("Creating daily entries for 23 reps...");
    
    for (const rep of allReps) {
      const stats = PREDEFINED_STATS[rep.name];
      if (!stats) {
        console.log(`No predefined stats for ${rep.name}, skipping...`);
        continue;
      }

      const totalPrmr = stats.prmr + stats.upgradePrmr;
      const salesLog = generateSalesLog(stats.fpPlus, stats.prmr, stats.upgradePrmr);
      const counterTimestamps = generateRealisticTimestamps(stats);

      const dailyEntry = {
        user_id: rep.userId,
        entry_date: DEMO_DATE,
        doors_knocked: stats.doors,
        decision_makers: stats.decisionMakers,
        pitches: stats.pitches,
        transitions: stats.transitions,
        presentations: stats.presentations,
        closes: stats.closes,
        fp_plus: stats.fpPlus,
        prmr: totalPrmr,
        upgrade_prmr: stats.upgradePrmr,
        work_start_time: generateWorkStartTime(),
        work_end_time: generateWorkEndTime(),
        sales_log: salesLog,
        counter_timestamps: counterTimestamps,
        timezone: TIMEZONE,
        is_finalized: false, // Keep as live/unfinalized for demo
        notes: "DEMO_DATA",
      };

      const { error } = await supabase
        .from("daily_entries")
        .upsert(dailyEntry, { onConflict: "user_id,entry_date" });

      if (error) {
        results.errors.push(`Daily entry for ${rep.name}: ${error.message}`);
      } else {
        results.dailyEntries++;
      }
    }

    // ============================================
    // PHASE 2: Create Team Battle Challenge (Red vs Blue)
    // ============================================
    console.log("Creating team battle challenge (12 vs 11)...");
    
    const teamBattleId = generateUUID();
    const calderUserId = "fc0a08d5-14bb-4690-96d6-2e48d0645de9"; // Team Red Captain
    
    const { error: teamBattleError } = await supabase
      .from("challenges")
      .insert({
        id: teamBattleId,
        type: "group",
        metric: "fp_plus",
        status: "active",
        visibility: "public",
        stakes: "🍗 BBQ at the Apt Sunday",
        start_date: DEMO_DATE,
        end_date: DEMO_DATE,
        created_by: calderUserId,
        creator_timezone: TIMEZONE,
      });

    if (teamBattleError) {
      results.errors.push(`Team battle challenge: ${teamBattleError.message}`);
    } else {
      results.challenges++;

      // Add Team Red participants (team "a")
      for (const userId of TEAM_RED) {
        const isTeamACaptain = userId === calderUserId;
        const { error } = await supabase.from("challenge_participants").insert({
          challenge_id: teamBattleId,
          user_id: userId,
          team: "a",
          role: isTeamACaptain ? "captain_a" : "member",
          accepted: true,
          accepted_at: new Date().toISOString(),
        });
        if (error) {
          results.errors.push(`Team Red participant ${userId}: ${error.message}`);
        } else {
          results.challengeParticipants++;
        }
      }

      // Add Team Blue participants (team "b")
      const quinnUserId = "69c2fc5c-f6c0-4926-9d73-e5db117cd5ce";
      for (const userId of TEAM_BLUE) {
        const isTeamBCaptain = userId === quinnUserId;
        const { error } = await supabase.from("challenge_participants").insert({
          challenge_id: teamBattleId,
          user_id: userId,
          team: "b",
          role: isTeamBCaptain ? "captain_b" : "member",
          accepted: true,
          accepted_at: new Date().toISOString(),
        });
        if (error) {
          results.errors.push(`Team Blue participant ${userId}: ${error.message}`);
        } else {
          results.challengeParticipants++;
        }
      }
    }

    // ============================================
    // PHASE 3: Create 1v1 Ammon vs Adam Challenge (FP+)
    // ============================================
    console.log("Creating 1v1 challenge: Ammon vs Adam...");
    
    const ammonVsAdamId = generateUUID();
    const ammonUserId = "4180229c-27e4-4a0a-9f45-b3a399950dd6";
    const adamUserId = "1712a7f8-0b37-4095-916c-67e03ce169df";
    
    const { error: ammonVsAdamError } = await supabase
      .from("challenges")
      .insert({
        id: ammonVsAdamId,
        type: "1v1",
        metric: "fp_plus",
        status: "active",
        visibility: "public",
        stakes: "Pride",
        start_date: DEMO_DATE,
        end_date: DEMO_DATE,
        created_by: ammonUserId,
        creator_timezone: TIMEZONE,
      });

    if (ammonVsAdamError) {
      results.errors.push(`Ammon vs Adam challenge: ${ammonVsAdamError.message}`);
    } else {
      results.challenges++;

      // Add Ammon as challenger
      const { error: ammonError } = await supabase.from("challenge_participants").insert({
        challenge_id: ammonVsAdamId,
        user_id: ammonUserId,
        role: "captain_a",
        accepted: true,
        accepted_at: new Date().toISOString(),
      });
      if (ammonError) results.errors.push(`Ammon participant: ${ammonError.message}`);
      else results.challengeParticipants++;

      // Add Adam as opponent
      const { error: adamError } = await supabase.from("challenge_participants").insert({
        challenge_id: ammonVsAdamId,
        user_id: adamUserId,
        role: "captain_b",
        accepted: true,
        accepted_at: new Date().toISOString(),
      });
      if (adamError) results.errors.push(`Adam participant: ${adamError.message}`);
      else results.challengeParticipants++;
    }

    // ============================================
    // PHASE 4: Create 1v1 Jackson vs Misael Challenge (Transitions)
    // ============================================
    console.log("Creating 1v1 challenge: Jackson vs Misael (Transitions)...");
    
    const jacksonVsMisaelId = generateUUID();
    const jacksonUserId = "3ab2ef67-df50-436d-a7b9-8e179b84307f";
    const misaelUserId = "373d13e3-24ea-49b8-8327-13cedae789d0";
    
    const { error: jacksonVsMisaelError } = await supabase
      .from("challenges")
      .insert({
        id: jacksonVsMisaelId,
        type: "1v1",
        metric: "transitions",
        status: "active",
        visibility: "public",
        stakes: "Pride",
        start_date: DEMO_DATE,
        end_date: DEMO_DATE,
        created_by: jacksonUserId,
        creator_timezone: TIMEZONE,
      });

    if (jacksonVsMisaelError) {
      results.errors.push(`Jackson vs Misael challenge: ${jacksonVsMisaelError.message}`);
    } else {
      results.challenges++;

      // Add Jackson as challenger
      const { error: jacksonError } = await supabase.from("challenge_participants").insert({
        challenge_id: jacksonVsMisaelId,
        user_id: jacksonUserId,
        role: "captain_a",
        accepted: true,
        accepted_at: new Date().toISOString(),
      });
      if (jacksonError) results.errors.push(`Jackson participant: ${jacksonError.message}`);
      else results.challengeParticipants++;

      // Add Misael as opponent
      const { error: misaelError } = await supabase.from("challenge_participants").insert({
        challenge_id: jacksonVsMisaelId,
        user_id: misaelUserId,
        role: "captain_b",
        accepted: true,
        accepted_at: new Date().toISOString(),
      });
      if (misaelError) results.errors.push(`Misael participant: ${misaelError.message}`);
      else results.challengeParticipants++;
    }

    // ============================================
    // PHASE 5: Create Nike Gift Card Incentive (Rookies Only)
    // ============================================
    console.log("Creating Nike Gift Card incentive for rookies...");
    
    const nikeIncentiveId = generateUUID();
    const { error: nikeIncentiveError } = await supabase
      .from("incentives")
      .insert({
        id: nikeIncentiveId,
        title: "👟 Nike Gift Card",
        description: "Hit 3 FP+ today and earn a Nike Gift Card!",
        reward: "👟 Nike Gift Card",
        metric: "fp_plus",
        target_type: "anyone_who",
        target_value: 3,
        visibility: "public",
        status: "active",
        start_date: DEMO_DATE,
        end_date: DEMO_DATE,
        created_by: YOUR_USER_ID,
        creator_timezone: TIMEZONE,
      });

    if (nikeIncentiveError) {
      results.errors.push(`Nike incentive: ${nikeIncentiveError.message}`);
    } else {
      results.incentives++;

      // Add all rookies as eligible
      for (const rookie of DEMO_REPS.rookies) {
        const { error } = await supabase.from("incentive_eligible_reps").insert({
          incentive_id: nikeIncentiveId,
          user_id: rookie.userId,
        });
        if (error) {
          results.errors.push(`Nike incentive eligible ${rookie.name}: ${error.message}`);
        } else {
          results.incentiveEligibleReps++;
        }
      }
    }

    // ============================================
    // PHASE 6: Create Family Day Office Goal (Group Total)
    // ============================================
    console.log("Creating Family Day office goal (100 FP+ target)...");
    
    const familyDayId = generateUUID();
    const { error: familyDayError } = await supabase
      .from("incentives")
      .insert({
        id: familyDayId,
        title: "⛵️ Family Day",
        description: "Office goal: Hit 100 FP+ as a team today!",
        reward: "⛵️ Family Day",
        metric: "fp_plus",
        target_type: "group_total",
        target_value: 100,
        visibility: "public",
        status: "active",
        start_date: DEMO_DATE,
        end_date: DEMO_DATE,
        created_by: YOUR_USER_ID,
        creator_timezone: TIMEZONE,
      });

    if (familyDayError) {
      results.errors.push(`Family Day incentive: ${familyDayError.message}`);
    } else {
      results.incentives++;

      // Add all 23 demo reps as eligible
      for (const rep of allReps) {
        const { error } = await supabase.from("incentive_eligible_reps").insert({
          incentive_id: familyDayId,
          user_id: rep.userId,
        });
        if (error) {
          results.errors.push(`Family Day eligible ${rep.name}: ${error.message}`);
        } else {
          results.incentiveEligibleReps++;
        }
      }
    }

    console.log("Demo data seeding complete!", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Demo data created successfully for Feb 1, 2026!",
        results,
        summary: {
          totalReps: 23,
          dailyEntries: results.dailyEntries,
          challenges: `${results.challenges} (Team Battle + 2 1v1s)`,
          incentives: `${results.incentives} (Nike + Family Day)`,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error seeding demo data:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
