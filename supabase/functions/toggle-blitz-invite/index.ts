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

    const { blitzId, repNotionPageId, isContacted } = await req.json();

    if (!blitzId || !repNotionPageId || typeof isContacted !== "boolean") {
      throw new Error("Missing required parameters: blitzId, repNotionPageId, isContacted");
    }

    console.log(`Toggling invite status - blitz: ${blitzId}, rep: ${repNotionPageId}, contacted: ${isContacted}`);

    if (isContacted) {
      // Add or update the invite record
      const { error: upsertError } = await supabase
        .from("blitz_invites")
        .upsert(
          {
            blitz_id: blitzId,
            rep_notion_page_id: repNotionPageId,
            contacted_by: user.id,
            contacted_at: new Date().toISOString(),
          },
          { onConflict: "blitz_id,rep_notion_page_id" }
        );

      if (upsertError) throw upsertError;

      console.log("Invite record created/updated");
    } else {
      // Remove the invite record
      const { error: deleteError } = await supabase
        .from("blitz_invites")
        .delete()
        .eq("blitz_id", blitzId)
        .eq("rep_notion_page_id", repNotionPageId);

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
  } catch (error: any) {
    console.error("Error in toggle-blitz-invite:", error);
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
