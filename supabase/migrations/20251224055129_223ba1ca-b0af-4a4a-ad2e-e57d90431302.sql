-- Phase 1: Add new ID columns alongside existing notion columns
-- This allows gradual migration without breaking existing functionality

-- 1. Add recruit_id to recruit_activities (proper FK to recruits table)
ALTER TABLE public.recruit_activities 
ADD COLUMN IF NOT EXISTS recruit_id uuid REFERENCES public.recruits(id) ON DELETE CASCADE;

-- 2. Add team_leader_user_id to recruit_suggestions
ALTER TABLE public.recruit_suggestions 
ADD COLUMN IF NOT EXISTS team_leader_user_id uuid;

-- 3. Add rep_user_id to blitz_invites (for reps who have user accounts)
ALTER TABLE public.blitz_invites 
ADD COLUMN IF NOT EXISTS rep_user_id uuid;

-- 4. Add rep_user_id to blitz_declines
ALTER TABLE public.blitz_declines 
ADD COLUMN IF NOT EXISTS rep_user_id uuid;

-- 5. Populate recruit_id in recruit_activities from existing notion IDs
UPDATE public.recruit_activities ra
SET recruit_id = r.id
FROM public.recruits r
WHERE ra.recruit_id IS NULL 
  AND (r.notion_page_id = ra.rep_notion_page_id OR r.id::text = ra.rep_notion_page_id);

-- 6. Populate team_leader_user_id in recruit_suggestions
UPDATE public.recruit_suggestions rs
SET team_leader_user_id = rep.user_id
FROM public.reps rep
WHERE rs.team_leader_user_id IS NULL 
  AND rep.notion_page_id = rs.team_leader_notion_id;

-- 7. Populate rep_user_id in blitz_invites
UPDATE public.blitz_invites bi
SET rep_user_id = rep.user_id
FROM public.reps rep
WHERE bi.rep_user_id IS NULL 
  AND rep.notion_page_id = bi.rep_notion_page_id;

-- 8. Populate rep_user_id in blitz_declines
UPDATE public.blitz_declines bd
SET rep_user_id = rep.user_id
FROM public.reps rep
WHERE bd.rep_user_id IS NULL 
  AND rep.notion_page_id = bd.rep_notion_page_id;

-- 9. Create index on new columns for performance
CREATE INDEX IF NOT EXISTS idx_recruit_activities_recruit_id ON public.recruit_activities(recruit_id);
CREATE INDEX IF NOT EXISTS idx_recruit_suggestions_team_leader_user_id ON public.recruit_suggestions(team_leader_user_id);
CREATE INDEX IF NOT EXISTS idx_blitz_invites_rep_user_id ON public.blitz_invites(rep_user_id);
CREATE INDEX IF NOT EXISTS idx_blitz_declines_rep_user_id ON public.blitz_declines(rep_user_id);