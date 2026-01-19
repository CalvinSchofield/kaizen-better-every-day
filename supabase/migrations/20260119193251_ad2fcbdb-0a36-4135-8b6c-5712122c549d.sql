-- Table 1: Activity Reactions (like Venmo likes)
CREATE TABLE public.recruit_activity_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.recruit_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'like' CHECK (reaction_type IN ('like', 'helpful', 'thumbsup')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(activity_id, user_id, reaction_type)
);

-- Table 2: Activity Comments
CREATE TABLE public.recruit_activity_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.recruit_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table 3: Read Status for unread detection
CREATE TABLE public.recruit_activity_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recruit_id UUID NOT NULL,
  user_id UUID NOT NULL,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(recruit_id, user_id)
);

-- Enable RLS
ALTER TABLE public.recruit_activity_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruit_activity_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruit_activity_read_status ENABLE ROW LEVEL SECURITY;

-- RLS for reactions: All authenticated can view, users can manage their own
CREATE POLICY "Anyone can view reactions"
  ON public.recruit_activity_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add their own reactions"
  ON public.recruit_activity_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions"
  ON public.recruit_activity_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS for comments: All authenticated can view, users can manage their own
CREATE POLICY "Anyone can view comments"
  ON public.recruit_activity_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add comments"
  ON public.recruit_activity_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.recruit_activity_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.recruit_activity_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS for read status: Users can manage their own
CREATE POLICY "Users can view their own read status"
  ON public.recruit_activity_read_status FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own read status"
  ON public.recruit_activity_read_status FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own read status"
  ON public.recruit_activity_read_status FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for social features
ALTER PUBLICATION supabase_realtime ADD TABLE public.recruit_activity_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recruit_activity_comments;

-- Create updated_at trigger for comments
CREATE TRIGGER update_recruit_activity_comments_updated_at
  BEFORE UPDATE ON public.recruit_activity_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();