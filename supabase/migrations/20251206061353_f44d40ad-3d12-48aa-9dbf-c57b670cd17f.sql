-- Create rep_goals table for storing goal configurations
CREATE TABLE public.rep_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  
  -- Calculation inputs
  monthly_expenses numeric DEFAULT 0,
  months_off numeric DEFAULT 4,
  rent_type text DEFAULT 'Single',
  avg_prmr_per_fp numeric DEFAULT 85,
  upgrade_fp_goal numeric DEFAULT 0,
  weeks_working numeric DEFAULT 18,
  
  -- Three-tier goals (FP+ values)
  must_do_fp_goal numeric DEFAULT 0,
  will_do_fp_goal numeric DEFAULT 0,
  could_do_fp_goal numeric DEFAULT 0,
  
  -- Preseason commitments
  training_hours_goal numeric DEFAULT 0,
  books_goal numeric DEFAULT 0,
  monday_night_lights_goal numeric DEFAULT 0,
  role_plays_goal numeric DEFAULT 0,
  blitzes_goal numeric DEFAULT 0,
  preseason_fp_goal numeric DEFAULT 0,
  recruits_with_sale_goal numeric DEFAULT 0,
  
  -- Setup tracking
  setup_complete boolean DEFAULT false,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create planned_work_days table for calendar planning
CREATE TABLE public.planned_work_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  planned_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(user_id, planned_date)
);

-- Enable RLS on both tables
ALTER TABLE public.rep_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_work_days ENABLE ROW LEVEL SECURITY;

-- RLS policies for rep_goals
CREATE POLICY "Users can view own goals"
ON public.rep_goals
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
ON public.rep_goals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
ON public.rep_goals
FOR UPDATE
USING (auth.uid() = user_id);

-- Leaders can view all goals for team reports
CREATE POLICY "Authenticated users can view all goals for reports"
ON public.rep_goals
FOR SELECT
TO authenticated
USING (true);

-- RLS policies for planned_work_days
CREATE POLICY "Users can view own planned days"
ON public.planned_work_days
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own planned days"
ON public.planned_work_days
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own planned days"
ON public.planned_work_days
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own planned days"
ON public.planned_work_days
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at on rep_goals
CREATE TRIGGER update_rep_goals_updated_at
BEFORE UPDATE ON public.rep_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();