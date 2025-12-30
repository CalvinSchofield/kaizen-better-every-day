import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Stage progression order - higher index = more advanced
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

// Exit stages that should NEVER be auto-overridden - leader manually set these
// Must match stageConstants.ts exactly
const EXIT_STAGES = ['Not Interested', 'Signed but Not Interested', 'Potential Follow Up'];

// Check if stage is an exit stage (case-insensitive)
const isExitStage = (stage: string | null): boolean => {
  if (!stage) return false;
  return EXIT_STAGES.some(es => es.toLowerCase() === stage.toLowerCase());
};

const getStageIndex = (stage: string | null): number => {
  if (!stage) return -1;
  const normalizedStage = stage.trim();
  return STAGE_PROGRESSION_ORDER.findIndex(
    s => s.toLowerCase() === normalizedStage.toLowerCase()
  );
};

const canProgressToStage = (currentStage: string | null, newStage: string): boolean => {
  // NEVER auto-progress from exit stages - leader manually put them there
  if (isExitStage(currentStage)) {
    return false;
  }
  
  const currentIndex = getStageIndex(currentStage);
  const newIndex = getStageIndex(newStage);
  if (currentIndex === -1 || newIndex === -1) return true;
  return newIndex > currentIndex;
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

    // Get the user's rep record - use user_id as primary lookup
    const { data: repData } = await supabase
      .from('reps')
      .select('id, stage, onboarding_complete, blitz_trip_date')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!repData) {
      return new Response(JSON.stringify({ updated: false, reason: 'No rep record found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SAFEGUARD: Skip auto-progression entirely for users already in exit stages
    // Leaders manually set these stages - never override them
    if (isExitStage(repData.stage)) {
      console.log(`[check-auto-stage-progression] Skipping - user ${repData.id} is in exit stage: ${repData.stage}`);
      return new Response(JSON.stringify({ 
        updated: false, 
        reason: 'User is in an exit stage - no auto-progression allowed',
        currentStage: repData.stage
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get total FP+ from all daily entries
    const { data: entries } = await supabase
      .from('daily_entries')
      .select('fp_plus')
      .eq('user_id', user.id);

    const totalFpPlus = entries?.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0) || 0;

    // Check if they've attended a blitz (blitz trip date is in the past)
    const hasAttendedBlitz = repData.blitz_trip_date 
      ? new Date(repData.blitz_trip_date) < new Date()
      : false;
    
    const onboardingComplete = repData.onboarding_complete ?? false;
    const currentStage = repData.stage;

    // Determine new stage based on metrics (check from most advanced to least)
    let newStage: string | null = null;
    let reason = '';

    if (totalFpPlus >= 5 && canProgressToStage(currentStage, 'Sold (5+) 💰')) {
      newStage = 'Sold (5+) 💰';
      reason = '5+ FP+ achieved';
    } else if (totalFpPlus > 0 && canProgressToStage(currentStage, 'Sold 💲')) {
      newStage = 'Sold 💲';
      reason = 'First sale recorded';
    } else if (hasAttendedBlitz && canProgressToStage(currentStage, 'Shadow ✅')) {
      newStage = 'Shadow ✅';
      reason = 'Attended blitz';
    } else if (onboardingComplete && canProgressToStage(currentStage, 'Signed')) {
      newStage = 'Signed';
      reason = 'Onboarding completed';
    }

    if (!newStage || newStage === currentStage) {
      return new Response(JSON.stringify({ 
        updated: false, 
        currentStage,
        totalFpPlus,
        onboardingComplete,
        hasAttendedBlitz
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update stage in reps table using Supabase ID
    const { error: updateError } = await supabase
      .from('reps')
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', repData.id);

    if (updateError) {
      console.error('Error updating stage:', updateError);
      throw new Error('Failed to update stage');
    }

    // Also update recruits table if there's a matching record by ID
    await supabase
      .from('recruits')
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', repData.id);

    // Log the automatic stage change
    await supabase
      .from('recruit_activities')
      .insert({
        recruit_id: repData.id,
        activity_type: 'stage_change',
        logged_by_user_id: user.id,
        notes: `Auto-progressed to ${newStage}: ${reason}`,
      });

    console.log(`Auto-progressed ${repData.id} from ${currentStage} to ${newStage}: ${reason}`);

    return new Response(JSON.stringify({ 
      updated: true, 
      previousStage: currentStage,
      newStage,
      reason,
      totalFpPlus
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error checking auto stage progression:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
