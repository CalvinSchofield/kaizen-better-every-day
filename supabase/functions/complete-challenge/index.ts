import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChallengeParticipant {
  id: string;
  user_id: string;
  team: 'a' | 'b' | null;
  role: string;
  final_value: number | null;
}

interface Challenge {
  id: string;
  type: '1v1' | 'group';
  metric: 'fp_plus' | 'prmr' | 'transitions' | 'doors_knocked';
  status: string;
  start_date: string;
  end_date: string;
  created_by: string;
  creator_timezone: string | null;
}

// Helper function to get current date in a specific timezone
function getCurrentDateInTimezone(timezone: string): string {
  try {
    const now = new Date();
    // Format the date as YYYY-MM-DD in the specified timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  } catch (e) {
    // Fallback to UTC if timezone is invalid
    console.log(`[complete-challenge] Invalid timezone "${timezone}", falling back to UTC`);
    return new Date().toISOString().split('T')[0];
  }
}

// Check if a challenge has ended based on its creator's timezone
function isChallengeEnded(challenge: Challenge): boolean {
  const timezone = challenge.creator_timezone || 'America/Los_Angeles'; // Default to Pacific
  const todayInCreatorTz = getCurrentDateInTimezone(timezone);
  
  // Challenge has ended if end_date is before today in the creator's timezone
  return challenge.end_date < todayInCreatorTz;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('[complete-challenge] Checking for ended challenges using creator timezones...');

    // Fetch all active challenges (we'll filter by timezone in code)
    const { data: activeChallenges, error: fetchError } = await supabase
      .from('challenges')
      .select('*')
      .eq('status', 'active');

    if (fetchError) {
      console.error('[complete-challenge] Error fetching challenges:', fetchError);
      throw fetchError;
    }

    // Filter challenges that have ended based on their creator's timezone
    const endedChallenges = (activeChallenges || []).filter((c: Challenge) => {
      const ended = isChallengeEnded(c);
      if (ended) {
        console.log(`[complete-challenge] Challenge ${c.id} ended (end_date: ${c.end_date}, timezone: ${c.creator_timezone || 'default Pacific'})`);
      }
      return ended;
    });

    if (!endedChallenges.length) {
      console.log('[complete-challenge] No challenges to complete');
      return new Response(
        JSON.stringify({ message: 'No challenges to complete', completed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[complete-challenge] Found ${endedChallenges.length} challenges to complete`);

    const results = [];

    for (const challenge of endedChallenges as Challenge[]) {
      try {
        console.log(`[complete-challenge] Processing challenge ${challenge.id}`);

        // Get participants
        const { data: participants, error: partError } = await supabase
          .from('challenge_participants')
          .select('*')
          .eq('challenge_id', challenge.id);

        if (partError) throw partError;
        if (!participants?.length) {
          console.log(`[complete-challenge] No participants for challenge ${challenge.id}`);
          continue;
        }

        const participantUserIds = participants.map((p: ChallengeParticipant) => p.user_id);

        // Fetch daily entries for the challenge period
        const { data: entries, error: entriesError } = await supabase
          .from('daily_entries')
          .select('user_id, fp_plus, prmr, transitions, doors_knocked')
          .in('user_id', participantUserIds)
          .gte('entry_date', challenge.start_date)
          .lte('entry_date', challenge.end_date);

        if (entriesError) throw entriesError;

        // Calculate totals per user for the challenge metric
        const metricColumn = challenge.metric;
        const userTotals = new Map<string, { primary: number; prmr: number }>();

        participantUserIds.forEach(userId => {
          userTotals.set(userId, { primary: 0, prmr: 0 });
        });

        (entries || []).forEach((entry: any) => {
          const current = userTotals.get(entry.user_id) || { primary: 0, prmr: 0 };
          current.primary += entry[metricColumn] || 0;
          current.prmr += entry.prmr || 0;
          userTotals.set(entry.user_id, current);
        });

        // Update final_value for each participant
        for (const participant of participants as ChallengeParticipant[]) {
          const totals = userTotals.get(participant.user_id);
          const { error: updateError } = await supabase
            .from('challenge_participants')
            .update({ final_value: totals?.primary || 0 })
            .eq('id', participant.id);

          if (updateError) {
            console.error(`[complete-challenge] Error updating participant ${participant.id}:`, updateError);
          }
        }

        // Determine winner based on challenge type
        let winnerUserId: string | null = null;
        let isTie = false;
        let tiebreakerWinnerId: string | null = null;

        if (challenge.type === '1v1') {
          // 1v1: Compare two participants
          const sorted = [...participants].sort((a, b) => {
            const aTotal = userTotals.get(a.user_id)?.primary || 0;
            const bTotal = userTotals.get(b.user_id)?.primary || 0;
            return bTotal - aTotal;
          });

          const first = sorted[0];
          const second = sorted[1];
          const firstTotal = userTotals.get(first?.user_id)?.primary || 0;
          const secondTotal = userTotals.get(second?.user_id)?.primary || 0;

          if (firstTotal > secondTotal) {
            winnerUserId = first.user_id;
          } else if (firstTotal === secondTotal) {
            // Tie - check if FP+ metric, use PRMR as tiebreaker
            if (challenge.metric === 'fp_plus') {
              const firstPrmr = userTotals.get(first?.user_id)?.prmr || 0;
              const secondPrmr = userTotals.get(second?.user_id)?.prmr || 0;
              
              if (firstPrmr > secondPrmr) {
                winnerUserId = first.user_id;
                isTie = true;
                tiebreakerWinnerId = first.user_id;
                console.log(`[complete-challenge] FP+ tie broken by PRMR: ${first.user_id} (${firstPrmr}) vs ${second?.user_id} (${secondPrmr})`);
              } else if (secondPrmr > firstPrmr) {
                winnerUserId = second.user_id;
                isTie = true;
                tiebreakerWinnerId = second.user_id;
                console.log(`[complete-challenge] FP+ tie broken by PRMR: ${second.user_id} (${secondPrmr}) vs ${first?.user_id} (${firstPrmr})`);
              } else {
                // Still tied after PRMR - co-winners
                isTie = true;
                winnerUserId = null;
                console.log(`[complete-challenge] Perfect tie - co-winners`);
              }
            } else {
              // Non-FP+ metrics: co-winners on tie
              isTie = true;
              winnerUserId = null;
              console.log(`[complete-challenge] Non-FP+ tie - co-winners`);
            }
          }
        } else {
          // Group: Compare team totals
          const teamATotals = participants
            .filter((p: ChallengeParticipant) => p.team === 'a')
            .reduce((sum: number, p: ChallengeParticipant) => sum + (userTotals.get(p.user_id)?.primary || 0), 0);
          
          const teamBTotals = participants
            .filter((p: ChallengeParticipant) => p.team === 'b')
            .reduce((sum: number, p: ChallengeParticipant) => sum + (userTotals.get(p.user_id)?.primary || 0), 0);

          console.log(`[complete-challenge] Team A: ${teamATotals}, Team B: ${teamBTotals}`);

          if (teamATotals > teamBTotals) {
            // Team A wins - winner is captain_a
            const captainA = participants.find((p: ChallengeParticipant) => p.role === 'captain_a');
            winnerUserId = captainA?.user_id || null;
          } else if (teamBTotals > teamATotals) {
            // Team B wins - winner is captain_b
            const captainB = participants.find((p: ChallengeParticipant) => p.role === 'captain_b');
            winnerUserId = captainB?.user_id || null;
          } else {
            // Tie for group challenges
            if (challenge.metric === 'fp_plus') {
              // Use PRMR as tiebreaker for team totals
              const teamAPrmr = participants
                .filter((p: ChallengeParticipant) => p.team === 'a')
                .reduce((sum: number, p: ChallengeParticipant) => sum + (userTotals.get(p.user_id)?.prmr || 0), 0);
              
              const teamBPrmr = participants
                .filter((p: ChallengeParticipant) => p.team === 'b')
                .reduce((sum: number, p: ChallengeParticipant) => sum + (userTotals.get(p.user_id)?.prmr || 0), 0);

              if (teamAPrmr > teamBPrmr) {
                const captainA = participants.find((p: ChallengeParticipant) => p.role === 'captain_a');
                winnerUserId = captainA?.user_id || null;
                isTie = true;
                tiebreakerWinnerId = captainA?.user_id || null;
              } else if (teamBPrmr > teamAPrmr) {
                const captainB = participants.find((p: ChallengeParticipant) => p.role === 'captain_b');
                winnerUserId = captainB?.user_id || null;
                isTie = true;
                tiebreakerWinnerId = captainB?.user_id || null;
              } else {
                isTie = true;
                winnerUserId = null;
              }
            } else {
              isTie = true;
              winnerUserId = null;
            }
          }
        }

        // Update challenge status
        const { error: updateError } = await supabase
          .from('challenges')
          .update({
            status: 'completed',
            winner_user_id: winnerUserId,
            is_tie: isTie,
            tiebreaker_winner_id: tiebreakerWinnerId,
            completed_at: new Date().toISOString(),
          })
          .eq('id', challenge.id);

        if (updateError) {
          console.error(`[complete-challenge] Error updating challenge ${challenge.id}:`, updateError);
          throw updateError;
        }

        console.log(`[complete-challenge] Completed challenge ${challenge.id}. Winner: ${winnerUserId || 'tie'}`);
        
        results.push({
          challengeId: challenge.id,
          winner: winnerUserId,
          isTie,
          tiebreakerWinner: tiebreakerWinnerId,
        });

      } catch (challengeError) {
        console.error(`[complete-challenge] Error processing challenge ${challenge.id}:`, challengeError);
        results.push({
          challengeId: challenge.id,
          error: String(challengeError),
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${results.length} challenges`,
        completed: results.filter(r => !r.error).length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[complete-challenge] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
