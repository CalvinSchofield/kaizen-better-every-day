
-- Fix search_path for normalize_stage function
CREATE OR REPLACE FUNCTION public.normalize_stage(raw_stage text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF raw_stage IS NULL THEN
    RETURN NULL;
  END IF;
  
  CASE LOWER(TRIM(raw_stage))
    WHEN '100 list', '100list', '100_list' THEN RETURN '100 List';
    WHEN 'reached out', 'reached_out', 'reachedout' THEN RETURN 'Reached Out';
    WHEN 'evaluating' THEN RETURN 'Evaluating';
    WHEN 'signed' THEN RETURN 'Signed';
    WHEN 'shadow ✅', 'shadow_complete', 'shadow complete', 'shadowed', 'shadowed ✅' THEN RETURN 'Shadow ✅';
    WHEN 'sold 💲', 'sold', 'sold_1' THEN RETURN 'Sold 💲';
    WHEN 'sold (5+) 💰', 'sold_5_plus', 'sold 5+', 'sold (5+)', 'sold5+' THEN RETURN 'Sold (5+) 💰';
    WHEN 'potential follow up', 'follow up', 'followup', 'follow_up', 'potential_follow_up' THEN RETURN 'Potential Follow Up';
    WHEN 'not interested', 'not_interested', 'notinterested' THEN RETURN 'Not Interested';
    WHEN 'signed but not interested', 'signed (left)', 'signed_but_not_interested', 'signedleft' THEN RETURN 'Signed but Not Interested';
    ELSE RETURN raw_stage;
  END CASE;
END;
$$;
