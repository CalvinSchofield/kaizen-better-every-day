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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!notionApiKey) {
      throw new Error("NOTION_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { nudgeValue } = await req.json();

    console.log(`[update-notion-nudge] User ${user.email} setting nudge to:`, nudgeValue);

    // Get the rep's Notion page ID
    const { data: repData, error: repError } = await supabase
      .from("reps")
      .select("notion_page_id, name")
      .eq("user_id", user.id)
      .single();

    if (repError || !repData?.notion_page_id) {
      throw new Error("Rep data not found");
    }

    console.log(`[update-notion-nudge] Updating Notion page ${repData.notion_page_id}`);
    console.log(`[update-notion-nudge] Setting "Nudge leader" checkbox to: ${nudgeValue}`);

    // Update the Notion page property
    const notionBody = {
      properties: {
        "Nudge leader": {
          checkbox: nudgeValue,
        },
      },
    };
    
    console.log("[update-notion-nudge] Request body:", JSON.stringify(notionBody, null, 2));

    const notionResponse = await fetch(
      `https://api.notion.com/v1/pages/${repData.notion_page_id}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notionBody),
      }
    );

    console.log(`[update-notion-nudge] Notion API response status: ${notionResponse.status}`);

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text();
      console.error("[update-notion-nudge] Notion API error response:", errorText);
      throw new Error(`Notion API error: ${notionResponse.status} - ${errorText}`);
    }

    const result = await notionResponse.json();
    console.log("[update-notion-nudge] Notion API success response:", JSON.stringify(result.properties?.["Nudge leader"], null, 2));
    console.log(`[update-notion-nudge] Successfully updated Notion for ${repData.name}`);

    // Also update Supabase
    const { error: updateError } = await supabase
      .from("reps")
      .update({
        nudge_leader: nudgeValue,
        last_nudge_time: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[update-notion-nudge] Supabase update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Nudge updated in Notion",
        repName: repData.name,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[update-notion-nudge] Error:", error);
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
