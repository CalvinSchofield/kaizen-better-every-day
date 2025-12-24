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

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { nudgeValue } = await req.json();

    console.log(`[update-nudge] User ${user.email} setting nudge to:`, nudgeValue);

    // Update Supabase directly (no Notion)
    const { data: repData, error: updateError } = await supabase
      .from("reps")
      .update({
        nudge_leader: nudgeValue,
        last_nudge_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select('name')
      .single();

    if (updateError) {
      console.error("[update-nudge] Supabase update error:", updateError);
      throw new Error(`Failed to update nudge: ${updateError.message}`);
    }

    console.log(`[update-nudge] Successfully updated nudge for ${repData?.name || user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Nudge updated",
        repName: repData?.name,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[update-nudge] Error:", error);
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
