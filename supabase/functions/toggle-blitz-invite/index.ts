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

    const { blitzId, repId, repUserId, isContacted } = await req.json();

    if (!blitzId || !repId || typeof isContacted !== "boolean") {
      throw new Error("Missing required parameters: blitzId, repId, isContacted");
    }

    // Resolve rep_user_id if not provided
    let resolvedRepUserId = repUserId;
    if (!resolvedRepUserId) {
      const { data: rep } = await supabase
        .from("reps")
        .select("user_id")
        .eq("id", repId)
        .maybeSingle();
      resolvedRepUserId = rep?.user_id || null;
    }

    console.log(`Toggling invite status - blitz: ${blitzId}, rep: ${repId}, contacted: ${isContacted}`);

    if (isContacted) {
      // Add or update the invite record
      const { error: upsertError } = await supabase
        .from("blitz_invites")
        .upsert(
          {
            blitz_id: blitzId,
            rep_id: repId,
            rep_user_id: resolvedRepUserId,
            contacted_by: user.id,
            contacted_at: new Date().toISOString(),
          },
          { onConflict: "blitz_id,rep_id" }
        );

      if (upsertError) throw upsertError;

      console.log("Invite record created/updated");
    } else {
      // Remove the invite record
      const { error: deleteError } = await supabase
        .from("blitz_invites")
        .delete()
        .eq("blitz_id", blitzId)
        .eq("rep_id", repId);

      if (deleteError) throw deleteError;

      console.log("Invite record deleted");
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in toggle-blitz-invite:", errorMessage);
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: "Check function logs for more information",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
