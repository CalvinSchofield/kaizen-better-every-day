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
      rookieId,  // This could be from reps table OR recruits table
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

    // First, try to find the rep by notion_page_id or by looking up from recruits
    let repNotionPageId = rookieNotionPageId;
    let recruitId: string | null = null;

    // If we have rookieId, we need to determine if it's a rep ID or recruit ID
    if (rookieId && !rookieNotionPageId) {
      // Try to find in reps table first
      const { data: repById } = await supabase
        .from('reps')
        .select('id, notion_page_id')
        .eq('id', rookieId)
        .maybeSingle();

      if (repById) {
        repNotionPageId = repById.notion_page_id;
        console.log(`[update-rookie-status] Found rep by ID: ${rookieId}`);
      } else {
        // Try recruits table
        const { data: recruitById } = await supabase
          .from('recruits')
          .select('id, notion_page_id')
          .eq('id', rookieId)
          .maybeSingle();

        if (recruitById) {
          recruitId = recruitById.id;
          repNotionPageId = recruitById.notion_page_id;
          console.log(`[update-rookie-status] Found recruit by ID: ${rookieId}, notion_page_id: ${repNotionPageId}`);
        }
      }
    }

    // Update reps table - try by notion_page_id first, then by ID
    let repsUpdated = false;
    
    if (repNotionPageId) {
      const { error: updateError, count } = await supabase
        .from('reps')
        .update(updateData)
        .eq('notion_page_id', repNotionPageId)
        .select('id');
      
      if (!updateError) {
        repsUpdated = true;
        console.log(`[update-rookie-status] Updated reps by notion_page_id: ${repNotionPageId}`);
      }
    }
    
    if (!repsUpdated && rookieId) {
      const { error: updateError } = await supabase
        .from('reps')
        .update(updateData)
        .eq('id', rookieId);
      
      if (!updateError) {
        repsUpdated = true;
        console.log(`[update-rookie-status] Updated reps by id: ${rookieId}`);
      }
    }

    // Also update recruits table - only include defined values
    const recruitsUpdateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    
    if (updateData.ipad_assigned !== undefined) recruitsUpdateData.ipad_assigned = updateData.ipad_assigned;
    if (updateData.onboarding_complete !== undefined) recruitsUpdateData.onboarding_complete = updateData.onboarding_complete;
    if (updateData.trainings_complete !== undefined) recruitsUpdateData.trainings_complete = updateData.trainings_complete;
    if (updateData.slack_joined !== undefined) recruitsUpdateData.slack_joined = updateData.slack_joined;
    if (updateData.ramp_phase_1_complete !== undefined) recruitsUpdateData.ramp_phase_1_complete = updateData.ramp_phase_1_complete;
    if (updateData.ramp_phase_2_complete !== undefined) recruitsUpdateData.ramp_phase_2_complete = updateData.ramp_phase_2_complete;
    if (updateData.ramp_phase_3_complete !== undefined) recruitsUpdateData.ramp_phase_3_complete = updateData.ramp_phase_3_complete;
    if (updateData.ramp_phase_4_complete !== undefined) recruitsUpdateData.ramp_phase_4_complete = updateData.ramp_phase_4_complete;

    if (repNotionPageId) {
      await supabase
        .from('recruits')
        .update(recruitsUpdateData)
        .eq('notion_page_id', repNotionPageId);
      console.log(`[update-rookie-status] Updated recruits by notion_page_id: ${repNotionPageId}`);
    } else if (recruitId) {
      await supabase
        .from('recruits')
        .update(recruitsUpdateData)
        .eq('id', recruitId);
      console.log(`[update-rookie-status] Updated recruits by id: ${recruitId}`);
    } else if (rookieId) {
      // Last resort - try the rookieId directly on recruits
      await supabase
        .from('recruits')
        .update(recruitsUpdateData)
        .eq('id', rookieId);
      console.log(`[update-rookie-status] Updated recruits by rookieId: ${rookieId}`);
    }

    console.log("[update-rookie-status] Successfully updated rookie status");

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
