-- Step 7: Drop notion_page_id columns from tables
-- Note: Keep notion_page_id in competitors table (still uses Notion images)

-- Drop from reps table
ALTER TABLE public.reps DROP COLUMN IF EXISTS notion_page_id;

-- Drop from recruits table  
ALTER TABLE public.recruits DROP COLUMN IF EXISTS notion_page_id;

-- Drop from teams table
ALTER TABLE public.teams DROP COLUMN IF EXISTS notion_page_id;

-- Drop from mgmt_groups table
ALTER TABLE public.mgmt_groups DROP COLUMN IF EXISTS notion_page_id;

-- Drop from blitzes table
ALTER TABLE public.blitzes DROP COLUMN IF EXISTS notion_page_id;

-- Drop rep_notion_page_id from blitz_declines (already has rep_id and rep_user_id)
ALTER TABLE public.blitz_declines DROP COLUMN IF EXISTS rep_notion_page_id;

-- Drop rep_notion_page_id from blitz_invites (already has rep_id and rep_user_id)
ALTER TABLE public.blitz_invites DROP COLUMN IF EXISTS rep_notion_page_id;