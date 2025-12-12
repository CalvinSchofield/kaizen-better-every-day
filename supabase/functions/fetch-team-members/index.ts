import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry helper for Notion API with exponential backoff
async function fetchNotionWithRetry(url: string, options: RequestInit, maxRetries = 5): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If rate limited (429), retry with exponential backoff
      if (response.status === 429) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 32000); // Max 32 seconds
        console.log(`Rate limited (429). Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Return response for other status codes (caller will handle errors)
      return response;
    } catch (error: any) {
      lastError = error;
      console.error(`Fetch attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 32000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error(`Failed after ${maxRetries} attempts`);
}

// Helper function to process rep data from Notion
function processReps(reps: any[]): any[] {
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

  const getRollupText = (prop: any) => {
    if (!prop || prop.type !== "rollup") return null;
    const rollup = prop.rollup;
    if (rollup?.type === "array" && rollup.array?.length > 0) {
      const first = rollup.array[0];
      if (first?.type === "title" && first.title?.length > 0) {
        return first.title[0]?.plain_text || null;
      }
    }
    return null;
  };

  return reps.map((page: any) => {
    const props = page.properties;

    const name = getTitle(props["Name"]);
    const email = getEmail(props["Email"]);
    const phone = getPhone(props["Phone"]);
    const onboardingStatus = getStatus(props["Onboarding Step Completed"]);
    const ipadAssigned = getCheckbox(props["iPad Assigned"]);
    const preseasonTrips = getRelation(props["Preseason trips"]);
    const year = getSelect(props["Year"]);
    const stage = getSelect(props["Stage"]);
    const recruiter = getSelect(props["Recruiter"]);
    const teamName = getRollupText(props["Team Name"]) || getSelect(props["Team"]);
    const teamIds = getRelation(props["Teams"]); // Get team relation IDs
    
    // Ramp-to-blitz phase completion checkboxes
    const phase1Complete = getCheckbox(props["Phase 1 ✅"]);
    const phase2Complete = getCheckbox(props["Phase 2 ✅"]);
    const phase3Complete = getCheckbox(props["Phase 3 ✅"]);
    const phase4Complete = getCheckbox(props["Phase 4 ✅"]);
    
    // Onboarding checkboxes (for fallback when not in Supabase reps table)
    const onboardingComplete = getCheckbox(props["Onboarding Complete"]);
    const trainingsComplete = getCheckbox(props["Trainings Complete"]);
    const slackJoined = getCheckbox(props["Slack ✅"]);

    const blitzReady = onboardingStatus === "Phase 4: Saddle Up!" || 
                      onboardingStatus === "Blitz ready" ||
                      phase4Complete;

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
      recruiter,
      teamName,
      teamIds, // Include team IDs for filtering
      // Ramp-to-blitz phase completion
      phase1Complete,
      phase2Complete,
      phase3Complete,
      phase4Complete,
      // Onboarding completion
      onboardingComplete,
      trainingsComplete,
      slackJoined,
    };
  });
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

    const { leaderNotionPageId, fetchAllForAccessLevel, accessibleNotionIds } = await req.json();

    if (!leaderNotionPageId) {
      throw new Error("Leader Notion page ID is required");
    }

    console.log(`Fetching team members for leader: ${leaderNotionPageId}, accessLevel: ${fetchAllForAccessLevel || 'team_lead'}, accessibleNotionIds count: ${accessibleNotionIds?.length || 0}`);

    const MGMT_DATABASE_ID = '287070fe3bc280e1ab5fec17d5582878'; // Teams database
    const MGMT_GROUPS_DATABASE_ID = '287070fe3bc2804f874bd9dae57bd1b9'; // MGMT Groups database

    // For area directors and mgmt group leads, fetch ALL reps from Notion database
    // Also fetch teams and MGMT groups for proper filtering
    if (fetchAllForAccessLevel === 'area_director' || fetchAllForAccessLevel === 'mgmt_group_lead') {
      // Fetch teams and MGMT groups first for mapping
      const [teamsResponse, mgmtGroupsResponse] = await Promise.all([
        fetchNotionWithRetry(`https://api.notion.com/v1/databases/${MGMT_DATABASE_ID}/query`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${notionApiKey}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
        fetchNotionWithRetry(`https://api.notion.com/v1/databases/${MGMT_GROUPS_DATABASE_ID}/query`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${notionApiKey}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      ]);

      const [teamsData, mgmtGroupsData] = await Promise.all([
        teamsResponse.json(),
        mgmtGroupsResponse.json(),
      ]);

      // Build team to MGMT group mapping
      const teamToMgmtGroup = new Map<string, { mgmtGroupId: string; mgmtGroupName: string }>();
      const teamNames = new Map<string, string>();

      for (const team of teamsData.results || []) {
        const teamName = team.properties['Name']?.title?.[0]?.plain_text || 'Unnamed Team';
        teamNames.set(team.id, teamName);
      }

      for (const group of mgmtGroupsData.results || []) {
        const groupName = group.properties['Name']?.title?.[0]?.plain_text || 'Unnamed Group';
        const teamIds = (group.properties['Teams']?.relation || []).map((t: any) => t.id);
        for (const teamId of teamIds) {
          teamToMgmtGroup.set(teamId, { mgmtGroupId: group.id, mgmtGroupName: groupName });
        }
      }

      // Query all reps from the Notion database with pagination
      let allReps: any[] = [];
      let hasMore = true;
      let startCursor: string | undefined;

      while (hasMore) {
        const repsResponse = await fetchNotionWithRetry(
          `https://api.notion.com/v1/databases/99130d187a8c4bbda60c77a230ddc364/query`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${notionApiKey}`,
              "Notion-Version": "2022-06-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              start_cursor: startCursor,
              page_size: 100,
            }),
          }
        );

        if (!repsResponse.ok) {
          throw new Error(`Failed to query reps database: ${repsResponse.status}`);
        }

        const repsData = await repsResponse.json();
        allReps = [...allReps, ...repsData.results];
        
        hasMore = repsData.has_more;
        startCursor = repsData.next_cursor;
      }

      console.log(`Found ${allReps.length} total reps in Notion for ${fetchAllForAccessLevel}`);

      // Process reps and add team/mgmt group info
      const processedReps = processReps(allReps);
      const teamMembers = processedReps.map((rep: any) => {
        const repTeamId = rep.teamIds?.[0] || null; // First team relation
        const teamName = repTeamId ? teamNames.get(repTeamId) : rep.teamName;
        const mgmtInfo = repTeamId ? teamToMgmtGroup.get(repTeamId) : null;
        
        return {
          ...rep,
          teamId: repTeamId,
          teamName: teamName || rep.teamName,
          mgmtGroupId: mgmtInfo?.mgmtGroupId || null,
          mgmtGroupName: mgmtInfo?.mgmtGroupName || null,
        };
      });
      
      return new Response(
        JSON.stringify({ teamMembers, isTeamLead: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // For team leads: Find teams where this leader is the Group Lead
    const teamsResponse = await fetchNotionWithRetry(
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
        JSON.stringify({ teamMembers: [], isTeamLead: false }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Get all team IDs
    const teamIds = teamsData.results.map((team: any) => team.id);
    console.log(`Team IDs: ${teamIds.join(", ")}`);

    // Find all reps that belong to these teams
    const repsResponse = await fetchNotionWithRetry(
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

    // Process each team member
    const teamMembers = processReps(repsData.results);

    console.log(`Processed ${teamMembers.length} team members`);

    return new Response(
      JSON.stringify({ teamMembers, isTeamLead: true }),
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