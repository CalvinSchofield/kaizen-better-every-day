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
    const notionApiKey = Deno.env.get("NOTION_API_KEY");
    if (!notionApiKey) {
      throw new Error("NOTION_API_KEY not configured");
    }

    const { rookieNotionPageId, onboardingStatus, ipadAssigned } = await req.json();

    if (!rookieNotionPageId) {
      throw new Error("rookieNotionPageId is required");
    }

    if (!onboardingStatus && ipadAssigned === undefined) {
      throw new Error("At least one of onboardingStatus or ipadAssigned must be provided");
    }

    console.log(`Updating rookie ${rookieNotionPageId}`, { onboardingStatus, ipadAssigned });

    // Build the properties object dynamically
    const properties: any = {};
    
    if (onboardingStatus) {
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

    const result = await notionResponse.json();
    console.log("Successfully updated rookie status in Notion");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Rookie status updated in Notion"
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
