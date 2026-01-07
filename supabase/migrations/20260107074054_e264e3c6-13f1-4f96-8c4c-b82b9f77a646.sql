-- Add timezone column to challenges table
ALTER TABLE public.challenges 
ADD COLUMN creator_timezone TEXT;

-- Add timezone column to incentives table  
ALTER TABLE public.incentives
ADD COLUMN creator_timezone TEXT;