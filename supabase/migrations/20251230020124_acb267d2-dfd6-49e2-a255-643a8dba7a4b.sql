-- Phase 1B: Drop legacy notion_page_id columns
-- These are no longer needed now that we use Supabase UUIDs

-- Drop rep_notion_page_id from tables (keep the new rep_id/recruit_id columns)
ALTER TABLE public.blitz_invites DROP COLUMN IF EXISTS rep_notion_page_id;
ALTER TABLE public.blitz_declines DROP COLUMN IF EXISTS rep_notion_page_id;
ALTER TABLE public.recruit_activities DROP COLUMN IF EXISTS rep_notion_page_id;
ALTER TABLE public.leader_interactions DROP COLUMN IF EXISTS rep_notion_page_id;

-- Drop notion_page_id from recruit_suggestions (now uses recruit_id)
ALTER TABLE public.recruit_suggestions DROP COLUMN IF EXISTS notion_page_id;
ALTER TABLE public.recruit_suggestions DROP COLUMN IF EXISTS team_leader_notion_id;

-- Drop notion_page_id from core entity tables
ALTER TABLE public.reps DROP COLUMN IF EXISTS notion_page_id;
ALTER TABLE public.recruits DROP COLUMN IF EXISTS notion_page_id;
ALTER TABLE public.blitzes DROP COLUMN IF EXISTS notion_page_id;
ALTER TABLE public.teams DROP COLUMN IF EXISTS notion_page_id;
ALTER TABLE public.mgmt_groups DROP COLUMN IF EXISTS notion_page_id;
ALTER TABLE public.competitors DROP COLUMN IF EXISTS notion_page_id;