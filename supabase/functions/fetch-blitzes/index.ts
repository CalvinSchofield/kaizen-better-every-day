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

    // Map to expected format - include both IDs for commit operations
    const blitzes = (blitzesData || []).map(blitz => ({
      id: blitz.notion_page_id || blitz.id, // UI uses this as primary ID
      supabaseId: blitz.id, // Actual DB ID for recruit_blitzes FK
      name: blitz.name,
      date: blitz.date,
      endDate: blitz.end_date,
      location: blitz.location,
      address1: blitz.address,
      wifi1: blitz.wifi,
      code1: blitz.code,
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
