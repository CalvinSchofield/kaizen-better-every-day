import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate Mon-Sat dates between start and end (inclusive), skip past dates
const getWorkDaysInRange = (startStr: string, endStr: string): string[] => {
  const days: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  const current = new Date(start);
  while (current <= end) {
    const dow = current.getDay();
    if (dow !== 0 && current >= today) { // Skip Sunday and past dates
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      days.push(`${y}-${m}-${d}`);
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
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
          .select("committed_blitzes, user_id")
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
    const repUserId = prevRep?.user_id;

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

    // === AUTO-GENERATE PLANNED WORK DAYS FOR BLITZ DATE RANGES ===
    if (repUserId) {
      try {
        // Determine which blitzes were added vs removed
        const prevIds = previousRecruitBlitzIds.map(String);
        const newIds = normalizedIds.map(String);
        const addedBlitzIds = newIds.filter(id => !prevIds.includes(id));
        const removedBlitzIds = prevIds.filter(id => !newIds.includes(id));

        // Remove planned days for removed blitzes
        if (removedBlitzIds.length > 0) {
          const { data: removedBlitzes } = await supabase
            .from("blitzes")
            .select("id, date, end_date")
            .in("id", removedBlitzIds);

          if (removedBlitzes && removedBlitzes.length > 0) {
            const daysToRemove: string[] = [];
            for (const blitz of removedBlitzes) {
              const endDate = blitz.end_date || blitz.date;
              // Get ALL work days in range (including past) for removal
              const [sy, sm, sd] = blitz.date.split('-').map(Number);
              const [ey, em, ed] = endDate.split('-').map(Number);
              const start = new Date(sy, sm - 1, sd);
              const end = new Date(ey, em - 1, ed);
              const current = new Date(start);
              while (current <= end) {
                const dow = current.getDay();
                if (dow !== 0) {
                  const y = current.getFullYear();
                  const m = String(current.getMonth() + 1).padStart(2, '0');
                  const d = String(current.getDate()).padStart(2, '0');
                  daysToRemove.push(`${y}-${m}-${d}`);
                }
                current.setDate(current.getDate() + 1);
              }
            }

            if (daysToRemove.length > 0) {
              const { error: removeError } = await supabase
                .from("planned_work_days")
                .delete()
                .eq("user_id", repUserId)
                .in("planned_date", daysToRemove);

              if (removeError) {
                console.error("Error removing planned days for removed blitzes:", removeError);
              } else {
                console.log(`Removed ${daysToRemove.length} planned days for removed blitzes`);
              }
            }
          }
        }

        // Add planned days for newly added blitzes
        if (addedBlitzIds.length > 0) {
          const { data: addedBlitzes } = await supabase
            .from("blitzes")
            .select("id, date, end_date")
            .in("id", addedBlitzIds);

          if (addedBlitzes && addedBlitzes.length > 0) {
            const allDaysToAdd: string[] = [];
            for (const blitz of addedBlitzes) {
              const endDate = blitz.end_date || blitz.date;
              const workDays = getWorkDaysInRange(blitz.date, endDate);
              allDaysToAdd.push(...workDays);
            }

            // Deduplicate
            const uniqueDays = [...new Set(allDaysToAdd)];

            if (uniqueDays.length > 0) {
              // Fetch existing planned days to avoid duplicates
              const { data: existingDays } = await supabase
                .from("planned_work_days")
                .select("planned_date")
                .eq("user_id", repUserId)
                .in("planned_date", uniqueDays);

              const existingSet = new Set((existingDays || []).map(d => d.planned_date));
              const newDays = uniqueDays.filter(d => !existingSet.has(d));

              if (newDays.length > 0) {
                const rows = newDays.map(date => ({
                  user_id: repUserId,
                  planned_date: date,
                }));

                const { error: insertError } = await supabase
                  .from("planned_work_days")
                  .insert(rows);

                if (insertError) {
                  console.error("Error inserting planned work days:", insertError);
                } else {
                  console.log(`Added ${newDays.length} planned work days for new blitz commitments`);
                }
              }
            }
          }
        }
      } catch (plannedDaysError) {
        // Non-critical - log but don't fail the whole request
        console.error("Error syncing planned work days (non-critical):", plannedDaysError);
      }
    } else {
      console.log("No user_id on rep - skipping planned days sync (ghost rep)");
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
