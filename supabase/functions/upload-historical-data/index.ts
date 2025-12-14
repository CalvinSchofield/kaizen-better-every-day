import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Season start dates (Monday of week 1)
const SEASON_STARTS: Record<number, { preseason: Date; summer: Date; extension: Date }> = {
  2024: {
    preseason: new Date(2023, 9, 2),  // Oct 2, 2023
    summer: new Date(2024, 3, 15),    // Apr 15, 2024
    extension: new Date(2024, 8, 2),  // Sept 2, 2024
  },
  2025: {
    preseason: new Date(2024, 8, 30), // Sept 30, 2024
    summer: new Date(2025, 3, 14),    // Apr 14, 2025
    extension: new Date(2025, 8, 1),  // Sept 1, 2025
  },
  2026: {
    preseason: new Date(2025, 8, 29), // Sept 29, 2025
    summer: new Date(2026, 3, 13),    // Apr 13, 2026
    extension: new Date(2026, 7, 31), // Aug 31, 2026
  },
};

interface RawEntry {
  date: string;
  doors_knocked?: number;
  decision_makers?: number;
  pitches?: number;
  transitions?: number;
  presentations?: number;
  closes?: number;
  fp_plus?: number;
  prmr?: number;
  hours_worked?: number;
}

function parseDate(dateStr: string): Date | null {
  try {
    // Try YYYY-MM-DD
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    }
    // Try MM/DD/YYYY
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      }
    }
    return null;
  } catch {
    return null;
  }
}

function getSeasonInfo(date: Date): { year: number; type: string; week: number; dayOfWeek: number } | null {
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  // Check each year's seasons in reverse order (newest first)
  const years = Object.keys(SEASON_STARTS).map(Number).sort((a, b) => b - a);
  
  for (const year of years) {
    const seasons = SEASON_STARTS[year];
    if (!seasons) continue;
    
    // Check seasons in reverse order: extension, summer, preseason
    for (const [type, startDate] of [
      ['extension', seasons.extension] as [string, Date],
      ['summer', seasons.summer] as [string, Date],
      ['preseason', seasons.preseason] as [string, Date],
    ]) {
      if (dateOnly >= startDate) {
        const daysSinceStart = Math.floor((dateOnly.getTime() - (startDate as Date).getTime()) / (1000 * 60 * 60 * 24));
        const week = Math.floor(daysSinceStart / 7) + 1;
        const dayOfWeek = date.getDay(); // 0 = Sunday
        const adjustedDayOfWeek = dayOfWeek === 0 ? 0 : dayOfWeek; // Keep 1-6 for Mon-Sat, 0 for Sunday
        
        return { year, type: type as string, week, dayOfWeek: adjustedDayOfWeek };
      }
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { entries } = await req.json() as { entries: RawEntry[] };

    if (!entries || !Array.isArray(entries)) {
      return new Response(JSON.stringify({ error: 'Invalid entries data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${entries.length} entries for user ${user.id}`);

    // Process and validate entries
    const validEntries: any[] = [];
    const errors: string[] = [];

    for (const entry of entries) {
      const date = parseDate(entry.date);
      if (!date) {
        errors.push(`Invalid date: ${entry.date}`);
        continue;
      }

      const seasonInfo = getSeasonInfo(date);
      if (!seasonInfo) {
        errors.push(`Cannot determine season for date: ${entry.date}`);
        continue;
      }

      // Skip Sundays (dayOfWeek === 0)
      if (seasonInfo.dayOfWeek === 0) {
        continue;
      }

      validEntries.push({
        user_id: user.id,
        season_year: seasonInfo.year,
        season_type: seasonInfo.type,
        season_week: seasonInfo.week,
        day_of_week: seasonInfo.dayOfWeek,
        original_date: date.toISOString().split('T')[0],
        doors_knocked: entry.doors_knocked || 0,
        decision_makers: entry.decision_makers || 0,
        pitches: entry.pitches || 0,
        transitions: entry.transitions || 0,
        presentations: entry.presentations || 0,
        closes: entry.closes || 0,
        fp_plus: entry.fp_plus || 0,
        prmr: entry.prmr || 0,
        hours_worked: entry.hours_worked || 0,
      });
    }

    console.log(`Valid entries: ${validEntries.length}, Errors: ${errors.length}`);

    if (validEntries.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No valid entries to import',
        details: errors.slice(0, 10),
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert entries (on conflict, update)
    const { error: insertError } = await supabase
      .from('historical_entries')
      .upsert(validEntries, {
        onConflict: 'user_id,season_year,season_type,season_week,day_of_week',
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get summary of imported data
    const yearSummary: Record<number, Record<string, number>> = {};
    for (const entry of validEntries) {
      if (!yearSummary[entry.season_year]) {
        yearSummary[entry.season_year] = {};
      }
      if (!yearSummary[entry.season_year][entry.season_type]) {
        yearSummary[entry.season_year][entry.season_type] = 0;
      }
      yearSummary[entry.season_year][entry.season_type]++;
    }

    console.log('Import complete:', yearSummary);

    return new Response(JSON.stringify({
      imported: validEntries.length,
      errors: errors.length,
      errorSamples: errors.slice(0, 5),
      summary: yearSummary,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
