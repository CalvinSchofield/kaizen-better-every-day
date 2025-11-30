-- Add counter_layout_config column to reps table for customizable counter layouts
ALTER TABLE public.reps 
ADD COLUMN counter_layout_config JSONB DEFAULT NULL;