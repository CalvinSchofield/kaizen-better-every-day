-- Create historical_entries table for Me vs Me comparisons
CREATE TABLE public.historical_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  season_year INTEGER NOT NULL,
  season_type TEXT NOT NULL CHECK (season_type IN ('preseason', 'summer', 'extension')),
  season_week INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  original_date DATE NOT NULL,
  
  doors_knocked INTEGER DEFAULT 0,
  decision_makers INTEGER DEFAULT 0,
  pitches INTEGER DEFAULT 0,
  transitions INTEGER DEFAULT 0,
  presentations INTEGER DEFAULT 0,
  closes INTEGER DEFAULT 0,
  fp_plus NUMERIC DEFAULT 0,
  prmr NUMERIC DEFAULT 0,
  upgrade_prmr NUMERIC DEFAULT 0,
  hours_worked NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, season_year, season_type, season_week, day_of_week)
);

-- Add me_vs_me_enabled to reps table
ALTER TABLE public.reps ADD COLUMN IF NOT EXISTS me_vs_me_enabled BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.historical_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for historical_entries
CREATE POLICY "Users can view own historical entries"
ON public.historical_entries
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own historical entries"
ON public.historical_entries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own historical entries"
ON public.historical_entries
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own historical entries"
ON public.historical_entries
FOR DELETE
USING (auth.uid() = user_id);