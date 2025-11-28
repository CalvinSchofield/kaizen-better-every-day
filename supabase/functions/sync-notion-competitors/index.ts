import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotionPage {
  id: string;
  properties: Record<string, any>;
  url: string;
}

interface CompetitorData {
  notion_page_id: string;
  name: string;
  category: string | null;
  main_image_url: string | null;
  alternate_versions: any[];
  monitoring_companies: string[];
  our_selling_points: string[];
  their_selling_points: string[];
  objections: any[];
}

// Helper functions to safely extract Notion properties
function getTitle(properties: Record<string, any>, key: string): string {
  const prop = properties[key];
  if (!prop || prop.type !== 'title') return '';
  return prop.title?.[0]?.plain_text || '';
}

function getRichText(properties: Record<string, any>, key: string): string {
  const prop = properties[key];
  if (!prop || prop.type !== 'rich_text') return '';
  return prop.rich_text?.[0]?.plain_text || '';
}

function getMultiSelect(properties: Record<string, any>, key: string): string | null {
  const prop = properties[key];
  if (!prop || prop.type !== 'multi_select') return null;
  // Return the first category for simplicity
  return prop.multi_select?.[0]?.name || null;
}

function getFiles(properties: Record<string, any>, key: string): string | null {
  const prop = properties[key];
  if (!prop || prop.type !== 'files') return null;
  const file = prop.files?.[0];
  if (!file) return null;
  return file.type === 'external' ? file.external?.url : file.file?.url;
}

function getRelationIds(properties: Record<string, any>, key: string): string[] {
  const prop = properties[key];
  if (!prop || prop.type !== 'relation') return [];
  return prop.relation?.map((r: any) => r.id) || [];
}

async function fetchNotionPage(pageId: string, notionApiKey: string): Promise<any> {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      'Authorization': `Bearer ${notionApiKey}`,
      'Notion-Version': '2022-06-28',
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch page ${pageId}:`, await response.text());
    return null;
  }

  return await response.json();
}

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
  
  // Recursively fetch children for blocks that have them
  for (const block of blocks) {
    if (block.has_children && (block.type === 'callout' || block.type === 'bulleted_list_item' || block.type === 'synced_block' || block.type === 'numbered_list_item')) {
      const childResponse = await fetch(`https://api.notion.com/v1/blocks/${block.id}/children?page_size=100`, {
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
        },
      });
      
      if (childResponse.ok) {
        const childData = await childResponse.json();
        const children = childData.results || [];
        
        // Recursively fetch deeper children
        for (const child of children) {
          if (child.has_children) {
            const grandchildren = await fetchNotionBlocks(child.id, notionApiKey);
            if (child.type === 'callout') {
              child.callout = child.callout || {};
              child.callout.children = grandchildren;
            } else if (child.type === 'bulleted_list_item') {
              child.bulleted_list_item = child.bulleted_list_item || {};
              child.bulleted_list_item.children = grandchildren;
            } else if (child.type === 'numbered_list_item') {
              child.numbered_list_item = child.numbered_list_item || {};
              child.numbered_list_item.children = grandchildren;
            } else if (child.type === 'synced_block') {
              child.synced_block = child.synced_block || {};
              child.synced_block.children = grandchildren;
            }
          }
        }
        
        if (block.type === 'callout') {
          block.callout.children = children;
        } else if (block.type === 'bulleted_list_item') {
          block.bulleted_list_item.children = children;
        } else if (block.type === 'numbered_list_item') {
          block.numbered_list_item.children = children;
        } else if (block.type === 'synced_block') {
          block.synced_block.children = children;
        }
      }
    }
  }
  
  return blocks;
}

async function extractTextFromBlocks(blocks: any[], notionToken: string): Promise<{ ourSellingPoints: string[], objections: any[] }> {
  const ourSellingPoints: string[] = [];
  const objections: any[] = [];
  let inObjections = false;
  let currentObjection = '';

  console.log(`Processing ${blocks.length} blocks for selling points and objections...`);

  // Helper function to process children blocks recursively
  async function processChildrenForSellingPoints(children: any[], depth = 0): Promise<string[]> {
    const points: string[] = [];
    let foundHeading = false;
    const indent = '  '.repeat(depth);
    
    for (const child of children) {
      console.log(`${indent}Child block type: ${child.type}`);
      
      // Recursively process nested synced blocks or callouts
      if (child.type === 'synced_block' && child.synced_block?.children) {
        console.log(`${indent}Found nested synced_block, processing children...`);
        const nestedPoints = await processChildrenForSellingPoints(child.synced_block.children, depth + 1);
        points.push(...nestedPoints);
        continue;
      }
      
      if (child.type === 'callout' && child.callout?.children) {
        console.log(`${indent}Found nested callout, processing children...`);
        const nestedPoints = await processChildrenForSellingPoints(child.callout.children, depth + 1);
        points.push(...nestedPoints);
        continue;
      }
      
      // Look for H1 heading with "selling points"
      if (child.type === 'heading_1') {
        const headingText = child.heading_1?.rich_text?.map((rt: any) => rt.plain_text).join('').toLowerCase() || '';
        console.log(`${indent}Found H1: "${headingText}"`);
        if (headingText.includes('selling points')) {
          foundHeading = true;
          console.log(`${indent}✅ Found "selling points" heading!`);
        }
      }
      
      // Skip dividers
      if (child.type === 'divider') {
        console.log(`${indent}Skipping divider`);
        continue;
      }
      
      // Extract list items after finding the heading
      if (foundHeading && (child.type === 'bulleted_list_item' || child.type === 'numbered_list_item')) {
        const itemType = child.type === 'bulleted_list_item' ? 'bulleted_list_item' : 'numbered_list_item';
        const text = child[itemType]?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
        if (text) {
          const cleanText = text.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim();
          console.log(`${indent}✅ Extracted selling point: ${cleanText.substring(0, 80)}...`);
          points.push(cleanText);
        }
      }
    }
    
    return points;
  }

  for (const block of blocks) {
    console.log(`Block type: ${block.type}`);
    
    // Check for synced block
    if (block.type === 'synced_block' && block.has_children) {
      console.log('Found synced_block, fetching children...');
      const syncedChildren = block.synced_block?.children || await fetchNotionBlocks(block.id, notionToken);
      const syncedPoints = await processChildrenForSellingPoints(syncedChildren);
      ourSellingPoints.push(...syncedPoints);
    }
    
    // Check for callout block
    if (block.type === 'callout' && block.has_children) {
      const calloutIcon = block.callout?.icon?.emoji || '';
      console.log(`Callout found - Icon: "${calloutIcon}", Has children: ${block.has_children}`);
      
      // Fetch children blocks of this callout
      const children = block.callout?.children || await fetchNotionBlocks(block.id, notionToken);
      console.log(`Found ${children.length} children blocks in callout`);
      
      const calloutPoints = await processChildrenForSellingPoints(children);
      ourSellingPoints.push(...calloutPoints);
    }

    // Check for heading_1 to identify objections section
    if (block.type === 'heading_1') {
      const headingText = block.heading_1?.rich_text?.[0]?.plain_text || '';
      if (headingText.includes('Potential objections')) {
        inObjections = true;
      } else {
        inObjections = false;
      }
    }

    // Extract objections and handles
    if (inObjections) {
      if (block.type === 'bulleted_list_item') {
        const text = block.bulleted_list_item?.rich_text?.[0]?.plain_text || '';
        if (text && text.trim() !== '' && !currentObjection) {
          currentObjection = text;
        }
        
        // Check for child quote blocks
        const children = block.bulleted_list_item?.children || [];
        for (const child of children) {
          if (child.type === 'quote') {
            const handle = child.quote?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
            if (handle && currentObjection) {
              objections.push({
                objection: currentObjection,
                handle: handle.replace(/[""]/g, '"'), // Normalize quotes
              });
              currentObjection = '';
            }
          }
        }
      }
    }
  }

  return { ourSellingPoints, objections };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!notionApiKey || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Database ID from the Notion URL
    const databaseId = '1af070fe3bc2809e9a4cc6ea3fb777b6';

    console.log('Fetching competitors from Notion database...');

    // Query the Notion database
    const notionResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!notionResponse.ok) {
      throw new Error(`Failed to query Notion database: ${await notionResponse.text()}`);
    }

    const notionData = await notionResponse.json();
    const pages: NotionPage[] = notionData.results || [];

    console.log(`Found ${pages.length} competitors in Notion`);

    // Process all competitors in parallel for better performance
    const competitorPromises = pages.map(async (page) => {
      const name = getTitle(page.properties, 'Name');
      if (!name) {
        console.log(`Skipping page ${page.id} - no name found`);
        return null;
      }

      console.log(`Processing competitor: ${name}`);

      const category = getMultiSelect(page.properties, 'Type');
      const mainImageUrl = getFiles(page.properties, 'Image');
      const theirSellingPointsText = getRichText(page.properties, 'Why customers buy it');
      const theirSellingPoints = theirSellingPointsText ? theirSellingPointsText.split('\n').filter(Boolean) : [];

      // Fetch page blocks to get our selling points and objections
      const blocks = await fetchNotionBlocks(page.id, notionApiKey);
      const { ourSellingPoints, objections } = await extractTextFromBlocks(blocks, notionApiKey);

      // Fetch "Used by" monitoring companies in parallel
      const usedByIds = getRelationIds(page.properties, 'Used by');
      const monitoringCompanyPromises = usedByIds.map(async (id) => {
        const companyPage = await fetchNotionPage(id, notionApiKey);
        if (companyPage) {
          const companyName = getTitle(companyPage.properties, 'Name');
          return companyName || null;
        }
        return null;
      });
      const monitoringCompanies = (await Promise.all(monitoringCompanyPromises)).filter(Boolean) as string[];

      // Fetch alternate versions in parallel
      const alternateVersionIds = getRelationIds(page.properties, 'Other versions');
      const alternateVersionPromises = alternateVersionIds.map(async (id) => {
        const versionPage = await fetchNotionPage(id, notionApiKey);
        if (versionPage) {
          const versionName = getTitle(versionPage.properties, 'Name');
          const versionImage = getFiles(versionPage.properties, 'Image');
          if (versionName) {
            return {
              name: versionName,
              image_url: versionImage,
              notion_page_id: id,
            };
          }
        }
        return null;
      });
      const alternateVersions = (await Promise.all(alternateVersionPromises)).filter(Boolean) as any[];

      return {
        notion_page_id: page.id,
        name,
        category,
        main_image_url: mainImageUrl,
        alternate_versions: alternateVersions,
        monitoring_companies: monitoringCompanies,
        our_selling_points: ourSellingPoints,
        their_selling_points: theirSellingPoints,
        objections,
      } as CompetitorData;
    });

    const competitorsToUpsert = (await Promise.all(competitorPromises)).filter(Boolean) as CompetitorData[];

    // Upsert all competitors in a single batch operation
    console.log(`Upserting ${competitorsToUpsert.length} competitors to Supabase...`);

    const { error: batchError } = await supabase
      .from('competitors')
      .upsert(competitorsToUpsert, {
        onConflict: 'notion_page_id',
      });

    if (batchError) {
      console.error('Batch upsert error:', batchError);
      throw new Error(`Failed to upsert competitors: ${batchError.message}`);
    }

    console.log(`Successfully synced ${competitorsToUpsert.length} competitors`);

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount: competitorsToUpsert.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error syncing competitors:', error);
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
