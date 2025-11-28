-- Create daily_entries table for QTally tracking
CREATE TABLE public.daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  doors_knocked INTEGER DEFAULT 0 CHECK (doors_knocked >= 0),
  decision_makers INTEGER DEFAULT 0 CHECK (decision_makers >= 0),
  pitches INTEGER DEFAULT 0 CHECK (pitches >= 0),
  transitions INTEGER DEFAULT 0 CHECK (transitions >= 0),
  presentations INTEGER DEFAULT 0 CHECK (presentations >= 0),
  closes INTEGER DEFAULT 0 CHECK (closes >= 0),
  fp_plus NUMERIC(5,1) DEFAULT 0,
  prmr NUMERIC(10,2) DEFAULT 0,
  is_finalized BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

-- Create season_config table for mode management
CREATE TABLE public.season_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  knocking_mode_enabled BOOLEAN DEFAULT NULL,
  personal_summer_start DATE,
  personal_summer_end DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_entries
CREATE POLICY "Users can view own entries"
  ON public.daily_entries
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON public.daily_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON public.daily_entries
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON public.daily_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for season_config
CREATE POLICY "Users can view own config"
  ON public.season_config
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own config"
  ON public.season_config
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own config"
  ON public.season_config
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_daily_entries_updated_at
  BEFORE UPDATE ON public.daily_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_season_config_updated_at
  BEFORE UPDATE ON public.season_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();