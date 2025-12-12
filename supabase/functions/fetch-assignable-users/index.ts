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

    // Helper function to strip emojis for searching
    const stripEmojis = (text: string | null): string => {
      if (!text) return '';
      return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '').trim();
    };

    const cleanName = stripEmojis(currentRep.name);
    const cleanTeamLeader = stripEmojis(currentRep.team_leader);
    
    console.log('Fetching assignable users for:', currentRep.name, '(clean:', cleanName, ') Team leader:', currentRep.team_leader, '(clean:', cleanTeamLeader, ')');

    // Build list of assignable users based on STRICT upline/downline hierarchy only
    // No teammates - only people directly above or below in the recruiting chain
    const assignableUsers: Array<{
      userId: string;
      name: string;
      role: string;
      notionPageId: string;
    }> = [];

    // 1. Add downline reps (people where current user is their team leader) - DIRECT RECRUITS ONLY
    if (cleanName) {
      const { data: downlineReps } = await supabase
        .from('reps')
        .select('user_id, name, notion_page_id, team_leader')
        .ilike('team_leader', `%${cleanName}%`)
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
        console.log(`Found ${downlineReps.length} direct downline reps`);
      }
    }

    // 2. Add team leader (direct upline only)
    if (cleanTeamLeader) {
      const { data: leaderReps } = await supabase
        .from('reps')
        .select('user_id, name, notion_page_id')
        .neq('user_id', user.id);

      if (leaderReps) {
        for (const leader of leaderReps) {
          const leaderCleanName = stripEmojis(leader.name);
          if (leaderCleanName.toLowerCase().includes(cleanTeamLeader.toLowerCase())) {
            if (!assignableUsers.find(u => u.userId === leader.user_id)) {
              assignableUsers.push({
                userId: leader.user_id,
                name: leader.name,
                role: 'Team Leader',
                notionPageId: leader.notion_page_id || '',
              });
            }
          }
        }
        console.log(`Found ${assignableUsers.filter(u => u.role === 'Team Leader').length} team leaders`);
      }
    }

    // 3. Add recruits of recruits (second-level downline) - for area directors/mgmt leads
    // This allows a leader to assign tasks to their recruits' recruits
    if (cleanName) {
      // First get direct recruits
      const { data: directRecruits } = await supabase
        .from('reps')
        .select('name')
        .ilike('team_leader', `%${cleanName}%`);
      
      if (directRecruits && directRecruits.length > 0) {
        // Then get recruits of those recruits
        for (const directRecruit of directRecruits) {
          const cleanRecruitName = stripEmojis(directRecruit.name);
          if (cleanRecruitName) {
            const { data: secondLevelRecruits } = await supabase
              .from('reps')
              .select('user_id, name, notion_page_id')
              .ilike('team_leader', `%${cleanRecruitName}%`)
              .neq('user_id', user.id);
            
            if (secondLevelRecruits) {
              for (const rep of secondLevelRecruits) {
                if (!assignableUsers.find(u => u.userId === rep.user_id)) {
                  assignableUsers.push({
                    userId: rep.user_id,
                    name: rep.name,
                    role: 'Downline',
                    notionPageId: rep.notion_page_id || '',
                  });
                }
              }
            }
          }
        }
      }
    }

    // Sort: Team Leader first, then Your Recruit, then Downline
    const roleOrder = { 'Team Leader': 0, 'Your Recruit': 1, 'Downline': 2 };
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
