-- Add per-window RSVP acknowledgement tracking so the RSVP CTA only reappears in the 10-day window after a first-window response
ALTER TABLE public.reps
ADD COLUMN IF NOT EXISTS rsvp_first_window_ack_blitz_ids text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.reps
ADD COLUMN IF NOT EXISTS rsvp_second_window_ack_blitz_ids text[] NOT NULL DEFAULT '{}'::text[];