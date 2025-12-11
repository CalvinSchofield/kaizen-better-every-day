-- Add columns to store synced book data and weekly activity logs
-- This enables multi-device sync for books committed/read and weekly activities

ALTER TABLE public.rep_goals 
ADD COLUMN IF NOT EXISTS books_committed jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS books_read jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS other_books_committed jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS other_books_read jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS weekly_mnl_logs jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS weekly_roleplay_logs jsonb DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.rep_goals.books_committed IS 'Array of book IDs user committed to reading';
COMMENT ON COLUMN public.rep_goals.books_read IS 'Array of book IDs user has marked as read';
COMMENT ON COLUMN public.rep_goals.other_books_committed IS 'Array of custom book titles user committed to';
COMMENT ON COLUMN public.rep_goals.other_books_read IS 'Array of custom book titles user has read';
COMMENT ON COLUMN public.rep_goals.weekly_mnl_logs IS 'Object mapping week_start dates to MNL attendance (0 or 1)';
COMMENT ON COLUMN public.rep_goals.weekly_roleplay_logs IS 'Object mapping week_start dates to roleplay counts';