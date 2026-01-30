-- Rename total_spent to baseline_spent for semantic clarity
-- This column represents pre-tracking spending baseline, not a total override
ALTER TABLE official_totals 
RENAME COLUMN total_spent TO baseline_spent;

-- Add comment for clarity
COMMENT ON COLUMN official_totals.baseline_spent IS 
'Pre-tracking spending baseline. Added to tracked spending for season totals.';