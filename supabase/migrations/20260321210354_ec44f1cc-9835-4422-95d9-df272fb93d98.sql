
-- Idempotency log for counter events (prevents double-apply on retries)
CREATE TABLE public.counter_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE NOT NULL,
  user_id uuid NOT NULL,
  entry_date date NOT NULL,
  field text NOT NULL,
  delta integer NOT NULL,
  applied_at timestamptz DEFAULT now()
);

-- Index for cleanup queries
CREATE INDEX idx_counter_event_log_applied_at ON public.counter_event_log (applied_at);
CREATE INDEX idx_counter_event_log_user_date ON public.counter_event_log (user_id, entry_date);

-- RLS
ALTER TABLE public.counter_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own events"
  ON public.counter_event_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own events"
  ON public.counter_event_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Atomic counter event RPC with idempotency
CREATE OR REPLACE FUNCTION public.apply_counter_event(
  p_user_id uuid,
  p_entry_date date,
  p_field text,
  p_delta integer,
  p_idempotency_key text,
  p_timestamp_value text DEFAULT NULL,
  p_work_start_time timestamptz DEFAULT NULL,
  p_timezone text DEFAULT NULL,
  p_break_periods jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_applied boolean;
  v_result jsonb;
  v_current_val integer;
  v_new_val integer;
  v_timestamps jsonb;
  v_field_ts jsonb;
BEGIN
  -- Validate field name (whitelist to prevent injection)
  IF p_field NOT IN ('doors_knocked', 'decision_makers', 'pitches', 'transitions', 'presentations', 'closes')
     AND p_field NOT LIKE 'custom_%' THEN
    RAISE EXCEPTION 'Invalid counter field: %', p_field;
  END IF;

  -- Check idempotency
  SELECT EXISTS(
    SELECT 1 FROM counter_event_log WHERE idempotency_key = p_idempotency_key
  ) INTO v_already_applied;

  IF v_already_applied THEN
    SELECT to_jsonb(de.*) INTO v_result FROM daily_entries de
    WHERE user_id = p_user_id AND entry_date = p_entry_date;
    RETURN COALESCE(v_result, jsonb_build_object('already_applied', true));
  END IF;

  -- Ensure entry exists
  INSERT INTO daily_entries (user_id, entry_date)
  VALUES (p_user_id, p_entry_date)
  ON CONFLICT (user_id, entry_date) DO NOTHING;

  -- Block writes to finalized entries
  IF EXISTS (SELECT 1 FROM daily_entries WHERE user_id = p_user_id AND entry_date = p_entry_date AND is_finalized = true) THEN
    RAISE EXCEPTION 'Entry is finalized';
  END IF;

  -- Get current value and compute new value
  IF p_field LIKE 'custom_%' THEN
    SELECT COALESCE((custom_counters->>substring(p_field from 8))::integer, 0)
    INTO v_current_val
    FROM daily_entries WHERE user_id = p_user_id AND entry_date = p_entry_date;
  ELSE
    EXECUTE format('SELECT COALESCE(%I, 0) FROM daily_entries WHERE user_id = $1 AND entry_date = $2', p_field)
    INTO v_current_val USING p_user_id, p_entry_date;
  END IF;

  v_new_val := GREATEST(0, v_current_val + p_delta);

  -- Update counter
  IF p_field LIKE 'custom_%' THEN
    UPDATE daily_entries
    SET custom_counters = jsonb_set(
      COALESCE(custom_counters, '{}'::jsonb),
      ARRAY[substring(p_field from 8)],
      to_jsonb(v_new_val)
    ), updated_at = now()
    WHERE user_id = p_user_id AND entry_date = p_entry_date;
  ELSE
    EXECUTE format('UPDATE daily_entries SET %I = $1, updated_at = now() WHERE user_id = $2 AND entry_date = $3', p_field)
    USING v_new_val, p_user_id, p_entry_date;
  END IF;

  -- Handle timestamps
  SELECT COALESCE(counter_timestamps, '{}'::jsonb) INTO v_timestamps
  FROM daily_entries WHERE user_id = p_user_id AND entry_date = p_entry_date;

  v_field_ts := COALESCE(v_timestamps->p_field, '[]'::jsonb);

  IF p_delta > 0 AND p_timestamp_value IS NOT NULL THEN
    -- Add timestamp
    v_field_ts := v_field_ts || to_jsonb(p_timestamp_value);
    v_timestamps := jsonb_set(v_timestamps, ARRAY[p_field], v_field_ts);
    UPDATE daily_entries SET counter_timestamps = v_timestamps, updated_at = now()
    WHERE user_id = p_user_id AND entry_date = p_entry_date;
  ELSIF p_delta < 0 AND jsonb_array_length(v_field_ts) > 0 THEN
    -- Remove last timestamp
    v_field_ts := COALESCE(
      (SELECT jsonb_agg(elem) FROM (
        SELECT elem FROM jsonb_array_elements(v_field_ts) WITH ORDINALITY AS t(elem, ord)
        WHERE ord < jsonb_array_length(COALESCE(v_timestamps->p_field, '[]'::jsonb))
      ) sub),
      '[]'::jsonb
    );
    v_timestamps := jsonb_set(v_timestamps, ARRAY[p_field], v_field_ts);
    UPDATE daily_entries SET counter_timestamps = v_timestamps, updated_at = now()
    WHERE user_id = p_user_id AND entry_date = p_entry_date;
  END IF;

  -- Optionally set work_start_time (auto-start on first tap)
  IF p_work_start_time IS NOT NULL THEN
    UPDATE daily_entries
    SET work_start_time = LEAST(COALESCE(work_start_time, p_work_start_time), p_work_start_time),
        timezone = COALESCE(p_timezone, timezone),
        updated_at = now()
    WHERE user_id = p_user_id AND entry_date = p_entry_date;
  END IF;

  -- Optionally update break_periods (auto-end break on tap)
  IF p_break_periods IS NOT NULL THEN
    UPDATE daily_entries
    SET break_periods = p_break_periods, updated_at = now()
    WHERE user_id = p_user_id AND entry_date = p_entry_date;
  END IF;

  -- Record idempotency
  INSERT INTO counter_event_log (idempotency_key, user_id, entry_date, field, delta)
  VALUES (p_idempotency_key, p_user_id, p_entry_date, p_field, p_delta);

  -- Return updated entry
  SELECT to_jsonb(de.*) INTO v_result FROM daily_entries de
  WHERE user_id = p_user_id AND entry_date = p_entry_date;

  RETURN v_result;
END;
$$;

-- Cleanup function: remove events older than 48 hours
CREATE OR REPLACE FUNCTION public.cleanup_old_counter_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM counter_event_log WHERE applied_at < now() - interval '48 hours';
$$;
