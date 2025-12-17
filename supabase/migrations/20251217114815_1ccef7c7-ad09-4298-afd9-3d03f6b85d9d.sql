-- Create leader_interactions table for tracking 1-on-1s, trainings, and conversations
CREATE TABLE public.leader_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  leader_user_id UUID NOT NULL,
  rep_user_id UUID NOT NULL,
  rep_notion_page_id TEXT,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('weekly_training', 'monthly_review', 'tough_conversation', 'praise', 'check_in')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  interaction_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Enable Row Level Security
ALTER TABLE public.leader_interactions ENABLE ROW LEVEL SECURITY;

-- Leaders can view interactions they created
CREATE POLICY "Leaders can view own interactions"
ON public.leader_interactions
FOR SELECT
USING (auth.uid() = leader_user_id);

-- Leaders can insert their own interactions
CREATE POLICY "Leaders can insert own interactions"
ON public.leader_interactions
FOR INSERT
WITH CHECK (auth.uid() = leader_user_id);

-- Leaders can update their own interactions
CREATE POLICY "Leaders can update own interactions"
ON public.leader_interactions
FOR UPDATE
USING (auth.uid() = leader_user_id);

-- Leaders can delete their own interactions
CREATE POLICY "Leaders can delete own interactions"
ON public.leader_interactions
FOR DELETE
USING (auth.uid() = leader_user_id);

-- Create index for efficient querying by leader and date
CREATE INDEX idx_leader_interactions_leader_date ON public.leader_interactions (leader_user_id, interaction_date DESC);

-- Create index for finding interactions for a specific rep
CREATE INDEX idx_leader_interactions_rep ON public.leader_interactions (rep_user_id, interaction_date DESC);