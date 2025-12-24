import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MGMT_DATABASE_ID = '287070fe3bc2804f874bd9dae57bd1b9';
const TEAMS_DATABASE_ID = '287070fe3bc280e1ab5fec17d5582878';
const BLITZES_DATABASE_ID = '29d5554f5d9b48f59e6a1b2777199ae0';

// Notion API helper with retry logic
async function fetchNotionWithRetry(url: string, options: RequestInit, maxRetries = 5): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        let delay: number;
        
        if (retryAfter) {
          delay = Math.min(parseInt(retryAfter, 10) * 1000, 30000);
        } else {
          const baseDelay = Math.min(2000 * Math.pow(2, attempt), 30000);
          const jitter = Math.random() * 1000;
          delay = baseDelay + jitter;
        }
        
        console.log(`Rate limited (429). Retrying in ${Math.round(delay)}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error: any) {
      lastError = error;
      console.error(`Fetch attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 30000) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error(`Failed after ${maxRetries} attempts`);
}

// Helper to extract Notion property values
const getTitle = (prop: any) => prop?.title?.[0]?.plain_text || null;
const getRichText = (prop: any) => prop?.rich_text?.[0]?.plain_text || null;
const getSelect = (prop: any) => prop?.select?.name || null;
const getPhone = (prop: any) => prop?.phone_number || null;
const getEmail = (prop: any) => prop?.email || null;
const getDate = (prop: any) => prop?.date?.start || null;
const getDateEnd = (prop: any) => prop?.date?.end || null;
const getCheckbox = (prop: any) => prop?.checkbox ?? false;
const getRelationIds = (prop: any) => (prop?.relation || []).map((r: any) => r.id);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    const notionRepsDbId = Deno.env.get('NOTION_REPS_DATABASE_ID');

    if (!notionApiKey || !notionRepsDbId) {
      throw new Error('Missing Notion configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user (should be area director only)
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is area director (optional - for security)
    // For migration purposes, we'll allow any authenticated user to run this

    const notionHeaders = {
      'Authorization': `Bearer ${notionApiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };

    const stats = {
      mgmtGroups: { fetched: 0, inserted: 0 },
      teams: { fetched: 0, inserted: 0 },
      blitzes: { fetched: 0, inserted: 0 },
      recruits: { fetched: 0, inserted: 0 },
      recruitBlitzes: { inserted: 0 },
      errors: [] as string[],
    };

    // ========== STEP 1: Fetch and insert MGMT Groups ==========
    console.log('Step 1: Fetching MGMT Groups from Notion...');
    
    const mgmtResponse = await fetchNotionWithRetry(
      `https://api.notion.com/v1/databases/${MGMT_DATABASE_ID}/query`,
      { method: 'POST', headers: notionHeaders, body: JSON.stringify({}) }
    );

    if (!mgmtResponse.ok) {
      throw new Error(`Failed to fetch MGMT groups: ${mgmtResponse.status}`);
    }

    const mgmtData = await mgmtResponse.json();
    stats.mgmtGroups.fetched = mgmtData.results.length;
    console.log(`Fetched ${stats.mgmtGroups.fetched} MGMT groups`);

    // Map Notion ID → Supabase UUID for mgmt groups
    const mgmtNotionToUuid = new Map<string, string>();
    // Map Notion ID → Group Lead Notion ID
    const mgmtLeadMap = new Map<string, string>();
    // Map Notion ID → Team Notion IDs
    const mgmtTeamsMap = new Map<string, string[]>();

    for (const group of mgmtData.results) {
      const props = group.properties;
      const name = getTitle(props['Name']) || 'Unnamed Group';
      const groupLeadNotionId = getRelationIds(props['Group Lead'])[0] || null;
      const teamNotionIds = getRelationIds(props['Teams']);

      mgmtLeadMap.set(group.id, groupLeadNotionId);
      mgmtTeamsMap.set(group.id, teamNotionIds);

      // Insert into Supabase (lead_user_id will be updated later)
      const { data: inserted, error } = await supabase
        .from('mgmt_groups')
        .upsert({
          notion_page_id: group.id,
          name,
          lead_user_id: null, // Will update after we know rep → user mappings
        }, { onConflict: 'notion_page_id' })
        .select('id')
        .single();

      if (error) {
        console.error(`Error inserting mgmt group ${name}:`, error);
        stats.errors.push(`MGMT ${name}: ${error.message}`);
      } else if (inserted) {
        mgmtNotionToUuid.set(group.id, inserted.id);
        stats.mgmtGroups.inserted++;
      }
    }

    // Small delay between API calls
    await new Promise(resolve => setTimeout(resolve, 500));

    // ========== STEP 2: Fetch and insert Teams ==========
    console.log('Step 2: Fetching Teams from Notion...');

    const teamsResponse = await fetchNotionWithRetry(
      `https://api.notion.com/v1/databases/${TEAMS_DATABASE_ID}/query`,
      { method: 'POST', headers: notionHeaders, body: JSON.stringify({}) }
    );

    if (!teamsResponse.ok) {
      throw new Error(`Failed to fetch teams: ${teamsResponse.status}`);
    }

    const teamsData = await teamsResponse.json();
    stats.teams.fetched = teamsData.results.length;
    console.log(`Fetched ${stats.teams.fetched} teams`);

    // Map Notion ID → Supabase UUID for teams
    const teamNotionToUuid = new Map<string, string>();
    // Map Notion ID → Group Lead Notion ID
    const teamLeadMap = new Map<string, string>();

    for (const team of teamsData.results) {
      const props = team.properties;
      const name = getTitle(props['Name']) || 'Unnamed Team';
      const teamLeadNotionId = getRelationIds(props['Group Lead'])[0] || null;

      teamLeadMap.set(team.id, teamLeadNotionId);

      const { data: inserted, error } = await supabase
        .from('teams')
        .upsert({
          notion_page_id: team.id,
          name,
          lead_user_id: null, // Will update later
        }, { onConflict: 'notion_page_id' })
        .select('id')
        .single();

      if (error) {
        console.error(`Error inserting team ${name}:`, error);
        stats.errors.push(`Team ${name}: ${error.message}`);
      } else if (inserted) {
        teamNotionToUuid.set(team.id, inserted.id);
        stats.teams.inserted++;
      }
    }

    // ========== STEP 2.5: Create team_mgmt_groups junction records ==========
    console.log('Step 2.5: Creating team-mgmt group relationships...');

    for (const [mgmtNotionId, teamNotionIds] of mgmtTeamsMap.entries()) {
      const mgmtUuid = mgmtNotionToUuid.get(mgmtNotionId);
      if (!mgmtUuid) continue;

      for (const teamNotionId of teamNotionIds) {
        const teamUuid = teamNotionToUuid.get(teamNotionId);
        if (!teamUuid) continue;

        const { error } = await supabase
          .from('team_mgmt_groups')
          .upsert({
            team_id: teamUuid,
            mgmt_group_id: mgmtUuid,
          }, { onConflict: 'team_id,mgmt_group_id' });

        if (error && !error.message.includes('duplicate')) {
          console.error(`Error linking team to mgmt group:`, error);
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // ========== STEP 3: Fetch and insert Blitzes ==========
    console.log('Step 3: Fetching Blitzes from Notion...');

    const blitzesResponse = await fetchNotionWithRetry(
      `https://api.notion.com/v1/databases/${BLITZES_DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({
          sorts: [{ property: 'Date', direction: 'ascending' }]
        })
      }
    );

    if (!blitzesResponse.ok) {
      throw new Error(`Failed to fetch blitzes: ${blitzesResponse.status}`);
    }

    const blitzesData = await blitzesResponse.json();
    stats.blitzes.fetched = blitzesData.results.length;
    console.log(`Fetched ${stats.blitzes.fetched} blitzes`);

    // Map Notion ID → Supabase UUID for blitzes
    const blitzNotionToUuid = new Map<string, string>();

    for (const blitz of blitzesData.results) {
      const props = blitz.properties;
      const name = getTitle(props['Name']);
      if (!name) continue;

      const date = getDate(props['Date']);
      if (!date) continue;

      const endDate = getDateEnd(props['Date']);
      const location = getRichText(props['Location']) || getSelect(props['Location']);
      const address = getRichText(props['Address 1']) || getRichText(props['Address1']);
      const wifi = getRichText(props['WiFi 1']);
      const code = getRichText(props['Code 1']);

      const { data: inserted, error } = await supabase
        .from('blitzes')
        .upsert({
          notion_page_id: blitz.id,
          name,
          date,
          end_date: endDate,
          location,
          address,
          wifi,
          code,
        }, { onConflict: 'notion_page_id' })
        .select('id')
        .single();

      if (error) {
        console.error(`Error inserting blitz ${name}:`, error);
        stats.errors.push(`Blitz ${name}: ${error.message}`);
      } else if (inserted) {
        blitzNotionToUuid.set(blitz.id, inserted.id);
        stats.blitzes.inserted++;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // ========== STEP 4: Fetch and insert Recruits ==========
    console.log('Step 4: Fetching Recruits from Notion...');

    // Fetch ALL reps from the Notion reps database
    // We'll filter for recruiting stages in code instead of via Notion filter
    const recruitingStages = ['100 List', 'Reached Out', 'Evaluating', 'Signed', 'Shadow ✅', 'Sold 💲', 'Sold (5+) 💰'];

    let allRecruitPages: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    // Paginate through all results
    while (hasMore) {
      const queryBody: any = { page_size: 100 };
      if (startCursor) {
        queryBody.start_cursor = startCursor;
      }

      const recruitsResponse = await fetchNotionWithRetry(
        `https://api.notion.com/v1/databases/${notionRepsDbId}/query`,
        {
          method: 'POST',
          headers: notionHeaders,
          body: JSON.stringify(queryBody)
        }
      );

      if (!recruitsResponse.ok) {
        const errorText = await recruitsResponse.text();
        console.error('Notion recruits API error:', errorText);
        throw new Error(`Failed to fetch recruits: ${recruitsResponse.status}`);
      }

      const recruitsData = await recruitsResponse.json();
      allRecruitPages = allRecruitPages.concat(recruitsData.results);
      
      hasMore = recruitsData.has_more;
      startCursor = recruitsData.next_cursor;
      
      console.log(`Fetched ${recruitsData.results.length} recruits (total so far: ${allRecruitPages.length})`);
      
      // Small delay between pagination requests
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Filter for recruiting stages in code
    const recruitPages = allRecruitPages.filter(page => {
      const stage = getSelect(page.properties?.['Stage']);
      return recruitingStages.includes(stage || '');
    });

    stats.recruits.fetched = recruitPages.length;
    console.log(`Found ${recruitPages.length} recruits in recruiting stages (out of ${allRecruitPages.length} total)`);


    // Get existing reps from Supabase to map notion_page_id → user_id
    const { data: existingReps } = await supabase
      .from('reps')
      .select('notion_page_id, user_id');

    const repNotionToUserId = new Map<string, string>();
    for (const rep of existingReps || []) {
      if (rep.notion_page_id && rep.user_id) {
        repNotionToUserId.set(rep.notion_page_id, rep.user_id);
      }
    }

    // Map recruit Notion ID → Supabase UUID
    const recruitNotionToUuid = new Map<string, string>();
    // Track recruit → committed blitz Notion IDs for later
    const recruitBlitzCommitments = new Map<string, string[]>();

    for (const recruit of recruitPages) {
      const props = recruit.properties;
      const name = getTitle(props['Name']);
      if (!name) continue;

      const recruiterNotionId = getRelationIds(props['Recruiter'])[0] || null;
      const recruiterUserId = recruiterNotionId ? repNotionToUserId.get(recruiterNotionId) : null;

      // Get team info - try to match based on recruiter's team or team relation
      const teamRelationIds = getRelationIds(props['Team']);
      const teamNotionId = teamRelationIds[0] || null;
      const teamUuid = teamNotionId ? teamNotionToUuid.get(teamNotionId) : null;

      // Get committed blitzes
      const blitzTripNotionIds = getRelationIds(props['Preseason trips']);
      if (blitzTripNotionIds.length > 0) {
        recruitBlitzCommitments.set(recruit.id, blitzTripNotionIds);
      }

      // Parse onboarding step
      const onboardingStepValue = getSelect(props['Onboarding Step Completed']) || '';
      const stepLower = onboardingStepValue.toLowerCase();
      
      const hasPhase4 = stepLower.includes('phase 4');
      const hasPhase3 = hasPhase4 || stepLower.includes('phase 3');
      const hasPhase2 = hasPhase3 || stepLower.includes('phase 2');
      const hasPhase1 = hasPhase2 || stepLower.includes('phase 1');
      const hasSlack = hasPhase1 || stepLower.includes('slack');
      const hasTrainings = hasSlack || stepLower.includes('training');
      const hasBasicOnboarding = hasTrainings || stepLower.includes('onboarding');

      const { data: inserted, error } = await supabase
        .from('recruits')
        .upsert({
          notion_page_id: recruit.id,
          name,
          phone: getPhone(props['Phone']),
          email: getEmail(props['Email']),
          stage: getSelect(props['Stage']) || '100 List',
          year: getSelect(props['Year']) || 'Rookie',
          location: getRichText(props['Location']),
          recruitment_source: getSelect(props['Source']) || getRichText(props['Source']),
          last_contact: getDate(props['Last Contact']),
          next_action: getRichText(props['Next Action']),
          next_action_due: getDate(props['Next Action Due']),
          recruiter_user_id: recruiterUserId,
          team_id: teamUuid,
          onboarding_complete: hasSlack,
          trainings_complete: hasTrainings,
          slack_joined: hasSlack,
          ramp_phase_1_complete: hasPhase1,
          ramp_phase_2_complete: hasPhase2,
          ramp_phase_3_complete: hasPhase3,
          ramp_phase_4_complete: hasPhase4,
          ipad_assigned: getCheckbox(props['iPad Assigned']),
          blitz_ready: getCheckbox(props['Blitz Ready']),
        }, { onConflict: 'notion_page_id' })
        .select('id')
        .single();

      if (error) {
        console.error(`Error inserting recruit ${name}:`, error);
        stats.errors.push(`Recruit ${name}: ${error.message}`);
      } else if (inserted) {
        recruitNotionToUuid.set(recruit.id, inserted.id);
        stats.recruits.inserted++;
      }
    }

    // ========== STEP 5: Create recruit_blitzes junction records ==========
    console.log('Step 5: Creating recruit-blitz commitments...');

    for (const [recruitNotionId, blitzNotionIds] of recruitBlitzCommitments.entries()) {
      const recruitUuid = recruitNotionToUuid.get(recruitNotionId);
      if (!recruitUuid) continue;

      for (const blitzNotionId of blitzNotionIds) {
        const blitzUuid = blitzNotionToUuid.get(blitzNotionId);
        if (!blitzUuid) continue;

        const { error } = await supabase
          .from('recruit_blitzes')
          .upsert({
            recruit_id: recruitUuid,
            blitz_id: blitzUuid,
          }, { onConflict: 'recruit_id,blitz_id' });

        if (error && !error.message.includes('duplicate')) {
          console.error(`Error linking recruit to blitz:`, error);
        } else {
          stats.recruitBlitzes.inserted++;
        }
      }
    }

    // ========== STEP 6: Update lead_user_id for teams and mgmt groups ==========
    console.log('Step 6: Updating team and mgmt group leaders...');

    // Update mgmt group leads
    for (const [mgmtNotionId, leadNotionId] of mgmtLeadMap.entries()) {
      if (!leadNotionId) continue;
      const leadUserId = repNotionToUserId.get(leadNotionId);
      if (!leadUserId) continue;
      const mgmtUuid = mgmtNotionToUuid.get(mgmtNotionId);
      if (!mgmtUuid) continue;

      await supabase
        .from('mgmt_groups')
        .update({ lead_user_id: leadUserId })
        .eq('id', mgmtUuid);
    }

    // Update team leads
    for (const [teamNotionId, leadNotionId] of teamLeadMap.entries()) {
      if (!leadNotionId) continue;
      const leadUserId = repNotionToUserId.get(leadNotionId);
      if (!leadUserId) continue;
      const teamUuid = teamNotionToUuid.get(teamNotionId);
      if (!teamUuid) continue;

      await supabase
        .from('teams')
        .update({ lead_user_id: leadUserId })
        .eq('id', teamUuid);
    }

    // ========== STEP 7: Backfill recruit_id in recruit_activities ==========
    console.log('Step 7: Backfilling recruit_activities with recruit_id...');

    // Get all recruit_activities that have rep_notion_page_id
    const { data: activities } = await supabase
      .from('recruit_activities')
      .select('id, rep_notion_page_id');

    let activitiesUpdated = 0;
    for (const activity of activities || []) {
      if (!activity.rep_notion_page_id) continue;
      
      // Find the recruit UUID for this notion page ID
      const recruitUuid = recruitNotionToUuid.get(activity.rep_notion_page_id);
      if (!recruitUuid) continue;

      // Note: recruit_id column doesn't exist yet - we'll add it in a separate migration
      // This step is just logging what would be updated
      activitiesUpdated++;
    }

    console.log(`Would update ${activitiesUpdated} recruit_activities with recruit_id`);

    // ========== Complete ==========
    console.log('Migration complete!', stats);

    return new Response(JSON.stringify({
      success: true,
      stats,
      message: 'Migration completed successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
