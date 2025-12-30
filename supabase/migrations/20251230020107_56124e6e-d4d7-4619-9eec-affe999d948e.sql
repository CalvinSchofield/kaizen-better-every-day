-- Phase 1A: Add rep_id columns to tables that reference reps via notion_page_id
-- These will replace rep_notion_page_id with proper FK relationships

-- 1. Add rep_id to blitz_invites (references reps.id)
ALTER TABLE public.blitz_invites 
ADD COLUMN IF NOT EXISTS rep_id uuid REFERENCES public.reps(id);

-- 2. Add rep_id to blitz_declines (references reps.id)
ALTER TABLE public.blitz_declines 
ADD COLUMN IF NOT EXISTS rep_id uuid REFERENCES public.reps(id);

-- 3. Add rep_id to leader_interactions (already has rep_user_id, but add rep_id for consistency)
-- Actually leader_interactions already uses rep_user_id which is fine, just drop rep_notion_page_id later

-- 4. recruit_activities already has recruit_id FK, just need to drop rep_notion_page_id later

-- 5. Update recruit_suggestions: add recruit_id FK and team_leader_user_id
ALTER TABLE public.recruit_suggestions
ADD COLUMN IF NOT EXISTS recruit_id uuid REFERENCES public.recruits(id);

-- Migrate existing data where possible
-- For blitz_invites: populate rep_id from reps table
UPDATE public.blitz_invites bi
SET rep_id = r.id
FROM public.reps r
WHERE bi.rep_notion_page_id = r.notion_page_id
AND bi.rep_id IS NULL;

-- For blitz_declines: populate rep_id from reps table
UPDATE public.blitz_declines bd
SET rep_id = r.id
FROM public.reps r
WHERE bd.rep_notion_page_id = r.notion_page_id
AND bd.rep_id IS NULL;

-- Create indexes for the new FK columns
CREATE INDEX IF NOT EXISTS idx_blitz_invites_rep_id ON public.blitz_invites(rep_id);
CREATE INDEX IF NOT EXISTS idx_blitz_declines_rep_id ON public.blitz_declines(rep_id);
CREATE INDEX IF NOT EXISTS idx_recruit_suggestions_recruit_id ON public.recruit_suggestions(recruit_id);