import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MGMT_DATABASE_ID = '287070fe3bc2804f874bd9dae57bd1b9';
const TEAMS_DATABASE_ID = '287070fe3bc280e1ab5fec17d5582878';
const AREA_DIRECTOR_EMAIL = 'calvinjschofield@gmail.com';

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

type NotionQueryResponse = {
  results?: any[];
  [key: string]: any;
};

let mgmtGroupsCache: { fetchedAt: number; data: NotionQueryResponse } | null = null;
let teamsCache: { fetchedAt: number; data: NotionQueryResponse } | null = null;

const isFresh = (cache: { fetchedAt: number } | null) =>
  !!cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS;

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 6): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterMs = retryAfterHeader
          ? Math.max(0, Number(retryAfterHeader)) * 1000
          : 0;

        // Exponential backoff, but also respect Retry-After when provided
        const backoffMs = Math.min(2000 * Math.pow(2, attempt), 32000);
        const delayMs = Math.max(backoffMs, retryAfterMs);

        console.info(
          `Rate limited (429). Retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`,
        );

        // On final attempt, return the 429 response so the caller can fall back gracefully.
        if (attempt === maxRetries - 1) {
          return response;
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!response.ok) {
        console.error(`Notion API error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.error(`Fetch error (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * Math.pow(2, attempt)));
    }
  }

  // Should be unreachable, but keeps TypeScript happy.
  throw new Error('Failed after retries');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!notionApiKey) {
      throw new Error('NOTION_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: repData } = await supabase
      .from('reps')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!repData || !repData.notion_page_id) {
      return new Response(JSON.stringify({ 
        accessLevel: 'none',
        mgmtGroups: [],
        teams: [],
        accessibleUserIds: [],
        accessibleReps: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userNotionPageId = repData.notion_page_id;
    const userEmail = user.email?.toLowerCase();
    const isAreaDirector = userEmail === AREA_DIRECTOR_EMAIL;

    const notionHeaders = {
      'Authorization': `Bearer ${notionApiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };

    const getNotionDb = async (
      cacheKey: 'mgmt' | 'teams',
      databaseId: string,
    ): Promise<NotionQueryResponse> => {
      const cache = cacheKey === 'mgmt' ? mgmtGroupsCache : teamsCache;
      if (isFresh(cache)) {
        return cache!.data;
      }

      try {
        const response = await fetchWithRetry(
          `https://api.notion.com/v1/databases/${databaseId}/query`,
          {
            method: 'POST',
            headers: notionHeaders,
            body: JSON.stringify({}),
          },
        );

        const json = (await response.json()) as NotionQueryResponse;

        // If we were rate-limited or got an error, prefer stale cache if available.
        if (!response.ok) {
          if (cache?.data) {
            console.warn(
              `Using stale cache for ${cacheKey} database due to Notion response ${response.status}.`,
            );
            return cache.data;
          }
          return { results: [] };
        }

        const nextCache = { fetchedAt: Date.now(), data: json };
        if (cacheKey === 'mgmt') mgmtGroupsCache = nextCache;
        else teamsCache = nextCache;

        return json;
      } catch (e) {
        console.error(`Failed to fetch Notion ${cacheKey} DB. Falling back to cache.`, e);
        if (cache?.data) return cache.data;
        return { results: [] };
      }
    };

    // Fetch sequentially + cache to reduce rate limit pressure
    const mgmtGroupsData = await getNotionDb('mgmt', MGMT_DATABASE_ID);

    // Small delay between requests to help with rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));

    const teamsData = await getNotionDb('teams', TEAMS_DATABASE_ID);

    const mgmtGroups: any[] = [];
    const teams: any[] = [];
    let accessLevel = 'none';

    for (const group of mgmtGroupsData.results || []) {
      const groupProps = group.properties;
      const groupName = groupProps['Name']?.title?.[0]?.plain_text || 'Unnamed Group';
      const groupLeadId = groupProps['Group Lead']?.relation?.[0]?.id;
      const teamIds = (groupProps['Teams']?.relation || []).map((t: any) => t.id);

      mgmtGroups.push({ id: group.id, name: groupName, teamIds, groupLeadId });

      if (groupLeadId === userNotionPageId) {
        accessLevel = 'mgmt_group_lead';
      }
    }

    const teamLeadToTeamMap = new Map<string, string>();
    
    for (const team of teamsData.results || []) {
      const teamProps = team.properties;
      const teamName = teamProps['Name']?.title?.[0]?.plain_text || 'Unnamed Team';
      const teamLeadId = teamProps['Group Lead']?.relation?.[0]?.id;

      teams.push({ id: team.id, name: teamName, groupLeadId: teamLeadId });

      if (teamLeadId) teamLeadToTeamMap.set(teamLeadId, teamName);

      if (teamLeadId === userNotionPageId && accessLevel === 'none') {
        accessLevel = 'team_lead';
      }
    }

    if (isAreaDirector) accessLevel = 'area_director';

    const getRepTeamInfo = (repNotionId: string | null, repTeamLeaderName?: string | null) => {
      if (repNotionId) {
        const repAsLeadTeam = teams.find(t => t.groupLeadId === repNotionId);
        if (repAsLeadTeam) {
          const mgmtGroup = mgmtGroups.find(g => g.teamIds.includes(repAsLeadTeam.id));
          return { isTeamLead: true, teamId: repAsLeadTeam.id, teamName: repAsLeadTeam.name, mgmtGroupId: mgmtGroup?.id || null, mgmtGroupName: mgmtGroup?.name || null };
        }
      }
      
      if (repTeamLeaderName) {
        for (const team of teams) {
          if (team.name && repTeamLeaderName && 
              (team.name.toLowerCase().includes(repTeamLeaderName.toLowerCase()) ||
               repTeamLeaderName.toLowerCase().includes(team.name.toLowerCase().replace('team ', '')))) {
            const mgmtGroup = mgmtGroups.find(g => g.teamIds.includes(team.id));
            return { isTeamLead: false, teamId: team.id, teamName: team.name, mgmtGroupId: mgmtGroup?.id || null, mgmtGroupName: mgmtGroup?.name || null };
          }
        }
      }
      return { isTeamLead: false, teamId: null, teamName: null, mgmtGroupId: null, mgmtGroupName: null };
    };

    let accessibleUserIds: string[] = [];
    let accessibleReps: any[] = [];

    // Get ALL reps including ghost reps (user_id may be null)
    const buildRepData = (rep: any, teamInfo: any) => ({
      id: rep.id, // Supabase UUID for the rep record
      userId: rep.user_id || null, // null for ghost reps
      name: rep.name,
      notionPageId: rep.notion_page_id,
      phone: rep.phone || null,
      year: rep.year || null,
      stage: rep.stage || null,
      isTeamLead: teamInfo.isTeamLead,
      teamId: teamInfo.teamId,
      teamName: teamInfo.teamName || (rep.team_leader ? `Team ${rep.team_leader}` : null),
      mgmtGroupId: teamInfo.mgmtGroupId,
      mgmtGroupName: teamInfo.mgmtGroupName,
      isGhostRep: !rep.user_id, // Flag to identify ghost reps
      rampPhase1Complete: rep.ramp_phase_1_complete || false,
    });

    if (accessLevel === 'area_director') {
      // Area directors see ALL reps including ghost reps
      const { data: allReps } = await supabase
        .from('reps')
        .select('id, user_id, name, notion_page_id, team_leader, phone, year, stage, ramp_phase_1_complete');
      if (allReps) {
        accessibleUserIds = allReps.filter(r => r.user_id).map(r => r.user_id!);
        accessibleReps = allReps.map(r => {
          const teamInfo = getRepTeamInfo(r.notion_page_id, r.team_leader);
          return buildRepData(r, teamInfo);
        });
      }
    } else if (accessLevel === 'mgmt_group_lead') {
      const userMgmtGroups = mgmtGroups.filter(g => g.groupLeadId === userNotionPageId);
      const accessibleTeamIds = userMgmtGroups.flatMap(g => g.teamIds);
      
      const { data: allReps } = await supabase
        .from('reps')
        .select('id, user_id, name, notion_page_id, team_leader, phone, year, stage, ramp_phase_1_complete')
        .not('notion_page_id', 'is', null);
      if (allReps) {
        for (const rep of allReps) {
          const teamInfo = getRepTeamInfo(rep.notion_page_id, rep.team_leader);
          const isTeamLeadOfAccessibleTeam = accessibleTeamIds.some(teamId => {
            const team = teams.find(t => t.id === teamId);
            return team?.groupLeadId === rep.notion_page_id;
          });
          const belongsToAccessibleTeam = teamInfo.teamId && accessibleTeamIds.includes(teamInfo.teamId);
          
          if (isTeamLeadOfAccessibleTeam || belongsToAccessibleTeam) {
            if (rep.user_id) accessibleUserIds.push(rep.user_id);
            accessibleReps.push(buildRepData(rep, teamInfo));
          }
        }
      }
      console.log(`MGMT group lead has access to ${accessibleTeamIds.length} teams, ${accessibleReps.length} reps`);
    } else if (accessLevel === 'team_lead') {
      const userTeam = teams.find(t => t.groupLeadId === userNotionPageId);
      if (userTeam) {
        const { data: allReps } = await supabase
          .from('reps')
          .select('id, user_id, name, notion_page_id, team_leader, phone, year, stage, ramp_phase_1_complete');
        if (allReps) {
          for (const rep of allReps) {
            const teamInfo = getRepTeamInfo(rep.notion_page_id, rep.team_leader);
            if (teamInfo.teamId === userTeam.id) {
              if (rep.user_id) accessibleUserIds.push(rep.user_id);
              accessibleReps.push(buildRepData(rep, teamInfo));
            }
          }
        }
        console.log(`Team lead (${userTeam.name}) has access to ${accessibleReps.length} reps on their team`);
      }
    }

    return new Response(JSON.stringify({ accessLevel, mgmtGroups, teams, accessibleUserIds, accessibleReps }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in fetch-team-access:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
