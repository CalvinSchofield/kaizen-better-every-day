-- Create table to store admin dismissed data review issues
CREATE TABLE public.admin_dismissed_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  issue_id TEXT NOT NULL,
  entry_id UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(admin_user_id, issue_id)
);

-- Enable RLS
ALTER TABLE public.admin_dismissed_issues ENABLE ROW LEVEL SECURITY;

-- Allow admin to manage their own dismissed issues
CREATE POLICY "Admin can manage own dismissed issues"
ON public.admin_dismissed_issues
FOR ALL
USING (auth.uid() = admin_user_id)
WITH CHECK (auth.uid() = admin_user_id);