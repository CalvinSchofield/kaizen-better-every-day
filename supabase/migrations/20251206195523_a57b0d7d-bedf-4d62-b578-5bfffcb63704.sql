-- Add excluded_summer_days column to season_config for tracking summer off-days
ALTER TABLE public.season_config 
ADD COLUMN IF NOT EXISTS excluded_summer_days text[] DEFAULT '{}';

-- Add a comment for documentation
COMMENT ON COLUMN public.season_config.excluded_summer_days IS 'Array of date strings (YYYY-MM-DD) representing days the user will NOT work during summer season';