
-- When a ghost rep gets linked to an auth account (user_id goes from NULL to a value),
-- auto-assign them as lead of any team/mgmt_group that matches their name
CREATE OR REPLACE FUNCTION public.auto_assign_ghost_leader()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_name text;
BEGIN
  -- Only trigger when user_id changes from NULL to a value
  IF OLD.user_id IS NOT NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  clean_name := trim(NEW.name);

  -- Auto-assign as team lead if team name matches and has no leader
  UPDATE teams
  SET lead_user_id = NEW.user_id
  WHERE lead_user_id IS NULL
    AND trim(name) ILIKE clean_name;

  -- Auto-assign as mgmt group lead if group name matches and has no leader
  UPDATE mgmt_groups
  SET lead_user_id = NEW.user_id
  WHERE lead_user_id IS NULL
    AND trim(name) ILIKE clean_name;

  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicate
DROP TRIGGER IF EXISTS trg_auto_assign_ghost_leader ON public.reps;

CREATE TRIGGER trg_auto_assign_ghost_leader
  AFTER UPDATE ON public.reps
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_ghost_leader();
