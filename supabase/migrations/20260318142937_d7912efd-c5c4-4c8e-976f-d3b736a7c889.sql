ALTER TABLE public.rep_goals 
  ADD COLUMN goal_review_requested_by uuid,
  ADD COLUMN goal_review_requested_at timestamptz;