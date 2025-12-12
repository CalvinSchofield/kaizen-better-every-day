import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    const repsDatabaseId = Deno.env.get('NOTION_REPS_DATABASE_ID');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current user's rep data
    const { data: currentRep, error: repError } = await supabase
      .from('reps')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (repError || !currentRep) {
      return new Response(JSON.stringify({ error: 'User rep data not found', assignableUsers: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Query Notion for team hierarchy
    if (!notionApiKey || !repsDatabaseId) {
      console.error('Missing Notion configuration');
      return new Response(JSON.stringify({ assignableUsers: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all reps from Notion to build hierarchy
    const notionResponse = await fetch(`https://api.notion.com/v1/databases/${repsDatabaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 100,
      }),
    });

    if (!notionResponse.ok) {
      console.error('Notion API error:', await notionResponse.text());
      return new Response(JSON.stringify({ assignableUsers: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notionData = await notionResponse.json();
    
    // Build list of assignable users based on hierarchy
    const assignableUsers: Array<{
      userId: string;
      name: string;
      role: string;
      notionPageId: string;
    }> = [];

    // Get all reps from Supabase to match with Notion data
    const { data: allReps } = await supabase
      .from('reps')
      .select('user_id, name, email, notion_page_id, team_leader');

    const repsMap = new Map(allReps?.map(r => [r.notion_page_id, r]) || []);
    const repsByEmail = new Map(allReps?.map(r => [r.email?.toLowerCase(), r]) || []);
    const repsByName = new Map(allReps?.map(r => [r.name?.toLowerCase(), r]) || []);

    // Find current user's position in hierarchy
    const currentUserTeamLeader = currentRep.team_leader;
    
    // Parse Notion results to find hierarchy
    for (const page of notionData.results) {
      const props = page.properties;
      
      // Get name from Notion
      const nameProperty = props['Name'];
      let name = '';
      if (nameProperty?.type === 'title' && nameProperty.title?.[0]?.plain_text) {
        name = nameProperty.title[0].plain_text;
      }
      
      // Get email from Notion
      const emailProperty = props['Email'];
      let email = '';
      if (emailProperty?.type === 'email') {
        email = emailProperty.email || '';
      }

      // Get team leader from Notion
      const teamLeaderProperty = props['Team Leader'] || props['Team'];
      let teamLeader = '';
      if (teamLeaderProperty?.type === 'select' && teamLeaderProperty.select?.name) {
        teamLeader = teamLeaderProperty.select.name;
      } else if (teamLeaderProperty?.type === 'rich_text' && teamLeaderProperty.rich_text?.[0]?.plain_text) {
        teamLeader = teamLeaderProperty.rich_text[0].plain_text;
      }

      const notionPageId = page.id;
      
      // Find matching Supabase user
      let matchedRep = repsMap.get(notionPageId);
      if (!matchedRep && email) {
        matchedRep = repsByEmail.get(email.toLowerCase());
      }
      if (!matchedRep && name) {
        matchedRep = repsByName.get(name.toLowerCase());
      }

      if (!matchedRep || matchedRep.user_id === user.id) continue;

      // Determine if this person is in user's hierarchy
      let isAssignable = false;
      let role = 'Rep';

      // Check if this is user's team leader (upline)
      if (currentUserTeamLeader && name.toLowerCase().includes(currentUserTeamLeader.toLowerCase())) {
        isAssignable = true;
        role = 'Team Leader';
      }

      // Check if user is this person's team leader (downline)
      if (teamLeader && currentRep.name && teamLeader.toLowerCase().includes(currentRep.name.toLowerCase())) {
        isAssignable = true;
        role = 'Your Recruit';
      }

      // Check if they share the same team leader (peer - also assignable for collaboration)
      if (teamLeader && currentUserTeamLeader && 
          teamLeader.toLowerCase() === currentUserTeamLeader.toLowerCase()) {
        isAssignable = true;
        role = 'Teammate';
      }

      if (isAssignable && matchedRep.user_id) {
        assignableUsers.push({
          userId: matchedRep.user_id,
          name: matchedRep.name || name,
          role,
          notionPageId: matchedRep.notion_page_id || notionPageId,
        });
      }
    }

    // Also add any reps where current user appears as their team leader in Supabase
    const { data: downlineReps } = await supabase
      .from('reps')
      .select('user_id, name, notion_page_id')
      .ilike('team_leader', `%${currentRep.name}%`)
      .neq('user_id', user.id);

    if (downlineReps) {
      for (const rep of downlineReps) {
        if (!assignableUsers.find(u => u.userId === rep.user_id)) {
          assignableUsers.push({
            userId: rep.user_id,
            name: rep.name,
            role: 'Your Recruit',
            notionPageId: rep.notion_page_id || '',
          });
        }
      }
    }

    // Add team leader from Supabase if exists
    if (currentRep.team_leader) {
      const { data: leaderRep } = await supabase
        .from('reps')
        .select('user_id, name, notion_page_id')
        .ilike('name', `%${currentRep.team_leader}%`)
        .neq('user_id', user.id)
        .limit(1)
        .single();

      if (leaderRep && !assignableUsers.find(u => u.userId === leaderRep.user_id)) {
        assignableUsers.push({
          userId: leaderRep.user_id,
          name: leaderRep.name,
          role: 'Team Leader',
          notionPageId: leaderRep.notion_page_id || '',
        });
      }
    }

    // Sort: Team Leader first, then Your Recruit, then Teammate
    const roleOrder = { 'Team Leader': 0, 'Your Recruit': 1, 'Teammate': 2, 'Rep': 3 };
    assignableUsers.sort((a, b) => {
      const orderA = roleOrder[a.role as keyof typeof roleOrder] ?? 99;
      const orderB = roleOrder[b.role as keyof typeof roleOrder] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    console.log(`Found ${assignableUsers.length} assignable users for ${currentRep.name}`);

    return new Response(JSON.stringify({ assignableUsers }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-assignable-users:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', assignableUsers: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
