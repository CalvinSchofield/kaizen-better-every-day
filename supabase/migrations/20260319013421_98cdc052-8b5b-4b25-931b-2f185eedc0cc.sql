
-- Fix Ailyne Ramos sale - set to pending since user scheduled it out but RPC bug lost the status
-- Also fix Ledonric Dale who has install_status but confirm it's correct
UPDATE daily_entries
SET sales_log = (
  SELECT jsonb_agg(
    CASE 
      WHEN sale->>'id' = 'aaac8471-cf7d-43b0-952b-f0062c280b9f' AND (sale->>'install_status') IS NULL
      THEN sale || '{"install_status": "pending", "installed_same_day": false}'::jsonb
      ELSE sale
    END
  )
  FROM jsonb_array_elements(sales_log) AS sale
),
updated_at = now()
WHERE id = 'd15cb739-42e3-4d18-ae28-68ba4f609b1a';
