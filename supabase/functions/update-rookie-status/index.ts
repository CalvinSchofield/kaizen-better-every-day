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

    console.log(`[update-rookie-status] Updating with:`, updateData);

    // SIMPLIFIED: Only update reps table - the sync_rep_to_recruit trigger handles syncing to recruits
    let repNotionPageId = rookieNotionPageId;
    let updateSuccess = false;

    // If we have rookieId but no notion_page_id, look it up
    if (rookieId && !rookieNotionPageId) {
      // Try reps table first
      const { data: repById } = await supabase
        .from('reps')
        .select('id, notion_page_id, email')
        .eq('id', rookieId)
        .maybeSingle();

      if (repById) {
        repNotionPageId = repById.notion_page_id;
        console.log(`[update-rookie-status] Found rep by ID: ${rookieId}`);
      } else {
        // Try recruits table to get notion_page_id for matching
        const { data: recruitById } = await supabase
          .from('recruits')
          .select('id, notion_page_id, email')
          .eq('id', rookieId)
          .maybeSingle();

        if (recruitById) {
          repNotionPageId = recruitById.notion_page_id;
          console.log(`[update-rookie-status] Found recruit by ID: ${rookieId}, notion_page_id: ${repNotionPageId}`);
        }
      }
    }

    // Try to update by notion_page_id first (most reliable)
    if (repNotionPageId) {
      const { data, error } = await supabase
        .from('reps')
        .update(updateData)
        .eq('notion_page_id', repNotionPageId)
        .select('id, name');
      
      if (!error && data && data.length > 0) {
        updateSuccess = true;
        console.log(`[update-rookie-status] Updated rep by notion_page_id: ${repNotionPageId}, name: ${data[0].name}`);
      }
    }
    
    // Fallback to update by ID if notion_page_id didn't work
    if (!updateSuccess && rookieId) {
      const { data, error } = await supabase
        .from('reps')
        .update(updateData)
        .eq('id', rookieId)
        .select('id, name');
      
      if (!error && data && data.length > 0) {
        updateSuccess = true;
        console.log(`[update-rookie-status] Updated rep by id: ${rookieId}, name: ${data[0].name}`);
      }
    }

    if (!updateSuccess) {
      console.warn(`[update-rookie-status] No rep record found to update. rookieId: ${rookieId}, rookieNotionPageId: ${rookieNotionPageId}`);
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
