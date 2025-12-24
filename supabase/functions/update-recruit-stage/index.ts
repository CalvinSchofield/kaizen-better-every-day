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
      console.error('[update-recruit-stage] Missing authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use service role to bypass RLS (leaders updating recruits they manage)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[update-recruit-stage] Invalid token:', authError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Support both recruitId (new) and recruitNotionId (legacy)
    const body = await req.json();
    const { recruitId, recruitNotionId, newStage, notes, forceUpdate = false, isAutomatic = false } = body;
    
    console.log(`[update-recruit-stage] Request: recruitId=${recruitId}, recruitNotionId=${recruitNotionId}, newStage=${newStage}, isAutomatic=${isAutomatic}, user=${user.id}`);

    if ((!recruitId && !recruitNotionId) || !newStage) {
      console.error('[update-recruit-stage] Missing required fields');
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current stage from Supabase (source of truth)
    // Try by Supabase ID first, then fall back to Notion ID
    let currentRep = null;
    let fetchError = null;

    if (recruitId) {
      const result = await supabase
        .from('reps')
        .select('id, notion_page_id, stage, name')
        .eq('id', recruitId)
        .maybeSingle();
      currentRep = result.data;
      fetchError = result.error;
    }

    if (!currentRep && recruitNotionId) {
      const result = await supabase
        .from('reps')
        .select('id, notion_page_id, stage, name')
        .eq('notion_page_id', recruitNotionId)
        .maybeSingle();
      currentRep = result.data;
      fetchError = result.error;
    }

    if (fetchError || !currentRep) {
      console.error('[update-recruit-stage] Error fetching current rep:', fetchError);
      return new Response(JSON.stringify({ error: 'Recruit not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentStage = currentRep?.stage || null;
    console.log(`[update-recruit-stage] Current stage for ${currentRep?.name}: ${currentStage}`);

    // Check if this is a valid forward progression (only for automatic changes, not manual)
    if (isAutomatic && !forceUpdate && !isForwardProgression(currentStage, newStage)) {
      console.log(`[update-recruit-stage] Blocked backward automatic stage change: ${currentStage} -> ${newStage}`);
      return new Response(JSON.stringify({ 
        error: 'Cannot move stage backward automatically',
        currentStage,
        requestedStage: newStage 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update stage in Supabase using the rep's ID
    const { error: updateError } = await supabase
      .from('reps')
      .update({ 
        stage: newStage, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', currentRep.id);

    if (updateError) {
      console.error('[update-recruit-stage] Error updating rep stage:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update stage' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Also update recruits table if there's a matching record
    if (currentRep.notion_page_id) {
      await supabase
        .from('recruits')
        .update({ stage: newStage, updated_at: new Date().toISOString() })
        .eq('notion_page_id', currentRep.notion_page_id);
    }

    console.log(`[update-recruit-stage] Successfully updated ${currentRep?.name} from ${currentStage} to ${newStage}`);

    // Log the stage change as an activity - use rep_notion_page_id for compatibility
    const activityRepId = currentRep.notion_page_id || currentRep.id;
    const { error: activityError } = await supabase
      .from('recruit_activities')
      .insert({
        rep_notion_page_id: activityRepId,
        recruit_id: currentRep.id, // New column for future lookups
        activity_type: 'stage_change',
        logged_by_user_id: user.id,
        notes: notes || `Stage changed from "${currentStage || 'unknown'}" to "${newStage}"`,
      });

    if (activityError) {
      console.error('[update-recruit-stage] Error logging activity:', activityError);
      // Don't fail the request for activity logging errors
    }

    return new Response(JSON.stringify({ 
      success: true, 
      previousStage: currentStage,
      newStage: newStage 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[update-recruit-stage] Unexpected error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
