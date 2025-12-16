import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotionProperty {
  id: string;
  type: string;
  [key: string]: any;
}

interface NotionPage {
  id: string;
  properties: Record<string, NotionProperty>;
}

// Retry helper for Notion API with exponential backoff and jitter
async function fetchNotionWithRetry(url: string, options: RequestInit, maxRetries = 8): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If rate limited (429), retry with exponential backoff + jitter
      if (response.status === 429) {
        // Check for Retry-After header
        const retryAfter = response.headers.get('Retry-After');
        let delay: number;
        
        if (retryAfter) {
          delay = parseInt(retryAfter, 10) * 1000;
        } else {
          // Exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s, 64s, 64s
          const baseDelay = Math.min(2000 * Math.pow(2, attempt), 64000);
          // Add jitter (0-25% of base delay) to prevent thundering herd
          const jitter = Math.random() * baseDelay * 0.25;
          delay = baseDelay + jitter;
        }
        
        console.log(`Rate limited (429). Retrying in ${Math.round(delay)}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Return response for other status codes (caller will handle errors)
      return response;
    } catch (error: any) {
      lastError = error;
      console.error(`Fetch attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < maxRetries - 1) {
        const baseDelay = Math.min(2000 * Math.pow(2, attempt), 64000);
        const jitter = Math.random() * baseDelay * 0.25;
        await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
      }
    }
  }
  
  throw lastError || new Error(`Failed after ${maxRetries} attempts`);
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

    // Preseason Trips database ID
    const databaseId = "29d5554f5d9b48f59e6a1b2777199ae0";

    console.log("Fetching blitzes from Preseason Trips database:", databaseId);

    // Fetch all pages from the Preseason Trips database with retry logic
    const notionResponse = await fetchNotionWithRetry(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Sort by date ascending
          sorts: [
            {
              property: "Date",
              direction: "ascending"
            }
          ]
        }),
      }
    );

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text();
      console.error("Notion API error:", errorText);
      throw new Error(`Notion API error: ${notionResponse.status}`);
    }

    const notionData = await notionResponse.json();
    console.log(`Found ${notionData.results.length} blitzes in Notion`);

    const blitzes = [];

    // Process each page
    for (const page of notionData.results as NotionPage[]) {
      try {
        const props = page.properties;

        // Helper to extract property values
        const getTitle = (prop: NotionProperty) => {
          if (prop?.type === "title" && prop.title?.length > 0) {
            return prop.title[0].plain_text;
          }
          return null;
        };

        const getRichText = (prop: NotionProperty) => {
          if (prop?.type === "rich_text" && prop.rich_text?.length > 0) {
            return prop.rich_text[0].plain_text;
          }
          return null;
        };
        
        const getPlace = (prop: NotionProperty) => {
          if (prop?.type === "location" && prop.location) {
            // Location type has address field
            return prop.location.address || null;
          }
          return null;
        };

        const getSelect = (prop: NotionProperty) => {
          if (prop?.type === "select" && prop.select) {
            return prop.select.name;
          }
          return null;
        };

        // Get blitz details
        const name = getTitle(props.Name);
        if (!name) continue;

        let date = null;
        let endDate = null;
        const dateProperty = props.Date;
        if (dateProperty?.type === 'date' && dateProperty.date) {
          date = dateProperty.date.start;
          endDate = dateProperty.date.end;
        }

        const location = getRichText(props.Location) || getSelect(props.Location);
        
        // Try multiple variations of the property name
        const address1 = getPlace(props["Address 1"]) || getRichText(props["Address 1"]) || 
                        getPlace(props["Address1"]) || getRichText(props["Address1"]) ||
                        getPlace(props["address 1"]) || getRichText(props["address 1"]);
        
        
        const wifi1 = getRichText(props["WiFi 1"]);
        const code1 = getRichText(props["Code 1"]);

        // Only include blitzes with valid dates
        if (date) {
          blitzes.push({
            id: page.id,
            name,
            date,
            endDate,
            location,
            address1,
            wifi1,
            code1,
          });
        }
      } catch (error: any) {
        console.error(`Error processing blitz ${page.id}:`, error);
      }
    }

    console.log(`Returning ${blitzes.length} blitzes`);

    return new Response(
      JSON.stringify({
        success: true,
        blitzes,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in fetch-preseason-blitzes:", error);
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
