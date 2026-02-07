-- Update upsert_daily_entry_safe to ensure sales_log count never exceeds closes
CREATE OR REPLACE FUNCTION public.upsert_daily_entry_safe(
  p_user_id uuid,
  p_entry_date date,
  p_doors_knocked integer DEFAULT NULL,
  p_decision_makers integer DEFAULT NULL,
  p_pitches integer DEFAULT NULL,
  p_transitions integer DEFAULT NULL,
  p_presentations integer DEFAULT NULL,
  p_closes integer DEFAULT NULL,
  p_fp_plus numeric DEFAULT NULL,
  p_prmr numeric DEFAULT NULL,
  p_upgrade_prmr numeric DEFAULT NULL,
  p_work_start_time timestamp with time zone DEFAULT NULL,
  p_work_end_time timestamp with time zone DEFAULT NULL,
  p_break_periods jsonb DEFAULT NULL,
  p_counter_timestamps jsonb DEFAULT NULL,
  p_custom_counters jsonb DEFAULT NULL,
  p_timezone text DEFAULT NULL,
  p_sales_log jsonb DEFAULT NULL,
  p_is_finalized boolean DEFAULT NULL
)
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
  v_new_sale JSONB;
  v_sale JSONB;
  v_merged_timestamps JSONB;
  v_field TEXT;
  v_existing_ts JSONB;
  v_new_ts JSONB;
  v_final_closes INTEGER;
  v_sales_count INTEGER;
BEGIN
  -- Get existing entry
  SELECT * INTO v_existing
  FROM daily_entries
  WHERE user_id = p_user_id AND entry_date = p_entry_date;

  -- PROTECTION: If entry is finalized, reject counter updates (but allow sales additions)
  IF v_existing.is_finalized = true AND p_is_finalized IS DISTINCT FROM false THEN
    -- Only allow sales_log updates to finalized entries
    IF p_sales_log IS NOT NULL AND jsonb_array_length(COALESCE(p_sales_log, '[]'::jsonb)) > 0 THEN
      -- Merge sales only - get existing sale IDs
      SELECT array_agg(sale->>'id') INTO v_existing_sale_ids
      FROM jsonb_array_elements(COALESCE(v_existing.sales_log, '[]'::jsonb)) AS sale;
      
      v_merged_sales := COALESCE(v_existing.sales_log, '[]'::jsonb);
      
      -- Add only new sales that don't exist yet
      FOR v_sale IN SELECT * FROM jsonb_array_elements(p_sales_log)
      LOOP
        IF NOT (v_sale->>'id' = ANY(COALESCE(v_existing_sale_ids, ARRAY[]::TEXT[]))) THEN
          v_merged_sales := v_merged_sales || jsonb_build_array(v_sale);
        END IF;
      END LOOP;
      
      -- Count valid sales (excluding never_installed)
      SELECT COUNT(*) INTO v_sales_count
      FROM jsonb_array_elements(v_merged_sales) s
      WHERE s->>'install_status' IS DISTINCT FROM 'never_installed';
      
      -- CRITICAL: Ensure closes >= sales count
      v_final_closes := GREATEST(COALESCE(v_existing.closes, 0), v_sales_count);
      
      -- Update only sales_log and recalculate totals
      UPDATE daily_entries
      SET 
        sales_log = v_merged_sales,
        closes = v_final_closes,
        updated_at = now()
      WHERE user_id = p_user_id AND entry_date = p_entry_date
      RETURNING to_jsonb(daily_entries.*) INTO v_result;
      
      RETURN v_result;
    ELSE
      -- No sales to add, return existing without changes
      RETURN to_jsonb(v_existing);
    END IF;
  END IF;

  -- CRITICAL: Merge sales_log instead of overwriting
  -- Get existing sale IDs to prevent duplicates
  IF v_existing.id IS NOT NULL THEN
    SELECT array_agg(sale->>'id') INTO v_existing_sale_ids
    FROM jsonb_array_elements(COALESCE(v_existing.sales_log, '[]'::jsonb)) AS sale;
    
    -- Start with existing sales (NEVER lose them)
    v_merged_sales := COALESCE(v_existing.sales_log, '[]'::jsonb);
    
    -- Add new sales from p_sales_log that don't already exist
    IF p_sales_log IS NOT NULL THEN
      FOR v_sale IN SELECT * FROM jsonb_array_elements(p_sales_log)
      LOOP
        IF NOT (v_sale->>'id' = ANY(COALESCE(v_existing_sale_ids, ARRAY[]::TEXT[]))) THEN
          v_merged_sales := v_merged_sales || jsonb_build_array(v_sale);
        END IF;
      END LOOP;
    END IF;
  ELSE
    -- No existing entry, use provided sales_log
    v_merged_sales := COALESCE(p_sales_log, '[]'::jsonb);
  END IF;

  -- Count valid sales (excluding never_installed)
  SELECT COUNT(*) INTO v_sales_count
  FROM jsonb_array_elements(v_merged_sales) s
  WHERE s->>'install_status' IS DISTINCT FROM 'never_installed';

  -- BULLETPROOF: Merge counter_timestamps (append-only, deduplicate)
  IF v_existing.id IS NOT NULL AND p_counter_timestamps IS NOT NULL THEN
    v_merged_timestamps := COALESCE(v_existing.counter_timestamps, '{}'::jsonb);
    
    FOR v_field IN SELECT * FROM jsonb_object_keys(p_counter_timestamps)
    LOOP
      v_existing_ts := COALESCE(v_merged_timestamps->v_field, '[]'::jsonb);
      v_new_ts := COALESCE(p_counter_timestamps->v_field, '[]'::jsonb);
      
      -- Merge arrays and deduplicate (sort for consistency)
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

  -- Calculate final closes: GREATEST of provided, existing, AND sales count
  -- This ensures closes can never be less than the number of valid sales
  v_final_closes := GREATEST(
    COALESCE(p_closes, 0),
    COALESCE(v_existing.closes, 0),
    v_sales_count
  );

  -- Upsert with GREATEST() for counters - NEVER reduce counter values
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
    COALESCE(p_fp_plus, 0),
    COALESCE(p_prmr, 0),
    COALESCE(p_upgrade_prmr, 0),
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
    -- BULLETPROOF: Use GREATEST() - counter can ONLY go UP, never down from sync
    doors_knocked = GREATEST(COALESCE(p_doors_knocked, daily_entries.doors_knocked), daily_entries.doors_knocked),
    decision_makers = GREATEST(COALESCE(p_decision_makers, daily_entries.decision_makers), daily_entries.decision_makers),
    pitches = GREATEST(COALESCE(p_pitches, daily_entries.pitches), daily_entries.pitches),
    transitions = GREATEST(COALESCE(p_transitions, daily_entries.transitions), daily_entries.transitions),
    presentations = GREATEST(COALESCE(p_presentations, daily_entries.presentations), daily_entries.presentations),
    -- CRITICAL: closes must be >= sales count
    closes = GREATEST(COALESCE(p_closes, daily_entries.closes), daily_entries.closes, v_sales_count),
    -- FP and PRMR can be updated normally (calculated values)
    fp_plus = COALESCE(p_fp_plus, daily_entries.fp_plus),
    prmr = COALESCE(p_prmr, daily_entries.prmr),
    upgrade_prmr = COALESCE(p_upgrade_prmr, daily_entries.upgrade_prmr),
    -- Time fields use earliest start, latest end
    work_start_time = LEAST(COALESCE(p_work_start_time, daily_entries.work_start_time), daily_entries.work_start_time),
    work_end_time = GREATEST(COALESCE(p_work_end_time, daily_entries.work_end_time), daily_entries.work_end_time),
    break_periods = COALESCE(p_break_periods, daily_entries.break_periods),
    counter_timestamps = v_merged_timestamps, -- Use merged timestamps
    custom_counters = COALESCE(p_custom_counters, daily_entries.custom_counters),
    timezone = COALESCE(p_timezone, daily_entries.timezone),
    sales_log = v_merged_sales, -- ALWAYS use merged sales
    is_finalized = COALESCE(p_is_finalized, daily_entries.is_finalized),
    updated_at = now()
  RETURNING to_jsonb(daily_entries.*) INTO v_result;

  RETURN v_result;
END;
$function$;