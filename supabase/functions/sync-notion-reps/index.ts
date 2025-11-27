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

    const getDate = (prop: NotionProperty) => {
      if (prop?.type === "date" && prop.date) {
        return { start: prop.date.start, end: prop.date.end };
      }
      return { start: null, end: null };
    };

        const getStatus = (prop: NotionProperty) => {
          if (prop?.type === "status" && prop.status) {
            return prop.status.name;
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
        const ipadAssigned = getCheckbox(props["iPad Assigned"]);

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

        // Get Onboarding Step Completed - SINGLE SOURCE OF TRUTH for ALL journey progression
        console.log("Notion properties available:", Object.keys(props));
        console.log("Looking for 'Onboarding Step Completed' property...");
        
        // Debug: Log the actual property object
        const rampProp = props["Onboarding Step Completed"];
        console.log("Raw property object:", JSON.stringify(rampProp, null, 2));
        console.log("Property type:", rampProp?.type);
        console.log("Property select:", rampProp?.select);
        
        const rampPhase = getStatus(props["Onboarding Step Completed"]) || getSelect(props["Onboarding Step Completed"]) || "not started";
        console.log("Found ramp phase value:", rampPhase);
        const rampLower = rampPhase.toLowerCase();
        
        // Derive all step completions from the single Ramp to Blitz Phase property
        const onboardingComplete = rampLower.includes("onboarding") || rampLower.includes("trainings") || rampLower.includes("slack") || rampLower.includes("phase");
        const trainingsComplete = rampLower.includes("trainings") || rampLower.includes("slack") || rampLower.includes("phase");
        const slackJoined = rampLower.includes("slack") || rampLower.includes("phase");
        
        // Map phase to boolean completions for backward compatibility
        const rampPhase1Complete = rampLower.includes("phase 1") || rampLower.includes("phase 2") || rampLower.includes("phase 3") || rampLower.includes("phase 4");
        const rampPhase2Complete = rampLower.includes("phase 2") || rampLower.includes("phase 3") || rampLower.includes("phase 4");
        const rampPhase3Complete = rampLower.includes("phase 3") || rampLower.includes("phase 4");
        const rampPhase4Complete = rampLower.includes("phase 4");

        // Fetch team leader info from Teams relation
        let teamLeaderName = '';
        let teamLeaderPhone = '';
        
        console.log(`Processing team leader for ${name}...`);
        console.log('Teams property:', JSON.stringify(props.Teams, null, 2));
        
        if (props.Teams?.relation && props.Teams.relation.length > 0) {
          try {
            const teamId = props.Teams.relation[0].id;
            console.log(`Fetching team with ID: ${teamId}`);
            
            const teamResponse = await fetch(`https://api.notion.com/v1/pages/${teamId}`, {
              headers: {
                'Authorization': `Bearer ${notionApiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json',
              },
            });
            
            if (teamResponse.ok) {
              const teamData = await teamResponse.json();
              console.log('Team data properties:', Object.keys(teamData.properties));
              console.log('Team name:', getTitle(teamData.properties.Name));
              
              // Try both "Group lead" and "Group Lead" (case sensitive)
              const groupLeadProperty = teamData.properties['Group lead'] || teamData.properties['Group Lead'];
              console.log('Group lead property:', JSON.stringify(groupLeadProperty, null, 2));
              
              if (groupLeadProperty?.relation && groupLeadProperty.relation.length > 0) {
                const leaderId = groupLeadProperty.relation[0].id;
                console.log(`Fetching leader with ID: ${leaderId}`);
                
                const leaderResponse = await fetch(`https://api.notion.com/v1/pages/${leaderId}`, {
                  headers: {
                    'Authorization': `Bearer ${notionApiKey}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json',
                  },
                });
                
                if (leaderResponse.ok) {
                  const leaderData = await leaderResponse.json();
                  console.log('Leader data properties:', Object.keys(leaderData.properties));
                  
                  const leaderFullName = getTitle(leaderData.properties.Name);
                  const leaderPhone = getPhone(leaderData.properties.Phone) || getRichText(leaderData.properties.Phone);
                  
                  console.log(`Leader full name: ${leaderFullName}`);
                  console.log(`Leader phone from Notion: ${leaderPhone}`);
                  
                  // Extract first name only (remove emojis and extra text)
                  const firstName = leaderFullName
                    .replace(/[^\w\s]/g, '') // Remove emojis and special chars
                    .trim()
                    .split(' ')[0];
                  
                  console.log(`Extracted first name: ${firstName}`);
                  
                  // Map leader names to phone numbers
                  const leaderPhoneMap: Record<string, string> = {
                    'Calvin': '469-715-7056',
                    'Christian': '209-519-3176',
                    'Javier': '831-673-9285',
                    'Adam': '972-369-6386',
                    'Ammon': '714-510-1154',
                    'Levi': '469-715-7056', // Forward to Calvin
                    'Ansel': '925-788-0112',
                    'Quinn': '206-422-4462',
                    'Misael': '484-664-0518',
                  };
                  
                  // For Levi, always use Calvin's name
                  teamLeaderName = firstName === 'Levi' ? 'Calvin' : firstName;
                  teamLeaderPhone = leaderPhoneMap[firstName] || leaderPhone || '';
                  
                  console.log(`Final team leader name: ${teamLeaderName}`);
                  console.log(`Final team leader phone: ${teamLeaderPhone}`);
                } else {
                  console.error(`Failed to fetch leader: ${leaderResponse.status}`);
                }
              } else {
                console.log('No Group lead relation found');
              }
            } else {
              console.error(`Failed to fetch team: ${teamResponse.status}`);
            }
          } catch (error) {
            console.error('Error fetching team leader info:', error);
          }
        } else {
          console.log('No Teams relation found');
        }

        // Fetch blitz trip details from Preseason trips relation
        let blitzTripName: string | null = null;
        let blitzTripDate: string | null = null;
        let blitzTripEndDate: string | null = null;
        let blitzTripLocation: string | null = null;
        const committedBlitzes: Array<{id: string, name: string, date: string, endDate: string | null, location: string | null}> = [];

        console.log(`Processing blitz trips for ${name}...`);
        console.log('Preseason trips property:', JSON.stringify(props["Preseason trips"], null, 2));

        if (props["Preseason trips"]?.relation && props["Preseason trips"].relation.length > 0) {
          try {
            // Fetch ALL committed blitzes with full details
            for (const tripRelation of props["Preseason trips"].relation) {
              const tripId = tripRelation.id;
              console.log(`Fetching trip with ID: ${tripId}`);

              const tripResponse = await fetch(`https://api.notion.com/v1/pages/${tripId}`, {
                headers: {
                  'Authorization': `Bearer ${notionApiKey}`,
                  'Notion-Version': '2022-06-28',
                  'Content-Type': 'application/json',
                },
              });

              if (tripResponse.ok) {
                const tripData = await tripResponse.json();
                const tripName = getTitle(tripData.properties.Name);
                
                if (tripName) {
                  const dateProperty = tripData.properties.Date;
                  let tripDate = null;
                  let tripEndDate = null;
                  
                  if (dateProperty?.type === 'date' && dateProperty.date) {
                    tripDate = dateProperty.date.start;
                    tripEndDate = dateProperty.date.end;
                    console.log(`Trip dates: ${tripDate} to ${tripEndDate}`);
                  }

                  const tripLocation = getRichText(tripData.properties.Location) || getSelect(tripData.properties.Location);
                  console.log(`Trip location: ${tripLocation}`);
                  
                  // Store full blitz details INCLUDING the ID for comparison
                  committedBlitzes.push({
                    id: tripId,
                    name: tripName,
                    date: tripDate || '',
                    endDate: tripEndDate,
                    location: tripLocation,
                  });
                  console.log(`Added committed blitz: ${tripName} (ID: ${tripId})`);
                  
                  // For the first trip, also set the legacy fields for backward compatibility
                  if (!blitzTripName) {
                    blitzTripName = tripName;
                    blitzTripDate = tripDate;
                    blitzTripEndDate = tripEndDate;
                    blitzTripLocation = tripLocation;
                  }
                }
              } else {
                console.error(`Failed to fetch trip: ${tripResponse.status}`);
              }
            }
            
            console.log(`Total committed blitzes: ${committedBlitzes.length}`, committedBlitzes);
          } catch (error) {
            console.error('Error fetching blitz trip info:', error);
          }
        } else {
          console.log('No Preseason trips relation found');
        }

        const repData = {
          user_id: user.id,
          notion_page_id: page.id,
          name,
          phone,
          email,
          recruiter: getRichText(props.Recruiter) || getSelect(props.Recruiter),
          team_leader: teamLeaderName,
          team_leader_phone: teamLeaderPhone,
          stage: getStatus(props.Stage) || getSelect(props.Stage),
          year: getSelect(props.Year), // "Rookie", "Sophomore", or "Vet"
          
          // Blitz trip details
          blitz_trip_name: blitzTripName,
          blitz_trip_date: blitzTripDate,
          blitz_trip_end_date: blitzTripEndDate,
          blitz_trip_location: blitzTripLocation,
          committed_blitzes: committedBlitzes,
          
          // Journey progress - from Journey Step property
          onboarding_complete: onboardingComplete,
          trainings_complete: trainingsComplete,
          slack_joined: slackJoined,
          
          // Ramp to Blitz Phase - raw value from Notion
          ramp_to_blitz_phase: rampPhase,
          
          // Ramp to Blitz phases - from Ramp To Blitz Phase property (backward compatibility)
          ramp_phase_1_complete: rampPhase1Complete,
          ramp_phase_2_complete: rampPhase2Complete,
          ramp_phase_3_complete: rampPhase3Complete,
          ramp_phase_4_complete: rampPhase4Complete,
          
          // Post-blitz
          blitz_ready: getCheckbox(props["Blitz Ready"]),
          path_to_pro_started: getCheckbox(props["Path to Pro Started"]),
          path_to_pro_progress: 0,
          
          // iPad assignment
          ipad_assigned: ipadAssigned,
          
          // Nudge leader
          nudge_leader: getCheckbox(props["Nudge leader"]),
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

    // Cleanup: Remove rep records where the user's email doesn't match any Notion email
    console.log("Starting cleanup of orphaned rep records...");
    const notionEmails = new Set(
      notionData.results
        .map((page: NotionPage) => {
          const props = page.properties;
          const getEmail = (prop: NotionProperty) => {
            if (prop?.type === "email") return prop.email;
            return null;
          };
          const getRichText = (prop: NotionProperty) => {
            if (prop?.type === "rich_text" && prop.rich_text?.length > 0) {
              return prop.rich_text[0].plain_text;
            }
            return null;
          };
          return getEmail(props.Email) || getRichText(props.Email);
        })
        .filter(Boolean)
    );

    // Get all existing rep records
    const { data: allReps, error: fetchError } = await supabase
      .from("reps")
      .select("id, user_id, email, name");

    if (fetchError) {
      console.error("Error fetching reps for cleanup:", fetchError);
    } else if (allReps) {
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      
      for (const rep of allReps) {
        // Find the Supabase user for this rep
        const user = authUsers?.users.find(u => u.id === rep.user_id);
        
        if (!user) {
          console.log(`Deleting rep ${rep.name} - user no longer exists`);
          await supabase.from("reps").delete().eq("id", rep.id);
          continue;
        }
        
        // Check if the user's email matches any Notion email
        if (!notionEmails.has(user.email)) {
          console.log(`Deleting rep ${rep.name} - email ${user.email} not found in Notion`);
          await supabase.from("reps").delete().eq("id", rep.id);
        }
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
