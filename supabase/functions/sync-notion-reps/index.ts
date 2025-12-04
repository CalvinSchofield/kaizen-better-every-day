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

// Retry helper for Notion API with exponential backoff
async function fetchNotionWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error(`Failed after ${maxRetries} attempts`);
}

// Batch fetch multiple Notion pages in parallel with concurrency limit
async function batchFetchNotionPages(
  pageIds: string[], 
  notionApiKey: string, 
  concurrency = 5
): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
  for (let i = 0; i < pageIds.length; i += concurrency) {
    const batch = pageIds.slice(i, i + concurrency);
    const promises = batch.map(async (pageId) => {
      try {
        const response = await fetchNotionWithRetry(
          `https://api.notion.com/v1/pages/${pageId}`,
          {
            headers: {
              'Authorization': `Bearer ${notionApiKey}`,
              'Notion-Version': '2022-06-28',
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          return { pageId, data };
        }
        return { pageId, data: null };
      } catch (error) {
        console.error(`Error fetching page ${pageId}:`, error);
        return { pageId, data: null };
      }
    });
    
    const batchResults = await Promise.all(promises);
    for (const { pageId, data } of batchResults) {
      if (data) results.set(pageId, data);
    }
  }
  
  return results;
}

// Helper functions for extracting Notion property values
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
  if (prop?.type === "email") return prop.email;
  return null;
};

const getPhone = (prop: NotionProperty) => {
  if (prop?.type === "phone_number") return prop.phone_number;
  return null;
};

const getSelect = (prop: NotionProperty) => {
  if (prop?.type === "select" && prop.select) return prop.select.name;
  return null;
};

const getStatus = (prop: NotionProperty) => {
  if (prop?.type === "status" && prop.status) return prop.status.name;
  return null;
};

const getCheckbox = (prop: NotionProperty) => {
  if (prop?.type === "checkbox") return prop.checkbox || false;
  return false;
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
    const databaseId = "99130d187a8c4bbda60c77a230ddc364";

    console.log("Starting optimized Notion sync...");

    // STEP 1: Fetch ALL pages from Notion (paginated)
    const allPages: NotionPage[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;
    
    while (hasMore) {
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
            page_size: 100,
            ...(startCursor ? { start_cursor: startCursor } : {}),
          }),
        }
      );

      if (!notionResponse.ok) {
        throw new Error(`Notion API error: ${notionResponse.status}`);
      }

      const notionData = await notionResponse.json();
      allPages.push(...notionData.results);
      hasMore = notionData.has_more;
      startCursor = notionData.next_cursor;
    }
    
    console.log(`Fetched ${allPages.length} pages from Notion`);

    // STEP 2: Fetch ALL auth users ONCE
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw new Error(`Error fetching users: ${authError.message}`);
    
    const usersByEmail = new Map<string, any>();
    for (const user of authData.users) {
      if (user.email) {
        usersByEmail.set(user.email.toLowerCase(), user);
      }
    }
    console.log(`Loaded ${usersByEmail.size} auth users`);

    // STEP 3: Collect all unique relation IDs to batch-fetch
    const teamIds = new Set<string>();
    const blitzTripIds = new Set<string>();
    
    for (const page of allPages) {
      const props = page.properties;
      
      // Collect team IDs
      if (props.Teams?.relation) {
        for (const rel of props.Teams.relation) {
          teamIds.add(rel.id);
        }
      }
      
      // Collect blitz trip IDs
      if (props["Preseason trips"]?.relation) {
        for (const rel of props["Preseason trips"].relation) {
          blitzTripIds.add(rel.id);
        }
      }
    }
    
    console.log(`Found ${teamIds.size} unique teams, ${blitzTripIds.size} unique blitz trips`);

    // STEP 4: Batch-fetch teams and blitz trips in parallel
    const [teamsData, blitzTripsData] = await Promise.all([
      batchFetchNotionPages(Array.from(teamIds), notionApiKey, 10),
      batchFetchNotionPages(Array.from(blitzTripIds), notionApiKey, 10),
    ]);
    
    console.log(`Fetched ${teamsData.size} teams, ${blitzTripsData.size} blitz trips`);

    // STEP 5: Collect leader IDs from teams and batch-fetch
    const leaderIds = new Set<string>();
    for (const teamData of teamsData.values()) {
      const groupLeadProp = teamData.properties['Group lead'] || teamData.properties['Group Lead'];
      if (groupLeadProp?.relation) {
        for (const rel of groupLeadProp.relation) {
          leaderIds.add(rel.id);
        }
      }
    }
    
    const leadersData = await batchFetchNotionPages(Array.from(leaderIds), notionApiKey, 10);
    console.log(`Fetched ${leadersData.size} leaders`);

    // Leader phone map for fallback
    const leaderPhoneMap: Record<string, string> = {
      'Calvin': '469-715-7056',
      'Christian': '209-519-3176',
      'Javier': '831-673-9285',
      'Adam': '972-369-6386',
      'Ammon': '714-510-1154',
      'Levi': '469-715-7056',
      'Ansel': '925-788-0112',
      'Quinn': '206-422-4462',
      'Misael': '484-664-0518',
    };

    // STEP 6: Process all reps using pre-fetched data
    const syncedReps: string[] = [];
    const errors: any[] = [];

    for (const page of allPages) {
      try {
        const props = page.properties;
        const name = getTitle(props.Name) || getRichText(props.Name) || "Unknown";
        const email = getEmail(props.Email) || getRichText(props.Email);

        if (!email) continue;

        const user = usersByEmail.get(email.toLowerCase());
        if (!user) continue;

        // Get ramp phase
        const rampPhase = getStatus(props["Onboarding Step Completed"]) || 
                          getSelect(props["Onboarding Step Completed"]) || "not started";
        const rampLower = rampPhase.toLowerCase();
        
        const onboardingComplete = rampLower.includes("onboarding") || rampLower.includes("trainings") || 
                                   rampLower.includes("slack") || rampLower.includes("phase");
        const trainingsComplete = rampLower.includes("trainings") || rampLower.includes("slack") || 
                                  rampLower.includes("phase");
        const slackJoined = rampLower.includes("slack") || rampLower.includes("phase");
        const rampPhase1Complete = rampLower.includes("phase 1") || rampLower.includes("phase 2") || 
                                   rampLower.includes("phase 3") || rampLower.includes("phase 4");
        const rampPhase2Complete = rampLower.includes("phase 2") || rampLower.includes("phase 3") || 
                                   rampLower.includes("phase 4");
        const rampPhase3Complete = rampLower.includes("phase 3") || rampLower.includes("phase 4");
        const rampPhase4Complete = rampLower.includes("phase 4");

        // Get team leader from pre-fetched data
        let teamLeaderName = '';
        let teamLeaderPhone = '';
        
        if (props.Teams?.relation?.length > 0) {
          const teamData = teamsData.get(props.Teams.relation[0].id);
          if (teamData) {
            const groupLeadProp = teamData.properties['Group lead'] || teamData.properties['Group Lead'];
            if (groupLeadProp?.relation?.length > 0) {
              const leaderData = leadersData.get(groupLeadProp.relation[0].id);
              if (leaderData) {
                const leaderFullName = getTitle(leaderData.properties.Name) || '';
                const leaderPhone = getPhone(leaderData.properties.Phone) || getRichText(leaderData.properties.Phone);
                const firstName = leaderFullName.replace(/[^\w\s]/g, '').trim().split(' ')[0];
                teamLeaderName = firstName === 'Levi' ? 'Calvin' : firstName;
                teamLeaderPhone = leaderPhoneMap[firstName] || leaderPhone || '';
              }
            }
          }
        }

        // Get blitz trips from pre-fetched data
        let blitzTripName: string | null = null;
        let blitzTripDate: string | null = null;
        let blitzTripEndDate: string | null = null;
        let blitzTripLocation: string | null = null;
        const committedBlitzes: any[] = [];

        if (props["Preseason trips"]?.relation) {
          for (const tripRelation of props["Preseason trips"].relation) {
            const tripData = blitzTripsData.get(tripRelation.id);
            if (tripData) {
              const tripName = getTitle(tripData.properties.Name);
              if (tripName) {
                const dateProp = tripData.properties.Date;
                const tripDate = dateProp?.date?.start || null;
                const tripEndDate = dateProp?.date?.end || null;
                const tripLocation = getRichText(tripData.properties.Location) || 
                                     getSelect(tripData.properties.Location);
                
                committedBlitzes.push({
                  id: tripRelation.id,
                  name: tripName,
                  date: tripDate || '',
                  endDate: tripEndDate,
                  location: tripLocation,
                  address1: getRichText(tripData.properties["Address 1"]),
                  address2: getRichText(tripData.properties["Address 2"]),
                  code1: getRichText(tripData.properties["Code 1"]),
                  code2: getRichText(tripData.properties["Code 2"]),
                  wifi1: getRichText(tripData.properties["WiFi 1"]),
                  wifi2: getRichText(tripData.properties["WiFi 2"]),
                });

                if (!blitzTripName) {
                  blitzTripName = tripName;
                  blitzTripDate = tripDate;
                  blitzTripEndDate = tripEndDate;
                  blitzTripLocation = tripLocation;
                }
              }
            }
          }
        }

        const repData = {
          user_id: user.id,
          notion_page_id: page.id,
          name,
          phone: getPhone(props.Phone) || getRichText(props.Phone),
          email,
          recruiter: getRichText(props.Recruiter) || getSelect(props.Recruiter),
          team_leader: teamLeaderName,
          team_leader_phone: teamLeaderPhone,
          stage: getSelect(props.Stage),
          year: getSelect(props.Year),
          blitz_trip_name: blitzTripName,
          blitz_trip_date: blitzTripDate,
          blitz_trip_end_date: blitzTripEndDate,
          blitz_trip_location: blitzTripLocation,
          committed_blitzes: committedBlitzes,
          onboarding_complete: onboardingComplete,
          trainings_complete: trainingsComplete,
          slack_joined: slackJoined,
          ramp_to_blitz_phase: rampPhase,
          ramp_phase_1_complete: rampPhase1Complete,
          ramp_phase_2_complete: rampPhase2Complete,
          ramp_phase_3_complete: rampPhase3Complete,
          ramp_phase_4_complete: rampPhase4Complete,
          blitz_ready: getCheckbox(props["Blitz Ready"]),
          path_to_pro_started: getCheckbox(props["Path to Pro Started"]),
          path_to_pro_progress: 0,
          ipad_assigned: getCheckbox(props["iPad Assigned"]),
          nudge_leader: getCheckbox(props["Nudge leader"]),
        };

        const { error: upsertError } = await supabase
          .from("reps")
          .upsert(repData, { onConflict: "user_id" });

        if (upsertError) {
          errors.push({ name, error: upsertError.message });
        } else {
          syncedReps.push(name);
        }
      } catch (error: any) {
        errors.push({ pageId: page.id, error: error.message });
      }
    }

    // STEP 7: Cleanup orphaned records
    const notionEmails = new Set(
      allPages
        .map((page) => {
          const email = getEmail(page.properties.Email) || getRichText(page.properties.Email);
          return email?.toLowerCase();
        })
        .filter(Boolean)
    );

    const { data: allReps } = await supabase.from("reps").select("id, user_id, name");
    if (allReps) {
      for (const rep of allReps) {
        const user = authData.users.find(u => u.id === rep.user_id);
        if (!user || !notionEmails.has(user.email?.toLowerCase())) {
          await supabase.from("reps").delete().eq("id", rep.id);
        }
      }
    }

    console.log(`Sync complete: ${syncedReps.length} reps synced`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedReps.length,
        syncedReps,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully synced ${syncedReps.length} reps from Notion`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error in sync-notion-reps:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
