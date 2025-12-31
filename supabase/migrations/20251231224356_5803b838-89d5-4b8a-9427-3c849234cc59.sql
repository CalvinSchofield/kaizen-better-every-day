-- Extend notification_logs table with recipient tracking and metadata
ALTER TABLE notification_logs 
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create personal_records table for tracking best FP+ and PRMR
CREATE TABLE personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  record_type TEXT NOT NULL, -- 'daily_fp', 'daily_prmr'
  value NUMERIC NOT NULL,
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  entry_date DATE NOT NULL,
  entry_id UUID REFERENCES daily_entries(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, record_type)
);

-- Enable RLS
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;

-- Users can view their own records
CREATE POLICY "Users can view own records" 
ON personal_records FOR SELECT 
USING (auth.uid() = user_id);

-- Users can view all records for leaderboards
CREATE POLICY "Authenticated users can view all records" 
ON personal_records FOR SELECT 
USING (true);

-- Service role can manage all records (for edge functions)
CREATE POLICY "Service role can manage records" 
ON personal_records FOR ALL 
USING (true) 
WITH CHECK (true);