-- Enable realtime for recruit_activities table
ALTER TABLE recruit_activities REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE recruit_activities;

-- Enable realtime for recruit_suggestions table  
ALTER TABLE recruit_suggestions REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE recruit_suggestions;