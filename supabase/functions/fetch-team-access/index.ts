import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MGMT_DATABASE_ID = '287070fe3bc2804f874bd9dae57bd1b9';
const TEAMS_DATABASE_ID = '287070fe3bc280e1ab5fec17d5582878';
const AREA_DIRECTOR_EMAIL = 'calvinjschofield@gmail.com';

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
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

    const [mgmtGroupsResponse, teamsResponse] = await Promise.all([
      fetchWithRetry(`https://api.notion.com/v1/databases/${MGMT_DATABASE_ID}/query`, {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({}),
      }),
      fetchWithRetry(`https://api.notion.com/v1/databases/${TEAMS_DATABASE_ID}/query`, {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({}),
      }),
    ]);

    const [mgmtGroupsData, teamsData] = await Promise.all([
      mgmtGroupsResponse.json(),
      teamsResponse.json(),
    ]);

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

    const getRepTeamInfo = (repNotionId: string, repTeamLeaderName?: string) => {
      const repAsLeadTeam = teams.find(t => t.groupLeadId === repNotionId);
      if (repAsLeadTeam) {
        const mgmtGroup = mgmtGroups.find(g => g.teamIds.includes(repAsLeadTeam.id));
        return { isTeamLead: true, teamId: repAsLeadTeam.id, teamName: repAsLeadTeam.name, mgmtGroupId: mgmtGroup?.id || null, mgmtGroupName: mgmtGroup?.name || null };
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

    if (accessLevel === 'area_director') {
      const { data: allReps } = await supabase.from('reps').select('user_id, name, notion_page_id, team_leader, phone, year');
      if (allReps) {
        accessibleUserIds = allReps.map(r => r.user_id);
        accessibleReps = allReps.map(r => {
          const teamInfo = getRepTeamInfo(r.notion_page_id, r.team_leader);
          return { userId: r.user_id, name: r.name, notionPageId: r.notion_page_id, phone: r.phone || null, year: r.year || null, isTeamLead: teamInfo.isTeamLead, teamId: teamInfo.teamId, teamName: teamInfo.teamName || (r.team_leader ? `Team ${r.team_leader}` : null), mgmtGroupId: teamInfo.mgmtGroupId, mgmtGroupName: teamInfo.mgmtGroupName };
        });
      }
    } else if (accessLevel === 'mgmt_group_lead') {
      const userMgmtGroups = mgmtGroups.filter(g => g.groupLeadId === userNotionPageId);
      const accessibleTeamIds = userMgmtGroups.flatMap(g => g.teamIds);
      const { data: teamReps } = await supabase.from('reps').select('user_id, name, notion_page_id, team_leader, phone, year').not('notion_page_id', 'is', null);
      if (teamReps) {
        for (const rep of teamReps) {
          const repTeam = teams.find(t => t.groupLeadId === rep.notion_page_id || accessibleTeamIds.includes(t.id));
          if (repTeam) {
            const teamInfo = getRepTeamInfo(rep.notion_page_id, rep.team_leader);
            accessibleUserIds.push(rep.user_id);
            accessibleReps.push({ userId: rep.user_id, name: rep.name, notionPageId: rep.notion_page_id, phone: rep.phone || null, year: rep.year || null, isTeamLead: teamInfo.isTeamLead, teamId: teamInfo.teamId, teamName: teamInfo.teamName || (rep.team_leader ? `Team ${rep.team_leader}` : null), mgmtGroupId: teamInfo.mgmtGroupId, mgmtGroupName: teamInfo.mgmtGroupName });
          }
        }
      }
    } else if (accessLevel === 'team_lead') {
      const userTeam = teams.find(t => t.groupLeadId === userNotionPageId);
      if (userTeam) {
        const { data: teamReps } = await supabase.from('reps').select('user_id, name, notion_page_id, team_leader, phone, year');
        if (teamReps) {
          accessibleUserIds = teamReps.map(r => r.user_id);
          accessibleReps = teamReps.map(r => {
            const teamInfo = getRepTeamInfo(r.notion_page_id, r.team_leader);
            return { userId: r.user_id, name: r.name, notionPageId: r.notion_page_id, phone: r.phone || null, year: r.year || null, isTeamLead: teamInfo.isTeamLead, teamId: teamInfo.teamId, teamName: teamInfo.teamName || (r.team_leader ? `Team ${r.team_leader}` : null), mgmtGroupId: teamInfo.mgmtGroupId, mgmtGroupName: teamInfo.mgmtGroupName };
          });
        }
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
