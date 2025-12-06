-- Add progress tracking fields to rep_goals for preseason commitments
ALTER TABLE public.rep_goals
ADD COLUMN IF NOT EXISTS training_hours_progress numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS books_progress numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS monday_night_lights_progress numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS role_plays_progress numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS blitzes_progress numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS recruits_with_sale_progress numeric DEFAULT 0;