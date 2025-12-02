-- Allow viewing today's entries (finalized or not) for live leaderboards
-- This enables competitive real-time tracking while protecting historical draft data
CREATE POLICY "Users can view today's entries for live leaderboards"
ON public.daily_entries
FOR SELECT
TO authenticated
USING (entry_date = CURRENT_DATE);