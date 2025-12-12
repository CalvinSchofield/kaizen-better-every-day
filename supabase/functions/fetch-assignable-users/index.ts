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

    // Get current user's rep data
    const { data: currentRep, error: repError } = await supabase
      .from('reps')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (repError || !currentRep) {
      console.log('User rep data not found for user:', user.id);
      return new Response(JSON.stringify({ error: 'User rep data not found', assignableUsers: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching assignable users for:', currentRep.name, 'Team leader:', currentRep.team_leader);

    // Build list of assignable users based on hierarchy from Supabase data
    const assignableUsers: Array<{
      userId: string;
      name: string;
      role: string;
      notionPageId: string;
    }> = [];

    // 1. Add downline reps (people where current user is their team leader)
    if (currentRep.name) {
      const { data: downlineReps } = await supabase
        .from('reps')
        .select('user_id, name, notion_page_id')
        .ilike('team_leader', `%${currentRep.name}%`)
        .neq('user_id', user.id);

      if (downlineReps) {
        for (const rep of downlineReps) {
          assignableUsers.push({
            userId: rep.user_id,
            name: rep.name,
            role: 'Your Recruit',
            notionPageId: rep.notion_page_id || '',
          });
        }
        console.log(`Found ${downlineReps.length} downline reps`);
      }
    }

    // 2. Add team leader (upline)
    if (currentRep.team_leader) {
      const { data: leaderReps } = await supabase
        .from('reps')
        .select('user_id, name, notion_page_id')
        .ilike('name', `%${currentRep.team_leader}%`)
        .neq('user_id', user.id);

      if (leaderReps) {
        for (const leader of leaderReps) {
          if (!assignableUsers.find(u => u.userId === leader.user_id)) {
            assignableUsers.push({
              userId: leader.user_id,
              name: leader.name,
              role: 'Team Leader',
              notionPageId: leader.notion_page_id || '',
            });
          }
        }
        console.log(`Found ${leaderReps?.length || 0} team leaders`);
      }
    }

    // 3. Add teammates (people who share the same team leader)
    if (currentRep.team_leader) {
      const { data: teammates } = await supabase
        .from('reps')
        .select('user_id, name, notion_page_id')
        .ilike('team_leader', `%${currentRep.team_leader}%`)
        .neq('user_id', user.id);

      if (teammates) {
        for (const teammate of teammates) {
          if (!assignableUsers.find(u => u.userId === teammate.user_id)) {
            assignableUsers.push({
              userId: teammate.user_id,
              name: teammate.name,
              role: 'Teammate',
              notionPageId: teammate.notion_page_id || '',
            });
          }
        }
        console.log(`Found ${teammates?.length || 0} teammates`);
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

    console.log(`Total assignable users: ${assignableUsers.length} for ${currentRep.name}`);

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
