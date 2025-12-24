import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      rookieNotionPageId,
      rookieId, 
      onboardingStatus, 
      ipadAssigned,
      rampPhase1Complete,
      rampPhase2Complete,
      rampPhase3Complete,
      rampPhase4Complete
    } = await req.json();

    if (!rookieNotionPageId && !rookieId) {
      throw new Error("rookieNotionPageId or rookieId is required");
    }

    const hasOnboardingUpdate = onboardingStatus !== undefined;
    const hasIpadUpdate = ipadAssigned !== undefined;
    const hasRampPhaseUpdate = rampPhase1Complete !== undefined || 
                               rampPhase2Complete !== undefined || 
                               rampPhase3Complete !== undefined || 
                               rampPhase4Complete !== undefined;

    if (!hasOnboardingUpdate && !hasIpadUpdate && !hasRampPhaseUpdate) {
      throw new Error("At least one field must be provided for update");
    }

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (hasIpadUpdate) {
      updateData.ipad_assigned = ipadAssigned;
    }

    if (hasRampPhaseUpdate) {
      // When completing a ramp phase, also mark all prerequisite steps as complete
      if (rampPhase1Complete === true) {
        updateData.onboarding_complete = true;
        updateData.trainings_complete = true;
        updateData.slack_joined = true;
        updateData.ramp_phase_1_complete = true;
      } else if (rampPhase1Complete === false) {
        updateData.ramp_phase_1_complete = false;
      }
      
      if (rampPhase2Complete === true) {
        updateData.onboarding_complete = true;
        updateData.trainings_complete = true;
        updateData.slack_joined = true;
        updateData.ramp_phase_1_complete = true;
        updateData.ramp_phase_2_complete = true;
      } else if (rampPhase2Complete === false) {
        updateData.ramp_phase_2_complete = false;
      }
      
      if (rampPhase3Complete === true) {
        updateData.onboarding_complete = true;
        updateData.trainings_complete = true;
        updateData.slack_joined = true;
        updateData.ramp_phase_1_complete = true;
        updateData.ramp_phase_2_complete = true;
        updateData.ramp_phase_3_complete = true;
      } else if (rampPhase3Complete === false) {
        updateData.ramp_phase_3_complete = false;
      }
      
      if (rampPhase4Complete === true) {
        updateData.onboarding_complete = true;
        updateData.trainings_complete = true;
        updateData.slack_joined = true;
        updateData.ramp_phase_1_complete = true;
        updateData.ramp_phase_2_complete = true;
        updateData.ramp_phase_3_complete = true;
        updateData.ramp_phase_4_complete = true;
      } else if (rampPhase4Complete === false) {
        updateData.ramp_phase_4_complete = false;
      }
    }

    if (hasOnboardingUpdate) {
      // Parse onboarding status to boolean flags
      const statusOrder = [
        'Not started',
        'Onboarding ✅',
        'Required Trainings ✅',
        'Slack ✅',
        'Phase 1 ✅',
        'Phase 2 ✅',
        'Phase 3 ✅',
        'Phase 4 ✅'
      ];
      
      const index = statusOrder.indexOf(onboardingStatus);
      
      updateData.onboarding_complete = index >= 1;
      updateData.trainings_complete = index >= 2;
      updateData.slack_joined = index >= 3;
      updateData.ramp_phase_1_complete = index >= 4;
      updateData.ramp_phase_2_complete = index >= 5;
      updateData.ramp_phase_3_complete = index >= 6;
      updateData.ramp_phase_4_complete = index >= 7;
      updateData.ramp_to_blitz_phase = onboardingStatus;
    }

    console.log(`Updating rookie status in Supabase:`, updateData);

    // Update reps table
    let updateQuery = supabase.from('reps').update(updateData);
    
    if (rookieId) {
      updateQuery = updateQuery.eq('id', rookieId);
    } else {
      updateQuery = updateQuery.eq('notion_page_id', rookieNotionPageId);
    }

    const { error: updateError } = await updateQuery;

    if (updateError) {
      console.error("Supabase update error:", updateError);
      throw new Error(`Failed to update rookie status: ${updateError.message}`);
    }

    // Also update recruits table if exists
    let recruitsUpdateQuery = supabase.from('recruits').update({
      ipad_assigned: updateData.ipad_assigned,
      onboarding_complete: updateData.onboarding_complete,
      trainings_complete: updateData.trainings_complete,
      slack_joined: updateData.slack_joined,
      ramp_phase_1_complete: updateData.ramp_phase_1_complete,
      ramp_phase_2_complete: updateData.ramp_phase_2_complete,
      ramp_phase_3_complete: updateData.ramp_phase_3_complete,
      ramp_phase_4_complete: updateData.ramp_phase_4_complete,
      updated_at: new Date().toISOString(),
    });

    if (rookieId) {
      recruitsUpdateQuery = recruitsUpdateQuery.eq('id', rookieId);
    } else if (rookieNotionPageId) {
      recruitsUpdateQuery = recruitsUpdateQuery.eq('notion_page_id', rookieNotionPageId);
    }

    await recruitsUpdateQuery;

    console.log("Successfully updated rookie status in Supabase");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Rookie status updated",
        updates: updateData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in update-rookie-status:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: "Check function logs for more information",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
