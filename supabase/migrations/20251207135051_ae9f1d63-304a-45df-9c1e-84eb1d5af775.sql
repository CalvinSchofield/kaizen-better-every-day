-- Create enum for recruit stages
CREATE TYPE public.recruit_stage AS ENUM (
  '100_list',
  'reached_out', 
  'evaluating',
  'signed',
  'shadow_complete',
  'sold',
  'sold_5_plus'
);

-- Create enum for activity types
CREATE TYPE public.recruit_activity_type AS ENUM (
  'phone_call',
  'in_person',
  'note',
  'stage_change',
  'next_step'
);

-- Create enum for suggestion status
CREATE TYPE public.suggestion_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

-- Create recruit_suggestions table
CREATE TABLE public.recruit_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggested_by_name TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  notes TEXT,
  status suggestion_status NOT NULL DEFAULT 'pending',
  reviewed_by_user_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  notion_page_id TEXT,
  team_leader_notion_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create recruit_activities table
CREATE TABLE public.recruit_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_notion_page_id TEXT NOT NULL,
  activity_type recruit_activity_type NOT NULL,
  logged_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT,
  next_action TEXT,
  next_action_due DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recruit_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruit_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recruit_suggestions
CREATE POLICY "Users can view own suggestions"
ON public.recruit_suggestions
FOR SELECT
USING (auth.uid() = suggested_by_user_id);

CREATE POLICY "Users can insert own suggestions"
ON public.recruit_suggestions
FOR INSERT
WITH CHECK (auth.uid() = suggested_by_user_id);

CREATE POLICY "Leaders can view team suggestions"
ON public.recruit_suggestions
FOR SELECT
USING (true);

CREATE POLICY "Leaders can update suggestions"
ON public.recruit_suggestions
FOR UPDATE
USING (true);

-- RLS Policies for recruit_activities
CREATE POLICY "Authenticated users can view activities"
ON public.recruit_activities
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert activities"
ON public.recruit_activities
FOR INSERT
WITH CHECK (auth.uid() = logged_by_user_id);

CREATE POLICY "Users can update own activities"
ON public.recruit_activities
FOR UPDATE
USING (auth.uid() = logged_by_user_id);

-- Create indexes for performance
CREATE INDEX idx_recruit_suggestions_team_leader ON public.recruit_suggestions(team_leader_notion_id);
CREATE INDEX idx_recruit_suggestions_status ON public.recruit_suggestions(status);
CREATE INDEX idx_recruit_activities_rep ON public.recruit_activities(rep_notion_page_id);
CREATE INDEX idx_recruit_activities_type ON public.recruit_activities(activity_type);

-- Trigger for updated_at
CREATE TRIGGER update_recruit_suggestions_updated_at
BEFORE UPDATE ON public.recruit_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();