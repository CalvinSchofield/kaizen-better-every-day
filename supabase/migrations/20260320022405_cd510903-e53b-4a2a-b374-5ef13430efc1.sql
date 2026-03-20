
CREATE OR REPLACE FUNCTION public.upsert_daily_entry_safe(p_user_id uuid, p_entry_date date, p_doors_knocked integer DEFAULT NULL::integer, p_decision_makers integer DEFAULT NULL::integer, p_pitches integer DEFAULT NULL::integer, p_transitions integer DEFAULT NULL::integer, p_presentations integer DEFAULT NULL::integer, p_closes integer DEFAULT NULL::integer, p_fp_plus numeric DEFAULT NULL::numeric, p_prmr numeric DEFAULT NULL::numeric, p_upgrade_prmr numeric DEFAULT NULL::numeric, p_work_start_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_work_end_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_break_periods jsonb DEFAULT NULL::jsonb, p_counter_timestamps jsonb DEFAULT NULL::jsonb, p_custom_counters jsonb DEFAULT NULL::jsonb, p_timezone text DEFAULT NULL::text, p_sales_log jsonb DEFAULT NULL::jsonb, p_is_finalized boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing RECORD;
  v_result JSONB;
  v_merged_sales JSONB;
  v_existing_sale_ids TEXT[];
  v_incoming_sale_ids TEXT[];
  v_new_sale JSONB;
  v_sale JSONB;
  v_merged_timestamps JSONB;
  v_field TEXT;
  v_existing_ts JSONB;
  v_new_ts JSONB;
  v_final_closes INTEGER;
  v_sales_count INTEGER;
  v_computed_fp_plus NUMERIC;
  v_computed_prmr NUMERIC;
  v_computed_upgrade_prmr NUMERIC;
  v_fp_count INTEGER;
  v_fp_prmr_total NUMERIC;
  v_upgrade_prmr_total NUMERIC;
  v_has_sales BOOLEAN;
BEGIN
  SELECT * INTO v_existing
  FROM daily_entries
  WHERE user_id = p_user_id AND entry_date = p_entry_date;

  -- Build array of incoming sale IDs for lookup
  IF p_sales_log IS NOT NULL AND jsonb_array_length(COALESCE(p_sales_log, '[]'::jsonb)) > 0 THEN
    SELECT array_agg(s->>'id') INTO v_incoming_sale_ids
    FROM jsonb_array_elements(p_sales_log) AS s;
  ELSE
    v_incoming_sale_ids := ARRAY[]::TEXT[];
  END IF;

  IF v_existing.is_finalized = true AND p_is_finalized IS DISTINCT FROM false THEN
    IF p_sales_log IS NOT NULL AND jsonb_array_length(COALESCE(p_sales_log, '[]'::jsonb)) > 0 THEN
      SELECT array_agg(sale->>'id') INTO v_existing_sale_ids
      FROM jsonb_array_elements(COALESCE(v_existing.sales_log, '[]'::jsonb)) AS sale;
      
      v_merged_sales := '[]'::jsonb;
      
      FOR v_sale IN SELECT * FROM jsonb_array_elements(COALESCE(v_existing.sales_log, '[]'::jsonb))
      LOOP
        IF NOT (v_sale->>'id' = ANY(COALESCE(v_incoming_sale_ids, ARRAY[]::TEXT[]))) THEN
          v_merged_sales := v_merged_sales || jsonb_build_array(v_sale);
        END IF;
      END LOOP;
      
      v_merged_sales := v_merged_sales || p_sales_log;
      
      SELECT COUNT(*) INTO v_sales_count
      FROM jsonb_array_elements(v_merged_sales) s
      WHERE s->>'install_status' IS DISTINCT FROM 'never_installed'
        AND s->>'install_status' IS DISTINCT FROM 'cancelled';
      
      v_final_closes := GREATEST(COALESCE(v_existing.closes, 0), v_sales_count);
      
      SELECT 
        COALESCE(COUNT(*) FILTER (WHERE s->>'type' = 'fp' AND s->>'install_status' IS DISTINCT FROM 'cancelled' AND s->>'install_status' IS DISTINCT FROM 'never_installed'), 0),
        COALESCE(SUM((s->>'prmr')::numeric) FILTER (WHERE s->>'type' = 'fp' AND s->>'install_status' IS DISTINCT FROM 'cancelled' AND s->>'install_status' IS DISTINCT FROM 'never_installed'), 0),
        COALESCE(SUM((s->>'prmr')::numeric) FILTER (WHERE s->>'type' = 'upgrade' AND s->>'install_status' IS DISTINCT FROM 'cancelled' AND s->>'install_status' IS DISTINCT FROM 'never_installed'), 0)
      INTO v_fp_count, v_fp_prmr_total, v_upgrade_prmr_total
      FROM jsonb_array_elements(v_merged_sales) s;
      
      v_computed_fp_plus := v_fp_count + (v_upgrade_prmr_total / 85.0);
      v_computed_prmr := v_fp_prmr_total + v_upgrade_prmr_total;
      v_computed_upgrade_prmr := v_upgrade_prmr_total;
      
      UPDATE daily_entries
      SET 
        sales_log = v_merged_sales,
        closes = v_final_closes,
        fp_plus = ROUND(v_computed_fp_plus, 2),
        prmr = ROUND(v_computed_prmr, 2),
        upgrade_prmr = ROUND(v_computed_upgrade_prmr, 2),
        updated_at = now()
      WHERE user_id = p_user_id AND entry_date = p_entry_date
      RETURNING to_jsonb(daily_entries.*) INTO v_result;
      
      RETURN v_result;
    ELSE
      RETURN to_jsonb(v_existing);
    END IF;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    SELECT array_agg(sale->>'id') INTO v_existing_sale_ids
    FROM jsonb_array_elements(COALESCE(v_existing.sales_log, '[]'::jsonb)) AS sale;
    
    IF p_is_finalized = true AND p_sales_log IS NOT NULL THEN
      v_merged_sales := '[]'::jsonb;
      
      FOR v_sale IN SELECT * FROM jsonb_array_elements(COALESCE(v_existing.sales_log, '[]'::jsonb))
      LOOP
        IF NOT (v_sale->>'id' = ANY(COALESCE(v_incoming_sale_ids, ARRAY[]::TEXT[]))) THEN
          v_merged_sales := v_merged_sales || jsonb_build_array(v_sale);
        END IF;
      END LOOP;
      
      v_merged_sales := v_merged_sales || p_sales_log;
    ELSE
      v_merged_sales := COALESCE(v_existing.sales_log, '[]'::jsonb);
      
      IF p_sales_log IS NOT NULL THEN
        FOR v_sale IN SELECT * FROM jsonb_array_elements(p_sales_log)
        LOOP
          IF NOT (v_sale->>'id' = ANY(COALESCE(v_existing_sale_ids, ARRAY[]::TEXT[]))) THEN
            v_merged_sales := v_merged_sales || jsonb_build_array(v_sale);
          END IF;
        END LOOP;
      END IF;
    END IF;
  ELSE
    v_merged_sales := COALESCE(p_sales_log, '[]'::jsonb);
  END IF;

  SELECT COUNT(*) INTO v_sales_count
  FROM jsonb_array_elements(v_merged_sales) s
  WHERE s->>'install_status' IS DISTINCT FROM 'never_installed'
    AND s->>'install_status' IS DISTINCT FROM 'cancelled';

  v_has_sales := jsonb_array_length(v_merged_sales) > 0;
  
  IF v_has_sales THEN
    SELECT 
      COALESCE(COUNT(*) FILTER (WHERE s->>'type' = 'fp' AND s->>'install_status' IS DISTINCT FROM 'cancelled' AND s->>'install_status' IS DISTINCT FROM 'never_installed'), 0),
      COALESCE(SUM((s->>'prmr')::numeric) FILTER (WHERE s->>'type' = 'fp' AND s->>'install_status' IS DISTINCT FROM 'cancelled' AND s->>'install_status' IS DISTINCT FROM 'never_installed'), 0),
      COALESCE(SUM((s->>'prmr')::numeric) FILTER (WHERE s->>'type' = 'upgrade' AND s->>'install_status' IS DISTINCT FROM 'cancelled' AND s->>'install_status' IS DISTINCT FROM 'never_installed'), 0)
    INTO v_fp_count, v_fp_prmr_total, v_upgrade_prmr_total
    FROM jsonb_array_elements(v_merged_sales) s;
    
    v_computed_fp_plus := v_fp_count + (v_upgrade_prmr_total / 85.0);
    v_computed_prmr := v_fp_prmr_total + v_upgrade_prmr_total;
    v_computed_upgrade_prmr := v_upgrade_prmr_total;
  ELSE
    v_computed_fp_plus := COALESCE(p_fp_plus, 0);
    v_computed_prmr := COALESCE(p_prmr, 0);
    v_computed_upgrade_prmr := COALESCE(p_upgrade_prmr, 0);
  END IF;

  IF v_existing.id IS NOT NULL AND p_counter_timestamps IS NOT NULL THEN
    v_merged_timestamps := COALESCE(v_existing.counter_timestamps, '{}'::jsonb);
    
    FOR v_field IN SELECT * FROM jsonb_object_keys(p_counter_timestamps)
    LOOP
      v_existing_ts := COALESCE(v_merged_timestamps->v_field, '[]'::jsonb);
      v_new_ts := COALESCE(p_counter_timestamps->v_field, '[]'::jsonb);
      
      v_merged_timestamps := jsonb_set(
        v_merged_timestamps,
        ARRAY[v_field],
        (SELECT jsonb_agg(DISTINCT t ORDER BY t) 
         FROM (
           SELECT jsonb_array_elements_text(v_existing_ts) AS t
           UNION
           SELECT jsonb_array_elements_text(v_new_ts) AS t
         ) combined)
      );
    END LOOP;
  ELSE
    v_merged_timestamps := COALESCE(p_counter_timestamps, v_existing.counter_timestamps, '{}'::jsonb);
  END IF;

  v_final_closes := GREATEST(
    COALESCE(p_closes, 0),
    COALESCE(v_existing.closes, 0),
    v_sales_count
  );

  INSERT INTO daily_entries (
    user_id, entry_date, doors_knocked, decision_makers, pitches, transitions,
    presentations, closes, fp_plus, prmr, upgrade_prmr, work_start_time, work_end_time,
    break_periods, counter_timestamps, custom_counters, timezone, sales_log, is_finalized
  ) VALUES (
    p_user_id, p_entry_date,
    COALESCE(p_doors_knocked, 0),
    COALESCE(p_decision_makers, 0),
    COALESCE(p_pitches, 0),
    COALESCE(p_transitions, 0),
    COALESCE(p_presentations, 0),
    v_final_closes,
    ROUND(v_computed_fp_plus, 2),
    ROUND(v_computed_prmr, 2),
    ROUND(v_computed_upgrade_prmr, 2),
    p_work_start_time,
    p_work_end_time,
    COALESCE(p_break_periods, '[]'::jsonb),
    COALESCE(p_counter_timestamps, '{}'::jsonb),
    COALESCE(p_custom_counters, '{}'::jsonb),
    p_timezone,
    v_merged_sales,
    COALESCE(p_is_finalized, false)
  )
  ON CONFLICT (user_id, entry_date) DO UPDATE SET
    doors_knocked = GREATEST(COALESCE(p_doors_knocked, daily_entries.doors_knocked), daily_entries.doors_knocked),
    decision_makers = GREATEST(COALESCE(p_decision_makers, daily_entries.decision_makers), daily_entries.decision_makers),
    pitches = GREATEST(COALESCE(p_pitches, daily_entries.pitches), daily_entries.pitches),
    transitions = GREATEST(COALESCE(p_transitions, daily_entries.transitions), daily_entries.transitions),
    presentations = GREATEST(COALESCE(p_presentations, daily_entries.presentations), daily_entries.presentations),
    closes = GREATEST(COALESCE(p_closes, daily_entries.closes), daily_entries.closes, v_sales_count),
    fp_plus = CASE WHEN v_has_sales THEN ROUND(v_computed_fp_plus, 2) ELSE COALESCE(p_fp_plus, daily_entries.fp_plus) END,
    prmr = CASE WHEN v_has_sales THEN ROUND(v_computed_prmr, 2) ELSE COALESCE(p_prmr, daily_entries.prmr) END,
    upgrade_prmr = CASE WHEN v_has_sales THEN ROUND(v_computed_upgrade_prmr, 2) ELSE COALESCE(p_upgrade_prmr, daily_entries.upgrade_prmr) END,
    work_start_time = LEAST(COALESCE(p_work_start_time, daily_entries.work_start_time), daily_entries.work_start_time),
    work_end_time = COALESCE(p_work_end_time, daily_entries.work_end_time),
    break_periods = COALESCE(p_break_periods, daily_entries.break_periods),
    counter_timestamps = v_merged_timestamps,
    custom_counters = COALESCE(p_custom_counters, daily_entries.custom_counters),
    timezone = COALESCE(p_timezone, daily_entries.timezone),
    sales_log = v_merged_sales,
    is_finalized = COALESCE(p_is_finalized, daily_entries.is_finalized),
    updated_at = now()
  RETURNING to_jsonb(daily_entries.*) INTO v_result;

  RETURN v_result;
END;
$function$;
