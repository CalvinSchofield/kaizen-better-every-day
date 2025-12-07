import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Stage progression order - higher index = more advanced
// Used for AUTOMATIC progression checks only - manual changes always allowed
const STAGE_PROGRESSION_ORDER = [
  '100 List',
  'Reached Out',
  'Reached out',
  'Evaluating',
  'Signed',
  'Shadow ✅',
  'Sold 💲',
  'Sold (5+) 💰',
  'Potential Follow Up',
  'Not Interested',
  'Signed but Not Interested',
];

// Get stage index (returns -1 for unknown stages)
const getStageIndex = (stage: string | null): number => {
  if (!stage) return -1;
  const normalizedStage = stage.trim();
  return STAGE_PROGRESSION_ORDER.findIndex(
    s => s.toLowerCase() === normalizedStage.toLowerCase()
  );
};

// Check if stage change is a forward progression (for automatic changes only)
const isForwardProgression = (currentStage: string | null, newStage: string): boolean => {
  const currentIndex = getStageIndex(currentStage);
  const newIndex = getStageIndex(newStage);
  
  // If either stage is not in progression order, allow any change
  if (currentIndex === -1 || newIndex === -1) return true;
  
  // Only allow forward progression for automatic changes
  return newIndex >= currentIndex;
};

serve(async (req) => {
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { recruitNotionId, newStage, notes, forceUpdate = false, isAutomatic = false } = await req.json();

    if (!recruitNotionId || !newStage) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // First, get the current stage from Notion to check progression
    let currentStage: string | null = null;
    
    if (notionApiKey) {
      const getPageResponse = await fetch(`https://api.notion.com/v1/pages/${recruitNotionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
        },
      });

      if (getPageResponse.ok) {
        const pageData = await getPageResponse.json();
        currentStage = pageData.properties?.Stage?.select?.name || null;
      }
    }

    // Check if this is a valid forward progression (only for automatic changes, not manual)
    if (isAutomatic && !forceUpdate && !isForwardProgression(currentStage, newStage)) {
      console.log(`Blocked backward automatic stage change: ${currentStage} -> ${newStage}`);
      return new Response(JSON.stringify({ 
        error: 'Cannot move stage backward automatically',
        currentStage,
        requestedStage: newStage 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update in Notion
    if (notionApiKey) {
      const notionResponse = await fetch(`https://api.notion.com/v1/pages/${recruitNotionId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            'Stage': {
              select: { name: newStage }
            }
          }
        }),
      });

      if (!notionResponse.ok) {
        const errorText = await notionResponse.text();
        console.error('Notion API error:', errorText);
        throw new Error('Failed to update Notion');
      }
    }

    // Log the stage change as an activity
    const { error: activityError } = await supabase
      .from('recruit_activities')
      .insert({
        rep_notion_page_id: recruitNotionId,
        activity_type: 'stage_change',
        logged_by_user_id: user.id,
        notes: notes || `Stage changed to ${newStage}`,
      });

    if (activityError) {
      console.error('Error logging activity:', activityError);
    }

    console.log(`Updated recruit ${recruitNotionId} to stage ${newStage} (from ${currentStage})`);

    return new Response(JSON.stringify({ success: true, previousStage: currentStage }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating recruit stage:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
