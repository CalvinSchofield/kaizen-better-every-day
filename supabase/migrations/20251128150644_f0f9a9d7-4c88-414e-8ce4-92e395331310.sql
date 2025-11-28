-- Add unique constraint on user_id and entry_date to prevent duplicate entries per day
ALTER TABLE public.daily_entries 
ADD CONSTRAINT daily_entries_user_date_unique UNIQUE (user_id, entry_date);