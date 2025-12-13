import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map onboarding status to boolean flags
function parseOnboardingStatus(status: string | undefined) {
  if (!status) return {};
  
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
  
  const index = statusOrder.indexOf(status);
  
  return {
    onboarding_complete: index >= 1,
    trainings_complete: index >= 2,
    slack_joined: index >= 3,
    ramp_phase_1_complete: index >= 4,
    ramp_phase_2_complete: index >= 5,
    ramp_phase_3_complete: index >= 6,
    ramp_phase_4_complete: index >= 7,
    ramp_to_blitz_phase: status,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const notionApiKey = Deno.env.get("NOTION_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!notionApiKey) {
      throw new Error("NOTION_API_KEY not configured");
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      rookieNotionPageId, 
      onboardingStatus, 
      ipadAssigned,
      rampPhase1Complete,
      rampPhase2Complete,
      rampPhase3Complete,
      rampPhase4Complete
    } = await req.json();

    if (!rookieNotionPageId) {
      throw new Error("rookieNotionPageId is required");
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

    console.log(`Updating rookie ${rookieNotionPageId}`, { 
      onboardingStatus, 
      ipadAssigned,
      rampPhase1Complete,
      rampPhase2Complete,
      rampPhase3Complete,
      rampPhase4Complete
    });

    // Build the properties object dynamically for Notion
    const properties: any = {};
    
    if (onboardingStatus !== undefined) {
      properties["Onboarding Step Completed"] = {
        status: {
          name: onboardingStatus
        }
      };
    }

    if (ipadAssigned !== undefined) {
      properties["iPad Assigned"] = {
        checkbox: ipadAssigned
      };
    }

    // Ramp phase checkboxes - using the Notion property names
    if (rampPhase1Complete !== undefined) {
      properties["Ramp Phase 1 Complete"] = {
        checkbox: rampPhase1Complete
      };
    }

    if (rampPhase2Complete !== undefined) {
      properties["Ramp Phase 2 Complete"] = {
        checkbox: rampPhase2Complete
      };
    }

    if (rampPhase3Complete !== undefined) {
      properties["Ramp Phase 3 Complete"] = {
        checkbox: rampPhase3Complete
      };
    }

    if (rampPhase4Complete !== undefined) {
      properties["Ramp Phase 4 Complete"] = {
        checkbox: rampPhase4Complete
      };
    }

    // Update the rookie's Notion page
    const notionResponse = await fetch(
      `https://api.notion.com/v1/pages/${rookieNotionPageId}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties }),
      }
    );

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text();
      console.error("Notion API error:", errorText);
      throw new Error(`Notion API error: ${notionResponse.status} - ${errorText}`);
    }

    console.log("Successfully updated rookie status in Notion");

    // Also update Supabase reps table for immediate local sync
    const supabaseUpdate: any = {};
    
    if (hasOnboardingUpdate) {
      const parsedStatus = parseOnboardingStatus(onboardingStatus);
      Object.assign(supabaseUpdate, parsedStatus);
    }
    
    if (ipadAssigned !== undefined) {
      supabaseUpdate.ipad_assigned = ipadAssigned;
    }
    
    if (rampPhase1Complete !== undefined) {
      supabaseUpdate.ramp_phase_1_complete = rampPhase1Complete;
    }
    if (rampPhase2Complete !== undefined) {
      supabaseUpdate.ramp_phase_2_complete = rampPhase2Complete;
    }
    if (rampPhase3Complete !== undefined) {
      supabaseUpdate.ramp_phase_3_complete = rampPhase3Complete;
    }
    if (rampPhase4Complete !== undefined) {
      supabaseUpdate.ramp_phase_4_complete = rampPhase4Complete;
    }

    supabaseUpdate.updated_at = new Date().toISOString();

    console.log("Updating Supabase reps table:", supabaseUpdate);

    const { error: supabaseError } = await supabase
      .from('reps')
      .update(supabaseUpdate)
      .eq('notion_page_id', rookieNotionPageId);

    if (supabaseError) {
      console.error("Supabase update error (non-fatal):", supabaseError);
      // Don't throw - Notion update succeeded, Supabase sync can be retried
    } else {
      console.log("Successfully updated Supabase reps table");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Rookie status updated in Notion and Supabase",
        supabaseUpdate,
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
