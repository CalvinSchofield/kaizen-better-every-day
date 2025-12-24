import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching property options from Supabase...');

    // Fetch teams from Supabase
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, notion_page_id')
      .order('name');

    if (teamsError) {
      console.error('Error fetching teams:', teamsError);
    }

    const teamsOptions = (teamsData || []).map(t => ({
      id: t.notion_page_id || t.id,
      name: t.name
    }));

    // Fetch mgmt groups from Supabase
    const { data: mgmtData, error: mgmtError } = await supabase
      .from('mgmt_groups')
      .select('id, name, notion_page_id')
      .order('name');

    if (mgmtError) {
      console.error('Error fetching mgmt groups:', mgmtError);
    }

    const mgmtOptions = (mgmtData || []).map(m => ({
      id: m.notion_page_id || m.id,
      name: m.name
    }));

    // Get unique locations from recruits table
    const { data: recruitsData } = await supabase
      .from('recruits')
      .select('location')
      .not('location', 'is', null);

    const locationSet = new Set<string>();
    (recruitsData || []).forEach(r => {
      if (r.location) locationSet.add(r.location);
    });
    const locationOptions = Array.from(locationSet).sort();

    // Get unique recruitment sources from recruits table
    const { data: sourcesData } = await supabase
      .from('recruits')
      .select('recruitment_source')
      .not('recruitment_source', 'is', null);

    const sourceSet = new Set<string>();
    (sourcesData || []).forEach(r => {
      if (r.recruitment_source) sourceSet.add(r.recruitment_source);
    });
    // Add common default options
    const defaultSources = ['Friend/Family', 'Vivint Employee', 'Social Media', 'Cold Recruit', 'Referral', 'Other'];
    defaultSources.forEach(s => sourceSet.add(s));
    const recruitmentSourceOptions = Array.from(sourceSet).sort();

    // Stage options are predefined based on the app's workflow
    const stageOptions = [
      '100 List',
      'Reached Out',
      'Evaluating',
      'Signed',
      'Shadow Complete',
      'Sold',
      'Sold 5+'
    ];

    // Get unique recruiters from reps table
    const { data: recruitersData } = await supabase
      .from('reps')
      .select('name')
      .not('name', 'is', null)
      .order('name');

    const recruiterOptions = (recruitersData || []).map(r => r.name);

    console.log(`Found ${locationOptions.length} locations, ${recruitmentSourceOptions.length} sources, ${stageOptions.length} stages, ${recruiterOptions.length} recruiters, ${teamsOptions.length} teams, ${mgmtOptions.length} MGMT groups`);

    return new Response(JSON.stringify({
      locationOptions,
      recruitmentSourceOptions,
      stageOptions,
      recruiterOptions,
      teamsOptions,
      mgmtOptions,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching property options:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
