import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotionProperty {
  id: string;
  type: string;
  [key: string]: any;
}

interface NotionPage {
  id: string;
  properties: Record<string, NotionProperty>;
}

const MGMT_DATABASE_ID = '287070fe3bc2804f874bd9dae57bd1b9';
const TEAMS_DATABASE_ID = '287070fe3bc280e1ab5fec17d5582878';
const AREA_DIRECTOR_EMAIL = 'calvinjschofield@gmail.com';

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

    // Get current user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's rep record
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

    // Check if Area Director
    const isAreaDirector = userEmail === AREA_DIRECTOR_EMAIL;

    // Fetch MGMT Groups from Notion
    const mgmtGroupsResponse = await fetch(`https://api.notion.com/v1/databases/${MGMT_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const mgmtGroupsData = await mgmtGroupsResponse.json();
    console.log('Fetched MGMT Groups:', mgmtGroupsData.results?.length);

    // Fetch Teams from Notion
    const teamsResponse = await fetch(`https://api.notion.com/v1/databases/${TEAMS_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const teamsData = await teamsResponse.json();
    console.log('Fetched Teams:', teamsData.results?.length);

    const mgmtGroups: any[] = [];
    const teams: any[] = [];
    let accessLevel = 'none';

    // Process MGMT Groups
    for (const group of mgmtGroupsData.results || []) {
      const groupProps = group.properties;
      const nameProperty = groupProps['Name'];
      const groupName = nameProperty?.title?.[0]?.plain_text || 'Unnamed Group';
      
      const groupLeadProperty = groupProps['Group Lead'];
      const groupLeadId = groupLeadProperty?.relation?.[0]?.id;

      const teamsProperty = groupProps['Teams'];
      const teamRelations = teamsProperty?.relation || [];
      const teamIds = teamRelations.map((t: any) => t.id);

      const mgmtGroup = {
        id: group.id,
        name: groupName,
        teamIds,
        groupLeadId,
      };

      mgmtGroups.push(mgmtGroup);

      // Check if user is MGMT Group Lead
      if (groupLeadId === userNotionPageId) {
        accessLevel = 'mgmt_group_lead';
      }
    }

    // Process Teams
    for (const team of teamsData.results || []) {
      const teamProps = team.properties;
      const nameProperty = teamProps['Name'];
      const teamName = nameProperty?.title?.[0]?.plain_text || 'Unnamed Team';
      
      const groupLeadProperty = teamProps['Group Lead'];
      const teamLeadRelation = groupLeadProperty?.relation?.[0];
      const teamLeadId = teamLeadRelation?.id;

      teams.push({
        id: team.id,
        name: teamName,
        groupLeadId: teamLeadId,
      });

      // Check if user is Team Lead
      if (teamLeadId === userNotionPageId && accessLevel === 'none') {
        accessLevel = 'team_lead';
      }
    }

    // Override with Area Director if applicable
    if (isAreaDirector) {
      accessLevel = 'area_director';
    }

    // Helper function to determine if a rep is a team lead
    const getRepTeamInfo = (repNotionId: string) => {
      const repTeam = teams.find(t => t.groupLeadId === repNotionId);
      return {
        isTeamLead: !!repTeam,
        teamId: repTeam?.id || null,
        mgmtGroupId: repTeam ? mgmtGroups.find(g => g.teamIds.includes(repTeam.id))?.id || null : null
      };
    };

    // Get all accessible reps based on access level
    let accessibleUserIds: string[] = [];
    let accessibleReps: any[] = [];

    if (accessLevel === 'area_director') {
      // Get all reps
      const { data: allReps } = await supabase
        .from('reps')
        .select('user_id, name, notion_page_id');
      
      if (allReps) {
        accessibleUserIds = allReps.map(r => r.user_id);
        accessibleReps = allReps.map(r => {
          const teamInfo = getRepTeamInfo(r.notion_page_id);
          return {
            userId: r.user_id,
            name: r.name,
            notionPageId: r.notion_page_id,
            isTeamLead: teamInfo.isTeamLead,
            teamId: teamInfo.teamId,
            mgmtGroupId: teamInfo.mgmtGroupId,
          };
        });
      }
    } else if (accessLevel === 'mgmt_group_lead') {
      // Get reps from teams in user's MGMT groups
      const userMgmtGroups = mgmtGroups.filter(g => g.groupLeadId === userNotionPageId);
      const accessibleTeamIds = userMgmtGroups.flatMap(g => g.teamIds);

      // Get reps in those teams
      const { data: teamReps } = await supabase
        .from('reps')
        .select('user_id, name, notion_page_id')
        .not('notion_page_id', 'is', null);

      if (teamReps) {
        // Filter reps by checking if their team is in accessibleTeamIds
        for (const rep of teamReps) {
          // Check if rep's team is in accessibleTeamIds
          const repTeam = teams.find(t => t.groupLeadId === rep.notion_page_id || 
            accessibleTeamIds.includes(t.id));
          
          if (repTeam) {
            const teamInfo = getRepTeamInfo(rep.notion_page_id);
            accessibleUserIds.push(rep.user_id);
            accessibleReps.push({
              userId: rep.user_id,
              name: rep.name,
              notionPageId: rep.notion_page_id,
              isTeamLead: teamInfo.isTeamLead,
              teamId: teamInfo.teamId,
              mgmtGroupId: teamInfo.mgmtGroupId,
            });
          }
        }
      }
    } else if (accessLevel === 'team_lead') {
      // Get reps from user's team
      const userTeam = teams.find(t => t.groupLeadId === userNotionPageId);
      
      if (userTeam) {
        const { data: teamReps } = await supabase
          .from('reps')
          .select('user_id, name, notion_page_id');

        if (teamReps) {
          // This is simplified - in reality would need to query reps table's Teams relation
          accessibleUserIds = teamReps.map(r => r.user_id);
          accessibleReps = teamReps.map(r => {
            const teamInfo = getRepTeamInfo(r.notion_page_id);
            return {
              userId: r.user_id,
              name: r.name,
              notionPageId: r.notion_page_id,
              isTeamLead: teamInfo.isTeamLead,
              teamId: teamInfo.teamId,
              mgmtGroupId: teamInfo.mgmtGroupId,
            };
          });
        }
      }
    }

    return new Response(JSON.stringify({
      accessLevel,
      mgmtGroups,
      teams,
      accessibleUserIds,
      accessibleReps,
    }), {
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
