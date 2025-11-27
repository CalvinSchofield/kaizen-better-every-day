-- Add iPad assignment tracking from Notion
ALTER TABLE reps ADD COLUMN IF NOT EXISTS ipad_assigned BOOLEAN DEFAULT false;

-- Track which team members the leader has contacted for each blitz
-- Format: { "blitz_id_1": ["rep_notion_id_1", "rep_notion_id_2"], "blitz_id_2": [...] }
ALTER TABLE reps ADD COLUMN IF NOT EXISTS contacted_for_blitz JSONB DEFAULT '{}';