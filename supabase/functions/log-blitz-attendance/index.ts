import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Exit stages that should be completely skipped
// Must match stageConstants.ts exactly
const EXIT_STAGES = ['Not Interested', 'Signed but Not Interested', 'Potential Follow Up'];

const isExitStage = (stage: string | null): boolean => {
  if (!stage) return false;
  return EXIT_STAGES.some(es => es.toLowerCase() === stage.toLowerCase());
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
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

    const { blitzId, blitzName, blitzEndDate } = await req.json();

    if (!blitzId) {
      throw new Error("Missing blitzId parameter");
    }

    console.log(`Logging attendance for blitz: ${blitzName} (${blitzId}), end date: ${blitzEndDate}`);

    // Get the current user's rep record to check processed_blitz_ids
    const { data: currentUserRep } = await supabase
      .from("reps")
      .select("id, notion_page_id, processed_blitz_ids")
      .eq("user_id", user.id)
      .maybeSingle();

    const processedBlitzIds = (currentUserRep?.processed_blitz_ids as string[]) || [];
    if (processedBlitzIds.includes(blitzId)) {
      console.log(`Blitz ${blitzName} already processed for this user, skipping`);
      return new Response(
        JSON.stringify({
          success: true,
          blitzName,
          attendeesCount: 0,
          loggedCount: 0,
          skipped: true,
          reason: "Already processed",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Find the blitz in Supabase - try UUID first, then notion_page_id
    let supabaseBlitzId = blitzId;
    const { data: blitzData } = await supabase
      .from("blitzes")
      .select("id")
      .or(`id.eq.${blitzId},notion_page_id.eq.${blitzId}`)
      .maybeSingle();

    if (blitzData?.id) {
      supabaseBlitzId = blitzData.id;
    }

    // Fetch all recruits who have this blitz in their commitments via recruit_blitzes junction
    const { data: recruitBlitzes } = await supabase
      .from("recruit_blitzes")
      .select("recruit_id")
      .eq("blitz_id", supabaseBlitzId);

    const recruitIds = (recruitBlitzes || []).map(rb => rb.recruit_id);

    // If no recruits via junction table, check the committed_blitzes JSON in reps table
    let attendees: any[] = [];
    
    if (recruitIds.length > 0) {
      const { data: recruitsData } = await supabase
        .from("recruits")
        .select("id, notion_page_id, name, stage")
        .in("id", recruitIds);
      attendees = recruitsData || [];
    }

    // Also check reps table for committed_blitzes containing this blitz ID
    const { data: repsWithBlitz } = await supabase
      .from("reps")
      .select("id, notion_page_id, name, stage, user_id")
      .contains("committed_blitzes", [blitzId]);

    // Combine and deduplicate by Supabase ID first, then notion_page_id
    const allAttendees = [...attendees];
    for (const rep of repsWithBlitz || []) {
      const existingById = allAttendees.find(a => a.id === rep.id);
      const existingByNotionId = rep.notion_page_id && allAttendees.find(a => a.notion_page_id === rep.notion_page_id);
      
      if (!existingById && !existingByNotionId) {
        allAttendees.push({
          id: rep.id,
          notion_page_id: rep.notion_page_id,
          name: rep.name,
          stage: rep.stage,
          user_id: rep.user_id,
        });
      }
    }

    console.log(`Found ${allAttendees.length} attendees for blitz ${blitzName}`);

    const activityDate = blitzEndDate || new Date().toISOString().split('T')[0];
    const results: { name: string; success: boolean; error?: string; skipped?: boolean }[] = [];

    for (const attendee of allAttendees) {
      const repId = attendee.id;
      const repNotionId = attendee.notion_page_id;
      const repName = attendee.name || "Unknown";
      const repStage = attendee.stage;

      // Use the best available identifier for the activity log
      const activityRepId = repNotionId || repId;

      try {
        if (isExitStage(repStage)) {
          console.log(`Skipping ${repName} - in exit stage "${repStage}"`);
          results.push({ name: repName, success: true, skipped: true, error: `In exit stage: ${repStage}` });
          continue;
        }

        // Check if we already logged attendance for this rep + blitz
        // Check by both Supabase ID and Notion ID
        let existingActivity = null;
        
        if (repId) {
          const { data } = await supabase
            .from("recruit_activities")
            .select("id")
            .eq("recruit_id", repId)
            .eq("activity_type", "in_person")
            .ilike("notes", `%${blitzName}%`)
            .maybeSingle();
          existingActivity = data;
        }
        
        if (!existingActivity && repNotionId) {
          const { data } = await supabase
            .from("recruit_activities")
            .select("id")
            .eq("rep_notion_page_id", repNotionId)
            .eq("activity_type", "in_person")
            .ilike("notes", `%${blitzName}%`)
            .maybeSingle();
          existingActivity = data;
        }

        if (existingActivity) {
          console.log(`Already logged attendance for ${repName} at ${blitzName}`);
          results.push({ name: repName, success: true, error: "Already logged" });
          continue;
        }

        // Log the in_person activity
        const { error: insertError } = await supabase
          .from("recruit_activities")
          .insert({
            rep_notion_page_id: activityRepId,
            recruit_id: repId, // New column for future lookups
            activity_type: "in_person",
            notes: `Met at ${blitzName} blitz`,
            logged_by_user_id: user.id,
            created_at: `${activityDate}T18:00:00Z`,
          });

        if (insertError) {
          console.error(`Error inserting activity for ${repName}:`, insertError);
          results.push({ name: repName, success: false, error: insertError.message });
          continue;
        }

        // Update last_contact in recruits table - try by ID first, then notion_page_id
        if (repId) {
          await supabase
            .from("recruits")
            .update({ last_contact: activityDate })
            .eq("id", repId);
        } else if (repNotionId) {
          await supabase
            .from("recruits")
            .update({ last_contact: activityDate })
            .eq("notion_page_id", repNotionId);
        }

        console.log(`Successfully logged attendance for ${repName}`);
        results.push({ name: repName, success: true });
      } catch (repError: any) {
        console.error(`Error processing ${repName}:`, repError);
        results.push({ name: repName, success: false, error: repError.message });
      }
    }

    // Mark this blitz as processed in the database
    if (currentUserRep?.id) {
      const updatedProcessedIds = [...processedBlitzIds, blitzId];
      await supabase
        .from("reps")
        .update({ processed_blitz_ids: updatedProcessedIds })
        .eq("user_id", user.id);
    }

    const successCount = results.filter(r => r.success && !r.skipped).length;
    const skippedCount = results.filter(r => r.skipped).length;

    return new Response(
      JSON.stringify({
        success: true,
        blitzName,
        attendeesCount: allAttendees.length,
        loggedCount: successCount,
        skippedCount,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in log-blitz-attendance:", error);
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
