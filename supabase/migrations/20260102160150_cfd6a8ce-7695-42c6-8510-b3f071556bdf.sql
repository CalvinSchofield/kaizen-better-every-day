-- Add focus_tier column to rep_goals table
ALTER TABLE public.rep_goals 
ADD COLUMN focus_tier TEXT DEFAULT 'willDo';

-- Add comment for documentation
COMMENT ON COLUMN public.rep_goals.focus_tier IS 'User selected focus tier: mustDo, willDo, or couldDo';