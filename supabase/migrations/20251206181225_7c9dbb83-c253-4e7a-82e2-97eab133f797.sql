-- Add excluded_blitz_days field to season_config to track days user opted out of per blitz
ALTER TABLE public.season_config 
ADD COLUMN IF NOT EXISTS excluded_blitz_days JSONB DEFAULT '{}'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.season_config.excluded_blitz_days IS 'JSON object mapping blitz_id to array of excluded date strings, e.g. {"blitz_123": ["2024-12-20"]}';