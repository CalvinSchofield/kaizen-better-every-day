-- Add column to store completed task IDs as JSON array
ALTER TABLE public.reps 
ADD COLUMN completed_tasks jsonb DEFAULT '[]'::jsonb;

-- Add index for faster queries
CREATE INDEX idx_reps_completed_tasks ON public.reps USING gin(completed_tasks);

COMMENT ON COLUMN public.reps.completed_tasks IS 'Array of task IDs that the rep has completed in their Ramp to Blitz journey';