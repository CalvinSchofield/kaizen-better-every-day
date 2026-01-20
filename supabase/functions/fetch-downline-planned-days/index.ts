import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PlannedDayRow = {
  user_id: string;
  planned_date: string;
};

const isIsoDate = (v: unknown): v is string => {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
};

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate caller
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({} as any));
    const requestedUserIds: string[] | undefined = Array.isArray(body?.userIds)
      ? body.userIds.filter((v: unknown) => typeof v === 'string')
      : undefined;

    const startDate: string | null = isIsoDate(body?.startDate) ? body.startDate : null;
    const endDate: string | null = isIsoDate(body?.endDate) ? body.endDate : null;

    // Server-validated access: reuse fetch-team-access as the canonical downline scope.
    const teamAccessResp = await fetch(`${supabaseUrl}/functions/v1/fetch-team-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    if (!teamAccessResp.ok) {
      const text = await teamAccessResp.text().catch(() => '');
      console.error('[fetch-downline-planned-days] fetch-team-access failed', teamAccessResp.status, text);
      return new Response(JSON.stringify({ error: 'Failed to determine access scope' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const teamAccess = await teamAccessResp.json().catch(() => null) as { accessibleUserIds?: string[] } | null;
    const allowed = new Set((teamAccess?.accessibleUserIds || []).filter((v) => typeof v === 'string'));

    // Keep leader self-excluded (fetch-team-access already excludes self, but be explicit)
    allowed.delete(user.id);

    const targetUserIds = (requestedUserIds?.length
      ? requestedUserIds.filter((id) => allowed.has(id))
      : Array.from(allowed)
    ).filter(Boolean);

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ plannedDays: [] as PlannedDayRow[] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: PlannedDayRow[] = [];
    const batches = chunk(targetUserIds, 200);

    for (const batch of batches) {
      let q = supabase
        .from('planned_work_days')
        .select('user_id, planned_date')
        .in('user_id', batch)
        .order('planned_date', { ascending: true });

      if (startDate) q = q.gte('planned_date', startDate);
      if (endDate) q = q.lte('planned_date', endDate);

      const { data, error } = await q;
      if (error) {
        console.error('[fetch-downline-planned-days] query error', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch planned days' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (data?.length) {
        results.push(...(data as PlannedDayRow[]));
      }
    }

    return new Response(JSON.stringify({ plannedDays: results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[fetch-downline-planned-days] unhandled error', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
