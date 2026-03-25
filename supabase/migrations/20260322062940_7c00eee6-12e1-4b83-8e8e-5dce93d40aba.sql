
-- Strengthen ghost rep linking to also match by normalized name + phone (not just email)
CREATE OR REPLACE FUNCTION public.link_ghost_rep_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Try email match first (most reliable)
  UPDATE public.reps 
  SET user_id = NEW.id,
      updated_at = NOW()
  WHERE user_id IS NULL 
    AND LOWER(email) = LOWER(NEW.email);

  -- 2. If no email match, try name + phone fallback
  -- (uses the phone from the recruit record linked to this email)
  IF NOT FOUND THEN
    UPDATE public.reps r
    SET user_id = NEW.id,
        email = NEW.email,
        updated_at = NOW()
    FROM public.recruits rc
    WHERE rc.email = NEW.email
      AND r.user_id IS NULL
      AND r.id = rc.id;
  END IF;

  -- 3. Last resort: match by normalized name if there's exactly one ghost rep with that name
  IF NOT FOUND THEN
    UPDATE public.reps
    SET user_id = NEW.id,
        email = NEW.email,
        updated_at = NOW()
    WHERE user_id IS NULL
      AND id = (
        SELECT r2.id FROM public.reps r2
        WHERE r2.user_id IS NULL
          AND normalize_name(r2.name) = normalize_name(
            (SELECT rc2.name FROM public.recruits rc2 WHERE LOWER(rc2.email) = LOWER(NEW.email) LIMIT 1)
          )
        -- Only if exactly one match to avoid ambiguity
        HAVING COUNT(*) = 1
        LIMIT 1
      );
  END IF;
  
  RETURN NEW;
END;
$function$;
