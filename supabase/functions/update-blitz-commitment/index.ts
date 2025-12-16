import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchNotionWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 5
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      if (attempt === maxRetries) {
        throw new Error(`Rate limited after ${maxRetries + 1} attempts`);
      }
      
      // Get retry-after header or use exponential backoff
      const retryAfter = response.headers.get('retry-after');
      const waitTime = retryAfter 
        ? parseInt(retryAfter) * 1000 
        : Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 32000);
      
      console.log(`Rate limited (429). Retrying in ${waitTime}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    return response;
  }
  
  throw new Error(`Failed after ${maxRetries + 1} attempts`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const notionApiKey = Deno.env.get("NOTION_API_KEY");
    if (!notionApiKey) {
      throw new Error("NOTION_API_KEY not configured");
    }

    const { repNotionPageId, blitzPageIds } = await req.json();

    if (!repNotionPageId) {
      throw new Error("Rep Notion page ID is required");
    }

    if (!Array.isArray(blitzPageIds)) {
      throw new Error("blitzPageIds must be an array");
    }

    console.log(`Updating blitz commitments for rep ${repNotionPageId}`);
    console.log(`Raw blitz commitments received:`, blitzPageIds);

    // Normalize blitzPageIds - extract IDs if objects were passed
    const normalizedIds: string[] = blitzPageIds.map((item: string | { id: string }) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'id' in item) return item.id;
      throw new Error(`Invalid blitz item format: ${JSON.stringify(item)}`);
    });

    console.log(`Normalized blitz IDs:`, normalizedIds);

    // Update the rep's Notion page with the new blitz commitments
    const notionResponse = await fetchNotionWithRetry(
      `https://api.notion.com/v1/pages/${repNotionPageId}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            "Preseason trips": {
              relation: normalizedIds.map(id => ({ id }))
            }
          }
        }),
      }
    );

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text();
      console.error("Notion API error:", errorText);
      throw new Error(`Notion API error: ${notionResponse.status} - ${errorText}`);
    }

    const result = await notionResponse.json();
    console.log("Successfully updated blitz commitments in Notion");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Blitz commitments updated in Notion"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in update-blitz-commitment:", error);
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
