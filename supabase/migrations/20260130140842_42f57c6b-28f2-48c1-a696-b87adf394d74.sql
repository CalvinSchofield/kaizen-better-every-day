-- Add total_spent column to official_totals table for spending baseline override
ALTER TABLE official_totals 
ADD COLUMN IF NOT EXISTS total_spent numeric DEFAULT 0;