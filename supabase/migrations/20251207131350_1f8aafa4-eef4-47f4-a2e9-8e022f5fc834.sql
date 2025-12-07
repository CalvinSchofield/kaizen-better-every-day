-- Create table to track blitz declines from app RSVPs (similar to blitz_invites for contacted status)
CREATE TABLE public.blitz_declines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blitz_id text NOT NULL,
  rep_notion_page_id text NOT NULL,
  declined_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  declined_at timestamp with time zone DEFAULT now(),
  UNIQUE(blitz_id, rep_notion_page_id)
);

-- Enable RLS
ALTER TABLE public.blitz_declines ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view blitz declines"
ON public.blitz_declines FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage blitz declines"
ON public.blitz_declines FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update blitz declines"
ON public.blitz_declines FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete blitz declines"
ON public.blitz_declines FOR DELETE
TO authenticated
USING (true);