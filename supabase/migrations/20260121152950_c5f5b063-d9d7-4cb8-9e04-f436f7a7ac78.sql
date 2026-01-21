-- Create table to track which users have added activities to their calendar
CREATE TABLE public.activity_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.recruit_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calendar_date DATE NOT NULL,
  calendar_time TIME,
  recruit_name TEXT,
  event_title TEXT,
  UNIQUE(activity_id, user_id)
);

-- Enable RLS
ALTER TABLE public.activity_calendar_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own calendar events
CREATE POLICY "Users can view own calendar events"
ON public.activity_calendar_events
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own calendar events
CREATE POLICY "Users can insert own calendar events"
ON public.activity_calendar_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own calendar events
CREATE POLICY "Users can update own calendar events"
ON public.activity_calendar_events
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own calendar events
CREATE POLICY "Users can delete own calendar events"
ON public.activity_calendar_events
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_activity_calendar_events_activity_id ON public.activity_calendar_events(activity_id);
CREATE INDEX idx_activity_calendar_events_user_id ON public.activity_calendar_events(user_id);