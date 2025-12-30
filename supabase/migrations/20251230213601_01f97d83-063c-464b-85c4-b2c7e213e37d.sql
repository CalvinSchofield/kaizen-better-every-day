-- Add unique constraint on blitz_id and rep_id for upsert operations in blitz_declines
ALTER TABLE public.blitz_declines 
ADD CONSTRAINT blitz_declines_blitz_id_rep_id_key UNIQUE (blitz_id, rep_id);