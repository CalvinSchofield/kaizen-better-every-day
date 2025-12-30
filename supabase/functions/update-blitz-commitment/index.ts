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

    const { repId, blitzPageIds } = await req.json();

    if (!repId) {
      throw new Error("Rep ID is required");
    }

    if (!Array.isArray(blitzPageIds)) {
      throw new Error("blitzPageIds must be an array");
    }

    console.log(`Updating blitz commitments for rep ${repId}`);
    console.log(`Blitz IDs received:`, blitzPageIds);

    // Normalize blitzPageIds - extract IDs if objects were passed
    const normalizedIds: string[] = blitzPageIds.map((item: string | { id: string }) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'id' in item) return item.id;
      throw new Error(`Invalid blitz item format: ${JSON.stringify(item)}`);
    });

    console.log(`Normalized blitz IDs:`, normalizedIds);

    // Update the reps table with the committed blitzes
    const { error: updateError } = await supabase
      .from('reps')
      .update({ 
        committed_blitzes: normalizedIds,
        updated_at: new Date().toISOString()
      })
      .eq('id', repId);

    if (updateError) {
      console.error("Error updating reps table:", updateError);
      throw updateError;
    }

    console.log("Successfully updated blitz commitments in Supabase");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Blitz commitments updated"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in update-blitz-commitment:", errorMessage);
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
