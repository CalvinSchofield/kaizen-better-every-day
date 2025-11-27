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

    const { leaderNotionPageId } = await req.json();

    if (!leaderNotionPageId) {
      throw new Error("Leader Notion page ID is required");
    }

    console.log(`Fetching team members for leader: ${leaderNotionPageId}`);

    // Step 1: Find teams where this leader is the Group Lead
    // Query the Teams database
    const teamsResponse = await fetch(
      `https://api.notion.com/v1/databases/287070fe3bc280e1ab5fec17d5582878/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: {
            property: "Group Lead",
            relation: {
              contains: leaderNotionPageId
            }
          }
        }),
      }
    );

    if (!teamsResponse.ok) {
      throw new Error(`Failed to query Teams database: ${teamsResponse.status}`);
    }

    const teamsData = await teamsResponse.json();
    console.log(`Found ${teamsData.results.length} teams`);

    if (teamsData.results.length === 0) {
      return new Response(
        JSON.stringify({ teamMembers: [] }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Get all team IDs
    const teamIds = teamsData.results.map((team: any) => team.id);
    console.log(`Team IDs: ${teamIds.join(", ")}`);

    // Step 2: Find all reps that belong to these teams
    const repsResponse = await fetch(
      `https://api.notion.com/v1/databases/99130d187a8c4bbda60c77a230ddc364/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: {
            or: teamIds.map((teamId: string) => ({
              property: "Teams",
              relation: {
                contains: teamId
              }
            }))
          }
        }),
      }
    );

    if (!repsResponse.ok) {
      throw new Error(`Failed to query reps database: ${repsResponse.status}`);
    }

    const repsData = await repsResponse.json();
    console.log(`Found ${repsData.results.length} team members`);

    // Helper functions to extract data
    const getTitle = (prop: any) => {
      if (!prop || prop.type !== "title") return null;
      return prop.title?.[0]?.plain_text || null;
    };

    const getEmail = (prop: any) => {
      if (!prop || prop.type !== "email") return null;
      return prop.email || null;
    };

    const getPhone = (prop: any) => {
      if (!prop || prop.type !== "phone_number") return null;
      return prop.phone_number || null;
    };

    const getStatus = (prop: any) => {
      if (!prop || prop.type !== "status") return null;
      return prop.status?.name || null;
    };

    const getCheckbox = (prop: any) => {
      if (!prop || prop.type !== "checkbox") return false;
      return prop.checkbox || false;
    };

    const getRelation = (prop: any) => {
      if (!prop || prop.type !== "relation") return [];
      return prop.relation?.map((r: any) => r.id) || [];
    };

    const getSelect = (prop: any) => {
      if (!prop || prop.type !== "select") return null;
      return prop.select?.name || null;
    };

    // Process each team member
    const teamMembers = await Promise.all(
      repsData.results.map(async (page: any) => {
        const props = page.properties;

        const name = getTitle(props["Name"]);
        const email = getEmail(props["Email"]);
        const phone = getPhone(props["Phone"]);
        const onboardingStatus = getStatus(props["Onboarding Step Completed"]);
        const ipadAssigned = getCheckbox(props["iPad Assigned"]);
        const preseasonTrips = getRelation(props["Preseason trips"]);
        const year = getSelect(props["Year"]);
        const stage = getSelect(props["Stage"]);

        // Determine blitz readiness based on onboarding status
        const blitzReady = onboardingStatus === "Phase 4: Saddle Up!" || 
                          onboardingStatus === "Blitz ready";

        return {
          notionPageId: page.id,
          name,
          email,
          phone,
          onboardingStatus,
          blitzReady,
          ipadAssigned,
          committedBlitzes: preseasonTrips,
          year,
          stage,
        };
      })
    );

    console.log(`Processed ${teamMembers.length} team members`);

    return new Response(
      JSON.stringify({ teamMembers }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in fetch-team-members:", error);
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
