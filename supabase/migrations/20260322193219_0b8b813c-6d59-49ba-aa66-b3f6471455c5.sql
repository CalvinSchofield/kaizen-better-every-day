
ALTER TABLE public.invite_codes 
ADD COLUMN invite_type text NOT NULL DEFAULT 'downline',
ADD COLUMN target_mgmt_group_id uuid REFERENCES public.mgmt_groups(id),
ADD COLUMN target_team_id uuid REFERENCES public.teams(id);

COMMENT ON COLUMN public.invite_codes.invite_type IS 'downline = standard recruit invite, lateral = peer/upline invite (no auto-recruiter assignment)';
