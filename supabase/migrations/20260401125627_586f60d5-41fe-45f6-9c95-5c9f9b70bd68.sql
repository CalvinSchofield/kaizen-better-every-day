
-- Add pending_lead_recruit_id to teams, mgmt_groups, and sr_mgmt_groups
ALTER TABLE public.teams ADD COLUMN pending_lead_recruit_id uuid REFERENCES public.recruits(id) ON DELETE SET NULL;
ALTER TABLE public.mgmt_groups ADD COLUMN pending_lead_recruit_id uuid REFERENCES public.recruits(id) ON DELETE SET NULL;
ALTER TABLE public.sr_mgmt_groups ADD COLUMN pending_lead_recruit_id uuid REFERENCES public.recruits(id) ON DELETE SET NULL;

-- Update auto_assign_ghost_leader trigger to also check pending_lead_recruit_id
CREATE OR REPLACE FUNCTION public.auto_assign_ghost_leader()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  clean_name text;
BEGIN
  -- Only trigger when user_id changes from NULL to a value
  IF OLD.user_id IS NOT NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  clean_name := trim(NEW.name);

  -- 1. Check pending_lead_recruit_id (deterministic match by recruit ID)
  UPDATE teams
  SET lead_user_id = NEW.user_id, pending_lead_recruit_id = NULL
  WHERE pending_lead_recruit_id = NEW.id AND lead_user_id IS NULL;

  UPDATE mgmt_groups
  SET lead_user_id = NEW.user_id, pending_lead_recruit_id = NULL
  WHERE pending_lead_recruit_id = NEW.id AND lead_user_id IS NULL;

  UPDATE sr_mgmt_groups
  SET lead_user_id = NEW.user_id, pending_lead_recruit_id = NULL
  WHERE pending_lead_recruit_id = NEW.id AND lead_user_id IS NULL;

  -- 2. Fallback: name-based matching (original behavior)
  UPDATE teams
  SET lead_user_id = NEW.user_id
  WHERE lead_user_id IS NULL
    AND pending_lead_recruit_id IS NULL
    AND trim(name) ILIKE clean_name;

  UPDATE mgmt_groups
  SET lead_user_id = NEW.user_id
  WHERE lead_user_id IS NULL
    AND pending_lead_recruit_id IS NULL
    AND trim(name) ILIKE clean_name;

  RETURN NEW;
END;
$function$;
