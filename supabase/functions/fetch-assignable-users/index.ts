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

    // Get request body for recruit context
    const body = await req.json().catch(() => ({}));
    const { recruitNotionPageId } = body;

    if (!recruitNotionPageId) {
      console.log('No recruitNotionPageId provided, returning empty list');
      return new Response(JSON.stringify({ assignableUsers: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Helper function to strip emojis for searching
    const stripEmojis = (text: string | null): string => {
      if (!text) return '';
      return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '').trim();
    };

    // Get current user's rep data
    const { data: currentRep } = await supabase
      .from('reps')
      .select('user_id, name, notion_page_id')
      .eq('user_id', user.id)
      .single();

    // Get all reps to build the upline chain
    const { data: allReps } = await supabase
      .from('reps')
      .select('user_id, name, notion_page_id, team_leader');

    if (!allReps || allReps.length === 0) {
      return new Response(JSON.stringify({ assignableUsers: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the recruit by notion page ID
    const recruit = allReps.find(r => r.notion_page_id === recruitNotionPageId);
    
    if (!recruit) {
      console.log('Recruit not found for notion page ID:', recruitNotionPageId);
      return new Response(JSON.stringify({ assignableUsers: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Finding assignable users for recruit:', recruit.name);

    // Build upline chain for the recruit
    const assignableUsers: Array<{
      userId: string;
      name: string;
      role: string;
      notionPageId: string;
    }> = [];

    // Function to find a rep by name (handles emoji matching)
    const findRepByName = (targetName: string | null): typeof allReps[0] | undefined => {
      if (!targetName) return undefined;
      const cleanTarget = stripEmojis(targetName).toLowerCase();
      return allReps.find(r => {
        const cleanName = stripEmojis(r.name).toLowerCase();
        return cleanName.includes(cleanTarget) || cleanTarget.includes(cleanName);
      });
    };

    // Start with the recruit's team leader and go up the chain
    let currentTeamLeader = recruit.team_leader;
    let level = 0;
    const maxLevels = 10; // Prevent infinite loops
    const addedUserIds = new Set<string>();

    while (currentTeamLeader && level < maxLevels) {
      const leader = findRepByName(currentTeamLeader);
      
      if (!leader || !leader.user_id) {
        break;
      }

      // Don't add the current user to the list (they're the default "Me" option)
      // Also don't add duplicates
      if (leader.user_id !== user.id && !addedUserIds.has(leader.user_id)) {
        const role = level === 0 ? 'Team Leader' : level === 1 ? 'Upline' : 'Senior Leader';
        assignableUsers.push({
          userId: leader.user_id,
          name: leader.name,
          role,
          notionPageId: leader.notion_page_id || '',
        });
        addedUserIds.add(leader.user_id);
        console.log(`Added ${leader.name} as ${role} (level ${level})`);
      }

      // Move up the chain
      currentTeamLeader = leader.team_leader;
      
      // Stop if the leader is their own team leader (top of chain)
      if (leader.team_leader && stripEmojis(leader.team_leader).toLowerCase() === stripEmojis(leader.name).toLowerCase()) {
        break;
      }
      
      level++;
    }

    console.log(`Total assignable users: ${assignableUsers.length} for recruit ${recruit.name}`);

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
