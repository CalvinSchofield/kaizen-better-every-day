import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CounterTimestamps {
  [key: string]: string[];
}

interface DailyEntry {
  id: string;
  user_id: string;
  entry_date: string;
  doors_knocked: number | null;
  pitches: number | null;
  decision_makers: number | null;
  presentations: number | null;
  closes: number | null;
  transitions: number | null;
  work_start_time: string | null;
  work_end_time: string | null;
  counter_timestamps: CounterTimestamps | null;
  timezone: string | null;
  is_finalized: boolean | null;
}

// Get the earliest and latest timestamps from counter_timestamps
function getTimestampBounds(counterTimestamps: CounterTimestamps | null): { earliest: Date | null; latest: Date | null } {
  let earliest: Date | null = null;
  let latest: Date | null = null;

  if (!counterTimestamps) return { earliest, latest };

  Object.values(counterTimestamps).forEach((timestamps) => {
    if (Array.isArray(timestamps)) {
      timestamps.forEach((ts) => {
        try {
          const date = new Date(ts);
          if (isNaN(date.getTime())) return;
          if (!earliest || date < earliest) earliest = date;
          if (!latest || date > latest) latest = date;
        } catch {
          // Skip invalid timestamps
        }
      });
    }
  });

  return { earliest, latest };
}

// Format a Date as ISO string for work times
function formatWorkTime(date: Date): string {
  return date.toISOString();
}

// Check if an entry is "stale" (entry_date < today in user's timezone)
function isEntryStale(entryDate: string, timezone: string): boolean {
  try {
    const now = new Date();
    const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const todayStr = `${nowInTz.getFullYear()}-${String(nowInTz.getMonth() + 1).padStart(2, '0')}-${String(nowInTz.getDate()).padStart(2, '0')}`;
    return entryDate < todayStr;
  } catch (e) {
    console.error(`Timezone error for ${timezone}:`, e);
    // Fallback: assume stale if entry is older than yesterday UTC
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    return entryDate <= yesterdayStr;
  }
}

// Check if entry has any meaningful activity
function hasActivity(entry: DailyEntry): boolean {
  const hasCounters = (entry.doors_knocked || 0) > 0 ||
    (entry.pitches || 0) > 0 ||
    (entry.decision_makers || 0) > 0 ||
    (entry.presentations || 0) > 0 ||
    (entry.closes || 0) > 0 ||
    (entry.transitions || 0) > 0;

  const hasTimestamps = entry.counter_timestamps && 
    Object.values(entry.counter_timestamps).some(arr => Array.isArray(arr) && arr.length > 0);

  return hasCounters || !!hasTimestamps;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting auto-finalize-entries cron job...');

    const results = {
      processed: 0,
      finalized: [] as string[],
      skipped: 0,
      errors: [] as string[],
    };

    // Fetch all unfinalized entries from the last 7 days
    // (covers all timezones and catches any stragglers)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];

    const { data: unfinalizedEntries, error: entriesError } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('is_finalized', false)
      .gte('entry_date', cutoffDate);

    if (entriesError) {
      console.error('Error fetching unfinalized entries:', entriesError);
      throw new Error(`Failed to fetch entries: ${entriesError.message}`);
    }

    console.log(`Found ${unfinalizedEntries?.length || 0} unfinalized entries`);

    if (!unfinalizedEntries || unfinalizedEntries.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No unfinalized entries to process',
        ...results 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user timezones from reps table
    const userIds = [...new Set(unfinalizedEntries.map(e => e.user_id))];
    const { data: reps, error: repsError } = await supabase
      .from('reps')
      .select('user_id, timezone')
      .in('user_id', userIds);

    if (repsError) {
      console.error('Error fetching rep timezones:', repsError);
    }

    const userTimezones: Record<string, string> = {};
    reps?.forEach(rep => {
      if (rep.user_id && rep.timezone) {
        userTimezones[rep.user_id] = rep.timezone;
      }
    });

    // Process each unfinalized entry
    for (const entry of unfinalizedEntries) {
      results.processed++;

      try {
        // Determine user's timezone (priority: rep timezone > entry timezone > default)
        const timezone = userTimezones[entry.user_id] || 
          entry.timezone || 
          'America/Denver';

        // Check if this entry is stale (entry_date < today in user's timezone)
        if (!isEntryStale(entry.entry_date, timezone)) {
          console.log(`Entry ${entry.id} for ${entry.entry_date} is not stale yet in ${timezone}, skipping`);
          results.skipped++;
          continue;
        }

        // Check if entry has any activity worth saving
        if (!hasActivity(entry)) {
          console.log(`Entry ${entry.id} has no activity, skipping`);
          results.skipped++;
          continue;
        }

        // Get timestamp bounds from counter_timestamps
        const { earliest, latest } = getTimestampBounds(entry.counter_timestamps);

        // Calculate work times
        let finalStartTime = entry.work_start_time;
        let finalEndTime = entry.work_end_time;

        // If we have counter_timestamps, use them to determine times
        if (earliest && !finalStartTime) {
          finalStartTime = formatWorkTime(earliest);
          console.log(`Entry ${entry.id}: Setting start time from earliest timestamp: ${finalStartTime}`);
        }

        if (latest) {
          // Always use latest timestamp as end time (fixes the main issue)
          finalEndTime = formatWorkTime(latest);
          console.log(`Entry ${entry.id}: Setting end time from latest timestamp: ${finalEndTime}`);
        }

        // Validate: ensure end time is after start time
        if (finalStartTime && finalEndTime) {
          const startDate = new Date(finalStartTime);
          const endDate = new Date(finalEndTime);

          if (endDate <= startDate) {
            // End time is before or equal to start time - fix it
            console.log(`Entry ${entry.id}: End time (${finalEndTime}) <= start time (${finalStartTime}), fixing...`);
            
            // Use start + 8 hours as fallback
            const fixedEnd = new Date(startDate.getTime() + 8 * 60 * 60 * 1000);
            finalEndTime = formatWorkTime(fixedEnd);
            console.log(`Entry ${entry.id}: Fixed end time to: ${finalEndTime}`);
          }
        } else if (finalStartTime && !finalEndTime) {
          // We have start but no end - use start + 8 hours
          const startDate = new Date(finalStartTime);
          const fallbackEnd = new Date(startDate.getTime() + 8 * 60 * 60 * 1000);
          finalEndTime = formatWorkTime(fallbackEnd);
          console.log(`Entry ${entry.id}: No end time, using start + 8 hours: ${finalEndTime}`);
        }

        // Update the entry
        const updatePayload: Record<string, any> = {
          is_finalized: true,
          updated_at: new Date().toISOString(),
        };

        if (finalStartTime && finalStartTime !== entry.work_start_time) {
          updatePayload.work_start_time = finalStartTime;
        }

        if (finalEndTime && finalEndTime !== entry.work_end_time) {
          updatePayload.work_end_time = finalEndTime;
        }

        const { error: updateError } = await supabase
          .from('daily_entries')
          .update(updatePayload)
          .eq('id', entry.id);

        if (updateError) {
          console.error(`Error updating entry ${entry.id}:`, updateError);
          results.errors.push(`Entry ${entry.id}: ${updateError.message}`);
        } else {
          console.log(`Successfully finalized entry ${entry.id} for user ${entry.user_id} on ${entry.entry_date}`);
          results.finalized.push(`${entry.user_id}:${entry.entry_date}`);
        }
      } catch (err: any) {
        console.error(`Error processing entry ${entry.id}:`, err);
        results.errors.push(`Entry ${entry.id}: ${err.message}`);
      }
    }

    console.log('Auto-finalize results:', results);

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${results.processed} entries, finalized ${results.finalized.length}, skipped ${results.skipped}`,
      ...results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in auto-finalize-entries:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
