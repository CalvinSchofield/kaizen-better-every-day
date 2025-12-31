
-- Create a function to normalize names consistently
CREATE OR REPLACE FUNCTION public.normalize_name(raw_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF raw_name IS NULL THEN
    RETURN NULL;
  END IF;
  -- Remove emojis/special chars, collapse spaces, lowercase, trim
  RETURN LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(raw_name, '[^\w\s]', '', 'g'), '\s+', ' ', 'g')));
END;
$function$;

-- Create trigger function to prevent duplicate reps by normalized name
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
  
  -- Check for existing rep with same normalized name (excluding self on UPDATE)
  SELECT id INTO _existing_id
  FROM public.reps
  WHERE normalize_name(name) = _normalized_name
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  LIMIT 1;
  
  IF _existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate rep detected: "%" already exists with ID %', NEW.name, _existing_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger function to prevent duplicate recruits by normalized name
CREATE OR REPLACE FUNCTION public.prevent_duplicate_recruit()
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
  
  -- Check for existing recruit with same normalized name (excluding self on UPDATE)
  SELECT id INTO _existing_id
  FROM public.recruits
  WHERE normalize_name(name) = _normalized_name
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  LIMIT 1;
  
  IF _existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate recruit detected: "%" already exists with ID %', NEW.name, _existing_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create triggers on both tables
CREATE TRIGGER prevent_duplicate_rep_trigger
  BEFORE INSERT OR UPDATE ON public.reps
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_rep();

CREATE TRIGGER prevent_duplicate_recruit_trigger
  BEFORE INSERT OR UPDATE ON public.recruits
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_recruit();
