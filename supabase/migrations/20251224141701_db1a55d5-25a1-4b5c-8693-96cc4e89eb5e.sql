
-- Create a function to normalize stage strings to canonical values
CREATE OR REPLACE FUNCTION public.normalize_stage(raw_stage text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF raw_stage IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Normalize to lowercase for comparison
  CASE LOWER(TRIM(raw_stage))
    -- 100 List
    WHEN '100 list', '100list', '100_list' THEN RETURN '100 List';
    
    -- Reached Out
    WHEN 'reached out', 'reached_out', 'reachedout' THEN RETURN 'Reached Out';
    
    -- Evaluating
    WHEN 'evaluating' THEN RETURN 'Evaluating';
    
    -- Signed
    WHEN 'signed' THEN RETURN 'Signed';
    
    -- Shadow complete
    WHEN 'shadow ✅', 'shadow_complete', 'shadow complete', 'shadowed', 'shadowed ✅' THEN RETURN 'Shadow ✅';
    
    -- Sold
    WHEN 'sold 💲', 'sold', 'sold_1' THEN RETURN 'Sold 💲';
    
    -- Sold 5+
    WHEN 'sold (5+) 💰', 'sold_5_plus', 'sold 5+', 'sold (5+)', 'sold5+' THEN RETURN 'Sold (5+) 💰';
    
    -- Potential Follow Up (exit stage)
    WHEN 'potential follow up', 'follow up', 'followup', 'follow_up', 'potential_follow_up' THEN RETURN 'Potential Follow Up';
    
    -- Not Interested (exit stage)
    WHEN 'not interested', 'not_interested', 'notinterested' THEN RETURN 'Not Interested';
    
    -- Signed but Not Interested (exit stage)
    WHEN 'signed but not interested', 'signed (left)', 'signed_but_not_interested', 'signedleft' THEN RETURN 'Signed but Not Interested';
    
    ELSE RETURN raw_stage; -- Return as-is if no match
  END CASE;
END;
$$;

-- Create trigger function for reps table
CREATE OR REPLACE FUNCTION public.normalize_rep_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.stage := normalize_stage(NEW.stage);
  RETURN NEW;
END;
$$;

-- Create trigger function for recruits table
CREATE OR REPLACE FUNCTION public.normalize_recruit_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.stage := normalize_stage(NEW.stage);
  RETURN NEW;
END;
$$;

-- Create trigger on reps table
DROP TRIGGER IF EXISTS normalize_rep_stage_trigger ON public.reps;
CREATE TRIGGER normalize_rep_stage_trigger
  BEFORE INSERT OR UPDATE OF stage ON public.reps
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_rep_stage();

-- Create trigger on recruits table
DROP TRIGGER IF EXISTS normalize_recruit_stage_trigger ON public.recruits;
CREATE TRIGGER normalize_recruit_stage_trigger
  BEFORE INSERT OR UPDATE OF stage ON public.recruits
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_recruit_stage();
