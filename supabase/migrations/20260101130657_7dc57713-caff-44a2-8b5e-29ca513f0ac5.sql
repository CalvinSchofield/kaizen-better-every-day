-- Personal recaps history table
CREATE TABLE personal_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('week', 'month', 'blitz')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_label TEXT,
  days_worked INTEGER NOT NULL DEFAULT 0,
  total_fp NUMERIC DEFAULT 0,
  total_prmr NUMERIC DEFAULT 0,
  stats_json JSONB,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_type, period_start)
);

-- RLS policies
ALTER TABLE personal_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recaps"
  ON personal_recaps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recaps"
  ON personal_recaps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recaps"
  ON personal_recaps FOR UPDATE
  USING (auth.uid() = user_id);