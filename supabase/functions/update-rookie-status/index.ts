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

    // If ramp phase updates are provided, convert them to onboardingStatus
    // The Notion database uses "Onboarding Step Completed" status field
    let effectiveOnboardingStatus = onboardingStatus;
    if (hasRampPhaseUpdate && !hasOnboardingUpdate) {
      // Determine the highest phase being marked complete
      if (rampPhase4Complete) {
        effectiveOnboardingStatus = 'Phase 4 ✅';
      } else if (rampPhase3Complete) {
        effectiveOnboardingStatus = 'Phase 3 ✅';
      } else if (rampPhase2Complete) {
        effectiveOnboardingStatus = 'Phase 2 ✅';
      } else if (rampPhase1Complete) {
        effectiveOnboardingStatus = 'Phase 1 ✅';
      }
    }

    console.log(`Updating rookie ${rookieNotionPageId}`, { 
      onboardingStatus: effectiveOnboardingStatus, 
      ipadAssigned
    });

    // Build the properties object dynamically for Notion
    const properties: any = {};
    
    // Use effectiveOnboardingStatus which includes converted ramp phase updates
    if (effectiveOnboardingStatus !== undefined) {
      properties["Onboarding Step Completed"] = {
        status: {
          name: effectiveOnboardingStatus
        }
      };
    }

    if (ipadAssigned !== undefined) {
      properties["iPad Assigned"] = {
        checkbox: ipadAssigned
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
    
    // If we have an effective onboarding status, parse it for Supabase
    if (effectiveOnboardingStatus !== undefined) {
      const parsedStatus = parseOnboardingStatus(effectiveOnboardingStatus);
      Object.assign(supabaseUpdate, parsedStatus);
    }
    
    if (ipadAssigned !== undefined) {
      supabaseUpdate.ipad_assigned = ipadAssigned;
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
