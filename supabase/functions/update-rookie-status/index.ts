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
      rookieId,
      onboardingStatus, 
      ipadAssigned,
      rampPhase1Complete,
      rampPhase2Complete,
      rampPhase3Complete,
      rampPhase4Complete,
      // NEW: Self-reported flags (set by rookie)
      selfReportedOnboarding,
      selfReportedTrainings,
      selfReportedSlack,
      // NEW: Leader verification flags for pre-ramp onboarding
      onboardingComplete,
      trainingsComplete,
      slackJoined
    } = await req.json();

    if (!rookieId) {
      throw new Error("rookieId is required");
    }

    const hasOnboardingUpdate = onboardingStatus !== undefined;
    const hasIpadUpdate = ipadAssigned !== undefined;
    const hasRampPhaseUpdate = rampPhase1Complete !== undefined || 
                               rampPhase2Complete !== undefined || 
                               rampPhase3Complete !== undefined || 
                               rampPhase4Complete !== undefined;
    const hasSelfReportedUpdate = selfReportedOnboarding !== undefined ||
                                  selfReportedTrainings !== undefined ||
                                  selfReportedSlack !== undefined;
    const hasLeaderVerification = onboardingComplete !== undefined ||
                                  trainingsComplete !== undefined ||
                                  slackJoined !== undefined;

    if (!hasOnboardingUpdate && !hasIpadUpdate && !hasRampPhaseUpdate && !hasSelfReportedUpdate && !hasLeaderVerification) {
      throw new Error("At least one field must be provided for update");
    }

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (hasIpadUpdate) {
      updateData.ipad_assigned = ipadAssigned;
    }

    // Handle self-reported flags (set by rookie when they click "I'm Done")
    if (hasSelfReportedUpdate) {
      if (selfReportedOnboarding !== undefined) {
        updateData.self_reported_onboarding_complete = selfReportedOnboarding;
      }
      if (selfReportedTrainings !== undefined) {
        updateData.self_reported_trainings_complete = selfReportedTrainings;
      }
      if (selfReportedSlack !== undefined) {
        updateData.self_reported_slack_joined = selfReportedSlack;
      }
    }

    // Handle leader verification for pre-ramp onboarding steps
    if (hasLeaderVerification) {
      if (onboardingComplete === true) {
        updateData.onboarding_complete = true;
        updateData.self_reported_onboarding_complete = true; // Also mark self-reported
        updateData.ramp_to_blitz_phase = 'Onboarding ✅';
      }
      if (trainingsComplete === true) {
        updateData.onboarding_complete = true; // Prerequisite
        updateData.trainings_complete = true;
        updateData.self_reported_onboarding_complete = true;
        updateData.self_reported_trainings_complete = true;
        updateData.ramp_to_blitz_phase = 'Required Trainings ✅';
      }
      if (slackJoined === true) {
        updateData.onboarding_complete = true; // Prerequisites
        updateData.trainings_complete = true;
        updateData.slack_joined = true;
        updateData.self_reported_onboarding_complete = true;
        updateData.self_reported_trainings_complete = true;
        updateData.self_reported_slack_joined = true;
        updateData.ramp_to_blitz_phase = 'Slack ✅';
      }
    }

    if (hasRampPhaseUpdate) {
      // When completing a ramp phase, also mark all prerequisite steps as complete
      // AND set the ramp_to_blitz_phase string accordingly (fixes display revert)
      if (rampPhase1Complete === true) {
        updateData.onboarding_complete = true;
        updateData.trainings_complete = true;
        updateData.slack_joined = true;
        updateData.ramp_phase_1_complete = true;
        updateData.ramp_to_blitz_phase = 'Phase 1 ✅';
      } else if (rampPhase1Complete === false) {
        updateData.ramp_phase_1_complete = false;
        // Revert to Slack ✅ unless earlier steps were also false
        updateData.ramp_to_blitz_phase = 'Slack ✅';
      }
      
      if (rampPhase2Complete === true) {
        updateData.onboarding_complete = true;
        updateData.trainings_complete = true;
        updateData.slack_joined = true;
        updateData.ramp_phase_1_complete = true;
        updateData.ramp_phase_2_complete = true;
        updateData.ramp_to_blitz_phase = 'Phase 2 ✅';
      } else if (rampPhase2Complete === false) {
        updateData.ramp_phase_2_complete = false;
        // Revert to Phase 1 ✅ if phase 1 is still done
        updateData.ramp_to_blitz_phase = 'Phase 1 ✅';
      }
      
      if (rampPhase3Complete === true) {
        updateData.onboarding_complete = true;
        updateData.trainings_complete = true;
        updateData.slack_joined = true;
        updateData.ramp_phase_1_complete = true;
        updateData.ramp_phase_2_complete = true;
        updateData.ramp_phase_3_complete = true;
        updateData.ramp_to_blitz_phase = 'Phase 3 ✅';
      } else if (rampPhase3Complete === false) {
        updateData.ramp_phase_3_complete = false;
        updateData.ramp_to_blitz_phase = 'Phase 2 ✅';
      }
      
      if (rampPhase4Complete === true) {
        updateData.onboarding_complete = true;
        updateData.trainings_complete = true;
        updateData.slack_joined = true;
        updateData.ramp_phase_1_complete = true;
        updateData.ramp_phase_2_complete = true;
        updateData.ramp_phase_3_complete = true;
        updateData.ramp_phase_4_complete = true;
        updateData.ramp_to_blitz_phase = 'Phase 4 ✅';
      } else if (rampPhase4Complete === false) {
        updateData.ramp_phase_4_complete = false;
        updateData.ramp_to_blitz_phase = 'Phase 3 ✅';
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

    console.log(`[update-rookie-status] Updating rookieId: ${rookieId} with:`, updateData);

    // Update by ID
    const { data, error } = await supabase
      .from('reps')
      .update(updateData)
      .eq('id', rookieId)
      .select('id, name');
    
    if (error) {
      console.error(`[update-rookie-status] Error updating rep:`, error);
      throw error;
    }

    const updateSuccess = data && data.length > 0;
    if (updateSuccess) {
      console.log(`[update-rookie-status] Updated rep: ${data[0].name}`);
    } else {
      console.warn(`[update-rookie-status] No rep found with id: ${rookieId}`);
    }

    // The sync_rep_to_recruit trigger will automatically sync changes to the recruits table
    console.log("[update-rookie-status] Successfully updated rookie status (trigger will sync to recruits)");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Rookie status updated",
        updates: updateData,
        repsUpdated: updateSuccess,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[update-rookie-status] Error:", error);
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
