import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchNotionBlocks(pageId: string, notionApiKey: string): Promise<any[]> {
  const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
    headers: {
      'Authorization': `Bearer ${notionApiKey}`,
      'Notion-Version': '2022-06-28',
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch blocks for ${pageId}:`, await response.text());
    return [];
  }

  const data = await response.json();
  const blocks = data.results || [];
  
  // Fetch children for blocks that have them
  for (const block of blocks) {
    if (block.has_children && (block.type === 'callout' || block.type === 'bulleted_list_item')) {
      const childResponse = await fetch(`https://api.notion.com/v1/blocks/${block.id}/children?page_size=100`, {
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
        },
      });
      
      if (childResponse.ok) {
        const childData = await childResponse.json();
        if (block.type === 'callout') {
          block.callout.children = childData.results || [];
        } else if (block.type === 'bulleted_list_item') {
          block.bulleted_list_item.children = childData.results || [];
        }
      }
    }
  }
  
  return blocks;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    
    if (!notionApiKey) {
      throw new Error('Missing NOTION_API_KEY');
    }

    const { pageId } = await req.json();
    
    if (!pageId) {
      throw new Error('Missing pageId parameter');
    }

    console.log(`Fetching blocks for page: ${pageId}`);
    
    const blocks = await fetchNotionBlocks(pageId, notionApiKey);
    
    console.log(`Found ${blocks.length} blocks`);
    
    return new Response(
      JSON.stringify({
        success: true,
        blocks: blocks,
        blockCount: blocks.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in debug-notion-blocks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
