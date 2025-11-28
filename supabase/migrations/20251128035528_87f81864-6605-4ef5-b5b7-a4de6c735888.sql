-- Change personal_fp and personal_fp_goal columns to support decimal values
ALTER TABLE public.reps 
  ALTER COLUMN personal_fp TYPE NUMERIC(5,1),
  ALTER COLUMN personal_fp_goal TYPE NUMERIC(5,1);

COMMENT ON COLUMN public.reps.personal_fp IS 'Personal FP+ progress (supports 1 decimal place)';
COMMENT ON COLUMN public.reps.personal_fp_goal IS 'Personal FP+ goal (supports 1 decimal place)';