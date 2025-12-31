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

    // Fetch previous values for safer rollback if something goes wrong
    const [{ data: prevRep, error: prevRepError }, { data: prevRecruitBlitzes, error: prevRbError }] =
      await Promise.all([
        supabase
          .from("reps")
          .select("committed_blitzes")
          .eq("id", repId)
          .maybeSingle(),
        supabase
          .from("recruit_blitzes")
          .select("blitz_id")
          .eq("recruit_id", repId),
      ]);

    if (prevRepError) {
      console.error("Error fetching previous rep commitments:", prevRepError);
      throw prevRepError;
    }

    if (prevRbError) {
      console.error("Error fetching previous recruit_blitzes commitments:", prevRbError);
      throw prevRbError;
    }

    const previousCommittedBlitzes = (prevRep?.committed_blitzes ?? []) as string[];
    const previousRecruitBlitzIds = (prevRecruitBlitzes ?? []).map((r) => r.blitz_id);

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

    // Keep recruit_blitzes in sync (some screens read commitments from this table)
    try {
      const { error: deleteRbError } = await supabase
        .from("recruit_blitzes")
        .delete()
        .eq("recruit_id", repId);

      if (deleteRbError) {
        console.error("Error clearing recruit_blitzes:", deleteRbError);
        throw deleteRbError;
      }

      if (normalizedIds.length > 0) {
        const rows = normalizedIds.map((blitzId) => ({
          recruit_id: repId,
          blitz_id: blitzId,
        }));

        const { error: insertRbError } = await supabase
          .from("recruit_blitzes")
          .insert(rows);

        if (insertRbError) {
          console.error("Error inserting recruit_blitzes:", insertRbError);
          throw insertRbError;
        }
      }

      console.log("Successfully synced recruit_blitzes commitments");
    } catch (syncError) {
      // Best-effort rollback to avoid partial data updates
      console.error("Error syncing recruit_blitzes, attempting rollback:", syncError);

      await supabase
        .from("reps")
        .update({ committed_blitzes: previousCommittedBlitzes, updated_at: new Date().toISOString() })
        .eq("id", repId);

      await supabase.from("recruit_blitzes").delete().eq("recruit_id", repId);

      if (previousRecruitBlitzIds.length > 0) {
        await supabase.from("recruit_blitzes").insert(
          previousRecruitBlitzIds.map((blitzId) => ({
            recruit_id: repId,
            blitz_id: blitzId,
          }))
        );
      }

      throw syncError;
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
