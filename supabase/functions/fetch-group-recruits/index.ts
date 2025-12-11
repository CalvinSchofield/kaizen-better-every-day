import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Notion API helper with retry logic
async function fetchNotionWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error as Error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  throw lastError || new Error('Max retries exceeded');
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

    const { accessibleNotionIds, includeActivities = true } = await req.json();

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
            const getSelect = (prop: any) => prop?.select?.name || '';
            const getPhone = (prop: any) => prop?.phone_number || '';
            const getEmail = (prop: any) => prop?.email || '';
            const getDate = (prop: any) => prop?.date?.start || null;
            
            // Collect blitz trip relation IDs
            const blitzTripRelationIds: string[] = [];
            if (props['Preseason trips']?.relation) {
              for (const rel of props['Preseason trips'].relation) {
                blitzTripRelationIds.push(rel.id);
                allBlitzTripIds.add(rel.id);
              }
            }
            
            rawRecruits.push({
              notionPageId: page.id,
              name: getName(props['Name']),
              phone: getPhone(props['Phone']),
              email: getEmail(props['Email']),
              stage: getSelect(props['Stage']),
              recruiterNotionId: recruiterRelation,
              year: getSelect(props['Year']),
              lastContact: getDate(props['Last Contact']),
              nextAction: getName(props['Next Action']),
              nextActionDue: getDate(props['Next Action Due']),
              createdAt: page.created_time,
              blitzTripRelationIds, // Temporary field, will be replaced with full data
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
