import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Demo date - today
const DEMO_DATE = "2026-01-31";
const TIMEZONE = "America/Denver";

// Your user ID (Calvin Schofield - excluded from data generation)
const YOUR_USER_ID = "843dac61-139d-4511-a057-c3bf359a9c07";

// Target reps for demo data
const DEMO_REPS = {
  // Rookies (Sold/Sold 5+)
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
  // Sophomores
  sophomores: [
    { userId: "dde01bfc-6f28-4ef3-914f-dd2602b61e7e", name: "Abi Cunningham" },
    { userId: "4180229c-27e4-4a0a-9f45-b3a399950dd6", name: "Ammon Allan" },
    { userId: "a848bd1a-886c-4ea6-b093-060117a89dd3", name: "Ansel Severson" },
    { userId: "b38b47e4-af04-4c4f-9c0c-d7b2f81964fa", name: "Austin Clayton" },
    { userId: "393c450a-2241-4d03-91a7-f046d8019ec1", name: "Christian Fabian" },
    { userId: "68f129d0-fd1b-4154-8ab5-74bdc7ef6388", name: "Ephraim Wilde" },
    { userId: "bcf3761d-9d3c-4d59-9175-7232a4084187", name: "Jack Mair" },
    { userId: "1123659a-5e6c-4a07-bf2d-3ada4237b5da", name: "Javier Estrada" },
    { userId: "a9f5a317-e9cd-433a-bd93-e7c413ba5cc6", name: "Jose Pineda" },
    { userId: "ae5e1425-6b6b-4f6b-9ef4-af8289e84efa", name: "RJ Ashton" },
  ],
  // Vets (excluding you)
  vets: [
    { userId: "1712a7f8-0b37-4095-916c-67e03ce169df", name: "Adam Schofield" },
    { userId: "fc0a08d5-14bb-4690-96d6-2e48d0645de9", name: "Calder Severson" },
    { userId: "373d13e3-24ea-49b8-8327-13cedae789d0", name: "Misael Sanchez" },
    { userId: "69c2fc5c-f6c0-4926-9d73-e5db117cd5ce", name: "Quinn Gleed" },
  ],
};

// Predefined stats to ensure realistic and interesting demo data
const PREDEFINED_STATS: Record<string, {
  doors: number;
  fpPlus: number;
  prmr: number;
  decisionMakers: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
}> = {
  // Top performers
  "Ammon Allan": { doors: 72, fpPlus: 3.4, prmr: 310, decisionMakers: 22, pitches: 18, transitions: 10, presentations: 6, closes: 4 },
  "Quinn Gleed": { doors: 68, fpPlus: 2.8, prmr: 285, decisionMakers: 20, pitches: 16, transitions: 9, presentations: 5, closes: 3 },
  "Jackson Jennings": { doors: 85, fpPlus: 2.2, prmr: 195, decisionMakers: 25, pitches: 20, transitions: 8, presentations: 4, closes: 3 },
  "Bryson Bradshaw": { doors: 42, fpPlus: 2.1, prmr: 180, decisionMakers: 15, pitches: 12, transitions: 6, presentations: 4, closes: 3 },
  "Noah Delgado": { doors: 55, fpPlus: 2.0, prmr: 175, decisionMakers: 18, pitches: 14, transitions: 7, presentations: 4, closes: 2 },
  "Trevor Allan": { doors: 48, fpPlus: 1.8, prmr: 155, decisionMakers: 14, pitches: 11, transitions: 6, presentations: 3, closes: 2 },
  // Just missed incentive threshold
  "Weston": { doors: 62, fpPlus: 1.5, prmr: 130, decisionMakers: 17, pitches: 13, transitions: 5, presentations: 3, closes: 2 },
  "Jay Tingey": { doors: 38, fpPlus: 1.2, prmr: 105, decisionMakers: 12, pitches: 9, transitions: 4, presentations: 2, closes: 1 },
  // Others with varied performance
  "Izaiah Martinez": { doors: 52, fpPlus: 1.4, prmr: 120, decisionMakers: 16, pitches: 12, transitions: 5, presentations: 3, closes: 2 },
  "JP Perales": { doors: 45, fpPlus: 1.0, prmr: 85, decisionMakers: 13, pitches: 10, transitions: 4, presentations: 2, closes: 1 },
  "Abi Cunningham": { doors: 58, fpPlus: 1.6, prmr: 140, decisionMakers: 18, pitches: 15, transitions: 6, presentations: 3, closes: 2 },
  "Ansel Severson": { doors: 63, fpPlus: 1.3, prmr: 115, decisionMakers: 19, pitches: 14, transitions: 5, presentations: 3, closes: 2 },
  "Austin Clayton": { doors: 55, fpPlus: 1.1, prmr: 95, decisionMakers: 15, pitches: 11, transitions: 5, presentations: 2, closes: 1 },
  "Christian Fabian": { doors: 49, fpPlus: 0.8, prmr: 70, decisionMakers: 14, pitches: 10, transitions: 4, presentations: 2, closes: 1 },
  "Ephraim Wilde": { doors: 44, fpPlus: 0.6, prmr: 52, decisionMakers: 12, pitches: 8, transitions: 3, presentations: 1, closes: 1 },
  "Jack Mair": { doors: 51, fpPlus: 1.0, prmr: 85, decisionMakers: 15, pitches: 11, transitions: 4, presentations: 2, closes: 1 },
  "Javier Estrada": { doors: 47, fpPlus: 0.5, prmr: 43, decisionMakers: 13, pitches: 9, transitions: 3, presentations: 1, closes: 1 },
  "Jose Pineda": { doors: 40, fpPlus: 0.4, prmr: 35, decisionMakers: 11, pitches: 8, transitions: 3, presentations: 1, closes: 0 },
  "RJ Ashton": { doors: 56, fpPlus: 1.2, prmr: 105, decisionMakers: 16, pitches: 12, transitions: 5, presentations: 2, closes: 1 },
  "Adam Schofield": { doors: 65, fpPlus: 1.7, prmr: 150, decisionMakers: 19, pitches: 15, transitions: 6, presentations: 3, closes: 2 },
  "Calder Severson": { doors: 70, fpPlus: 1.9, prmr: 165, decisionMakers: 21, pitches: 16, transitions: 7, presentations: 4, closes: 2 },
  "Misael Sanchez": { doors: 60, fpPlus: 1.4, prmr: 120, decisionMakers: 17, pitches: 13, transitions: 5, presentations: 3, closes: 2 },
};

// Team assignments for Red vs Blue
const TEAM_RED = [
  "c8055f1f-1871-4995-82ae-8f44289b356d", // Bryson Bradshaw
  "3ab2ef67-df50-436d-a7b9-8e179b84307f", // Jackson Jennings
  "5076efe0-a115-440f-92fa-93f4f819519d", // JP Perales
  "67c22aa0-2cdd-4636-a15d-1425910ed042", // Trevor Allan
  "4180229c-27e4-4a0a-9f45-b3a399950dd6", // Ammon Allan (Captain)
  "a848bd1a-886c-4ea6-b093-060117a89dd3", // Ansel Severson
  "b38b47e4-af04-4c4f-9c0c-d7b2f81964fa", // Austin Clayton
  "1123659a-5e6c-4a07-bf2d-3ada4237b5da", // Javier Estrada
  "1712a7f8-0b37-4095-916c-67e03ce169df", // Adam Schofield
  "ae5e1425-6b6b-4f6b-9ef4-af8289e84efa", // RJ Ashton
  "dde01bfc-6f28-4ef3-914f-dd2602b61e7e", // Abi Cunningham
];

const TEAM_BLUE = [
  "a79bcce8-0bd7-4812-9a2c-1ac96cf2fcd5", // Izaiah Martinez
  "8ea77d54-223e-490d-b720-5a5c18667315", // Jay Tingey
  "8efaac75-4e91-4989-9ce5-6da02ce462b5", // Noah Delgado
  "d37d3df9-5657-4a7d-8ac3-742ab07f3fac", // Weston
  "69c2fc5c-f6c0-4926-9d73-e5db117cd5ce", // Quinn Gleed (Captain)
  "393c450a-2241-4d03-91a7-f046d8019ec1", // Christian Fabian
  "bcf3761d-9d3c-4d59-9175-7232a4084187", // Jack Mair
  "a9f5a317-e9cd-433a-bd93-e7c413ba5cc6", // Jose Pineda
  "fc0a08d5-14bb-4690-96d6-2e48d0645de9", // Calder Severson
  "373d13e3-24ea-49b8-8327-13cedae789d0", // Misael Sanchez
  "68f129d0-fd1b-4154-8ab5-74bdc7ef6388", // Ephraim Wilde
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
  // Between 9:00 AM and 10:15 AM Mountain Time
  const hour = 9;
  const minute = randomInt(0, 75); // 0-75 mins past 9 = 9:00-10:15
  const actualHour = hour + Math.floor(minute / 60);
  const actualMinute = minute % 60;
  return `${DEMO_DATE}T${String(actualHour).padStart(2, "0")}:${String(actualMinute).padStart(2, "0")}:00-07:00`;
}

function generateWorkEndTime(): string {
  // Between 7:00 PM and 8:30 PM Mountain Time
  const hour = 19;
  const minute = randomInt(0, 90); // 0-90 mins past 7 = 7:00-8:30
  const actualHour = hour + Math.floor(minute / 60);
  const actualMinute = minute % 60;
  return `${DEMO_DATE}T${String(actualHour).padStart(2, "0")}:${String(actualMinute).padStart(2, "0")}:00-07:00`;
}

function generateSalesLog(fpPlus: number, prmr: number): object[] {
  const sales = [];
  const numSales = Math.ceil(fpPlus);
  
  if (numSales === 0) return [];
  
  // Distribute PRMR across sales
  const avgPrmrPerSale = prmr / numSales;
  
  for (let i = 0; i < numSales; i++) {
    // Vary the time throughout the day (10am-7pm)
    const hour = randomInt(10, 19);
    const minute = randomInt(0, 59);
    const timestamp = `${DEMO_DATE}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-07:00`;
    
    // Vary PRMR slightly for each sale
    const salePrmr = Math.round(avgPrmrPerSale * (0.8 + Math.random() * 0.4));
    
    // Determine if this is a partial FP (for the last sale if fpPlus has decimals)
    const isPartial = i === numSales - 1 && fpPlus % 1 !== 0;
    const fpValue = isPartial ? fpPlus % 1 : 1;
    
    sales.push({
      id: `demo-sale-${generateUUID()}`,
      type: "fp",
      prmr: salePrmr,
      timestamp,
      install_status: "installed",
      installed_same_day: Math.random() > 0.3,
      fp_value: fpValue,
    });
  }
  
  return sales;
}

// Generate realistic "interaction clusters" where events happen in sequence
// Each cluster: Door → (maybe DM) → (maybe Pitch) → (maybe Transition) → (maybe Presentation) → (maybe Close)
function generateRealisticTimestamps(stats: typeof PREDEFINED_STATS["Ammon Allan"]): object {
  const timestamps: Record<string, string[]> = {
    doors_knocked: [],
    decision_makers: [],
    pitches: [],
    transitions: [],
    presentations: [],
    closes: [],
  };
  
  // Work day: 9:30 AM to 7:30 PM = 600 minutes of knocking time
  const workStartMinutes = 9 * 60 + 30; // 9:30 AM in minutes
  const workEndMinutes = 19 * 60 + 30; // 7:30 PM in minutes
  const totalWorkMinutes = workEndMinutes - workStartMinutes;
  
  // Calculate how many "interaction clusters" we need
  // Each door is the start of a potential cluster
  const totalDoors = stats.doors;
  
  // Spread doors evenly across the work day with some randomness
  const avgMinutesBetweenDoors = totalWorkMinutes / totalDoors;
  
  // Track which doors lead to deeper funnel events
  // Use stats to determine conversion rates
  const dmRate = stats.decisionMakers / stats.doors;
  const pitchRate = stats.pitches / stats.doors;
  const transitionRate = stats.transitions / stats.doors;
  const presentationRate = stats.presentations / stats.doors;
  const closeRate = stats.closes / stats.doors;
  
  let currentMinute = workStartMinutes + randomInt(0, 15); // Start between 9:30-9:45
  
  for (let doorIdx = 0; doorIdx < totalDoors; doorIdx++) {
    // Generate door knock timestamp
    const doorHour = Math.floor(currentMinute / 60);
    const doorMin = currentMinute % 60;
    const doorSecond = randomInt(0, 59);
    const doorTimestamp = `${DEMO_DATE}T${String(doorHour).padStart(2, "0")}:${String(doorMin).padStart(2, "0")}:${String(doorSecond).padStart(2, "0")}-07:00`;
    timestamps.doors_knocked.push(doorTimestamp);
    
    // Determine if this door leads to deeper interactions
    // Use cumulative probability so funnel makes sense
    const rand = Math.random();
    
    let interactionDuration = 0; // How long this interaction takes
    
    if (rand < dmRate) {
      // Got a decision maker! Add DM within 10-60 seconds of door
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
        // Started a pitch! Add pitch 30-90 seconds after DM
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
          // Got inside! Add transition 2-5 minutes after pitch
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
            // Did a presentation! Add 20-60 minutes after transition
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
              // Attempted a close! Add 5-15 minutes after presentation
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
    
    // Move to next door: base interval + interaction duration + small random variation
    const nextDoorDelay = avgMinutesBetweenDoors * (0.5 + Math.random()) + interactionDuration;
    currentMinute += Math.max(1, Math.floor(nextDoorDelay));
    
    // Don't go past end of work day
    if (currentMinute >= workEndMinutes) break;
  }
  
  // Sort all timestamps chronologically
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
    console.log("Creating daily entries...");
    
    for (const rep of allReps) {
      const stats = PREDEFINED_STATS[rep.name];
      if (!stats) {
        console.log(`No predefined stats for ${rep.name}, skipping...`);
        continue;
      }

      const salesLog = generateSalesLog(stats.fpPlus, stats.prmr);
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
        prmr: stats.prmr,
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
    // PHASE 2: Create Team Battle Challenge
    // ============================================
    console.log("Creating team battle challenge...");
    
    const teamBattleId = generateUUID();
    const { error: teamBattleError } = await supabase
      .from("challenges")
      .insert({
        id: teamBattleId,
        type: "group",
        metric: "fp_plus",
        status: "active",
        visibility: "public",
        stakes: "BBQ dinner on Sunday - losing team cooks for winners!",
        start_date: DEMO_DATE,
        end_date: DEMO_DATE,
        created_by: YOUR_USER_ID,
        creator_timezone: TIMEZONE,
      });

    if (teamBattleError) {
      results.errors.push(`Team battle challenge: ${teamBattleError.message}`);
    } else {
      results.challenges++;

      // Add Team Red participants (team "a" - lowercase)
      for (const userId of TEAM_RED) {
        const isTeamACaptain = userId === "4180229c-27e4-4a0a-9f45-b3a399950dd6"; // Ammon
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

      // Add Team Blue participants (team "b" - lowercase)
      for (const userId of TEAM_BLUE) {
        const isTeamBCaptain = userId === "69c2fc5c-f6c0-4926-9d73-e5db117cd5ce"; // Quinn
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
    // PHASE 3: Create 1v1 Ammon vs Quinn Challenge
    // ============================================
    console.log("Creating 1v1 challenge...");
    
    const oneVOneId = generateUUID();
    const ammonUserId = "4180229c-27e4-4a0a-9f45-b3a399950dd6";
    const quinnUserId = "69c2fc5c-f6c0-4926-9d73-e5db117cd5ce";
    
    const { error: oneVOneError } = await supabase
      .from("challenges")
      .insert({
        id: oneVOneId,
        type: "1v1",
        metric: "prmr",
        status: "active",
        visibility: "public",
        stakes: "Loser buys winner lunch next week",
        start_date: DEMO_DATE,
        end_date: DEMO_DATE,
        created_by: ammonUserId,
        creator_timezone: TIMEZONE,
      });

    if (oneVOneError) {
      results.errors.push(`1v1 challenge: ${oneVOneError.message}`);
    } else {
      results.challenges++;

      // Add Ammon as challenger (captain_a = creator)
      const { error: ammonError } = await supabase.from("challenge_participants").insert({
        challenge_id: oneVOneId,
        user_id: ammonUserId,
        role: "captain_a",
        accepted: true,
        accepted_at: new Date().toISOString(),
      });
      if (ammonError) {
        results.errors.push(`Ammon participant: ${ammonError.message}`);
      } else {
        results.challengeParticipants++;
      }

      // Add Quinn as opponent (captain_b = challenged person)
      const { error: quinnError } = await supabase.from("challenge_participants").insert({
        challenge_id: oneVOneId,
        user_id: quinnUserId,
        role: "captain_b",
        accepted: true,
        accepted_at: new Date().toISOString(),
      });
      if (quinnError) {
        results.errors.push(`Quinn participant: ${quinnError.message}`);
      } else {
        results.challengeParticipants++;
      }
    }

    // ============================================
    // PHASE 4: Create Rookie Incentive
    // ============================================
    console.log("Creating rookie incentive...");
    
    const incentiveId = generateUUID();
    const { error: incentiveError } = await supabase
      .from("incentives")
      .insert({
        id: incentiveId,
        title: "2 FP+ Club",
        description: "Hit 2 FP+ today and earn an energy drink!",
        reward: "Energy drink from the drink fridge on Monday",
        metric: "fp_plus",
        target_type: "anyone_who",
        target_value: 2,
        visibility: "public",
        status: "active",
        start_date: DEMO_DATE,
        end_date: DEMO_DATE,
        created_by: YOUR_USER_ID,
        creator_timezone: TIMEZONE,
      });

    if (incentiveError) {
      results.errors.push(`Incentive: ${incentiveError.message}`);
    } else {
      results.incentives++;

      // Add all rookies as eligible
      for (const rookie of DEMO_REPS.rookies) {
        const { error } = await supabase.from("incentive_eligible_reps").insert({
          incentive_id: incentiveId,
          user_id: rookie.userId,
        });
        if (error) {
          results.errors.push(`Incentive eligible ${rookie.name}: ${error.message}`);
        } else {
          results.incentiveEligibleReps++;
        }
      }
    }

    console.log("Demo data seeding complete!", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Demo data created successfully!",
        results,
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
