-- Drop the foreign key constraints on blitz_invites and blitz_declines
-- These tables should reference the unified ID from recruits, not require a reps record
ALTER TABLE public.blitz_invites DROP CONSTRAINT IF EXISTS blitz_invites_rep_id_fkey;
ALTER TABLE public.blitz_declines DROP CONSTRAINT IF EXISTS blitz_declines_rep_id_fkey;

-- Clean up legacy Notion blitz IDs that don't match any current blitz UUID
-- First, delete orphaned blitz_invites with Notion-style IDs
DELETE FROM public.blitz_invites 
WHERE blitz_id NOT IN (SELECT id::text FROM public.blitzes);

-- Delete orphaned blitz_declines with Notion-style IDs
DELETE FROM public.blitz_declines 
WHERE blitz_id NOT IN (SELECT id::text FROM public.blitzes);

-- Fix mismatched IDs for Levi Naylor and Abi Cunningham in reps table
-- Update their reps records to use the recruit ID (unified ID)
UPDATE public.reps SET id = '443e2a93-a812-4c0a-add9-9d7ac3686957' WHERE id = '4cfbe42b-c6e1-445f-9efd-54890ae774e2';
UPDATE public.reps SET id = 'd4c3579a-7ae7-4d86-9d70-63e1a93dded0' WHERE id = 'af34f2e3-b367-409d-9a19-b884a1de2ff6';