import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Notion API helper with retry logic and jitter
async function fetchNotionWithRetry(url: string, options: RequestInit, maxRetries = 8): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If rate limited (429), retry with exponential backoff + jitter
      if (response.status === 429) {
        // Check for Retry-After header
        const retryAfter = response.headers.get('Retry-After');
        let delay: number;
        
        if (retryAfter) {
          delay = parseInt(retryAfter, 10) * 1000 || 60000;
        } else {
          // Exponential backoff with jitter: base delay * 2^attempt + random jitter
          const baseDelay = Math.min(2000 * Math.pow(2, attempt), 90000); // Max 90 seconds
          const jitter = Math.random() * 1000; // 0-1 second jitter
          delay = baseDelay + jitter;
        }
        
        console.log(`Rate limited (429). Retrying in ${Math.round(delay)}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error: any) {
      lastError = error;
      console.error(`Fetch attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 90000) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error(`Failed after ${maxRetries} attempts`);
}

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
    const notionRepsDbId = Deno.env.get('NOTION_REPS_DATABASE_ID');

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

    const body = await req.json().catch(() => ({}));
    const { accessibleNotionIds, includeActivities = true } = body;

    if (!accessibleNotionIds || accessibleNotionIds.length === 0) {
      return new Response(JSON.stringify({ recruits: [], activities: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch recruits from Notion
    const recruits: any[] = [];
    const allBlitzTripIds = new Set<string>();
    
    // Temporary storage for recruit data before we have blitz details
    const rawRecruits: any[] = [];
    
    if (notionApiKey && notionRepsDbId) {
      // Filter for recruits in accessible list with recruiting-related stages
      const recruitingStages = ['100 List', 'Reached Out', 'Evaluating', 'Signed', 'Shadow ✅', 'Sold 💲', 'Sold (5+) 💰'];
      
      const response = await fetchNotionWithRetry(
        `https://api.notion.com/v1/databases/${notionRepsDbId}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${notionApiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filter: {
              or: recruitingStages.map(stage => ({
                property: 'Stage',
                select: { equals: stage }
              }))
            },
            page_size: 100
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        for (const page of data.results) {
          const props = page.properties;
          
          // Get recruiter relation to check if in accessible list
          const recruiterRelation = props['Recruiter']?.relation?.[0]?.id;
          
          if (recruiterRelation && accessibleNotionIds.includes(recruiterRelation)) {
            const getName = (prop: any) => prop?.title?.[0]?.plain_text || prop?.rich_text?.[0]?.plain_text || '';
            const getSelectLocal = (prop: any) => prop?.select?.name || '';
            const getPhone = (prop: any) => prop?.phone_number || '';
            const getEmail = (prop: any) => prop?.email || '';
            const getDate = (prop: any) => prop?.date?.start || null;
            const getCheckbox = (prop: any) => prop?.checkbox ?? false;
            const getSelectValue = (prop: any) => prop?.select?.name || '';
            
            // Collect blitz trip relation IDs
            const blitzTripRelationIds: string[] = [];
            if (props['Preseason trips']?.relation) {
              for (const rel of props['Preseason trips'].relation) {
                blitzTripRelationIds.push(rel.id);
                allBlitzTripIds.add(rel.id);
              }
            }
            
            // Parse "Onboarding Step Completed" status property
            // Progression: Not Started → Onboarding ✅ → Required Trainings ✅ → Slack ✅ → Phase 1 ✅ → Phase 2 ✅ → Phase 3 ✅ → Phase 4 ✅
            const onboardingStepValue = getSelectValue(props['Onboarding Step Completed']);
            const stepLower = onboardingStepValue.toLowerCase();
            
            // Determine what step they're at (each step implies all previous are complete)
            const hasPhase4 = stepLower.includes('phase 4');
            const hasPhase3 = hasPhase4 || stepLower.includes('phase 3');
            const hasPhase2 = hasPhase3 || stepLower.includes('phase 2');
            const hasPhase1 = hasPhase2 || stepLower.includes('phase 1');
            const hasSlack = hasPhase1 || stepLower.includes('slack');
            const hasTrainings = hasSlack || stepLower.includes('training');
            const hasBasicOnboarding = hasTrainings || stepLower.includes('onboarding');
            
            // slackJoined = they've reached "Slack ✅" or any phase (unlocks Goals page)
            const slackJoined = hasSlack;
            // trainingsComplete = they've reached "Required Trainings ✅" or beyond
            const trainingsComplete = hasTrainings;
            // onboardingComplete = they've completed basic onboarding through Slack (full onboarding done)
            // This is when they can start Ramp to Blitz
            const onboardingComplete = hasSlack;
            
            rawRecruits.push({
              notionPageId: page.id,
              name: getName(props['Name']),
              phone: getPhone(props['Phone']),
              email: getEmail(props['Email']),
              stage: getSelectLocal(props['Stage']),
              recruiterNotionId: recruiterRelation,
              year: getSelectLocal(props['Year']),
              lastContact: getDate(props['Last Contact']),
              nextAction: getName(props['Next Action']),
              nextActionDue: getDate(props['Next Action Due']),
              createdAt: page.created_time,
              blitzTripRelationIds, // Temporary field, will be replaced with full data
              // Ramp-to-blitz phase data parsed from "Onboarding Step Completed" select
              rampToBlitzPhase: onboardingStepValue || null,
              phase1Complete: hasPhase1,
              phase2Complete: hasPhase2,
              phase3Complete: hasPhase3,
              phase4Complete: hasPhase4,
              onboardingComplete: onboardingComplete,
              trainingsComplete: trainingsComplete,
              slackJoined: slackJoined,
              ipadAssigned: getCheckbox(props['iPad Assigned']),
              blitzReady: getCheckbox(props['Blitz Ready']),
            });
          }
        }
      }

      // Fetch blitz trip details for all collected IDs
      const blitzTripsData = new Map<string, any>();
      
      if (allBlitzTripIds.size > 0) {
        console.log(`Fetching ${allBlitzTripIds.size} blitz trips for recruit blitz data`);
        
        // Fetch each blitz trip page
        for (const tripId of allBlitzTripIds) {
          try {
            const tripResponse = await fetchNotionWithRetry(
              `https://api.notion.com/v1/pages/${tripId}`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${notionApiKey}`,
                  'Notion-Version': '2022-06-28',
                },
              }
            );

            if (tripResponse.ok) {
              const tripPage = await tripResponse.json();
              blitzTripsData.set(tripId, tripPage);
            }
          } catch (error) {
            console.error(`Failed to fetch blitz trip ${tripId}:`, error);
          }
        }
      }

      // Helper functions for extracting blitz trip properties
      const getTitle = (prop: any) => prop?.title?.[0]?.plain_text || '';
      const getRichText = (prop: any) => prop?.rich_text?.[0]?.plain_text || '';
      const getSelect = (prop: any) => prop?.select?.name || '';

      // Now build final recruits with blitz data
      for (const rawRecruit of rawRecruits) {
        const committedBlitzes: any[] = [];
        
        for (const tripId of rawRecruit.blitzTripRelationIds) {
          const tripPage = blitzTripsData.get(tripId);
          if (tripPage) {
            const tripProps = tripPage.properties;
            const tripName = getTitle(tripProps.Name);
            
            if (tripName) {
              const dateProp = tripProps.Date;
              const tripDate = dateProp?.date?.start || null;
              const tripEndDate = dateProp?.date?.end || null;
              const tripLocation = getRichText(tripProps.Location) || getSelect(tripProps.Location);
              
              committedBlitzes.push({
                id: tripId,
                name: tripName,
                date: tripDate || '',
                endDate: tripEndDate,
                location: tripLocation,
              });
            }
          }
        }
        
        // Remove temporary field and add committed blitzes
        const { blitzTripRelationIds, ...recruitData } = rawRecruit;
        recruits.push({
          ...recruitData,
          committedBlitzes,
        });
      }
    }

    // Fetch activities from Supabase if requested
    let activities: any[] = [];
    if (includeActivities && recruits.length > 0) {
      const recruitNotionIds = recruits.map(r => r.notionPageId);
      
      const { data: activityData } = await supabase
        .from('recruit_activities')
        .select('*')
        .in('rep_notion_page_id', recruitNotionIds)
        .order('created_at', { ascending: false })
        .limit(500);
      
      activities = activityData || [];
    }

    // Fetch pending suggestions for this user's team
    const { data: currentRep } = await supabase
      .from('reps')
      .select('notion_page_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let pendingSuggestions: any[] = [];
    if (currentRep?.notion_page_id) {
      const { data: suggestions } = await supabase
        .from('recruit_suggestions')
        .select('*')
        .eq('team_leader_notion_id', currentRep.notion_page_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      pendingSuggestions = suggestions || [];
    }

    console.log(`Fetched ${recruits.length} recruits, ${activities.length} activities, ${pendingSuggestions.length} pending suggestions`);

    return new Response(JSON.stringify({ 
      recruits, 
      activities,
      pendingSuggestions
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching group recruits:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
