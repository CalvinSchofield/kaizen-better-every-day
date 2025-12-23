import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchNotionWithRateLimit, getNotionHeaders } from "../_shared/notion-rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    // Hardcode the Reps database ID
    const notionRepsDbId = '99130d187a8c4bbda60c77a230ddc364';

    if (!notionApiKey) {
      return new Response(JSON.stringify({ error: 'Notion API key missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const { 
      name, 
      phone, 
      location, 
      recruitmentSource, 
      recruiterNotionId,
      recruiterName,
      teamNotionId,
      mgmtNotionId,
      downlineNotionId 
    } = await req.json();

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Creating Notion recruit: ${name}, phone: ${phone}, location: ${location}`);

    // Build the properties object for Notion
    const properties: Record<string, any> = {
      'Name': {
        title: [{ text: { content: name } }]
      },
      'Stage': {
        select: { name: '100 List' }
      },
      'Year': {
        select: { name: 'Rookie' }
      }
    };

    // Add phone if provided
    if (phone) {
      properties['Phone'] = {
        phone_number: phone
      };
    }

    // Add location/state if provided (multi_select)
    if (location) {
      properties['Location'] = {
        multi_select: [{ name: location }]
      };
    }

    // Add recruitment source if provided (multi_select)
    if (recruitmentSource) {
      properties['How did you recruit them?'] = {
        multi_select: [{ name: recruitmentSource }]
      };
    }

    // Add recruiter if provided (select field - needs name, not ID)
    if (recruiterName) {
      // Helper to strip emojis and normalize name for comparison
      const normalizeNameForComparison = (name: string): string => {
        return name
          // Remove emojis using comprehensive unicode ranges
          .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1FA00}-\u{1FAFF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{1F004}]|[\u{1F0CF}]/gu, '')
          // Normalize whitespace (multiple spaces to single)
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
      };

      // Triple check: Fetch existing options to verify if this name already exists
      const dbResponse = await fetchNotionWithRateLimit(
        `https://api.notion.com/v1/databases/${notionRepsDbId}`,
        { headers: getNotionHeaders(notionApiKey) }
      );
      
      if (dbResponse.ok) {
        const dbData = await dbResponse.json();
        const recruiterProperty = dbData.properties?.['Recruiter'];
        
        if (recruiterProperty?.type === 'select' && recruiterProperty?.select?.options) {
          const existingOptions = recruiterProperty.select.options.map((o: { name: string }) => o.name);
          
          // Normalize input (strip emojis, whitespace, lowercase)
          const normalizedInput = normalizeNameForComparison(recruiterName);
          const inputWords = normalizedInput.split(' ').filter(Boolean);
          
          console.log(`Looking for recruiter match. Input: "${recruiterName}" → normalized: "${normalizedInput}"`);
          
          // Try to find a match with priority:
          // 1. Exact match after normalization
          // 2. First name match (if input is single word and matches first word of existing)
          // 3. Existing first name matches full input (e.g., existing "Christian" matches input "Christian Fabian")
          let existingMatch = existingOptions.find((opt: string) => 
            normalizeNameForComparison(opt) === normalizedInput
          );
          
          // If no exact match and input is a single name, try first-name matching
          if (!existingMatch && inputWords.length === 1) {
            const firstNameMatches = existingOptions.filter((opt: string) => {
              const optNormalized = normalizeNameForComparison(opt);
              const optFirstName = optNormalized.split(' ')[0];
              return optFirstName === inputWords[0];
            });
            // Only use first-name match if there's exactly one match (avoid ambiguity)
            if (firstNameMatches.length === 1) {
              existingMatch = firstNameMatches[0];
              console.log(`First-name match found: "${existingMatch}"`);
            }
          }
          
          // If no match yet, check if existing is a prefix of input (e.g., "Christian" in Notion, "Christian Fabian" coming in)
          if (!existingMatch) {
            const prefixMatch = existingOptions.find((opt: string) => {
              const optNormalized = normalizeNameForComparison(opt);
              // Existing option is a prefix (first word(s)) of input
              return normalizedInput.startsWith(optNormalized + ' ') || normalizedInput === optNormalized;
            });
            if (prefixMatch) {
              existingMatch = prefixMatch;
              console.log(`Prefix match found: "${existingMatch}"`);
            }
          }
          
          if (existingMatch) {
            // Use the existing option's exact name (preserves Notion's formatting)
            console.log(`Using existing recruiter option: "${existingMatch}"`);
            properties['Recruiter'] = {
              select: { name: existingMatch }
            };
          } else {
            // Create new option with cleaned name (no emojis)
            const cleanName = recruiterName
              .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1FA00}-\u{1FAFF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{1F004}]|[\u{1F0CF}]/gu, '')
              .replace(/\s+/g, ' ')
              .trim();
            console.log(`Creating new recruiter option: "${cleanName}" (original: "${recruiterName}")`);
            properties['Recruiter'] = {
              select: { name: cleanName }
            };
          }
        }
      }
    }
    // Add team relation if provided
    if (teamNotionId) {
      properties['Teams'] = {
        relation: [{ id: teamNotionId }]
      };
    }

    // Add MGMT relation if provided (upline MGMT group)
    if (mgmtNotionId) {
      properties['MGMT'] = {
        relation: [{ id: mgmtNotionId }]
      };
    }

    // Note: Downline is a people field, not relation - skip for now
    // Would need the person's Notion user ID, not page ID

    console.log('Creating Notion page with properties:', JSON.stringify(properties, null, 2));

    const notionResponse = await fetchNotionWithRateLimit(
      `https://api.notion.com/v1/pages`,
      {
        method: 'POST',
        headers: getNotionHeaders(notionApiKey),
        body: JSON.stringify({
          parent: { database_id: notionRepsDbId },
          properties,
        }),
      }
    );

    if (!notionResponse.ok) {
      const errorData = await notionResponse.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Notion API error:', JSON.stringify(errorData, null, 2));
      console.error('Notion response status:', notionResponse.status);
      return new Response(JSON.stringify({ 
        error: 'Failed to create recruit in Notion',
        details: errorData.message || JSON.stringify(errorData),
        notionError: errorData,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notionData = await notionResponse.json();
    console.log(`Successfully created Notion page for ${name}: ${notionData.id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      notionPageId: notionData.id,
      name 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating recruit:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
