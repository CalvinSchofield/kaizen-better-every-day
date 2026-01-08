-- Allow creating Group Total incentives
ALTER TABLE public.incentives
  DROP CONSTRAINT IF EXISTS incentives_target_type_check;

ALTER TABLE public.incentives
  ADD CONSTRAINT incentives_target_type_check
  CHECK (target_type = ANY (ARRAY['first_to'::text, 'most_by_end'::text, 'group_total'::text]));
