import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTION_REPS_DB_ID = '99130d187a8c4bbda60c77a230ddc364';

// Helper to normalize names for comparison (strip emojis, lowercase, trim)
function normalizeNameForComparison(name: string): string {
  return name
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Find best matching recruiter from existing options
function findMatchingRecruiter(inputName: string, existingOptions: string[]): string | null {
  const normalizedInput = normalizeNameForComparison(inputName);
  if (!normalizedInput) return null;

  // Exact match after normalization
  const exactMatch = existingOptions.find(
    opt => normalizeNameForComparison(opt) === normalizedInput
  );
  if (exactMatch) return exactMatch;

  // First name match (single word input)
  const inputParts = normalizedInput.split(' ');
  if (inputParts.length === 1) {
    const firstNameMatches = existingOptions.filter(opt => {
      const optParts = normalizeNameForComparison(opt).split(' ');
      return optParts[0] === inputParts[0];
    });
    if (firstNameMatches.length === 1) return firstNameMatches[0];
  }

  // Prefix match
  const prefixMatch = existingOptions.find(opt => {
    const normalizedOpt = normalizeNameForComparison(opt);
    return normalizedInput.startsWith(normalizedOpt) || normalizedOpt.startsWith(normalizedInput);
  });
  if (prefixMatch) return prefixMatch;

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const notionApiKey = Deno.env.get('NOTION_API_KEY');

    if (!notionApiKey) {
      return new Response(JSON.stringify({ error: 'Notion configuration missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has leader access
    const { data: callerRep } = await supabase
      .from('reps')
      .select('notion_page_id, name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!callerRep?.notion_page_id) {
      return new Response(JSON.stringify({ error: 'Not authorized - no rep record found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { 
      recruitNotionPageId,
      name,
      phone,
      email,
      stage,
      location,
      recruitmentSource,
      recruiter,
      recruiterUserId,
      teamsIds,
      mgmtIds,
      recruiterOptions = [], // Pass existing options for matching
    } = body;

    if (!recruitNotionPageId) {
      return new Response(JSON.stringify({ error: 'Missing recruitNotionPageId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Updating recruit ${recruitNotionPageId} properties...`);

    const notionHeaders = {
      'Authorization': `Bearer ${notionApiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };

    // Build Notion properties object
    const notionProperties: Record<string, any> = {};

    if (name !== undefined) {
      notionProperties['Name'] = {
        title: [{ text: { content: name } }],
      };
    }

    if (phone !== undefined) {
      notionProperties['Phone'] = {
        phone_number: phone || null,
      };
    }

    if (email !== undefined) {
      notionProperties['Email'] = {
        email: email || null,
      };
    }

    if (stage !== undefined) {
      notionProperties['Stage'] = {
        select: stage ? { name: stage } : null,
      };
    }

    if (location !== undefined) {
      // Location can be multi_select or select
      if (Array.isArray(location)) {
        notionProperties['Location'] = {
          multi_select: location.map((l: string) => ({ name: l })),
        };
      } else {
        notionProperties['Location'] = {
          multi_select: location ? [{ name: location }] : [],
        };
      }
    }

    if (recruitmentSource !== undefined) {
      // "How did you recruit them?" can be multi_select or select
      if (Array.isArray(recruitmentSource)) {
        notionProperties['How did you recruit them?'] = {
          multi_select: recruitmentSource.map((s: string) => ({ name: s })),
        };
      } else {
        notionProperties['How did you recruit them?'] = {
          multi_select: recruitmentSource ? [{ name: recruitmentSource }] : [],
        };
      }
    }

    if (recruiter !== undefined) {
      // Try to match with existing options
      let recruiterName = recruiter;
      if (recruiter && recruiterOptions.length > 0) {
        const matchedName = findMatchingRecruiter(recruiter, recruiterOptions);
        if (matchedName) {
          recruiterName = matchedName;
        }
      }
      notionProperties['Recruiter'] = {
        select: recruiterName ? { name: recruiterName } : null,
      };
    }

    if (teamsIds !== undefined) {
      notionProperties['Teams'] = {
        relation: (teamsIds || []).map((id: string) => ({ id })),
      };
    }

    if (mgmtIds !== undefined) {
      notionProperties['MGMT'] = {
        relation: (mgmtIds || []).map((id: string) => ({ id })),
      };
    }

    // Update Notion page
    const response = await fetch(`https://api.notion.com/v1/pages/${recruitNotionPageId}`, {
      method: 'PATCH',
      headers: notionHeaders,
      body: JSON.stringify({ properties: notionProperties }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Notion API error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to update Notion page', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Also update Supabase recruits table
    const recruitsUpdates: Record<string, any> = {};
    if (name !== undefined) recruitsUpdates.name = name;
    if (phone !== undefined) recruitsUpdates.phone = phone;
    if (email !== undefined) recruitsUpdates.email = email;
    if (stage !== undefined) recruitsUpdates.stage = stage;
    if (location !== undefined) recruitsUpdates.location = location;
    if (recruitmentSource !== undefined) recruitsUpdates.recruitment_source = recruitmentSource;
    if (recruiterUserId !== undefined) recruitsUpdates.recruiter_user_id = recruiterUserId || null;
    if (teamsIds !== undefined && teamsIds.length > 0) recruitsUpdates.team_id = teamsIds[0];
    if (mgmtIds !== undefined && mgmtIds.length > 0) recruitsUpdates.mgmt_group_id = mgmtIds[0];

    if (Object.keys(recruitsUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from('recruits')
        .update(recruitsUpdates)
        .eq('notion_page_id', recruitNotionPageId);

      if (updateError) {
        console.error('Supabase recruits update error:', updateError);
        // Don't fail the request, Notion was updated successfully
      }
    }

    // Also update Supabase reps table if we have matching fields (for linked reps)
    const repsUpdates: Record<string, any> = {};
    if (name !== undefined) repsUpdates.name = name;
    if (phone !== undefined) repsUpdates.phone = phone;
    if (email !== undefined) repsUpdates.email = email;
    if (stage !== undefined) repsUpdates.stage = stage;

    if (Object.keys(repsUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from('reps')
        .update(repsUpdates)
        .eq('notion_page_id', recruitNotionPageId);

      if (updateError) {
        console.error('Supabase reps update error:', updateError);
        // Don't fail the request, Notion was updated successfully
      }
    }

    console.log('Successfully updated recruit properties');

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating recruit properties:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});