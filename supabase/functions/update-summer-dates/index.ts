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

    const { repId, startDate, endDate } = await req.json();

    if (!repId) {
      throw new Error("repId is required");
    }

    if (!startDate && !endDate) {
      throw new Error("At least one of startDate or endDate must be provided");
    }

    console.log(`Updating summer dates for repId: ${repId}`, { startDate, endDate });

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

    // Update reps table by ID
    const { data: repData, error: updateError } = await supabase
      .from('reps')
      .update(updateData)
      .eq('id', repId)
      .select('user_id')
      .single();

    if (updateError) {
      console.error("Supabase update error:", updateError);
      throw new Error(`Failed to update summer dates: ${updateError.message}`);
    }

    // Also update season_config if user has one
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

    console.log("Successfully updated summer dates");

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
