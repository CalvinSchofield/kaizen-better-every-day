import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Stage progression order - higher index = more advanced
// Used for AUTOMATIC progression checks only - manual changes always allowed
// Must match stageConstants.ts exactly
const STAGE_PROGRESSION_ORDER = [
  '100 List',
  'Reached Out',
  'Evaluating',
  'Signed',
  'Shadow ✅',
  'Sold 💲',
  'Sold (5+) 💰',
];

// Exit stages - not part of linear progression
const EXIT_STAGES = [
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

    const body = await req.json();
    const { recruitId, newStage, notes, forceUpdate = false, isAutomatic = false } = body;
    
    console.log(`[update-recruit-stage] Request: recruitId=${recruitId}, newStage=${newStage}, isAutomatic=${isAutomatic}, user=${user.id}`);

    if (!recruitId || !newStage) {
      console.error('[update-recruit-stage] Missing required fields');
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if moving to Signed or beyond - require email
    const signedPlusStages = ['Signed', 'Shadow ✅', 'Sold 💲', 'Sold (5+) 💰'];
    const isMovingToSignedPlus = signedPlusStages.some(s => s.toLowerCase() === newStage.toLowerCase());

    // Get current recruit info
    let currentRecruit: { id: string; stage: string | null; name: string; email: string | null } | null = null;
    let currentRep: { id: string; stage: string | null; name: string } | null = null;

    // Try recruits table first
    const { data: recruit, error: recruitError } = await supabase
      .from('recruits')
      .select('id, stage, name, email')
      .eq('id', recruitId)
      .maybeSingle();

    if (recruitError) {
      console.error('[update-recruit-stage] Error fetching recruit:', recruitError);
    }
    currentRecruit = recruit;

    // Validate email requirement for Signed+ stages
    if (isMovingToSignedPlus && currentRecruit && (!currentRecruit.email || currentRecruit.email.trim() === '')) {
      console.error('[update-recruit-stage] Email required for Signed stage');
      return new Response(JSON.stringify({ 
        error: 'Email is required before moving to Signed stage',
        requiresEmail: true 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback: in leader views we sometimes only have a rep record
    if (!currentRecruit) {
      const { data: repById, error: repByIdError } = await supabase
        .from('reps')
        .select('id, stage, name')
        .eq('id', recruitId)
        .maybeSingle();

      if (repByIdError) {
        console.error('[update-recruit-stage] Error fetching rep by id:', repByIdError);
      }
      currentRep = repById;
    }

    // Try to find linked rep by email first, then by name
    if (currentRecruit && !currentRep) {
      if (currentRecruit.email) {
        const { data: repByEmail } = await supabase
          .from('reps')
          .select('id, stage, name, user_id')
          .ilike('email', currentRecruit.email)
          .maybeSingle();
        currentRep = repByEmail;
      }
      
      // If still no rep found, try matching by normalized name
      if (!currentRep && currentRecruit.name) {
        const normalizedName = currentRecruit.name.toLowerCase().trim().replace(/[^\w\s]/g, '');
        const { data: reps } = await supabase
          .from('reps')
          .select('id, stage, name, user_id');
        
        if (reps) {
          const matchedRep = reps.find(r => {
            const repNormalizedName = r.name?.toLowerCase().trim().replace(/[^\w\s]/g, '') || '';
            return repNormalizedName === normalizedName;
          });
          if (matchedRep) {
            currentRep = matchedRep;
            console.log(`[update-recruit-stage] Found matching rep by name: ${matchedRep.name} (id: ${matchedRep.id})`);
          }
        }
      }
    }

    // We need at least the recruit or rep to proceed
    if (!currentRecruit && !currentRep) {
      console.error('[update-recruit-stage] Neither recruit nor rep found');
      return new Response(JSON.stringify({ error: 'Recruit not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use recruit stage as current if available, otherwise use rep
    const currentStage = currentRecruit?.stage || currentRep?.stage || null;
    const entityName = currentRecruit?.name || currentRep?.name || 'Unknown';
    
    console.log(`[update-recruit-stage] Current stage for ${entityName}: ${currentStage}`);

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

    // Update stage in recruits table first (when we have a recruits row)
    if (currentRecruit) {
      const { error: recruitUpdateError } = await supabase
        .from('recruits')
        .update({
          stage: newStage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentRecruit.id);

      if (recruitUpdateError) {
        console.error('[update-recruit-stage] Error updating recruit stage:', recruitUpdateError);
        return new Response(JSON.stringify({ error: 'Failed to update stage' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log(`[update-recruit-stage] Updated recruits table for ${entityName}`);
    }

    // Update stage in reps table if there's a matching rep
    if (currentRep) {
      const { error: repUpdateError } = await supabase
        .from('reps')
        .update({ 
          stage: newStage, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', currentRep.id);

      if (repUpdateError) {
        console.error('[update-recruit-stage] Error updating rep stage:', repUpdateError);
        // Don't fail if rep update fails - recruit update is primary
      } else {
        console.log(`[update-recruit-stage] Updated reps table for ${entityName}`);
      }
    }

    console.log(`[update-recruit-stage] Successfully updated ${entityName} from ${currentStage} to ${newStage}`);

    // Log the stage change as an activity
    const recruitDbId = currentRecruit?.id || currentRep?.id || null;
    
    const { error: activityError } = await supabase
      .from('recruit_activities')
      .insert({
        recruit_id: recruitDbId,
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
