-- Add task assignment columns to recruit_activities table
ALTER TABLE public.recruit_activities 
ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.recruit_activities 
ADD COLUMN IF NOT EXISTS assignment_status text DEFAULT 'pending';

-- Add index for efficient querying of assigned tasks
CREATE INDEX IF NOT EXISTS idx_recruit_activities_assigned_to 
ON public.recruit_activities(assigned_to_user_id) 
WHERE assigned_to_user_id IS NOT NULL;

-- Add RLS policy for viewing tasks assigned to current user
CREATE POLICY "Users can view tasks assigned to them"
ON public.recruit_activities
FOR SELECT
USING (auth.uid() = assigned_to_user_id);