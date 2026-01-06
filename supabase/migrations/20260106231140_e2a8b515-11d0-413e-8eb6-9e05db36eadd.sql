-- Backfill legacy sales with install_status
-- For all sales_log entries without install_status, default to 'installed' with same_day = true
UPDATE daily_entries
SET sales_log = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'install_status' IS NULL 
      THEN elem || '{"install_status": "installed", "installed_same_day": true}'::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(sales_log) AS elem
)
WHERE sales_log IS NOT NULL 
  AND jsonb_array_length(sales_log) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(sales_log) e 
    WHERE e->>'install_status' IS NULL
  );