-- Enable realtime for challenges and daily_entries tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_entries;

-- Set replica identity to full for complete row data on updates
ALTER TABLE public.challenges REPLICA IDENTITY FULL;
ALTER TABLE public.challenge_participants REPLICA IDENTITY FULL;
ALTER TABLE public.daily_entries REPLICA IDENTITY FULL;