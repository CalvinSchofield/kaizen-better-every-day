import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userIds, dateRange, excludeUserIds = [] } = await req.json();

    if (!userIds || !Array.isArray(userIds)) {
      throw new Error('userIds array is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current user for access verification
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter out excluded users
    const filteredUserIds = userIds.filter(id => !excludeUserIds.includes(id));

    if (filteredUserIds.length === 0) {
      return new Response(JSON.stringify({ entries: [], reps: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build query for daily entries
    let query = supabase
      .from('daily_entries')
      .select('*')
      .in('user_id', filteredUserIds)
      .eq('is_finalized', true);

    // Apply date range filters if provided
    if (dateRange?.start) {
      query = query.gte('entry_date', dateRange.start);
    }
    if (dateRange?.end) {
      query = query.lte('entry_date', dateRange.end);
    }

    const { data: entries, error } = await query;

    if (error) {
      throw error;
    }

    // Get rep information for the user IDs
    const { data: reps } = await supabase
      .from('reps')
      .select('user_id, name, year')
      .in('user_id', filteredUserIds);

    console.log(`Fetched ${entries?.length || 0} entries for ${filteredUserIds.length} users`);

    return new Response(JSON.stringify({
      entries: entries || [],
      reps: reps || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in fetch-team-insights:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
