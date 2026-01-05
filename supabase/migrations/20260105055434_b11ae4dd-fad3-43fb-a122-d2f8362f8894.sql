-- Add purpose columns to rep_goals table
ALTER TABLE public.rep_goals 
ADD COLUMN IF NOT EXISTS purpose_statement TEXT,
ADD COLUMN IF NOT EXISTS purpose_answers JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS purpose_updated_at TIMESTAMPTZ;