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

    // Notion database ID for reps
    const databaseId = "99130d187a8c4bbda60c77a230ddc364";

    console.log("Fetching pages from Notion database:", databaseId);

    // Fetch all pages from the Notion database
    const notionResponse = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text();
      console.error("Notion API error:", errorText);
      throw new Error(`Notion API error: ${notionResponse.status}`);
    }

    const notionData = await notionResponse.json();
    console.log(`Found ${notionData.results.length} pages in Notion`);

    const syncedReps = [];
    const errors = [];

    // Process each page
    for (const page of notionData.results as NotionPage[]) {
      try {
        // Extract properties from Notion page
        const props = page.properties;

        // Helper to safely extract property values
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

        const getEmail = (prop: NotionProperty) => {
          if (prop?.type === "email") {
            return prop.email;
          }
          return null;
        };

        const getPhone = (prop: NotionProperty) => {
          if (prop?.type === "phone_number") {
            return prop.phone_number;
          }
          return null;
        };

        const getSelect = (prop: NotionProperty) => {
          if (prop?.type === "select" && prop.select) {
            return prop.select.name;
          }
          return null;
        };

        const getCheckbox = (prop: NotionProperty) => {
          if (prop?.type === "checkbox") {
            return prop.checkbox || false;
          }
          return false;
        };

        // Map Notion properties to our database fields
        const name = getTitle(props.Name) || getRichText(props.Name) || "Unknown";
        const email = getEmail(props.Email) || getRichText(props.Email);
        const phone = getPhone(props.Phone) || getRichText(props.Phone);

        if (!email) {
          console.log(`Skipping page ${page.id} - no email found`);
          continue;
        }

        // Find user by email
        const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
        
        if (authError) {
          throw new Error(`Error fetching users: ${authError.message}`);
        }

        const user = authUser.users.find(u => u.email === email);
        
        if (!user) {
          console.log(`No user found for email ${email}, skipping`);
          continue;
        }

        const repData = {
          user_id: user.id,
          notion_page_id: page.id,
          name,
          phone,
          email,
          recruiter: getRichText(props.Recruiter) || getSelect(props.Recruiter),
          team_leader: getRichText(props["Team Leader"]) || getSelect(props["Team Leader"]),
          stage: getSelect(props.Stage),
          
          // Journey progress
          onboarding_complete: getCheckbox(props["Onboarding Complete"]),
          trainings_complete: getCheckbox(props["Trainings Complete"]),
          slack_joined: getCheckbox(props["Slack Joined"]),
          
          // Ramp to Blitz phases
          ramp_phase_1_complete: getCheckbox(props["Ramp Phase 1 Complete"]),
          ramp_phase_2_complete: getCheckbox(props["Ramp Phase 2 Complete"]),
          ramp_phase_3_complete: getCheckbox(props["Ramp Phase 3 Complete"]),
          ramp_phase_4_complete: getCheckbox(props["Ramp Phase 4 Complete"]),
          
          // Post-blitz
          blitz_ready: getCheckbox(props["Blitz Ready"]),
          path_to_pro_started: getCheckbox(props["Path to Pro Started"]),
          path_to_pro_progress: 0, // Can be enhanced to read from Notion
        };

        // Upsert rep data
        const { error: upsertError } = await supabase
          .from("reps")
          .upsert(repData, { onConflict: "user_id" });

        if (upsertError) {
          console.error(`Error upserting rep ${name}:`, upsertError);
          errors.push({ name, error: upsertError.message });
        } else {
          console.log(`Successfully synced rep: ${name}`);
          syncedReps.push(name);
        }
      } catch (error: any) {
        console.error(`Error processing page ${page.id}:`, error);
        errors.push({ pageId: page.id, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedReps.length,
        syncedReps,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully synced ${syncedReps.length} reps from Notion`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in sync-notion-reps:", error);
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
