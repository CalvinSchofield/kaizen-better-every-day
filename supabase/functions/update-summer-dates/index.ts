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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { notionPageId, repId, startDate, endDate } = await req.json();

    if (!notionPageId && !repId) {
      throw new Error("notionPageId or repId is required");
    }

    if (!startDate && !endDate) {
      throw new Error("At least one of startDate or endDate must be provided");
    }

    console.log(`Updating summer dates in Supabase`, { notionPageId, repId, startDate, endDate });

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    
    if (startDate) {
      updateData.blitz_trip_date = startDate;
    }

    if (endDate) {
      updateData.blitz_trip_end_date = endDate;
    }

    // Update reps table
    let updateQuery = supabase.from('reps').update(updateData);
    
    if (repId) {
      updateQuery = updateQuery.eq('id', repId);
    } else {
      updateQuery = updateQuery.eq('notion_page_id', notionPageId);
    }

    const { error: updateError } = await updateQuery;

    if (updateError) {
      console.error("Supabase update error:", updateError);
      throw new Error(`Failed to update summer dates: ${updateError.message}`);
    }

    // Also update season_config if user has one
    if (notionPageId || repId) {
      // Get user_id from reps
      let userQuery = supabase.from('reps').select('user_id');
      if (repId) {
        userQuery = userQuery.eq('id', repId);
      } else {
        userQuery = userQuery.eq('notion_page_id', notionPageId);
      }
      
      const { data: repData } = await userQuery.single();
      
      if (repData?.user_id) {
        const seasonConfigUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
        if (startDate) seasonConfigUpdate.personal_summer_start = startDate;
        if (endDate) seasonConfigUpdate.personal_summer_end = endDate;

        await supabase
          .from('season_config')
          .upsert({
            user_id: repData.user_id,
            ...seasonConfigUpdate,
          }, { onConflict: 'user_id' });
      }
    }

    console.log("Successfully updated summer dates in Supabase");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Summer dates updated"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in update-summer-dates:", error);
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
