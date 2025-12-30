-- Add unique constraint on blitz_id and rep_id for upsert operations
ALTER TABLE public.blitz_invites 
ADD CONSTRAINT blitz_invites_blitz_id_rep_id_key UNIQUE (blitz_id, rep_id);