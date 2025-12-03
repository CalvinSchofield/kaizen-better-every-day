-- Drop the timezone-problematic policy
DROP POLICY IF EXISTS "Users can view today's entries for live leaderboards" ON public.daily_entries;

-- Create a new policy that accounts for timezone differences
-- Allow viewing entries from the last 2 days to cover all US timezones
CREATE POLICY "Users can view recent entries for live leaderboards" 
ON public.daily_entries 
FOR SELECT 
TO authenticated
USING (entry_date >= CURRENT_DATE - INTERVAL '1 day');