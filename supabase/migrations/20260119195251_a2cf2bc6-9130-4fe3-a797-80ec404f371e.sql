-- Create table to track mentions in activity comments
CREATE TABLE public.activity_comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.recruit_activity_comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_activity_comment_mentions_user ON public.activity_comment_mentions(mentioned_user_id);
CREATE INDEX idx_activity_comment_mentions_comment ON public.activity_comment_mentions(comment_id);

-- Enable RLS
ALTER TABLE public.activity_comment_mentions ENABLE ROW LEVEL SECURITY;

-- Users can view all mentions (to show who was mentioned)
CREATE POLICY "Authenticated users can view mentions"
  ON public.activity_comment_mentions
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert mentions (when they create a comment)
CREATE POLICY "Authenticated users can insert mentions"
  ON public.activity_comment_mentions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime for mentions
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_comment_mentions;