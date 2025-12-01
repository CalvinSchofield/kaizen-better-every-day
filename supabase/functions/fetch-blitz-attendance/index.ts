import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamMember {
  notionPageId: string;
  name: string;
  email: string | null;
  phone: string | null;
  blitzReady: boolean;
  committedBlitzes: string[];
  ipadAssigned: boolean;
  year: string | null;
  stage: string | null;
  onboardingStatus: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const notionApiKey = Deno.env.get("NOTION_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !notionApiKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { scope, leaderNotionPageId } = await req.json();
    
    if (!scope || !leaderNotionPageId) {
      throw new Error("Missing required parameters: scope and leaderNotionPageId");
    }

    console.log(`Fetching blitz attendance for scope: ${scope}, leader: ${leaderNotionPageId}`);

    // Fetch leader's access level and teams using the existing fetch-team-access logic
    const { data: repData, error: repError } = await supabase
      .from("reps")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (repError || !repData) {
      console.error("Rep data error:", repError);
      throw new Error("Rep data not found");
    }

    console.log("Rep data found:", { email: repData.email, notionPageId: repData.notion_page_id });

    // Determine access level based on email
    const areaDirectorEmails = ["calvinjschofield@gmail.com", "calvin.schofield@vivint.com"];
    const isAreaDirector = repData.email && areaDirectorEmails.includes(repData.email.toLowerCase());

    let accessibleUserIds: string[] = [];
    let accessibleReps: TeamMember[] = [];

    if (scope === "you") {
      // Personal view - no team members, just their own data
      accessibleReps = [];
    } else {
      // Fetch teams and MGMT groups from Notion
      const teamsResponse = await fetch(
        `https://api.notion.com/v1/databases/287070fe3bc280e1ab5fec17d5582878/query`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${notionApiKey}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ page_size: 100 }),
        }
      );

      const teamsData = await teamsResponse.json();
      const teams = teamsData.results || [];
      
      console.log(`Fetched ${teams.length} teams from Notion`);

      // Determine which teams the leader has access to based on scope
      let accessibleTeamIds: string[] = [];

      if (scope === "office" && isAreaDirector) {
        // Area Director sees all teams
        accessibleTeamIds = teams.map((team: any) => team.id);
        console.log(`Area Director - accessible teams: ${accessibleTeamIds.length}`);
      } else if (scope === "mgmt" || scope === "team") {
        // Find teams where this leader is the Group Lead
        for (const team of teams) {
          const groupLeadRelation = team.properties?.["Group Lead"]?.relation || [];
          console.log(`Checking team ${team.id}:`, {
            teamName: team.properties?.Name?.title?.[0]?.plain_text,
            groupLeadRelation: groupLeadRelation.map((r: any) => r.id)
          });
          if (groupLeadRelation.some((rel: any) => rel.id === leaderNotionPageId)) {
            accessibleTeamIds.push(team.id);
            console.log(`✓ Leader has access to team: ${team.properties?.Name?.title?.[0]?.plain_text}`);
          }
        }
        console.log(`${scope} scope - accessible teams: ${accessibleTeamIds.length}`);
      }

      // Fetch all reps from Notion
      const repsResponse = await fetch(
        `https://api.notion.com/v1/databases/99130d187a8c4bbda60c77a230ddc364/query`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${notionApiKey}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ page_size: 100 }),
        }
      );

      const repsData = await repsResponse.json();
      const notionReps = repsData.results || [];
      
      console.log(`Fetched ${notionReps.length} reps from Notion`);
      console.log(`Accessible team IDs: ${accessibleTeamIds.join(', ')}`);

      // Filter reps based on accessible teams
      for (const rep of notionReps) {
        const emailProp = rep.properties?.Email?.email;
        if (!emailProp) continue;

        const teamsRelation = rep.properties?.Teams?.relation || [];
        const hasAccessToRep = teamsRelation.some((teamRel: any) =>
          accessibleTeamIds.includes(teamRel.id)
        );

        console.log(`Checking rep ${rep.properties?.Name?.title?.[0]?.plain_text}:`, {
          email: emailProp,
          teams: teamsRelation.map((t: any) => t.id),
          hasAccess: hasAccessToRep
        });

        if (!hasAccessToRep) continue;

        // Fetch Supabase user ID for this rep
        const { data: repUser } = await supabase
          .from("reps")
          .select("user_id, notion_page_id, name, email, phone, year, stage, ipad_assigned, committed_blitzes")
          .ilike("email", emailProp)
          .single();

        if (repUser) {
          accessibleUserIds.push(repUser.user_id);

          const committedBlitzes = Array.isArray(repUser.committed_blitzes)
            ? repUser.committed_blitzes.map((b: any) => b.id).filter((id: string) => id)
            : [];

          const onboardingStatus = rep.properties?.["Onboarding Step Completed"]?.status?.name ||
            rep.properties?.["Onboarding Step Completed"]?.select?.name || null;

          accessibleReps.push({
            notionPageId: rep.id,
            name: repUser.name,
            email: repUser.email,
            phone: repUser.phone,
            blitzReady: onboardingStatus?.includes("Phase 4") || false,
            committedBlitzes,
            ipadAssigned: repUser.ipad_assigned || false,
            year: repUser.year,
            stage: repUser.stage,
            onboardingStatus,
          });
          
          console.log(`✓ Added rep: ${repUser.name}`);
        } else {
          console.log(`✗ No Supabase user found for email: ${emailProp}`);
        }
      }
      
      console.log(`Total accessible reps found: ${accessibleReps.length}`);
    }

    // Fetch contacted/invite status from blitz_invites table
    const { data: inviteData, error: inviteError } = await supabase
      .from("blitz_invites")
      .select("*");

    if (inviteError) {
      console.error("Error fetching blitz invites:", inviteError);
    }

    // Transform invite data into format expected by frontend
    const contactedForBlitz: { [blitzId: string]: string[] } = {};
    if (inviteData) {
      for (const invite of inviteData) {
        if (!contactedForBlitz[invite.blitz_id]) {
          contactedForBlitz[invite.blitz_id] = [];
        }
        contactedForBlitz[invite.blitz_id].push(invite.rep_notion_page_id);
      }
    }

    return new Response(
      JSON.stringify({
        teamMembers: accessibleReps,
        contactedForBlitz,
        accessibleUserIds,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in fetch-blitz-attendance:", error);
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
