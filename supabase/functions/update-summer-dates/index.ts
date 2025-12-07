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

    const { notionPageId, startDate, endDate } = await req.json();

    if (!notionPageId) {
      throw new Error("notionPageId is required");
    }

    if (!startDate && !endDate) {
      throw new Error("At least one of startDate or endDate must be provided");
    }

    console.log(`Updating summer dates for ${notionPageId}`, { startDate, endDate });

    // Build the properties object dynamically
    // Notion date properties use ISO 8601 format
    const properties: any = {};
    
    if (startDate) {
      properties["Start Date"] = {
        date: {
          start: startDate, // Format: YYYY-MM-DD
        }
      };
    }

    if (endDate) {
      properties["End Date"] = {
        date: {
          start: endDate, // Format: YYYY-MM-DD
        }
      };
    }

    // Update the rep's Notion page
    const notionResponse = await fetch(
      `https://api.notion.com/v1/pages/${notionPageId}`,
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
    console.log("Successfully updated summer dates in Notion");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Summer dates updated in Notion"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in update-summer-dates:", error);
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
