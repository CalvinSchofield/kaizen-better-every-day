CREATE TABLE public.blitz_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blitz_id TEXT NOT NULL,
  rep_notion_page_id TEXT NOT NULL,
  contacted_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contacted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blitz_id, rep_notion_page_id)
);

ALTER TABLE public.blitz_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_blitz_invites_blitz_id ON public.blitz_invites(blitz_id);
CREATE INDEX idx_blitz_invites_rep ON public.blitz_invites(rep_notion_page_id);