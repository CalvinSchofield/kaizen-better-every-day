
ALTER TABLE public.sr_mgmt_groups ADD COLUMN region_id UUID REFERENCES public.regions(id);
