import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get timezone offset in minutes (negative = west of UTC = later local time)
const getTimezoneOffset = (timezone: string): number => {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return (tzDate.getTime() - utcDate.getTime()) / 60000;
  } catch {
    return 0;
  }
};

// Find the westernmost (latest) timezone - these are the last to reach end of day
const getLatestTimezone = (timezones: (string | null | undefined)[]): string => {
  const validTimezones = timezones.filter(Boolean) as string[];
  if (validTimezones.length === 0) return 'America/Los_Angeles'; // Default to Pacific
  
  return validTimezones.reduce((latest, tz) => {
    return getTimezoneOffset(tz) < getTimezoneOffset(latest) ? tz : latest;
  });
};

// Check if end_date has passed in a given timezone
const hasEndDatePassed = (endDate: string, timezone: string): boolean => {
  const [year, month, day] = endDate.split('-').map(Number);
  
  // Get current time in the timezone
  const now = new Date();
  const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  
  // End of day in that timezone
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
  
  return nowInTz > endOfDay;
};

// Check if today is the end date in a timezone
const isEndDate = (endDate: string, timezone: string): boolean => {
  const now = new Date();
  const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const todayStr = `${nowInTz.getFullYear()}-${String(nowInTz.getMonth() + 1).padStart(2, '0')}-${String(nowInTz.getDate()).padStart(2, '0')}`;
  return todayStr === endDate;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      incentivesCompleted: [] as string[],
      challengesCompleted: [] as string[],
      errors: [] as string[],
    };

    // ==================== PROCESS INCENTIVES ====================
    const { data: activeIncentives, error: incentivesError } = await supabase
      .from('incentives')
      .select(`
        id, title, metric, target_type, target_value, start_date, end_date,
        incentive_eligible_reps (user_id)
      `)
      .eq('status', 'active');

    if (incentivesError) {
      console.error('Error fetching incentives:', incentivesError);
      results.errors.push(`Incentives fetch error: ${incentivesError.message}`);
    }

    for (const incentive of activeIncentives || []) {
      try {
        const userIds = incentive.incentive_eligible_reps?.map((r: any) => r.user_id) || [];
        if (userIds.length === 0) continue;

        // Get participant timezones
        const { data: reps } = await supabase
          .from('reps')
          .select('user_id, timezone')
          .in('user_id', userIds);

        const timezones = reps?.map(r => r.timezone) || [];
        const latestTz = getLatestTimezone(timezones);

        let shouldComplete = false;
        let completionReason = '';

        // Check 1: Has end_date passed in the latest timezone?
        if (hasEndDatePassed(incentive.end_date, latestTz)) {
          shouldComplete = true;
          completionReason = 'end_date_passed';
        }

        // Check 2: Is it the last day AND all participants have finalized?
        if (!shouldComplete && isEndDate(incentive.end_date, latestTz)) {
          const { data: entries } = await supabase
            .from('daily_entries')
            .select('user_id, is_finalized')
            .in('user_id', userIds)
            .eq('entry_date', incentive.end_date);

          const finalizedUserIds = new Set(
            entries?.filter(e => e.is_finalized).map(e => e.user_id) || []
          );
          
          const allFinalized = userIds.every((uid: string) => finalizedUserIds.has(uid));
          if (allFinalized) {
            shouldComplete = true;
            completionReason = 'all_finalized';
          }
        }

        if (shouldComplete) {
          // Calculate final values and determine winner
          const { data: entries } = await supabase
            .from('daily_entries')
            .select('user_id, fp_plus, prmr, transitions, doors_knocked, sales_log')
            .in('user_id', userIds)
            .gte('entry_date', incentive.start_date)
            .lte('entry_date', incentive.end_date);

          const metricColumn = incentive.metric === 'fp_plus' ? 'fp_plus' 
            : incentive.metric === 'prmr' ? 'prmr'
            : incentive.metric === 'transitions' ? 'transitions'
            : 'doors_knocked';

          // Aggregate per user
          const userTotals: Record<string, number> = {};
          userIds.forEach((uid: string) => { userTotals[uid] = 0; });

          entries?.forEach((entry: any) => {
            let value = 0;
            if (incentive.metric === 'prmr') {
              const prmrFromColumn = entry.prmr || 0;
              const salesLog = entry.sales_log as any[] | null;
              const prmrFromSalesLog = salesLog?.reduce((sum, sale) => sum + (sale.prmr || 0), 0) || 0;
              value = prmrFromColumn > 0 ? prmrFromColumn : prmrFromSalesLog;
            } else {
              value = entry[metricColumn] || 0;
            }
            userTotals[entry.user_id] = (userTotals[entry.user_id] || 0) + value;
          });

          let winnerId: string | null = null;
          let winnerIds: string[] = []; // For 'anyone_who' type
          const groupTotal = Object.values(userTotals).reduce((sum, v) => sum + v, 0);

          if (incentive.target_type === 'group_total') {
            // Group goal met = everyone wins (no single winner)
            if (groupTotal >= (incentive.target_value || 0)) {
              winnerId = 'group_success';
            }
          } else if (incentive.target_type === 'anyone_who') {
            // Anyone who reaches target qualifies
            for (const [uid, total] of Object.entries(userTotals)) {
              if (total >= (incentive.target_value || 0)) {
                winnerIds.push(uid);
              }
            }
            // Set winnerId to indicate at least one person qualified
            if (winnerIds.length > 0) {
              winnerId = 'anyone_who_success';
            }
          } else if (incentive.target_type === 'first_to') {
            // First to reach target wins
            for (const [uid, total] of Object.entries(userTotals)) {
              if (total >= (incentive.target_value || 0)) {
                winnerId = uid;
                break;
              }
            }
          } else if (incentive.target_type === 'most_by_end') {
            // Most by end wins
            let maxValue = 0;
            for (const [uid, total] of Object.entries(userTotals)) {
              if (total > maxValue) {
                maxValue = total;
                winnerId = uid;
              }
            }
          }

          // Update incentive
          const updateData: any = {
            status: 'completed',
            completed_at: new Date().toISOString(),
            winner_user_id: (winnerId === 'group_success' || winnerId === 'anyone_who_success') ? null : winnerId,
          };

          // For 'anyone_who' type, also store the array of winners
          if (incentive.target_type === 'anyone_who') {
            updateData.winner_user_ids = winnerIds;
          }

          const { error: updateError } = await supabase
            .from('incentives')
            .update(updateData)
            .eq('id', incentive.id);

          if (updateError) {
            results.errors.push(`Incentive ${incentive.id} update error: ${updateError.message}`);
          } else {
            const winnerInfo = incentive.target_type === 'anyone_who' 
              ? `${winnerIds.length} qualified` 
              : winnerId ? 'winner found' : 'no winner';
            results.incentivesCompleted.push(`${incentive.title} (${completionReason}, ${winnerInfo})`);
            console.log(`Completed incentive: ${incentive.title} - ${completionReason} - ${winnerInfo}`);
          }
        }
      } catch (err: any) {
        results.errors.push(`Incentive ${incentive.id} processing error: ${err.message}`);
      }
    }

    // ==================== PROCESS CHALLENGES ====================
    const { data: activeChallenges, error: challengesError } = await supabase
      .from('challenges')
      .select(`
        id, metric, stakes, start_date, end_date, creator_timezone,
        challenge_participants (user_id, role, accepted)
      `)
      .eq('status', 'active');

    if (challengesError) {
      console.error('Error fetching challenges:', challengesError);
      results.errors.push(`Challenges fetch error: ${challengesError.message}`);
    }

    for (const challenge of activeChallenges || []) {
      try {
        const acceptedParticipants = challenge.challenge_participants?.filter(
          (p: any) => p.accepted === true
        ) || [];
        const userIds = acceptedParticipants.map((p: any) => p.user_id);
        if (userIds.length < 2) continue;

        // Get participant timezones
        const { data: reps } = await supabase
          .from('reps')
          .select('user_id, timezone')
          .in('user_id', userIds);

        const timezones = reps?.map(r => r.timezone) || [];
        const latestTz = getLatestTimezone(timezones);

        let shouldComplete = false;
        let completionReason = '';

        // Check 1: Has end_date passed in the latest timezone?
        if (hasEndDatePassed(challenge.end_date, latestTz)) {
          shouldComplete = true;
          completionReason = 'end_date_passed';
        }

        // Check 2: Is it the last day AND all participants have finalized?
        if (!shouldComplete && isEndDate(challenge.end_date, latestTz)) {
          const { data: entries } = await supabase
            .from('daily_entries')
            .select('user_id, is_finalized')
            .in('user_id', userIds)
            .eq('entry_date', challenge.end_date);

          const finalizedUserIds = new Set(
            entries?.filter(e => e.is_finalized).map(e => e.user_id) || []
          );
          
          const allFinalized = userIds.every((uid: string) => finalizedUserIds.has(uid));
          if (allFinalized) {
            shouldComplete = true;
            completionReason = 'all_finalized';
          }
        }

        if (shouldComplete) {
          // Calculate final values
          const { data: entries } = await supabase
            .from('daily_entries')
            .select('user_id, fp_plus, prmr, transitions, doors_knocked, sales_log')
            .in('user_id', userIds)
            .gte('entry_date', challenge.start_date)
            .lte('entry_date', challenge.end_date);

          const metricColumn = challenge.metric === 'fp_plus' ? 'fp_plus' 
            : challenge.metric === 'prmr' ? 'prmr'
            : challenge.metric === 'transitions' ? 'transitions'
            : 'doors_knocked';

          // Aggregate per user
          const userTotals: Record<string, number> = {};
          userIds.forEach((uid: string) => { userTotals[uid] = 0; });

          entries?.forEach((entry: any) => {
            let value = 0;
            if (challenge.metric === 'prmr') {
              const prmrFromColumn = entry.prmr || 0;
              const salesLog = entry.sales_log as any[] | null;
              const prmrFromSalesLog = salesLog?.reduce((sum, sale) => sum + (sale.prmr || 0), 0) || 0;
              value = prmrFromColumn > 0 ? prmrFromColumn : prmrFromSalesLog;
            } else {
              value = entry[metricColumn] || 0;
            }
            userTotals[entry.user_id] = (userTotals[entry.user_id] || 0) + value;
          });

          // Determine winner
          let winnerId: string | null = null;
          let isTie = false;
          let maxValue = -1;

          for (const [uid, total] of Object.entries(userTotals)) {
            if (total > maxValue) {
              maxValue = total;
              winnerId = uid;
              isTie = false;
            } else if (total === maxValue) {
              isTie = true;
            }
          }

          // Update challenge and participant final_values
          const { error: updateError } = await supabase
            .from('challenges')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              winner_user_id: isTie ? null : winnerId,
              is_tie: isTie,
            })
            .eq('id', challenge.id);

          if (updateError) {
            results.errors.push(`Challenge ${challenge.id} update error: ${updateError.message}`);
          } else {
            // Update final_value for each participant
            for (const [uid, total] of Object.entries(userTotals)) {
              await supabase
                .from('challenge_participants')
                .update({ final_value: total })
                .eq('challenge_id', challenge.id)
                .eq('user_id', uid);
            }

            results.challengesCompleted.push(`Challenge ${challenge.id} (${completionReason})`);
            console.log(`Completed challenge: ${challenge.id} - ${completionReason}`);
          }
        }
      } catch (err: any) {
        results.errors.push(`Challenge ${challenge.id} processing error: ${err.message}`);
      }
    }

    console.log('Auto-complete results:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in auto-complete-competitions:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});