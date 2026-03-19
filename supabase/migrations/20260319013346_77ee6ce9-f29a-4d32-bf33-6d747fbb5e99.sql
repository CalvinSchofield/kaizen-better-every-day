
-- Fix Jessica and George's invalid 'funded' status to 'installed'
UPDATE daily_entries
SET sales_log = (
  SELECT jsonb_agg(
    CASE 
      WHEN sale->>'install_status' = 'funded' 
      THEN jsonb_set(sale, '{install_status}', '"installed"')
      ELSE sale
    END
  )
  FROM jsonb_array_elements(sales_log) AS sale
),
updated_at = now()
WHERE id = 'cf8a8e86-dc7f-4f75-9d87-5ced1e8346c1';
