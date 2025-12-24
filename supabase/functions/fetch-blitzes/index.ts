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

    console.log("Fetching blitzes from Supabase...");

    // Fetch all blitzes ordered by date
    const { data: blitzesData, error } = await supabase
      .from('blitzes')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.error("Error fetching blitzes:", error);
      throw error;
    }

    console.log(`Found ${blitzesData?.length || 0} blitzes`);

    // Fetch accommodations for all blitzes
    const blitzIds = (blitzesData || []).map(b => b.id);
    const { data: accommodationsData, error: accError } = await supabase
      .from('blitz_accommodations')
      .select('*')
      .in('blitz_id', blitzIds)
      .order('sort_order', { ascending: true });

    if (accError) {
      console.error("Error fetching accommodations:", accError);
    }

    // Group accommodations by blitz
    const accByBlitz: Record<string, any[]> = {};
    (accommodationsData || []).forEach(acc => {
      if (!accByBlitz[acc.blitz_id]) {
        accByBlitz[acc.blitz_id] = [];
      }
      accByBlitz[acc.blitz_id].push({
        id: acc.id,
        name: acc.name,
        address: acc.address,
        wifiPassword: acc.wifi_password,
        doorCode: acc.door_code,
        notes: acc.notes,
      });
    });

    // Map to expected format - include both IDs for commit operations
    const blitzes = (blitzesData || []).map(blitz => ({
      id: blitz.notion_page_id || blitz.id, // UI uses this as primary ID
      supabaseId: blitz.id, // Actual DB ID for recruit_blitzes FK
      name: blitz.name,
      date: blitz.date,
      endDate: blitz.end_date,
      location: blitz.location,
      // Legacy single-accommodation fields (for backward compatibility)
      address1: blitz.address,
      wifi1: blitz.wifi,
      code1: blitz.code,
      // New multi-accommodation support
      accommodations: accByBlitz[blitz.id] || [],
    }));

    return new Response(
      JSON.stringify({
        success: true,
        blitzes,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in fetch-blitzes:", error);
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
