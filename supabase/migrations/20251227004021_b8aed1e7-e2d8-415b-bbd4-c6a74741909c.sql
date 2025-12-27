-- Create function to link rep to existing auth user
CREATE OR REPLACE FUNCTION public.link_rep_to_existing_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _auth_user_id uuid;
BEGIN
  -- Only proceed if:
  -- 1. Rep has no user_id
  -- 2. Rep has an email
  -- 3. This is an INSERT, or an UPDATE where email changed or user_id was null
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
    -- Look for existing auth user with this email
    SELECT id INTO _auth_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;
    
    -- If found, link the rep to this user
    IF _auth_user_id IS NOT NULL THEN
      NEW.user_id := _auth_user_id;
      NEW.updated_at := NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger that fires BEFORE insert or update on reps
DROP TRIGGER IF EXISTS link_rep_to_existing_user_trigger ON public.reps;
CREATE TRIGGER link_rep_to_existing_user_trigger
  BEFORE INSERT OR UPDATE ON public.reps
  FOR EACH ROW
  EXECUTE FUNCTION public.link_rep_to_existing_user();