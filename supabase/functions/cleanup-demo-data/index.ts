import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEMO_DATE = "2026-02-01";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      dailyEntriesDeleted: 0,
      challengeParticipantsDeleted: 0,
      challengesDeleted: 0,
      incentiveEligibleRepsDeleted: 0,
      incentivesDeleted: 0,
      errors: [] as string[],
    };

    // ============================================
    // PHASE 1: Delete Daily Entries with DEMO_DATA tag
    // ============================================
    console.log("Deleting demo daily entries...");
    
    const { data: deletedEntries, error: entriesError } = await supabase
      .from("daily_entries")
      .delete()
      .eq("entry_date", DEMO_DATE)
      .eq("notes", "DEMO_DATA")
      .select("id");

    if (entriesError) {
      results.errors.push(`Daily entries: ${entriesError.message}`);
    } else {
      results.dailyEntriesDeleted = deletedEntries?.length || 0;
    }

    // ============================================
    // PHASE 2: Find and Delete Challenges from Demo Date
    // ============================================
    console.log("Finding demo challenges...");
    
    // Get challenges created on demo date
    const { data: demoChallenges, error: findChallengesError } = await supabase
      .from("challenges")
      .select("id")
      .gte("created_at", `${DEMO_DATE}T00:00:00`)
      .lt("created_at", `${DEMO_DATE}T23:59:59`);

    if (findChallengesError) {
      results.errors.push(`Find challenges: ${findChallengesError.message}`);
    } else if (demoChallenges && demoChallenges.length > 0) {
      const challengeIds = demoChallenges.map((c) => c.id);
      
      // Delete challenge participants first (foreign key constraint)
      console.log(`Deleting participants for ${challengeIds.length} challenges...`);
      const { data: deletedParticipants, error: participantsError } = await supabase
        .from("challenge_participants")
        .delete()
        .in("challenge_id", challengeIds)
        .select("id");

      if (participantsError) {
        results.errors.push(`Challenge participants: ${participantsError.message}`);
      } else {
        results.challengeParticipantsDeleted = deletedParticipants?.length || 0;
      }

      // Delete challenge edit approvals if any
      const { data: proposals } = await supabase
        .from("challenge_edit_proposals")
        .select("id")
        .in("challenge_id", challengeIds);

      if (proposals && proposals.length > 0) {
        const proposalIds = proposals.map((p) => p.id);
        await supabase
          .from("challenge_edit_approvals")
          .delete()
          .in("proposal_id", proposalIds);
      }

      // Delete challenge edit proposals
      await supabase
        .from("challenge_edit_proposals")
        .delete()
        .in("challenge_id", challengeIds);

      // Now delete the challenges
      console.log("Deleting challenges...");
      const { data: deletedChallenges, error: challengesError } = await supabase
        .from("challenges")
        .delete()
        .in("id", challengeIds)
        .select("id");

      if (challengesError) {
        results.errors.push(`Challenges: ${challengesError.message}`);
      } else {
        results.challengesDeleted = deletedChallenges?.length || 0;
      }
    }

    // ============================================
    // PHASE 3: Find and Delete Incentives from Demo Date
    // ============================================
    console.log("Finding demo incentives...");
    
    // Get incentives created on demo date
    const { data: demoIncentives, error: findIncentivesError } = await supabase
      .from("incentives")
      .select("id")
      .gte("created_at", `${DEMO_DATE}T00:00:00`)
      .lt("created_at", `${DEMO_DATE}T23:59:59`);

    if (findIncentivesError) {
      results.errors.push(`Find incentives: ${findIncentivesError.message}`);
    } else if (demoIncentives && demoIncentives.length > 0) {
      const incentiveIds = demoIncentives.map((i) => i.id);
      
      // Delete eligible reps first (foreign key constraint)
      console.log(`Deleting eligible reps for ${incentiveIds.length} incentives...`);
      const { data: deletedEligible, error: eligibleError } = await supabase
        .from("incentive_eligible_reps")
        .delete()
        .in("incentive_id", incentiveIds)
        .select("id");

      if (eligibleError) {
        results.errors.push(`Incentive eligible reps: ${eligibleError.message}`);
      } else {
        results.incentiveEligibleRepsDeleted = deletedEligible?.length || 0;
      }

      // Now delete the incentives
      console.log("Deleting incentives...");
      const { data: deletedIncentives, error: incentivesError } = await supabase
        .from("incentives")
        .delete()
        .in("id", incentiveIds)
        .select("id");

      if (incentivesError) {
        results.errors.push(`Incentives: ${incentivesError.message}`);
      } else {
        results.incentivesDeleted = deletedIncentives?.length || 0;
      }
    }

    console.log("Demo data cleanup complete!", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Demo data cleaned up successfully!",
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error cleaning up demo data:", error);
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
