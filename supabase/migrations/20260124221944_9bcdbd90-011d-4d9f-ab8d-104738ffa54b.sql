-- Update prevent_duplicate_recruit to only block true duplicates (same name AND same phone)
CREATE OR REPLACE FUNCTION public.prevent_duplicate_recruit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _normalized_name text;
  _existing_id uuid;
  _existing_phone text;
BEGIN
  _normalized_name := normalize_name(NEW.name);
  
  -- Check for existing recruit with same normalized name AND same phone (true duplicate)
  -- If no phone provided, skip duplicate check (allow multiple Jacobs with no phone)
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    -- Clean the phone for comparison (last 10 digits)
    SELECT id, phone INTO _existing_id, _existing_phone
    FROM public.recruits
    WHERE (
      -- Same normalized name AND same phone (last 10 digits match)
      normalize_name(name) = _normalized_name
      AND phone IS NOT NULL
      AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g'), 10)
    )
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;
    
    IF _existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Duplicate recruit detected: "%" with phone "%" already exists with ID %', NEW.name, NEW.phone, _existing_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update prevent_duplicate_rep with same logic
CREATE OR REPLACE FUNCTION public.prevent_duplicate_rep()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _normalized_name text;
  _existing_id uuid;
BEGIN
  _normalized_name := normalize_name(NEW.name);
  
  -- Check for existing rep with same normalized name AND same phone (true duplicate)
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    SELECT id INTO _existing_id
    FROM public.reps
    WHERE (
      normalize_name(name) = _normalized_name
      AND phone IS NOT NULL
      AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g'), 10)
    )
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;
    
    IF _existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Duplicate rep detected: "%" with this phone already exists with ID %', NEW.name, _existing_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;