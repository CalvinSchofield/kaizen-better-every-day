-- Add fp_sold column to track Families Protected count separately from FP+
ALTER TABLE official_totals ADD COLUMN IF NOT EXISTS fp_sold integer DEFAULT 0;