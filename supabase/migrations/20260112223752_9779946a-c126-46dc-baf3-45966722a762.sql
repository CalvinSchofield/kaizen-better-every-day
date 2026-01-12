-- Create a SECURE function for updating daily entries with merge logic
-- This prevents stale client data from overwriting sales
CREATE OR REPLACE FUNCTION public.upsert_daily_entry_safe(
  p_user_id UUID,
  p_entry_date DATE,
  p_doors_knocked INTEGER DEFAULT NULL,
  p_decision_makers INTEGER DEFAULT NULL,
  p_pitches INTEGER DEFAULT NULL,
  p_transitions INTEGER DEFAULT NULL,
  p_presentations INTEGER DEFAULT NULL,
  p_closes INTEGER DEFAULT NULL,
  p_fp_plus NUMERIC DEFAULT NULL,
  p_prmr NUMERIC DEFAULT NULL,
  p_upgrade_prmr NUMERIC DEFAULT NULL,
  p_work_start_time TIMESTAMPTZ DEFAULT NULL,
  p_work_end_time TIMESTAMPTZ DEFAULT NULL,
  p_break_periods JSONB DEFAULT NULL,
  p_counter_timestamps JSONB DEFAULT NULL,
  p_custom_counters JSONB DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_sales_log JSONB DEFAULT NULL,
  p_is_finalized BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_result JSONB;
  v_merged_sales JSONB;
  v_existing_sale_ids TEXT[];
  v_new_sale JSONB;
  v_sale JSONB;
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
      
      -- Update only sales_log and recalculate totals
      UPDATE daily_entries
      SET 
        sales_log = v_merged_sales,
        closes = (SELECT COUNT(*) FROM jsonb_array_elements(v_merged_sales) s 
                  WHERE s->>'install_status' IS DISTINCT FROM 'cancelled' 
                  AND s->>'install_status' IS DISTINCT FROM 'never_installed'),
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

  -- MERGE counter_timestamps (append-only for activity timeline)
  -- Use the version with more keys, or merge them
  
  -- Upsert with merged data
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
    COALESCE(p_closes, 0),
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
    doors_knocked = COALESCE(p_doors_knocked, daily_entries.doors_knocked),
    decision_makers = COALESCE(p_decision_makers, daily_entries.decision_makers),
    pitches = COALESCE(p_pitches, daily_entries.pitches),
    transitions = COALESCE(p_transitions, daily_entries.transitions),
    presentations = COALESCE(p_presentations, daily_entries.presentations),
    closes = COALESCE(p_closes, daily_entries.closes),
    fp_plus = COALESCE(p_fp_plus, daily_entries.fp_plus),
    prmr = COALESCE(p_prmr, daily_entries.prmr),
    upgrade_prmr = COALESCE(p_upgrade_prmr, daily_entries.upgrade_prmr),
    work_start_time = COALESCE(p_work_start_time, daily_entries.work_start_time),
    work_end_time = COALESCE(p_work_end_time, daily_entries.work_end_time),
    break_periods = COALESCE(p_break_periods, daily_entries.break_periods),
    counter_timestamps = COALESCE(p_counter_timestamps, daily_entries.counter_timestamps),
    custom_counters = COALESCE(p_custom_counters, daily_entries.custom_counters),
    timezone = COALESCE(p_timezone, daily_entries.timezone),
    sales_log = v_merged_sales, -- ALWAYS use merged sales
    is_finalized = COALESCE(p_is_finalized, daily_entries.is_finalized),
    updated_at = now()
  RETURNING to_jsonb(daily_entries.*) INTO v_result;

  RETURN v_result;
END;
$$;